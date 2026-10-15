/* The sequence executor. Turns a campaign definition into timed sends.
 *
 * Driven entirely by the job runner, so a sequence survives a restart: each
 * lead's next step is a queued job with an idempotency key, not an entry in an
 * in-memory timer that vanishes when the process dies.
 *
 * Five rules, each one a failure mode seen in the research or in the wild:
 *
 *   1. AN UNRESOLVED MERGE FIELD IS A HARD STOP. A message that renders
 *      "Hi {{first_name}}," is worse than no message: it tells the recipient
 *      they are row 400 in a spreadsheet. Rendering collects every unresolved
 *      variable and the send is skipped with that reason rather than sent.
 *
 *   2. A REPLY ENDS THE SEQUENCE. Checked immediately before each step, not on
 *      a nightly sweep, because the embarrassing failure is a follow-up that
 *      lands after someone has already answered.
 *
 *   3. ONE STEP PER LEAD PER CAMPAIGN, EVER. The idempotency key is
 *      campaign + lead + step, enforced by a unique index. Two workers, a
 *      retry, or a double tick cannot produce two copies of step 2.
 *
 *   4. A SEND WINDOW, IN THE MAILBOX'S OWN TIMEZONE. An athletic director
 *      receiving a pitch at 02:40 knows it was automated. Outside the window
 *      the step is deferred, not dropped.
 *
 *   5. EVERY DECISION IS RECORDED. Deferred, skipped, exited, sent — each one
 *      writes a row. "Why did this lead stop getting emails" must be
 *      answerable from the database.
 *
 * Consent, suppression, caps and identification are NOT re-implemented here.
 * They live in sending.send(), which this calls, so there is exactly one gate.
 */
"use strict";

const { id } = require("./db");

const HOUR = 3600000;
const DAY = 24 * HOUR;

/* ----------------------------------------------------------- templating */

/* Render {{variable}} against a context.
 *
 * Returns {text, missing[], used[]}. `missing` is what the caller must treat
 * as fatal. Supports {{var|fallback}} for genuinely optional fields, because
 * the alternative is operators leaving a variable out of the template
 * entirely and losing the personalisation.
 */
function render(template, vars) {
  const missing = [], used = [];
  const text = String(template == null ? "" : template).replace(
    /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|\s*([^}]*?)\s*)?\}\}/g,
    (whole, name, fallback) => {
      const value = name.split(".").reduce((o, k) => (o == null ? undefined : o[k]), vars);
      const present = value !== undefined && value !== null && String(value).trim() !== "";
      if (present) { used.push(name); return String(value); }
      if (fallback !== undefined) { used.push(name + "|fallback"); return fallback; }
      missing.push(name);
      return whole;   // left visible so the skip reason can quote it
    }
  );
  return { text, missing, used };
}

/* The variables available to a template, assembled from the contact, company
 * and brand. Kept deliberately small and explicit: a template can only use
 * what is listed, so a typo surfaces as a missing variable rather than
 * silently rendering empty. */
function contextFor(db, contactId, brandId) {
  const c = db
    .prepare(
      "SELECT ct.*, co.name company_name, co.domain company_domain, co.city company_city," +
        " co.region company_region, co.country company_country, co.industry, co.sub, co.size" +
        " FROM contacts ct LEFT JOIN companies co ON co.id = ct.company_id WHERE ct.id = ?"
    )
    .get(contactId);
  if (!c) return null;
  const first = String(c.name || "").trim().split(/\s+/)[0] || "";
  const last = String(c.name || "").trim().split(/\s+/).slice(1).join(" ");
  return {
    first_name: first,
    last_name: last,
    full_name: c.name,
    title: c.title,
    email: c.email,
    company: c.company_name,
    domain: c.company_domain,
    city: c.company_city,
    region: c.company_region,
    country: c.company_country,
    industry: c.industry,
    category: c.sub,
    staff: c.size,
    brand: brandId || "",
  };
}

/* -------------------------------------------------------- the definition */

