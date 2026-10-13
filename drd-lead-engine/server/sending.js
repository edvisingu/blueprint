/* The send path. Dry-run unless explicitly armed and explicitly configured.
 *
 * Design notes, each one a direct response to a documented failure in a
 * competing product (see reports/Smartlead feature gap analysis.md):
 *
 *   SINGLE BUDGET AUTHORITY. A mailbox's daily cap is counted in exactly one
 *   place — countSentToday() reading the sends table. Competing tools split a
 *   cap across campaigns and then reconcile, which is how a cap gets quietly
 *   exceeded or a campaign quietly starved.
 *
 *   CORRECT DENOMINATOR. bounceRate() divides bounces by messages actually
 *   SENT in a rolling window. Smartlead's documented formula divides by total
 *   lead count, which on a large list makes the figure useless as an early
 *   brake: 50 bounces out of 50 sent reads as 0.5% against a 10,000-row list.
 *
 *   NO SILENT SKIPS. Every send that does not happen is written to the sends
 *   table with state='SKIPPED' and a machine-readable skip_reason. The densest
 *   complaint cluster across every review platform in the research was silent
 *   failure: mailboxes disconnecting, campaigns not triggering, nobody told.
 *
 *   WARN BEFORE PAUSE. Crossing a warn threshold raises an alert; crossing the
 *   pause threshold stops the mailbox AND raises a critical alert. A pause the
 *   operator learns about by noticing low volume is a defect, not a feature.
 *
 * NOT LEGAL ADVICE. The footer requirements implement our reading of CASL and
 * are pending qualified Canadian legal review.
 */
"use strict";

const crypto = require("crypto");
const consent = require("./consent");
const { id } = require("./db");

const DAY = 86400000;

/* Thresholds. Deliberately conservative: the cost of sending too slowly is
 * small, the cost of a burned domain is months. */
const LIMITS = {
  bounceWarnPct: 2,
  bouncePausePct: 4,
  complaintWarnPct: 0.1,
  complaintPausePct: 0.3,
  // Rolling window over which rates are computed, and the minimum number of
  // sends before a rate is allowed to trigger anything. Without a floor, one
  // bounce out of two sends reads as 50% and pauses a healthy mailbox.
  windowDays: 7,
  minSendsForRate: 20,
};

// ---------------------------------------------------------------- alerts
/* Raise or re-raise an alert. Deduplicates on (kind, subject) and counts
 * repeats, so a recurring failure is one row with a count rather than a
 * thousand rows nobody reads. */
function raise(db, orgId, kind, severity, subject, detail) {
  const now = Date.now();
  const existing = db
    .prepare("SELECT id, count, state FROM alerts WHERE org_id=? AND kind=? AND subject=?")
    .get(orgId, kind, subject);
  if (existing) {
    db.prepare("UPDATE alerts SET count=count+1, last_at=?, state=CASE WHEN state='RESOLVED' THEN 'OPEN' ELSE state END, detail=?, severity=? WHERE id=?")
      .run(now, detail || null, severity, existing.id);
    return existing.id;
  }
  const aid = id("al");
  db.prepare(
    "INSERT INTO alerts (id,org_id,kind,severity,subject,detail,state,count,first_at,last_at)" +
      " VALUES (?,?,?,?,?,?,'OPEN',1,?,?)"
  ).run(aid, orgId, kind, severity, subject, detail || null, now, now);
  return aid;
}

function openAlerts(db, orgId) {
  return db
    .prepare("SELECT * FROM alerts WHERE org_id=? AND state!='RESOLVED' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warn' THEN 1 ELSE 2 END, last_at DESC")
    .all(orgId);
}

// ------------------------------------------------------- budget authority
/* The ONLY place a mailbox's daily usage is computed. Counts real sends in
 * the mailbox's own calendar day, in the mailbox's own timezone. */
function countSentToday(db, mailboxId, now) {
  const mb = db.prepare("SELECT timezone FROM mailboxes WHERE id=?").get(mailboxId);
  const at = now || Date.now();
  // Day boundary in the mailbox's timezone. Falls back to UTC on a bad zone
  // rather than throwing, because a typo in a timezone must not stop sending
  // silently — it raises an alert at preflight instead.
  let dayStart;
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: (mb && mb.timezone) || "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const parts = fmt.format(new Date(at)); // YYYY-MM-DD
    dayStart = Date.parse(parts + "T00:00:00Z");
    // Correct for the zone's offset so the boundary is local midnight.
    const probe = new Date(at);
    const localised = new Date(probe.toLocaleString("en-US", { timeZone: (mb && mb.timezone) || "UTC" }));
    const offset = probe.getTime() - localised.getTime();
    dayStart += offset;
  } catch (e) {
    dayStart = at - (at % DAY);
  }
  // Only SENT counts against a cap. DRAFTED does not: a draft consumes no
  // sending reputation and reaches nobody until a human sends it.
  return db
    .prepare("SELECT COUNT(*) n FROM sends WHERE mailbox_id=? AND state='SENT' AND attempted_at >= ?")
    .get(mailboxId, dayStart).n;
}

