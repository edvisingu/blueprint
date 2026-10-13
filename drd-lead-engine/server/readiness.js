/* The go-live gate. Refuses to arm sending until every check passes.
 *
 * The point of a gate like this is that it cannot be talked around. Arming is
 * a single boolean on the organisation, and arm() will not set it while any
 * blocking check fails. Each check returns a stable key, a verdict, and a
 * remedy written for the person who has to act on it.
 *
 * Checks are split into BLOCKING (arming is refused) and ADVISORY (arming is
 * allowed, but the operator is told). The split is deliberate: a gate that
 * blocks on everything gets bypassed, and a gate that blocks on nothing is
 * decoration.
 *
 * NOT LEGAL ADVICE. The compliance checks implement our reading of CASL and
 * are pending qualified Canadian legal review. A green gate means this system
 * is configured correctly — it is not a legal opinion that sending is lawful.
 */
"use strict";

const dns = require("node:dns");
const consent = require("./consent");
const sending = require("./sending");

const DAY = 86400000;

function resolveTxt(name) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const t = setTimeout(() => finish({ error: "timeout" }), 3000);
    try {
      dns.resolveTxt(name, (err, recs) => {
        clearTimeout(t);
        if (err) finish({ error: err.code || err.message });
        else finish({ records: recs.map((r) => r.join("")) });
      });
    } catch (e) { clearTimeout(t); finish({ error: e.message }); }
  });
}

/* Authentication check. Looks for SPF and DMARC, and reports whether DMARC
 * is in a posture that actually asserts anything.
 *
 * Alignment is the part most tooling omits: SPF passing for a bounce domain
 * that differs from the visible From domain does not protect the From domain.
 * We can verify record presence and DMARC policy from DNS; true alignment can
 * only be confirmed against a real delivered message, so that is reported as
 * unverified rather than claimed. */
async function checkDomain(domain) {
  const out = { domain, spf: null, dmarc: null, dmarcPolicy: null, notes: [] };
  const spf = await resolveTxt(domain);
  if (spf.error) {
    out.spf = null;
    out.notes.push("SPF lookup failed (" + spf.error + ") — could not verify from this environment");
  } else {
    const rec = (spf.records || []).find((r) => /^v=spf1/i.test(r));
    out.spf = !!rec;
    if (rec) out.spfRecord = rec;
    if (rec && /[?~]all\s*$/.test(rec) === false && /-all\s*$/.test(rec) === false) {
      out.notes.push("SPF record has no explicit all mechanism");
    }
  }
  const dm = await resolveTxt("_dmarc." + domain);
  if (dm.error) {
    out.dmarc = null;
    out.notes.push("DMARC lookup failed (" + dm.error + ") — could not verify from this environment");
  } else {
    const rec = (dm.records || []).find((r) => /^v=DMARC1/i.test(r));
    out.dmarc = !!rec;
    if (rec) {
      out.dmarcRecord = rec;
      const p = /\bp\s*=\s*(none|quarantine|reject)/i.exec(rec);
      out.dmarcPolicy = p ? p[1].toLowerCase() : null;
      if (!/\brua\s*=/.test(rec)) out.notes.push("DMARC has no rua= address, so no aggregate reports arrive");
    }
  }
  // DKIM selectors are provider-specific; we cannot discover them blind.
  out.dkim = null;
  out.notes.push("DKIM must be verified against the sending provider's selector — not discoverable from the domain alone");
  return out;
}

/* Run every check. `db` and `orgId` required; network checks degrade to
 * "unverified" rather than failing when DNS is unavailable, which is the case
 * in sandboxed environments. */