/* A sequence is an array of steps:
 *   { step: 1, subject: "...", body: "...", delayHours: 0 }
 * delayHours is measured from the PREVIOUS step's send, not from enrolment,
 * so a pause in the middle does not compress everything after it.
 */
function validateSequence(seq) {
  const errors = [];
  if (!Array.isArray(seq) || seq.length === 0) {
    return ["sequence must be a non-empty array of steps"];
  }
  seq.forEach((s, i) => {
    const n = "step " + (i + 1);
    if (!s.subject || !String(s.subject).trim()) errors.push(n + ": subject is required");
    if (!s.body || !String(s.body).trim()) errors.push(n + ": body is required");
    if (i === 0 && s.delayHours) errors.push("step 1 must have no delay (it is the first contact)");
    if (i > 0 && (!s.delayHours || s.delayHours < 1)) {
      errors.push(n + ": needs delayHours of at least 1 — a same-moment follow-up reads as a bug");
    }
    // A sequence longer than this stops being outreach.
    if (i >= 6) errors.push("sequences longer than 6 steps are refused: past that it is harassment, not follow-up");
  });
  return errors;
}

/* Check every template in a sequence against one real contact, so a broken
 * merge field is found at setup rather than at send time. */
function dryRunSequence(db, seq, contactId, brandId) {
  const ctx = contextFor(db, contactId, brandId);
  if (!ctx) return { ok: false, error: "contact_not_found" };
  const issues = [];
  seq.forEach((s, i) => {
    const subj = render(s.subject, ctx);
    const body = render(s.body, ctx);
    const missing = [...new Set([...subj.missing, ...body.missing])];
    if (missing.length) issues.push({ step: i + 1, missing });
  });
  return { ok: issues.length === 0, issues, available: Object.keys(ctx) };
}

/* ------------------------------------------------------------ send window */

/* Is `at` inside the window, in `tz`? Pure predicate, no searching.
 *
 * Factored out deliberately: an earlier version had windowCheck() recurse into
 * itself while searching for the next opening, so each nested call ran the
 * same 192-iteration search again. That is exponential, and it hung the test
 * suite rather than failing it — the worst kind of bug, because it looks like
 * slowness. The search below calls this, never itself.
 */
function isInside(w, tz, at) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC", weekday: "short", hour: "numeric", hour12: false,
    }).formatToParts(new Date(at));
  } catch (e) {
    return null;   // invalid timezone — caller decides, and must not send
  }
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  const dayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday];
  const hour = Number(map.hour) % 24;
  return w.days.includes(dayIndex) && hour >= w.startHour && hour < w.endHour;
}

/* Is `at` inside the campaign's send window, in the mailbox's timezone?
 * Returns {inside, nextOpen}. Default window: weekdays 08:00-16:00. */
function windowCheck(window, timezone, at) {
  const w = Object.assign({ days: [1, 2, 3, 4, 5], startHour: 8, endHour: 16 }, window || {});
  const tz = timezone || "UTC";

  const inside = isInside(w, tz, at);
  if (inside === null) {
    // An invalid timezone must not silently send at the wrong hour. The
    // readiness gate blocks arming on this, so treat the window as closed and
    // re-check in an hour rather than guessing.
    return { inside: false, nextOpen: at + HOUR, reason: "invalid_timezone" };
  }
  if (inside) return { inside: true };

  // Walk forward hour by hour to the next opening. Bounded at eight days,
  // which covers any weekday-plus-hours window including a holiday gap.
  for (let i = 1; i <= 24 * 8; i++) {
    const t = at + i * HOUR;
    if (isInside(w, tz, t) === true) return { inside: false, nextOpen: t };
  }
  // A window that never opens is a configuration error, not a reason to send.
  return { inside: false, nextOpen: at + DAY, reason: "window_never_opens" };
}

/* ------------------------------------------------------------- execution */