function lastSendAt(db, mailboxId) {
  const r = db
    .prepare("SELECT MAX(attempted_at) t FROM sends WHERE mailbox_id=? AND state='SENT'")
    .get(mailboxId);
  return (r && r.t) || 0;
}

/* Rates over a rolling window, with a sample floor. */
function rates(db, mailboxId, now) {
  const at = now || Date.now();
  const since = at - LIMITS.windowDays * DAY;
  const row = db
    .prepare(
      "SELECT" +
        " SUM(CASE WHEN state IN ('SENT','BOUNCED','COMPLAINED') THEN 1 ELSE 0 END) sent," +
        " SUM(CASE WHEN state='BOUNCED' THEN 1 ELSE 0 END) bounced," +
        " SUM(CASE WHEN state='COMPLAINED' THEN 1 ELSE 0 END) complained" +
        " FROM sends WHERE mailbox_id=? AND attempted_at >= ?"
    )
    .get(mailboxId, since);
  const sent = (row && row.sent) || 0;
  const bounced = (row && row.bounced) || 0;
  const complained = (row && row.complained) || 0;
  return {
    sent, bounced, complained,
    // Denominator is messages sent, not list size. See header note.
    bouncePct: sent ? (bounced / sent) * 100 : 0,
    complaintPct: sent ? (complained / sent) * 100 : 0,
    // Below the floor, rates are reported but must not gate anything.
    actionable: sent >= LIMITS.minSendsForRate,
  };
}

/* Check health and pause the mailbox if it has crossed a hard threshold.
 * Always raises an alert on any threshold crossing. */
function enforceHealth(db, orgId, mailboxId, now) {
  const r = rates(db, mailboxId, now);
  const mb = db.prepare("SELECT address, status FROM mailboxes WHERE id=?").get(mailboxId);
  if (!mb || !r.actionable) return { paused: false, rates: r };

  const pause = (what, pct, limit) => {
    db.prepare("UPDATE mailboxes SET status='Paused', pause_reason=? WHERE id=?")
      .run(what + " " + pct.toFixed(2) + "% over " + limit + "%", mailboxId);
    raise(db, orgId, "mailbox_paused", "critical", mb.address,
      what + " rate " + pct.toFixed(2) + "% exceeded the " + limit + "% pause threshold over " +
      LIMITS.windowDays + " days (" + r.sent + " sent). Sending stopped for this mailbox.");
    return { paused: true, rates: r, reason: what };
  };
  if (r.bouncePct >= LIMITS.bouncePausePct) return pause("Bounce", r.bouncePct, LIMITS.bouncePausePct);
  if (r.complaintPct >= LIMITS.complaintPausePct) return pause("Complaint", r.complaintPct, LIMITS.complaintPausePct);

  if (r.bouncePct >= LIMITS.bounceWarnPct) {
    raise(db, orgId, "bounce_rate_warn", "warn", mb.address,
      "Bounce rate " + r.bouncePct.toFixed(2) + "% over " + r.sent + " sends is above the " +
      LIMITS.bounceWarnPct + "% warning line; pause is at " + LIMITS.bouncePausePct + "%.");
  }
  if (r.complaintPct >= LIMITS.complaintWarnPct) {
    raise(db, orgId, "complaint_rate_warn", "warn", mb.address,
      "Complaint rate " + r.complaintPct.toFixed(3) + "% over " + r.sent + " sends is above the " +
      LIMITS.complaintWarnPct + "% warning line.");
  }
  return { paused: false, rates: r };
}

// ------------------------------------------------------------- unsubscribe
function unsubToken(db, orgId, contactId) {
  const existing = db
    .prepare("SELECT token FROM unsubscribe_tokens WHERE contact_id=? AND used_at IS NULL")
    .get(contactId);
  if (existing) return existing.token;
  const token = crypto.randomBytes(24).toString("base64url");
  db.prepare("INSERT INTO unsubscribe_tokens (token,org_id,contact_id,created_at) VALUES (?,?,?,?)")
    .run(token, orgId, contactId, Date.now());
  return token;
}