async function evaluate(db, orgId, opts) {
  const o = opts || {};
  const org = db.prepare("SELECT * FROM organizations WHERE id=?").get(orgId);
  if (!org) return { ok: false, error: "org_not_found" };
  const checks = [];
  const add = (key, blocking, pass, summary, remedy, extra) =>
    checks.push({ key, blocking, status: pass === null ? "unverified" : pass ? "pass" : "fail", summary, remedy: pass ? null : remedy, ...(extra || {}) });

  // ---- 1. No fiction in the sendable set -------------------------------
  const cov = consent.coverage(db, orgId);
  add("no_demo_data", true, cov.demoContacts === 0,
    cov.demoContacts === 0
      ? "No generated sample contacts present"
      : cov.demoContacts + " generated sample contacts are still in the database",
    "Run `node server/purge-demo.js` to remove them. They can never be sent to, but their presence makes " +
      "counts and analytics meaningless. Keep them only in a development database.",
    { demoContacts: cov.demoContacts });

  // ---- 2. There is something real to send to ---------------------------
  add("has_real_contacts", true, cov.realContacts > 0,
    cov.realContacts + " real contacts imported",
    "Import real contacts with consent provenance using the CSV template at /v1/import/template. " +
      "Nothing can be sent until real contacts exist.",
    { realContacts: cov.realContacts });

  // ---- 3. Consent coverage --------------------------------------------
  const uncovered = cov.realContacts - cov.withLiveBasis;
  add("consent_coverage", true, cov.realContacts > 0 && uncovered === 0,
    cov.withLiveBasis + " of " + cov.realContacts + " real contacts have a live consent basis",
    uncovered > 0
      ? uncovered + " contact(s) have no valid unexpired basis. They are already blocked from sending; " +
        "either record a basis or delete them."
      : "Import contacts with a recorded consent basis.",
    { withLiveBasis: cov.withLiveBasis, uncovered: Math.max(0, uncovered), byBasis: cov.byBasis });

  if (cov.expiringIn30Days > 0) {
    add("consent_expiring", false, false,
      cov.expiringIn30Days + " consent basis/bases expire within 30 days",
      "Implied consent runs out: 6 months from an inquiry, 24 months from a transaction. " +
        "Re-establish or let them lapse — they will stop being sendable automatically.");
  }

  // ---- 4. Sender identification (CASL) --------------------------------
  const f = sending.footer(org, "https://example.invalid/u/probe");
  add("sender_identification", true, f.ok,
    f.ok ? "Legal name, mailing address and contact details set"
         : "Missing: " + (f.missing || []).join(", "),
    "Every commercial message must identify the sender, give a mailing address and provide contact " +
      "details valid for at least 60 days. Set legal_name, mailing_address and contact_email/phone on the organisation.",
    { missing: f.missing || [] });

  // ---- 5. A usable mailbox --------------------------------------------
  const mailboxes = db.prepare("SELECT * FROM mailboxes WHERE org_id=?").all(orgId);
  const active = mailboxes.filter((m) => m.status === "Active");
  add("has_active_mailbox", true, active.length > 0,
    active.length + " active mailbox(es) of " + mailboxes.length + " configured",
    "Configure at least one mailbox and set its status to Active. Credentials belong in an environment " +
      "variable named by credential_env — never in the database or the repository.",
    { mailboxes: mailboxes.length, active: active.length });

  const realTransport = active.filter((m) => m.provider && m.provider !== "dryrun");
  add("transport_configured", false, realTransport.length > 0,
    realTransport.length > 0
      ? realTransport.length + " mailbox(es) have a real transport"
      : "All mailboxes are dry-run: nothing will actually be delivered",
    "Dry-run is the safe default and is correct until a sending provider is chosen. Note that most " +
      "mainstream ESP acceptable-use policies restrict cold outbound — confirm the provider permits " +
      "consent-based B2B outreach before configuring it.");

  const badTz = active.filter((m) => {
    try { new Intl.DateTimeFormat("en-CA", { timeZone: m.timezone }); return false; }
    catch (e) { return true; }
  });
  if (badTz.length) {
    add("mailbox_timezone", true, false,
      badTz.length + " mailbox(es) have an invalid timezone",
      "Daily caps reset on the mailbox's own timezone. An invalid zone silently falls back to UTC, " +
        "which is how caps drift. Fix: " + badTz.map((m) => m.address).join(", "));
  }

  // ---- 6. Paused mailboxes and open alerts ----------------------------
  const paused = mailboxes.filter((m) => m.status === "Paused");
  if (paused.length) {
    add("mailboxes_paused", false, false,
      paused.length + " mailbox(es) paused: " + paused.map((m) => m.address + " (" + (m.pause_reason || "no reason recorded") + ")").join("; "),
      "A pause means a bounce or complaint threshold was crossed. Investigate list quality before resuming.");
  }
  const critical = sending.openAlerts(db, orgId).filter((a) => a.severity === "critical");
  add("no_critical_alerts", true, critical.length === 0,
    critical.length === 0 ? "No open critical alerts" : critical.length + " open critical alert(s)",
    "Resolve or acknowledge critical alerts before arming: " + critical.map((a) => a.kind + "/" + a.subject).join(", "),
    { critical: critical.map((a) => ({ kind: a.kind, subject: a.subject, detail: a.detail })) });

  // ---- 7. Unsubscribe is reachable ------------------------------------
  const base = process.env.DRD_PUBLIC_URL || "";
  add("unsubscribe_url", true, /^https:\/\/[^\s]+$/i.test(base),
    base ? "Public URL set to " + base : "DRD_PUBLIC_URL is not set",
    "Set DRD_PUBLIC_URL to the https base URL that serves /u/<token>. Without it the unsubscribe link in " +
      "every message points nowhere, which fails both the one-click unsubscribe expectation and the " +
      "requirement that opt-out be readily performable.",
    { publicUrl: base || null });

  // ---- 8. Authentication records --------------------------------------
  const domains = [...new Set(active.map((m) => String(m.address).split("@")[1]).filter(Boolean))];
  const dnsResults = [];
  if (!o.skipDns) {
    for (const d of domains.slice(0, 10)) dnsResults.push(await checkDomain(d));
  }
  if (domains.length === 0) {
    add("email_authentication", true, false,
      "No sending domains to check (no active mailbox)",
      "Add an active mailbox first.");
  } else if (o.skipDns) {
    add("email_authentication", true, null,
      "DNS checks skipped",
      "Re-run the readiness check with DNS enabled before arming.");
  } else {
    const unresolved = dnsResults.filter((r) => r.spf === null || r.dmarc === null);
    const failing = dnsResults.filter((r) => r.spf === false || r.dmarc === false);
    const pass = failing.length === 0 && unresolved.length === 0;
    add("email_authentication", true, unresolved.length && !failing.length ? null : pass,
      pass ? "SPF and DMARC present on " + domains.join(", ")
           : failing.length ? "Missing records on " + failing.map((r) => r.domain).join(", ")
           : "Could not verify DNS from this environment",
      "Publish SPF and a DMARC record with a rua= address on every sending domain, and confirm DKIM " +
        "against the provider's selector. SPF and DKIM must ALIGN with the visible From domain — a pass " +
        "on a different domain protects nothing.",
      { domains: dnsResults });
    for (const r of dnsResults) {
      if (r.dmarcPolicy === "none") {
        add("dmarc_policy_" + r.domain, false, false,
          r.domain + " has DMARC p=none",
          "p=none asserts nothing and only collects reports. Move to quarantine then reject once aggregate " +
            "reports show legitimate mail passing.");
      }
    }
  }

  // ---- 9. Clearance on record ----------------------------------------
  const cl = db.prepare("SELECT * FROM clearances WHERE org_id=? ORDER BY at DESC LIMIT 1").get(orgId);
  add("clearance_recorded", true, !!cl,
    cl ? "Clearance recorded " + new Date(cl.at).toISOString().slice(0, 10) + " by " + cl.recorded_by + " (" + cl.granted_by + ")"
       : "No clearance recorded",
    "Record the clearance that authorises activation, including who granted it and when, via " +
      "POST /v1/clearance. This is an audit record of a decision made outside this system, not an approval " +
      "the system can grant itself.",
    { clearance: cl || null });

  const blocking = checks.filter((c) => c.blocking);
  const failed = blocking.filter((c) => c.status === "fail");
  const unverified = blocking.filter((c) => c.status === "unverified");
  return {
    ok: true,
    armed: !!org.send_armed,
    canArm: failed.length === 0 && unverified.length === 0,
    blockingFailed: failed.length,
    blockingUnverified: unverified.length,
    advisory: checks.filter((c) => !c.blocking && c.status !== "pass").length,
    checks,
    coverage: cov,
    // Said plainly, every time, because a green gate is easy to misread.
    disclaimer:
      "A passing gate means this system is configured correctly. It is not a legal opinion. " +
      "Qualified Canadian legal review of the consent basis for this list is required before sending.",
  };
}

/* Arm or disarm sending. Arming is refused while any blocking check fails. */
async function arm(db, orgId, on, actor, opts) {
  if (!on) {
    db.prepare("UPDATE organizations SET send_armed=0 WHERE id=?").run(orgId);
    db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
      .run(require("./db").id("au"), orgId, actor || "system", "disarm", "Sending disarmed", Date.now());
    return { ok: true, armed: false };
  }
  const r = await evaluate(db, orgId, opts);
  if (!r.ok) return r;
  if (!r.canArm) {
    return {
      ok: false, armed: false, error: "readiness_failed",
      message: "Cannot arm sending: " + r.blockingFailed + " blocking check(s) failed, " +
        r.blockingUnverified + " could not be verified.",
      checks: r.checks.filter((c) => c.blocking && c.status !== "pass"),
    };
  }
  db.prepare("UPDATE organizations SET send_armed=1 WHERE id=?").run(orgId);
  db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
    .run(require("./db").id("au"), orgId, actor || "system", "arm",
      "Sending armed after passing all blocking readiness checks", Date.now());
  return { ok: true, armed: true, checks: r.checks };
}

module.exports = { evaluate, arm, checkDomain };