/* Reasons a lead leaves a sequence before finishing. */
function exitReason(db, orgId, campaignId, contactId) {
  // A reply ends it. Checked against inbound_messages (excluding auto-replies,
  // which are not a reply) and against conversations, so a manually logged
  // reply counts too.
  const replied = db
    .prepare(
      "SELECT COUNT(*) n FROM inbound_messages WHERE org_id=? AND contact_id=? AND auto_reply=0"
    )
    .get(orgId, contactId).n;
  if (replied > 0) return "replied";

  const conv = db
    .prepare("SELECT status FROM conversations WHERE contact_id=? ORDER BY last_at DESC LIMIT 1")
    .get(contactId);
  if (conv && (conv.status === "Replied" || conv.status === "Meeting")) return "replied";

  const meeting = db.prepare("SELECT COUNT(*) n FROM meetings WHERE contact_id=?").get(contactId).n;
  if (meeting > 0) return "meeting_booked";

  // Suppression is checked here too so the sequence stops advancing rather
  // than generating a skipped row at every step forever.
  const sup = db
    .prepare(
      "SELECT 1 FROM suppressions s JOIN contacts c ON c.id=? " +
        "WHERE s.org_id=? AND (s.value = c.email OR (s.type='Domain' AND c.email LIKE '%@'||s.value)) LIMIT 1"
    )
    .get(contactId, orgId);
  if (sup) return "suppressed";

  return null;
}

/* Execute one step for one lead. Called by the job runner.
 *
 * Returns a decision object; never throws for business reasons, because a
 * business reason is data. Throws only on genuine faults, so the runner can
 * retry those.
 */