/* Honour an unsubscribe. Writes an org-wide suppression, so one request
 * covers every brand — the behaviour Smartlead's own docs say theirs lacks. */
function unsubscribe(db, orgId, token) {
  const row = db.prepare("SELECT * FROM unsubscribe_tokens WHERE token=?").get(token);
  if (!row) return { ok: false, error: "unknown_token" };
  const c = db.prepare("SELECT id,email FROM contacts WHERE id=?").get(row.contact_id);
  if (!c || !c.email) return { ok: false, error: "contact_missing" };
  const now = Date.now();
  db.prepare("UPDATE unsubscribe_tokens SET used_at=? WHERE token=?").run(now, token);
  // Org-wide, immediate. CASL allows up to 10 business days; honouring at
  // once removes a whole class of timing failure.
  try {
    db.prepare(
      "INSERT INTO suppressions (id,org_id,type,value,reason,scope,created_at,channel,honored_at)" +
        " VALUES (?,?,'Person',?,?,'Global',?,'email',?)"
    ).run(id("sup"), orgId, c.email, "Unsubscribed", now, now);
  } catch (e) {
    // UNIQUE(org_id,value) — already suppressed, which is success.
  }
  db.prepare("UPDATE consents SET revoked_at=?, revoke_reason='unsubscribed' WHERE contact_id=? AND revoked_at IS NULL")
    .run(now, c.id);
  db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
    .run(id("au"), orgId, "recipient", "unsubscribe", c.email + " suppressed org-wide", now);
  return { ok: true, email: c.email, at: now };
}

/* The footer CASL requires: who is writing, a mailing address, contact
 * details, and a working unsubscribe. Refuses to build if the org has not
 * supplied identification — the readiness gate surfaces that before arming. */
function footer(org, unsubUrl) {
  const missing = [];
  if (!org.legal_name) missing.push("legal_name");
  if (!org.mailing_address) missing.push("mailing_address");
  if (!org.contact_email && !org.contact_phone) missing.push("contact_email or contact_phone");
  if (missing.length) return { ok: false, missing };
  const lines = [
    "",
    "--",
    org.legal_name,
    org.mailing_address,
    [org.contact_email, org.contact_phone].filter(Boolean).join(" · "),
    "",
    "Don't want these emails? Unsubscribe here: " + unsubUrl,
    "(That link asks you to confirm. One click, and you are removed from every list we operate.)",
  ];
  return { ok: true, text: lines.join("\n"), unsubUrl };
}

/* Headers for RFC 8058 one-click unsubscribe. Gmail and Microsoft bulk-sender
 * guidance expects both, and List-Unsubscribe alone does not satisfy it. */
