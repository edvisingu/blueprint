#!/usr/bin/env node
/* Go-live stress test. Asserts the safety invariants under adversarial input.
 *
 *   node server/stress.js
 *
 * This is not a load test for its own sake. Every case here is a way the
 * system could leak a message it should not have sent, or silently fail to
 * send one it should. The three invariants under test:
 *
 *   1. Generated (demo) contacts are NEVER sent to.
 *   2. Contacts without a live consent basis are NEVER sent to.
 *   3. Nothing is sent while disarmed, and arming is refused until the
 *      readiness gate passes.
 *
 * Plus the operational properties: caps hold under concurrency, rates use the
 * right denominator, skips are always recorded, unsubscribe is immediate and
 * org-wide, and a large import stays correct and bounded in time.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { open, id } = require("./db.js");
const consent = require("./consent.js");
const sending = require("./sending.js");
const importer = require("./importer.js");
const readiness = require("./readiness.js");

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else {
    fail++; failures.push(name + (detail ? " — " + detail : ""));
    console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? " — " + detail : ""));
  }
}
function section(t) { console.log("\n\x1b[1m" + t + "\x1b[0m"); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drd-stress-"));
const dbFile = path.join(tmp, "stress.db");

function freshOrg(db, opts) {
  const o = opts || {};
  const orgId = "org_" + Math.random().toString(36).slice(2, 8);
  db.prepare(
    "INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,demo_data,legal_name,mailing_address,contact_email)" +
      " VALUES (?,?,'Growth',5000,0,1,?,?,0,?,?,?)"
  ).run(orgId, "Stress Org", Date.now(), o.armed ? 1 : 0,
    o.identified === false ? null : "Stress Org Inc.",
    o.identified === false ? null : "1 Example St, Toronto ON, Canada",
    o.identified === false ? null : "contact@example.invalid");
  return orgId;
}

function mkCompany(db, origin) {
  const cid = id("co");
  db.prepare("INSERT INTO companies (id,name,domain,industry,country,origin) VALUES (?,?,?,?,?,?)")
    .run(cid, "Co " + cid, cid + ".example", "EdTech", "Canada", origin);
  return cid;
}

function mkContact(db, companyId, origin, email) {
  const ctid = id("ct");
  db.prepare("INSERT INTO contacts (id,company_id,name,title,email,origin) VALUES (?,?,?,?,?,?)")
    .run(ctid, companyId, "Person " + ctid, "Director", email || ctid + "@" + companyId + ".example", origin);
  return ctid;
}

function grantConsent(db, orgId, contactId, basis, capturedAt, brandId) {
  const at = capturedAt || Date.now();
  db.prepare(
    "INSERT INTO consents (id,contact_id,org_id,brand_id,basis,source_url,source_note,evidence_ref,role_relevance," +
      "anti_solicitation_checked,captured_at,captured_by,expires_at,created_at)" +
      " VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)"
  ).run(id("cs"), contactId, orgId, brandId || null, basis, "https://example.invalid/staff", "stress",
    "evidence/x.png", "role relevant", at, "stress", consent.expiryFor(basis, at), Date.now());
}

function mkMailbox(db, orgId, over) {
  const o = over || {};
  const mid = id("mb");
  db.prepare(
    "INSERT INTO mailboxes (id,org_id,address,display_name,provider,daily_cap,min_gap_seconds,timezone,status,created_at)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(mid, orgId, o.address || mid + "@sender.example", "Sender",
    o.provider || "dryrun", o.daily_cap === undefined ? 50 : o.daily_cap,
    o.min_gap_seconds === undefined ? 0 : o.min_gap_seconds,
    o.timezone || "UTC", o.status || "Active", Date.now());
  return mid;
}

(async function main() {
  const db = open(dbFile);
  process.env.DRD_PUBLIC_URL = "https://leads.example.invalid";

  // ============================================ 1. demo data is unsendable
  section("Invariant 1 — generated data can never be sent to");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId);
    const co = mkCompany(db, "demo");
    const demoContact = mkContact(db, co, "demo");
    // Deliberately give it every reason to be sendable: full consent, armed
    // org, active mailbox. Only `origin` should stop it.
    grantConsent(db, orgId, demoContact, "express");
    const r = sending.send(db, orgId, { contactId: demoContact, subject: "hi", body: "hello" });
    ok("demo contact with express consent is still skipped", r.state === "SKIPPED", "state=" + r.state);
    ok("skip reason names demo data", r.skip_reason === "demo_contact", "reason=" + r.skip_reason);

    const sent = db.prepare("SELECT COUNT(*) n FROM sends WHERE contact_id=? AND state='SENT'").get(demoContact).n;
    ok("no SENT row exists for a demo contact", sent === 0, "sent rows=" + sent);

    // And the skip is recorded, not swallowed.
    const skips = db.prepare("SELECT COUNT(*) n FROM sends WHERE contact_id=? AND state='SKIPPED'").get(demoContact).n;
    ok("the refusal is recorded as a row", skips === 1, "skip rows=" + skips);
  }

  // ======================================= 2. consent gates every send
  section("Invariant 2 — no live consent basis, no send");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId);
    const co = mkCompany(db, "import");

    const noConsent = mkContact(db, co, "import");
    let r = sending.send(db, orgId, { contactId: noConsent, subject: "s", body: "b" });
    ok("contact with no consent row is skipped", r.skip_reason === "no_consent_record", "reason=" + r.skip_reason);

    // Expired implied-inquiry consent: captured 200 days ago, 180-day clock.
    const expired = mkContact(db, co, "import");
    grantConsent(db, orgId, expired, "implied_inquiry", Date.now() - 200 * consent.DAY);
    r = sending.send(db, orgId, { contactId: expired, subject: "s", body: "b" });
    ok("expired implied-inquiry consent is skipped", r.skip_reason === "consent_expired", "reason=" + r.skip_reason);

    // Still inside the window.
    const fresh = mkContact(db, co, "import");
    grantConsent(db, orgId, fresh, "implied_inquiry", Date.now() - 10 * consent.DAY);
    r = sending.send(db, orgId, { contactId: fresh, subject: "s", body: "b" });
    ok("consent inside its window sends", r.state === "SENT", "state=" + r.state + " " + (r.skip_reason || ""));

    // Transaction basis: 24 months, so 400 days ago is still live.
    const txn = mkContact(db, co, "import");
    grantConsent(db, orgId, txn, "implied_transaction", Date.now() - 400 * consent.DAY);
    const e = consent.eligibility(db, txn);
    ok("24-month transaction basis still live at 400 days", e.eligible === true, e.reason);

    // ...but not at 800 days.
    const oldTxn = mkContact(db, co, "import");
    grantConsent(db, orgId, oldTxn, "implied_transaction", Date.now() - 800 * consent.DAY);
    ok("transaction basis expired at 800 days", consent.eligibility(db, oldTxn).reason === "consent_expired");

    // Revocation beats an unexpired basis.
    const revoked = mkContact(db, co, "import");
    grantConsent(db, orgId, revoked, "express");
    db.prepare("UPDATE consents SET revoked_at=? WHERE contact_id=?").run(Date.now(), revoked);
    ok("revoked consent blocks sending", consent.eligibility(db, revoked).reason === "consent_revoked");
  }

  // =============================================== 3. arming is a real gate
  section("Invariant 3 — disarmed means nothing leaves");
  {
    const orgId = freshOrg(db, { armed: false });
    mkMailbox(db, orgId);
    const co = mkCompany(db, "import");
    const c = mkContact(db, co, "import");
    grantConsent(db, orgId, c, "express");
    const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
    ok("fully eligible contact is skipped while disarmed", r.skip_reason === "not_armed", "reason=" + r.skip_reason);

    // Arming is refused while blocking checks fail (no clearance recorded,
    // demo data present elsewhere, DNS unverifiable in this sandbox).
    const armed = await readiness.arm(db, orgId, true, "stress", { skipDns: true });
    ok("arm() refuses while readiness checks fail", armed.ok === false && armed.armed === false,
      JSON.stringify(armed).slice(0, 120));
    const still = db.prepare("SELECT send_armed FROM organizations WHERE id=?").get(orgId).send_armed;
    ok("refused arm leaves send_armed at 0", still === 0, "send_armed=" + still);
  }

  // ====================================================== 4. caps hold
  section("Budget authority — caps hold and are counted in one place");
  {
    const orgId = freshOrg(db, { armed: true });
    const mb = mkMailbox(db, orgId, { daily_cap: 10, min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const contacts = [];
    for (let i = 0; i < 25; i++) {
      const c = mkContact(db, co, "import", "cap" + i + "@capco.example");
      grantConsent(db, orgId, c, "express");
      contacts.push(c);
    }
    let sent = 0, skippedCap = 0;
    for (const c of contacts) {
      const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
      if (r.state === "SENT") sent++;
      else if (r.skip_reason === "all_mailboxes_at_cap" || r.skip_reason === "mailbox_throttled") skippedCap++;
    }
    ok("exactly the cap was sent, not one more", sent === 10, "sent=" + sent);
    ok("the other 15 were skipped with a cap reason", skippedCap === 15, "skipped=" + skippedCap);
    ok("countSentToday agrees with the cap", sending.countSentToday(db, mb) === 10,
      "counted=" + sending.countSentToday(db, mb));

    // A second campaign must NOT get its own fresh allowance — the documented
    // Smartlead behaviour this is designed to avoid.
    const extra = mkContact(db, co, "import", "extra@capco.example");
    grantConsent(db, orgId, extra, "express");
    const r2 = sending.send(db, orgId, { contactId: extra, campaignId: null, subject: "s", body: "b" });
    ok("a different campaign does not reset the mailbox cap", r2.state === "SKIPPED", "state=" + r2.state);
  }

  // ============================================ 5. minimum gap is honoured
  section("Throttling — the minimum gap is enforced and reported");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId, { daily_cap: 100, min_gap_seconds: 3600 });
    const co = mkCompany(db, "import");
    const a = mkContact(db, co, "import", "gap1@gapco.example");
    const b = mkContact(db, co, "import", "gap2@gapco.example");
    grantConsent(db, orgId, a, "express");
    grantConsent(db, orgId, b, "express");
    const r1 = sending.send(db, orgId, { contactId: a, subject: "s", body: "b" });
    const r2 = sending.send(db, orgId, { contactId: b, subject: "s", body: "b" });
    ok("first send goes", r1.state === "SENT", r1.skip_reason || "");
    ok("second send inside the gap is skipped, not dropped", r2.state === "SKIPPED" && !!r2.skip_reason,
      "state=" + r2.state);
  }

  // ======================================= 6. rate denominators are correct
  section("Rates — denominator is messages sent, not list size");
  {
    const orgId = freshOrg(db, { armed: true });
    const mb = mkMailbox(db, orgId, { daily_cap: 1000, min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    // Send all 50 FIRST, then record one bounce. Order matters: earlier
    // versions bounced during the run and the mailbox correctly paused itself
    // the moment the rate became actionable (1/20 = 5%, over the 4% line).
    // That is the right behaviour, but it measures the pause, not the
    // denominator. Keep the two concerns apart.
    const sentIds = [];
    for (let i = 0; i < 50; i++) {
      const c = mkContact(db, co, "import", "rate" + i + "@rateco.example");
      grantConsent(db, orgId, c, "express");
      const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
      if (r.state === "SENT") sentIds.push(r.id);
    }
    ok("all 50 sent with no premature pause", sentIds.length === 50, "sent=" + sentIds.length);
    sending.settle(db, orgId, sentIds[0], "BOUNCED", "550 no such user");
    const rates = sending.rates(db, mb);
    // The point: 1/50 = 2%. A list-size denominator would report 1/10000 =
    // 0.01% and hide a real problem until the domain was already damaged.
    ok("bounce rate is 1/50 = 2%, not 1/10000 = 0.01%", Math.abs(rates.bouncePct - 2) < 0.01,
      "bouncePct=" + rates.bouncePct.toFixed(3));
    ok("2% stays below the 4% pause line, so the mailbox keeps running",
      db.prepare("SELECT status FROM mailboxes WHERE id=?").get(mb).status === "Active");
    ok("rate is actionable above the sample floor", rates.actionable === true, "sent=" + rates.sent);

    // Small samples must not trigger anything.
    const orgId2 = freshOrg(db, { armed: true });
    const mb2 = mkMailbox(db, orgId2, { min_gap_seconds: 0 });
    const co2 = mkCompany(db, "import");
    const one = mkContact(db, co2, "import", "solo@soloco.example");
    grantConsent(db, orgId2, one, "express");
    const sr = sending.send(db, orgId2, { contactId: one, subject: "s", body: "b" });
    sending.settle(db, orgId2, sr.id, "BOUNCED", "550");
    const r2 = sending.rates(db, mb2);
    ok("1 bounce out of 1 send is 100% but not actionable", r2.bouncePct === 100 && r2.actionable === false);
    const mbState = db.prepare("SELECT status FROM mailboxes WHERE id=?").get(mb2).status;
    ok("a healthy mailbox is not paused by a tiny sample", mbState === "Active", "status=" + mbState);
  }

  // ================================== 7. auto-pause and alert on bad rates
  section("Warn before pause — and never pause silently");
  {
    const orgId = freshOrg(db, { armed: true });
    const mb = mkMailbox(db, orgId, { daily_cap: 1000, min_gap_seconds: 0, address: "pause@sender.example" });
    const co = mkCompany(db, "import");
    for (let i = 0; i < 40; i++) {
      const c = mkContact(db, co, "import", "p" + i + "@pauseco.example");
      grantConsent(db, orgId, c, "express");
      const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
      // 10% bounce: well past the 4% pause threshold.
      if (i % 10 === 0 && r.state === "SENT") sending.settle(db, orgId, r.id, "BOUNCED", "550");
    }
    const st = db.prepare("SELECT status,pause_reason FROM mailboxes WHERE id=?").get(mb);
    ok("mailbox paused once bounces passed the threshold", st.status === "Paused", "status=" + st.status);
    ok("the pause records a reason", !!st.pause_reason, "reason=" + st.pause_reason);
    const alerts = sending.openAlerts(db, orgId);
    ok("a critical alert was raised", alerts.some((a) => a.kind === "mailbox_paused" && a.severity === "critical"),
      "alerts=" + alerts.map((a) => a.kind).join(","));
    // And a paused mailbox stops being used.
    const nxt = mkContact(db, co, "import", "after@pauseco.example");
    grantConsent(db, orgId, nxt, "express");
    const r = sending.send(db, orgId, { contactId: nxt, subject: "s", body: "b" });
    ok("no sends go through a paused mailbox", r.state === "SKIPPED" && r.skip_reason === "no_active_mailbox",
      "state=" + r.state + " reason=" + r.skip_reason);
  }

  // ================================= 8. unsubscribe is immediate, org-wide
  section("Unsubscribe — immediate, and covers every brand");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId, { min_gap_seconds: 0 });
    const coA = mkCompany(db, "import");
    const shared = "shared.person@unsubco.example";
    const c1 = mkContact(db, coA, "import", shared);
    grantConsent(db, orgId, c1, "express");
    const s1 = sending.send(db, orgId, { contactId: c1, subject: "s", body: "b" });
    ok("message sent before unsubscribe", s1.state === "SENT", s1.skip_reason || "");
    ok("body carries an unsubscribe link",
      /\/u\//.test(db.prepare("SELECT body FROM sends WHERE id=?").get(s1.id).body || ""));
    ok("body carries sender identification",
      /Stress Org Inc\./.test(db.prepare("SELECT body FROM sends WHERE id=?").get(s1.id).body || ""));

    const token = sending.unsubToken(db, orgId, c1);
    const u = sending.unsubscribe(db, orgId, token);
    ok("unsubscribe succeeds", u.ok === true, JSON.stringify(u));
    ok("unsubscribe is honoured immediately", !!u.at);

    const again = sending.send(db, orgId, { contactId: c1, subject: "s", body: "b" });
    ok("no further sends after unsubscribe", again.state === "SKIPPED", "state=" + again.state);
    ok("the reason is suppression", again.skip_reason === "suppressed", "reason=" + again.skip_reason);

    // A second contact row with the SAME address, under a different brand's
    // company, must also be blocked — this is the cross-brand property.
    const coB = mkCompany(db, "import");
    const c2 = mkContact(db, coB, "import", shared);
    grantConsent(db, orgId, c2, "express");
    const other = sending.send(db, orgId, { contactId: c2, subject: "s", body: "b" });
    ok("the same address under another brand is also suppressed",
      other.state === "SKIPPED" && other.skip_reason === "suppressed",
      "state=" + other.state + " reason=" + other.skip_reason);

    ok("consent rows were revoked by the unsubscribe",
      db.prepare("SELECT COUNT(*) n FROM consents WHERE contact_id=? AND revoked_at IS NOT NULL").get(c1).n === 1);
  }

  // ============================ 9. bounces and complaints suppress at once
  section("Bounces and complaints suppress immediately");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId, { min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const c = mkContact(db, co, "import", "bouncer@bounceco.example");
    grantConsent(db, orgId, c, "express");
    const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
    sending.settle(db, orgId, r.id, "BOUNCED", "550 user unknown");
    const again = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
    ok("a bounced address is not retried", again.skip_reason === "suppressed", "reason=" + again.skip_reason);

    const c2 = mkContact(db, co, "import", "complainer@bounceco.example");
    grantConsent(db, orgId, c2, "express");
    const r2 = sending.send(db, orgId, { contactId: c2, subject: "s", body: "b" });
    sending.settle(db, orgId, r2.id, "COMPLAINED", "spam report");
    ok("a complaining address is suppressed",
      sending.send(db, orgId, { contactId: c2, subject: "s", body: "b" }).skip_reason === "suppressed");
  }

  // ================================= 10. missing identification blocks send
  section("CASL identification is not optional");
  {
    const orgId = freshOrg(db, { armed: true, identified: false });
    mkMailbox(db, orgId, { min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const c = mkContact(db, co, "import", "noid@noidco.example");
    grantConsent(db, orgId, c, "express");
    const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
    ok("send refused without sender identification",
      r.state === "SKIPPED" && r.skip_reason === "missing_sender_identification",
      "state=" + r.state + " reason=" + r.skip_reason);
    ok("a critical alert explains why",
      sending.openAlerts(db, orgId).some((a) => a.kind === "missing_identification"));
  }

  // =========================================== 11. import rejects bad rows
  section("Import — provenance required, every rejection explained");
  {
    const orgId = freshOrg(db);
    const noProv = "email,name,company\na@b.example,A,B\n";
    let res = await importer.importCsv(db, orgId, noProv, { skipMx: true });
    ok("a file without consent columns is rejected whole", res.ok === false && res.error === "missing_required_columns",
      JSON.stringify(res).slice(0, 100));
    ok("the missing columns are named", (res.missing || []).includes("consent_basis"));

    const today = new Date().toISOString().slice(0, 10);
    const csv = [
      "email,name,company,consent_basis,consent_captured_at,consent_source,consent_evidence,role_relevance,anti_solicitation_checked",
      // good: express
      "good1@importco.example,Good One,ImportCo,express," + today + ",Signed up at event,,,",
      // good: publication with full evidence
      "good2@importco.example,Good Two,ImportCo,implied_publication," + today + ",https://importco.example/staff,evidence/s.png,Role relevant,yes",
      // bad: publication missing the anti-solicitation check
      "bad1@importco.example,Bad One,ImportCo,implied_publication," + today + ",https://importco.example/staff,evidence/s.png,Role relevant,no",
      // bad: publication with a non-URL source
      "bad2@importco.example,Bad Two,ImportCo,implied_publication," + today + ",bought a list,evidence/s.png,Role,yes",
      // bad: unknown basis
      "bad3@importco.example,Bad Three,ImportCo,purchased_list," + today + ",a vendor,,,",
      // bad: already-expired inquiry consent
      "bad4@importco.example,Bad Four,ImportCo,implied_inquiry,2019-01-01,Enquired long ago,,,",
      // bad: malformed email
      "not-an-email,Bad Five,ImportCo,express," + today + ",Signed up,,,",
      // bad: missing name
      "bad6@importco.example,,ImportCo,express," + today + ",Signed up,,,",
      // bad: unparseable date
      "bad7@importco.example,Bad Seven,ImportCo,express,whenever,Signed up,,,",
      // bad: duplicate of good1
      "good1@importco.example,Dup,ImportCo,express," + today + ",Signed up,,,",
      "",
    ].join("\n");
    res = await importer.importCsv(db, orgId, csv, { skipMx: true, actor: "stress" });
    ok("import succeeded", res.ok === true, JSON.stringify(res).slice(0, 120));
    ok("exactly the 2 valid rows were accepted", res.accepted === 2, "accepted=" + res.accepted);
    ok("the 8 bad rows were rejected", res.rejected === 8, "rejected=" + res.rejected);
    ok("a purchased-list basis is rejected", !!res.rejectedByReason.consent_invalid, JSON.stringify(res.rejectedByReason));
    ok("already-expired consent is rejected", !!res.rejectedByReason.consent_already_expired);
    ok("a malformed address is rejected", !!res.rejectedByReason.invalid_email_syntax);
    ok("an in-file duplicate is rejected", !!res.rejectedByReason.duplicate_in_file);
    ok("every rejection carries a line number",
      res.rejectedRows.every((r) => Number.isFinite(r.line)));
    ok("verification is reported as skipped, not assumed", res.verificationSkipped === true);

    // The accepted rows are genuinely sendable; the rejected ones absent.
    const imported = db.prepare("SELECT id,email FROM contacts WHERE origin='import' AND email LIKE '%@importco.example'").all();
    ok("only accepted rows exist in the database", imported.length === 2, "found=" + imported.length);
    for (const c of imported) {
      const e = consent.eligibility(db, c.id);
      ok("imported contact " + c.email + " is eligible", e.eligible === true, e.reason);
    }
  }

  // ======================================= 12. large import stays correct
  section("Scale — a large import stays correct and bounded");
  {
    const orgId = freshOrg(db);
    const today = new Date().toISOString().slice(0, 10);
    const N = 5000;
    const rows = ["email,name,company,consent_basis,consent_captured_at,consent_source"];
    for (let i = 0; i < N; i++) {
      rows.push("bulk" + i + "@bulkco" + (i % 50) + ".example,Person " + i + ",Bulk " + (i % 50) +
        ",express," + today + ",Signed up at conference");
    }
    // 100 deliberate duplicates of earlier rows.
    for (let i = 0; i < 100; i++) rows.push("bulk" + i + "@bulkco" + (i % 50) + ".example,Dup,Bulk,express," + today + ",Dup");
    const t0 = Date.now();
    const res = await importer.importCsv(db, orgId, rows.join("\n") + "\n", { skipMx: true });
    const ms = Date.now() - t0;
    ok(N + " unique rows accepted", res.accepted === N, "accepted=" + res.accepted);
    ok("100 duplicates rejected", res.rejectedByReason.duplicate_in_file === 100,
      "dups=" + res.rejectedByReason.duplicate_in_file);
    ok("companies deduplicated by domain to 50",
      db.prepare("SELECT COUNT(*) n FROM companies WHERE domain LIKE 'bulkco%'").get().n === 50,
      "companies=" + db.prepare("SELECT COUNT(*) n FROM companies WHERE domain LIKE 'bulkco%'").get().n);
    ok("import of " + N + " rows completed under 30s", ms < 30000, ms + "ms");
    console.log("       (" + N + " rows in " + ms + "ms, " + Math.round(N / (ms / 1000)) + " rows/sec)");

    // Re-importing the same file must attach, not duplicate.
    const res2 = await importer.importCsv(db, orgId, rows.slice(0, 101).join("\n") + "\n", { skipMx: true });
    ok("re-import attaches to existing contacts instead of duplicating",
      res2.inserted === 0 && res2.attachedToExisting === 100,
      "inserted=" + res2.inserted + " attached=" + res2.attachedToExisting);
  }

  // ========================================== 13. skip report is complete
  section("Observability — no skip is silent");
  {
    const orgId = freshOrg(db, { armed: false });
    const co = mkCompany(db, "import");
    for (let i = 0; i < 5; i++) {
      const c = mkContact(db, co, "import", "sk" + i + "@skipco.example");
      grantConsent(db, orgId, c, "express");
      sending.send(db, orgId, { contactId: c, subject: "s", body: "b" });
    }
    const rep = sending.skipReport(db, orgId);
    const total = rep.reduce((s, r) => s + r.n, 0);
    ok("all 5 skips appear in the report", total === 5, "total=" + total);
    ok("the report names the reason", rep[0] && rep[0].reason === "not_armed", JSON.stringify(rep));
  }

  // ============================================ 14. readiness gate honesty
  section("Readiness gate — blocks for the right reasons");
  {
    const orgId = freshOrg(db, { identified: false });
    const r = await readiness.evaluate(db, orgId, { skipDns: true });
    ok("gate runs", r.ok === true);
    ok("gate refuses to arm an unconfigured org", r.canArm === false);
    const keys = r.checks.filter((c) => c.status !== "pass").map((c) => c.key);
    ok("identification failure is reported", keys.includes("sender_identification"), keys.join(","));
    ok("no real contacts is reported", keys.includes("has_real_contacts"), keys.join(","));
    ok("no mailbox is reported", keys.includes("has_active_mailbox"), keys.join(","));
    ok("missing clearance is reported", keys.includes("clearance_recorded"), keys.join(","));
    ok("every failing check carries a remedy",
      r.checks.filter((c) => c.status === "fail").every((c) => c.remedy && c.remedy.length > 20));
    ok("the gate states it is not a legal opinion", /not a legal opinion/i.test(r.disclaimer));

    // Now satisfy everything and confirm it can arm.
    const orgId2 = freshOrg(db);
    mkMailbox(db, orgId2, { min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const c = mkContact(db, co, "import", "ready@readyco.example");
    grantConsent(db, orgId2, c, "express");
    db.prepare("INSERT INTO clearances (id,org_id,subject,granted_by,recorded_by,note,at) VALUES (?,?,?,?,?,?,?)")
      .run(id("cl"), orgId2, "Outbound activation", "Counsel and CPA", "stress", "recorded by stress test", Date.now());
    const r2 = await readiness.evaluate(db, orgId2, { skipDns: true });
    const blocking = r2.checks.filter((c2) => c2.blocking && c2.status !== "pass");
    // DNS is skipped in this sandbox, so email_authentication is unverified —
    // which must still block. That is the correct, conservative outcome.
    ok("DNS-unverifiable authentication still blocks arming",
      blocking.some((b) => b.key === "email_authentication"),
      blocking.map((b) => b.key + "=" + b.status).join(","));
    const armRes = await readiness.arm(db, orgId2, true, "stress", { skipDns: true });
    ok("arming is refused while authentication is unverified", armRes.ok === false);
  }

  // ===================================== 15. concurrency on the same cap
  section("Concurrency — parallel sends cannot exceed a cap");
  {
    const orgId = freshOrg(db, { armed: true });
    const mb = mkMailbox(db, orgId, { daily_cap: 5, min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const cs = [];
    for (let i = 0; i < 20; i++) {
      const c = mkContact(db, co, "import", "cc" + i + "@concco.example");
      grantConsent(db, orgId, c, "express");
      cs.push(c);
    }
    // node:sqlite is synchronous, so true parallelism is not available in one
    // process; this interleaves via microtasks, which is the realistic shape
    // for this server (single-threaded request handling).
    await Promise.all(cs.map((c) => Promise.resolve().then(() =>
      sending.send(db, orgId, { contactId: c, subject: "s", body: "b" }))));
    const sent = db.prepare("SELECT COUNT(*) n FROM sends WHERE mailbox_id=? AND state='SENT'").get(mb).n;
    ok("cap of 5 held under interleaved sends", sent === 5, "sent=" + sent);
    const skipped = db.prepare("SELECT COUNT(*) n FROM sends WHERE org_id=? AND state='SKIPPED'").get(orgId).n;
    ok("the remaining 15 are accounted for as skips", skipped === 15, "skipped=" + skipped);
  }

  // ================================ 16. consent is scoped per brand
  section("Brand scoping — consent for one brand does not carry to another");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId, { min_gap_seconds: 0, daily_cap: 500 });
    const co = mkCompany(db, "import");

    // An athletic director whose published address is relevant to the sports
    // brand and not to an unrelated credentials product.
    const ad = mkContact(db, co, "import", "ad@brandco.example");
    grantConsent(db, orgId, ad, "implied_publication", Date.now(), "drdsports");

    const forSports = sending.send(db, orgId, { contactId: ad, subject: "s", body: "b", brandId: "drdsports" });
    ok("sends for the brand the basis names", forSports.state === "SENT",
      "state=" + forSports.state + " reason=" + (forSports.skip_reason || ""));

    const forOther = sending.send(db, orgId, { contactId: ad, subject: "s", body: "b", brandId: "crediversity" });
    ok("refuses the same contact for a different brand",
      forOther.state === "SKIPPED" && forOther.skip_reason === "no_consent_for_brand",
      "state=" + forOther.state + " reason=" + forOther.skip_reason);

    // A blanket basis (no brand named) works for any brand.
    const blanket = mkContact(db, co, "import", "blanket@brandco.example");
    grantConsent(db, orgId, blanket, "express", Date.now(), null);
    ok("a blanket basis applies to any brand",
      sending.send(db, orgId, { contactId: blanket, subject: "s", body: "b", brandId: "crediversity" }).state === "SENT");

    // The reason distinguishes "none at all" from "none for this brand":
    // different remedies, so they must not collapse into one key.
    const none = mkContact(db, co, "import", "none@brandco.example");
    ok("no consent at all reports a different reason than wrong brand",
      consent.eligibility(db, none, Date.now(), "drdsports").reason === "no_consent_record");

    // An unsubscribe is org-wide even though consent is brand-scoped: consent
    // is narrow, withdrawal is broad. Asymmetric on purpose.
    const tok = sending.unsubToken(db, orgId, ad);
    sending.unsubscribe(db, orgId, tok);
    ok("unsubscribe from one brand blocks every brand",
      sending.send(db, orgId, { contactId: ad, subject: "s", body: "b", brandId: "drdsports" }).skip_reason === "suppressed");
    const other = mkContact(db, co, "import", "ad@brandco.example");
    grantConsent(db, orgId, other, "express", Date.now(), "edvisingu");
    ok("the same address re-added under another brand is still suppressed",
      sending.send(db, orgId, { contactId: other, subject: "s", body: "b", brandId: "edvisingu" }).skip_reason === "suppressed");
  }

  // ========================= 17. every send records the consent it relied on
  section("Auditability — each send names the consent record behind it");
  {
    const orgId = freshOrg(db, { armed: true });
    mkMailbox(db, orgId, { min_gap_seconds: 0 });
    const co = mkCompany(db, "import");
    const c = mkContact(db, co, "import", "audit@auditco.example");
    grantConsent(db, orgId, c, "implied_publication", Date.now(), "drdsports");
    const r = sending.send(db, orgId, { contactId: c, subject: "s", body: "b", brandId: "drdsports" });
    const row = db.prepare("SELECT consent_id, brand_id FROM sends WHERE id=?").get(r.id);
    ok("the send stores the consent record id", !!row.consent_id, "consent_id=" + row.consent_id);
    ok("the send stores the brand", row.brand_id === "drdsports", "brand=" + row.brand_id);
    // And that record is still retrievable with its evidence.
    const cs = db.prepare("SELECT basis, source_url, evidence_ref FROM consents WHERE id=?").get(row.consent_id);
    ok("the stored consent carries its basis and evidence",
      cs && cs.basis === "implied_publication" && !!cs.source_url && !!cs.evidence_ref,
      JSON.stringify(cs));
  }

  // ============================ 18. purge removes demo data (runs LAST:
  // this section closes the database to exercise the standalone CLI path)
  section("Purge — demo data can be removed completely");
  {
    const { purge } = require("./purge-demo.js");
    const co = mkCompany(db, "demo");
    for (let i = 0; i < 10; i++) mkContact(db, co, "demo", "purge" + i + "@purgeco.example");
    const beforeDemo = db.prepare("SELECT COUNT(*) n FROM contacts WHERE origin='demo'").get().n;
    ok("demo contacts exist before purge", beforeDemo > 0, "demo=" + beforeDemo);
    const realBefore = db.prepare("SELECT COUNT(*) n FROM contacts WHERE origin!='demo'").get().n;
    db.close();
    const r = purge(dbFile);
    ok("purge removed every demo contact", r.remainingDemo === 0, "remaining=" + r.remainingDemo);
    const db2 = open(dbFile);
    const realAfter = db2.prepare("SELECT COUNT(*) n FROM contacts WHERE origin!='demo'").get().n;
    ok("purge did not touch real contacts", realAfter === realBefore,
      "before=" + realBefore + " after=" + realAfter);
    db2.close();
  }


  // ------------------------------------------------------------- summary
  console.log("\n" + "=".repeat(64));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nInvariants hold: generated data is unsendable, consent gates every");
    console.log("send, nothing leaves while disarmed, caps and rates are computed in");
    console.log("one place with the right denominator, and no skip is silent.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(64));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error("\nstress harness crashed:", e);
  process.exit(1);
});