function runStep(db, orgId, payload, now) {
  const at = now || Date.now();
  const sending = require("./sending.js");
  const runner = require("./runner.js");
  const { campaignId, contactId, step } = payload;

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId);
  if (!campaign) return { decision: "campaign_gone", campaignId };
  if (campaign.status !== "Active") {
    return { decision: "campaign_not_active", status: campaign.status };
  }

  const lead = db
    .prepare("SELECT * FROM campaign_leads WHERE campaign_id=? AND contact_id=?")
    .get(campaignId, contactId);
  if (!lead) return { decision: "lead_not_enrolled" };
  if (lead.status === "Exited" || lead.status === "Done") {
    return { decision: "already_exited", status: lead.status };
  }

  // Rule 2: a reply ends the sequence, checked immediately before sending.
  const exit = exitReason(db, orgId, campaignId, contactId);
  if (exit) {
    db.prepare("UPDATE campaign_leads SET status='Exited', exit_reason=?, exited_at=? WHERE id=?")
      .run(exit, at, lead.id);
    return { decision: "exited", reason: exit };
  }

  let seq = [];
  try { seq = JSON.parse(campaign.sequence_json || "[]"); } catch (e) {}
  const def = seq[step - 1];
  if (!def) {
    db.prepare("UPDATE campaign_leads SET status='Done', exited_at=? WHERE id=?").run(at, lead.id);
    return { decision: "sequence_complete", steps: seq.length };
  }

  // Rule 4: the send window, in the mailbox's timezone.
  const mailbox = db
    .prepare("SELECT * FROM mailboxes WHERE org_id=? AND status='Active' ORDER BY id LIMIT 1")
    .get(orgId);
  let windowCfg = null;
  try { windowCfg = JSON.parse(campaign.send_window_json || "null"); } catch (e) {}
  const wc = windowCheck(windowCfg, mailbox && mailbox.timezone, at);
  if (!wc.inside) {
    // Deferred, not dropped: re-queue for when the window opens. A distinct
    // idempotency key per reschedule, or the duplicate check would block it.
    runner.enqueue(db, orgId, "sequence.step", payload, {
      runAt: wc.nextOpen,
      idempotencyKey: "seq:" + campaignId + ":" + contactId + ":" + step + ":w" + wc.nextOpen,
    });
    return { decision: "deferred_outside_window", nextOpen: wc.nextOpen, reason: wc.reason };
  }

  // Rule 1: an unresolved merge field is a hard stop.
  const ctx = contextFor(db, contactId, campaign.brand_id);
  if (!ctx) return { decision: "contact_gone" };
  const subject = render(def.subject, ctx);
  const body = render(def.body, ctx);
  const missing = [...new Set([...subject.missing, ...body.missing])];
  if (missing.length) {
    db.prepare(
      "INSERT INTO sends (id,org_id,campaign_id,contact_id,step,state,skip_reason,subject,dry_run,queued_at,settled_at,brand_id)" +
        " VALUES (?,?,?,?,?,'SKIPPED','unresolved_template_variable',?,1,?,?,?)"
    ).run(id("sn"), orgId, campaignId, contactId, step, def.subject, at, at, campaign.brand_id || null);
    sending.raise(db, orgId, "template_variable_missing", "warn", campaign.name,
      "Step " + step + " could not render for " + (ctx.email || contactId) + ": no value for " +
      missing.join(", ") + ". No message was sent. Fix the template or the contact record.");
    db.prepare("UPDATE campaign_leads SET status='Blocked' WHERE id=?").run(lead.id);
    return { decision: "blocked_unresolved_variable", missing };
  }

  // Hand to the single gate. Consent, suppression, caps, identification and
  // the footer all happen in there.
  const result = sending.send(db, orgId, {
    contactId, campaignId, step,
    subject: subject.text, body: body.text,
    brandId: campaign.brand_id,
  }, { now: at });

  if (result.state === "SKIPPED") {
    // A transient skip (cap reached, inside the minimum gap) should retry.
    // A terminal one (no consent, suppressed, demo data) should not.
    const TRANSIENT = new Set(["all_mailboxes_at_cap", "mailbox_throttled", "no_active_mailbox"]);
    if (TRANSIENT.has(result.skip_reason)) {
      runner.enqueue(db, orgId, "sequence.step", payload, {
        runAt: at + 2 * HOUR,
        idempotencyKey: "seq:" + campaignId + ":" + contactId + ":" + step + ":r" + Math.floor(at / HOUR),
      });
      return { decision: "retry_later", reason: result.skip_reason };
    }
    db.prepare("UPDATE campaign_leads SET status='Blocked', exit_reason=? WHERE id=?")
      .run(result.skip_reason, lead.id);
    return { decision: "blocked", reason: result.skip_reason };
  }

  // Sent or drafted: advance, and schedule the next step if there is one.
  db.prepare("UPDATE campaign_leads SET status='Active', step=?, last_sent_at=? WHERE id=?")
    .run(step, at, lead.id);
  db.prepare("UPDATE campaigns SET sent=sent+1 WHERE id=?").run(campaignId);

  const next = seq[step];
  let scheduled = null;
  if (next) {
    scheduled = at + (next.delayHours || 72) * HOUR;
    runner.enqueue(db, orgId, "sequence.step", { campaignId, contactId, step: step + 1 }, {
      runAt: scheduled,
      // Rule 3: one step per lead per campaign, ever.
      idempotencyKey: "seq:" + campaignId + ":" + contactId + ":" + (step + 1),
    });
  } else {
    db.prepare("UPDATE campaign_leads SET status='Done' WHERE id=?").run(lead.id);
  }
  return {
    decision: result.state === "DRAFTED" ? "drafted" : "sent",
    sendId: result.id, step, nextStepAt: scheduled,
  };
}

/* Enrol contacts into a campaign and queue their first step.
 *
 * Enrolment is separate from sending so a list can be staged, reviewed and
 * then started. It also refuses obviously wrong input early: demo contacts and
 * contacts with no consent for the brand never get enrolled, so the campaign's
 * lead count means something.
 */