function unsubHeaders(unsubUrl) {
  return {
    "List-Unsubscribe": "<" + unsubUrl + ">",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

// ------------------------------------------------------------- transports
/* A transport is {name, send(msg) -> {ok, id?, error?}}. The default does
 * nothing and says so. Real transports are registered by the operator with
 * credentials from the environment; none ship in this repo. */
const transports = {
  dryrun: {
    name: "dryrun",
    send: () => ({ ok: true, id: "dryrun-" + crypto.randomBytes(6).toString("hex"), dryRun: true }),
  },
};

function registerTransport(name, impl) {
  if (!impl || typeof impl.send !== "function") throw new Error("transport needs a send(msg) function");
  transports[name] = { name, ...impl };
}

/* Register the Gmail transports when Workspace credentials are present.
 *
 * Both modes are registered so a mailbox can choose per-mailbox: one brand can
 * be drafting while another sends. Absent credentials, neither is registered
 * and a mailbox configured for them falls back to dryrun, which the readiness
 * gate reports rather than hiding.
 *
 * "gmail-draft" writes a Gmail draft and delivers nothing. For a first campaign
 * that is the right posture — an accidental send becomes structurally
 * impossible rather than merely against policy.
 */
function registerGmail() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return [];
  let gmail;
  try { gmail = require("./transports/gmail.js"); } catch (e) { return []; }
  const registered = [];
  for (const mode of ["draft", "send"]) {
    const t = gmail.createTransport({ mode });
    registerTransport("gmail-" + mode, t);
    registered.push("gmail-" + mode);
  }
  return registered;
}
registerGmail();

// ----------------------------------------------------------------- queue
/* Decide, for one contact in one campaign, whether a send may happen now.
 * Returns {allow:true, mailbox} or {allow:false, reason, detail}.
 *
 * Every rejection reason is a stable key so the skip report can group them. */
function canSend(db, orgId, contactId, campaignId, now, brandId) {
  const at = now || Date.now();
  const org = db.prepare("SELECT * FROM organizations WHERE id=?").get(orgId);
  if (!org) return { allow: false, reason: "org_not_found" };

  // Arming is a deliberate, separate switch from configuration.
  if (!org.send_armed) {
    return { allow: false, reason: "not_armed", detail: "Sending is disarmed; nothing will be delivered" };
  }

  const elig = consent.eligibility(db, contactId, at, brandId);
  if (!elig.eligible) return { allow: false, reason: elig.reason, detail: elig.detail };

  const mailboxes = db
    .prepare("SELECT * FROM mailboxes WHERE org_id=? AND status='Active' ORDER BY id")
    .all(orgId);
  if (!mailboxes.length) return { allow: false, reason: "no_active_mailbox" };

  // Pick the eligible mailbox with the most headroom; skip ones at cap or
  // inside their minimum gap. Reasons are reported if none qualifies.
  let best = null, blocked = [];
  for (const mb of mailboxes) {
    const used = countSentToday(db, mb.id, at);
    if (used >= mb.daily_cap) { blocked.push("cap"); continue; }
    const gap = at - lastSendAt(db, mb.id);
    if (gap < mb.min_gap_seconds * 1000) { blocked.push("gap"); continue; }
    const headroom = mb.daily_cap - used;
    if (!best || headroom > best.headroom) best = { mb, headroom };
  }
  if (!best) {
    return {
      allow: false,
      reason: blocked.includes("cap") && !blocked.includes("gap") ? "all_mailboxes_at_cap" : "mailbox_throttled",
      detail: blocked.length + " mailbox(es) unavailable: " + blocked.join(", "),
    };
  }
  return { allow: true, mailbox: best.mb, basis: elig.basis, consentId: elig.consentId };
}

/* Record and (if allowed) perform one send. ALWAYS writes a row: a skip is
 * data, not an absence. Returns the sends row. */
function send(db, orgId, { contactId, campaignId, step, subject, body, brandId }, opts) {
  const at = (opts && opts.now) || Date.now();
  const sid = id("sn");
  const decision = canSend(db, orgId, contactId, campaignId, at, brandId);

  if (!decision.allow) {
    db.prepare(
      "INSERT INTO sends (id,org_id,campaign_id,contact_id,mailbox_id,step,state,skip_reason,subject,dry_run,queued_at,settled_at)" +
        " VALUES (?,?,?,?,NULL,?,'SKIPPED',?,?,1,?,?)"
    ).run(sid, orgId, campaignId || null, contactId, step || 0, decision.reason, subject || null, at, at);
    return { id: sid, state: "SKIPPED", skip_reason: decision.reason, detail: decision.detail };
  }

  const org = db.prepare("SELECT * FROM organizations WHERE id=?").get(orgId);
  const mb = decision.mailbox;
  const transport = transports[mb.provider] || transports.dryrun;
  const dryRun = transport.name === "dryrun";

  // Footer and unsubscribe are not optional and not the caller's choice.
  const base = process.env.DRD_PUBLIC_URL || "https://example.invalid";
  const unsubUrl = base.replace(/\/$/, "") + "/u/" + unsubToken(db, orgId, contactId);
  const f = footer(org, unsubUrl);
  if (!f.ok) {
    db.prepare(
      "INSERT INTO sends (id,org_id,campaign_id,contact_id,mailbox_id,step,state,skip_reason,subject,dry_run,queued_at,settled_at)" +
        " VALUES (?,?,?,?,?,?,'SKIPPED','missing_sender_identification',?,1,?,?)"
    ).run(sid, orgId, campaignId || null, contactId, mb.id, step || 0, subject || null, at, at);
    raise(db, orgId, "missing_identification", "critical", "organization",
      "Cannot send: " + f.missing.join(", ") + " not set. Every message must identify the sender and give a mailing address.");
    return { id: sid, state: "SKIPPED", skip_reason: "missing_sender_identification", missing: f.missing };
  }

  const fullBody = (body || "") + f.text;
  db.prepare(
    "INSERT INTO sends (id,org_id,campaign_id,contact_id,mailbox_id,step,state,subject,body,dry_run,consent_id,brand_id,queued_at,attempted_at)" +
      " VALUES (?,?,?,?,?,?,'QUEUED',?,?,?,?,?,?,?)"
  ).run(sid, orgId, campaignId || null, contactId, mb.id, step || 0, subject || null, fullBody,
    dryRun ? 1 : 0, decision.consentId || null, brandId || null, at, at);

  const contact = db.prepare("SELECT email,name FROM contacts WHERE id=?").get(contactId);
  let res;
  try {
    res = transport.send({
      from: mb.address, fromName: mb.display_name,
      to: contact.email, toName: contact.name,
      subject, body: fullBody,
      headers: unsubHeaders(unsubUrl),
    });
  } catch (e) {
    res = { ok: false, error: e.message };
  }

  if (res && res.ok) {
    // A draft is NOT a delivery. It is recorded as DRAFTED so no dashboard,
    // rate calculation or cap counts it as mail that went out: a drafted
    // message that is never opened has reached nobody.
    const drafted = res.draft === true;
    const state = drafted ? "DRAFTED" : "SENT";
    // Store both identifiers now: replies.js matches an incoming reply on the
    // thread id first and the Message-ID second, and neither can be recovered
    // after the fact.
    db.prepare("UPDATE sends SET state=?, provider_message_id=?, provider_thread_id=?, rfc_message_id=?, settled_at=? WHERE id=?")
      .run(state, res.id || null, res.threadId || null, res.rfcMessageId || null, Date.now(), sid);
    if (!drafted) enforceHealth(db, orgId, mb.id, at);
    return { id: sid, state, dryRun, drafted, mailbox: mb.address, messageId: res.id,
      threadId: res.threadId };
  }
  db.prepare("UPDATE sends SET state='FAILED', error=?, settled_at=? WHERE id=?")
    .run((res && res.error) || "unknown", Date.now(), sid);
  raise(db, orgId, "send_failed", "warn", mb.address, "Send failed: " + ((res && res.error) || "unknown"));
  return { id: sid, state: "FAILED", error: (res && res.error) || "unknown" };
}

/* Record a bounce or complaint reported by the transport/provider. */
function settle(db, orgId, sendId, outcome, detail) {
  const allowed = { BOUNCED: 1, COMPLAINED: 1, UNSUBSCRIBED: 1 };
  if (!allowed[outcome]) return { ok: false, error: "bad_outcome" };
  const row = db.prepare("SELECT * FROM sends WHERE id=? AND org_id=?").get(sendId, orgId);
  if (!row) return { ok: false, error: "unknown_send" };
  db.prepare("UPDATE sends SET state=?, error=?, settled_at=? WHERE id=?")
    .run(outcome, detail || null, Date.now(), sendId);

  // A hard bounce or a complaint suppresses the address immediately. Leaving
  // this to a nightly job is how a bad address gets mailed three more times.
  if (outcome === "BOUNCED" || outcome === "COMPLAINED") {
    const c = db.prepare("SELECT email FROM contacts WHERE id=?").get(row.contact_id);
    if (c && c.email) {
      try {
        db.prepare(
          "INSERT INTO suppressions (id,org_id,type,value,reason,scope,created_at,channel,honored_at)" +
            " VALUES (?,?,'Person',?,?,'Global',?,'email',?)"
        ).run(id("sup"), orgId, c.email, outcome === "BOUNCED" ? "Hard bounce" : "Spam complaint",
          Date.now(), Date.now());
      } catch (e) { /* already suppressed */ }
    }
  }
  if (row.mailbox_id) enforceHealth(db, orgId, row.mailbox_id, Date.now());
  return { ok: true };
}

/* Skip report: why sends did not happen, grouped. The thing whose absence
 * causes "why is my campaign not sending" in every competing tool. */
function skipReport(db, orgId, sinceMs) {
  const since = sinceMs || Date.now() - 7 * DAY;
  return db
    .prepare(
      "SELECT skip_reason reason, COUNT(*) n FROM sends" +
        " WHERE org_id=? AND state='SKIPPED' AND queued_at >= ?" +
        " GROUP BY skip_reason ORDER BY n DESC"
    )
    .all(orgId, since);
}

module.exports = {
  LIMITS, registerGmail, raise, openAlerts, countSentToday, lastSendAt, rates, enforceHealth,
  unsubToken, unsubscribe, footer, unsubHeaders, transports, registerTransport,
  canSend, send, settle, skipReport,
};