function enrol(db, orgId, campaignId, contactIds, opts) {
  const o = opts || {};
  const at = o.now || Date.now();
  const consent = require("./consent.js");
  const runner = require("./runner.js");
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(campaignId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };

  let seq = [];
  try { seq = JSON.parse(campaign.sequence_json || "[]"); } catch (e) {}
  const seqErrors = validateSequence(seq);
  if (seqErrors.length) return { ok: false, error: "invalid_sequence", errors: seqErrors };

  const enrolled = [], rejected = [];
  for (const contactId of contactIds) {
    const elig = consent.eligibility(db, contactId, at, campaign.brand_id);
    if (!elig.eligible) { rejected.push({ contactId, reason: elig.reason }); continue; }

    // Catch a broken template before enrolling the whole list.
    const dry = dryRunSequence(db, seq, contactId, campaign.brand_id);
    if (!dry.ok) {
      rejected.push({ contactId, reason: "unresolved_template_variable",
        detail: dry.issues.map((i) => "step " + i.step + ": " + i.missing.join(",")).join("; ") });
      continue;
    }

    try {
      db.prepare(
        "INSERT INTO campaign_leads (id,campaign_id,contact_id,status,step,score,added_at) VALUES (?,?,?,'Queued',0,?,?)"
      ).run(id("cl"), campaignId, contactId, o.score || null, at);
    } catch (e) {
      rejected.push({ contactId, reason: "already_enrolled" });
      continue;
    }
    runner.enqueue(db, orgId, "sequence.step", { campaignId, contactId, step: 1 }, {
      runAt: o.startAt || at,
      idempotencyKey: "seq:" + campaignId + ":" + contactId + ":1",
    });
    enrolled.push(contactId);
  }
  db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
    .run(id("au"), orgId, o.actor || "system", "campaign.enrol",
      campaignId + ": " + enrolled.length + " enrolled, " + rejected.length + " rejected", at);
  return {
    ok: true, enrolled: enrolled.length, rejected: rejected.length,
    rejectedByReason: rejected.reduce((m, r) => { m[r.reason] = (m[r.reason] || 0) + 1; return m; }, {}),
    rejectedDetail: rejected.slice(0, 100),
  };
}

/* Per-campaign state, for the UI and for answering "where is everybody". */
function status(db, orgId, campaignId) {
  const byStatus = db
    .prepare("SELECT status, COUNT(*) n FROM campaign_leads WHERE campaign_id=? GROUP BY status")
    .all(campaignId);
  const byExit = db
    .prepare("SELECT exit_reason, COUNT(*) n FROM campaign_leads WHERE campaign_id=? AND exit_reason IS NOT NULL GROUP BY exit_reason")
    .all(campaignId);
  const sends = db
    .prepare("SELECT state, COUNT(*) n FROM sends WHERE campaign_id=? GROUP BY state")
    .all(campaignId);
  const skips = db
    .prepare("SELECT skip_reason, COUNT(*) n FROM sends WHERE campaign_id=? AND state='SKIPPED' GROUP BY skip_reason ORDER BY n DESC")
    .all(campaignId);
  const pending = db
    .prepare("SELECT COUNT(*) n FROM jobs WHERE org_id=? AND kind='sequence.step' AND state='QUEUED' AND payload_json LIKE ?")
    .get(orgId, '%"' + campaignId + '"%').n;
  const replies = db
    .prepare(
      "SELECT COUNT(*) n FROM inbound_messages i JOIN sends s ON s.id=i.send_id" +
        " WHERE s.campaign_id=? AND i.auto_reply=0"
    )
    .get(campaignId).n;
  const sent = sends.filter((s) => s.state === "SENT").reduce((a, s) => a + s.n, 0);
  return {
    leadsByStatus: byStatus.reduce((m, r) => { m[r.status] = r.n; return m; }, {}),
    exits: byExit.reduce((m, r) => { m[r.exit_reason] = r.n; return m; }, {}),
    sendsByState: sends.reduce((m, r) => { m[r.state] = r.n; return m; }, {}),
    skipReasons: skips,
    stepsPending: pending,
    realReplies: replies,
    // Reply rate over messages actually sent, excluding auto-replies.
    replyRatePct: sent ? Math.round((replies / sent) * 1000) / 10 : null,
  };
}

function registerJobs(runner) {
  runner.register("sequence.step", async (payload, ctx) => runStep(ctx.db, ctx.orgId, payload));
}

module.exports = {
  render, contextFor, validateSequence, dryRunSequence, windowCheck, isInside,
  exitReason, runStep, enrol, status, registerJobs, HOUR, DAY,
};
