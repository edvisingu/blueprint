#!/usr/bin/env node
/* Tests the sequence executor's five rules.
 *
 *   node server/sequences.test.js
 *
 * Every case here is a way a sequence embarrasses you or breaks the law:
 * an unresolved merge field, a follow-up after someone already replied, a
 * duplicate step, a 3am send, and a lead that silently stops with no record.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { open, id } = require("./db.js");
const seqs = require("./sequences.js");
const runner = require("./runner.js");
const sending = require("./sending.js");
const consent = require("./consent.js");

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else { fail++; failures.push(name); console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? " — " + detail : "")); }
}
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drd-seq-"));
const db = open(path.join(tmp, "s.db"));
const ORG = "org_t";
process.env.DRD_PUBLIC_URL = "https://leads.example.invalid";

db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,legal_name,mailing_address,contact_email) VALUES (?,?,'Growth',5000,0,1,?,1,?,?,?)")
  .run(ORG, "T", Date.now(), "T Inc.", "1 St, Toronto ON", "c@example.invalid");
db.prepare("INSERT INTO projects (id,org_id,name,autopilot,created_at) VALUES ('prj',?,'P',1,?)")
  .run(ORG, Date.now());
db.prepare("INSERT INTO mailboxes (id,org_id,address,provider,daily_cap,min_gap_seconds,timezone,status,created_at) VALUES ('mb_1',?,?,'dryrun',500,0,'UTC','Active',?)")
  .run(ORG, "outreach@drdsports.com", Date.now());

/* A window that is always open, so timing does not interfere with the tests
 * that are not about timing. */
const ALWAYS = JSON.stringify({ days: [0, 1, 2, 3, 4, 5, 6], startHour: 0, endHour: 24 });

function mkCampaign(sequence, over) {
  const o = over || {};
  const cid = id("cmp");
  db.prepare(
    "INSERT INTO campaigns (id,project_id,name,goal,tone,status,autopilot,budget,sequence_json,created_at,brand_id,send_window_json)" +
      " VALUES (?,'prj',?,?,?,?,0,0,?,?,?,?)"
  ).run(cid, o.name || "Campaign " + cid, "Book a call", "direct", o.status || "Active",
    JSON.stringify(sequence), Date.now(), o.brandId || "drdsports",
    o.window === undefined ? ALWAYS : o.window);
  return cid;
}

function mkContact(email, name, over) {
  const o = over || {};
  const co = id("co");
  db.prepare("INSERT INTO companies (id,name,domain,industry,sub,city,region,country,size,origin) VALUES (?,?,?,?,?,?,?,?,?,'import')")
    .run(co, o.company || "Northgate Soccer Club", email.split("@")[1], "Sports Club",
      "Soccer Club", o.city || "Oshawa", "Ontario", "Canada", 64);
  const ct = id("ct");
  db.prepare("INSERT INTO contacts (id,company_id,name,title,email,origin) VALUES (?,?,?,?,?,'import')")
    // A space, not null: contacts.name is NOT NULL, and a whitespace-only cell
    // is the realistic way this arrives from a spreadsheet.
    .run(ct, co, name === null ? " " : (name || "Jane Coach"), o.title || "Club Director", email);
  if (o.consent !== false) {
    db.prepare("INSERT INTO consents (id,contact_id,org_id,brand_id,basis,source_url,evidence_ref,role_relevance,anti_solicitation_checked,captured_at,captured_by,expires_at,created_at) VALUES (?,?,?,?,'implied_publication',?,?,?,1,?,?,NULL,?)")
      .run(id("cs"), ct, ORG, o.brandId || "drdsports", "https://club.example/staff",
        "evidence/s.png", "Website pitch", Date.now(), "test", Date.now());
  }
  return ct;
}

const SEQ2 = [
  { step: 1, subject: "{{company}} player records", body: "Hi {{first_name}},\n\nAbout {{company}} in {{city}}.\n\nDr. D" },
  { step: 2, delayHours: 72, subject: "Re: {{company}} player records", body: "Hi {{first_name}}, following up.\n\nDr. D" },
];

seqs.registerJobs(runner);

(async () => {

section("Templating — and refusing to send a half-rendered message");
{
  const r = seqs.render("Hi {{first_name}}, about {{company}}.", { first_name: "Jane", company: "Northgate" });
  ok("variables are substituted", r.text === "Hi Jane, about Northgate.", r.text);
  ok("nothing reported missing", r.missing.length === 0);

  const m = seqs.render("Hi {{first_name}}, your {{sport}} club", { first_name: "Jane" });
  ok("a missing variable is reported", m.missing.includes("sport"), m.missing.join(","));
  ok("the placeholder stays visible so it can be quoted", /\{\{\s*sport\s*\}\}/.test(m.text), m.text);

  const f = seqs.render("Hi {{first_name|there}},", {});
  ok("an explicit fallback is used", f.text === "Hi there,", f.text);
  ok("a fallback is not counted as missing", f.missing.length === 0);

  const blank = seqs.render("Hi {{first_name}},", { first_name: "   " });
  ok("whitespace counts as missing, not as a value", blank.missing.includes("first_name"));
}

section("Sequence validation");
{
  ok("an empty sequence is rejected", seqs.validateSequence([]).length > 0);
  ok("a step with no subject is rejected",
    seqs.validateSequence([{ body: "x" }]).some((e) => /subject/.test(e)));
  ok("a delay on step 1 is rejected",
    seqs.validateSequence([{ subject: "s", body: "b", delayHours: 24 }]).some((e) => /step 1/.test(e)));
  ok("a zero-delay follow-up is rejected",
    seqs.validateSequence([{ subject: "s", body: "b" }, { subject: "s", body: "b", delayHours: 0 }])
      .some((e) => /delayHours/.test(e)));
  const long = Array.from({ length: 8 }, (_, i) => ({ subject: "s", body: "b", delayHours: i ? 24 : 0 }));
  ok("a sequence over 6 steps is refused outright",
    seqs.validateSequence(long).some((e) => /harassment/.test(e)));
  ok("a good two-step sequence validates", seqs.validateSequence(SEQ2).length === 0,
    seqs.validateSequence(SEQ2).join("; "));
}

section("Enrolment screens before it enrols");
{
  const cid = mkCampaign(SEQ2);
  const good = mkContact("director@northgate.example", "Jane Coach");
  const noConsent = mkContact("noconsent@other.example", "No Consent", { consent: false });
  const noName = mkContact("noname@third.example", null);   // whitespace-only name

  const r = seqs.enrol(db, ORG, cid, [good, noConsent, noName]);
  ok("enrolment succeeded", r.ok === true, JSON.stringify(r).slice(0, 150));
  ok("only the eligible contact was enrolled", r.enrolled === 1, "enrolled=" + r.enrolled);
  ok("the contact with no consent was rejected", !!r.rejectedByReason.no_consent_record,
    JSON.stringify(r.rejectedByReason));
  // A contact with no name would render "Hi ," — caught at enrolment, not at
  // send time, which is the whole point of the dry run.
  ok("a contact that would break the template is rejected up front",
    !!r.rejectedByReason.unresolved_template_variable, JSON.stringify(r.rejectedByReason));
  ok("a first step was queued for the enrolled contact",
    db.prepare("SELECT COUNT(*) n FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ?").get('%' + good + '%').n === 1);

  const again = seqs.enrol(db, ORG, cid, [good]);
  ok("re-enrolling the same contact is rejected", !!again.rejectedByReason.already_enrolled,
    JSON.stringify(again.rejectedByReason));
}

section("A full two-step run");
{
  const cid = mkCampaign(SEQ2);
  const ct = mkContact("run@runclub.example", "Sam Director");
  seqs.enrol(db, ORG, cid, [ct]);

  const r1 = await runner.drain(db, { batchSize: 10 });
  ok("step 1 ran", r1.done >= 1, JSON.stringify(r1).slice(0, 120));
  const send1 = db.prepare("SELECT * FROM sends WHERE campaign_id=? AND step=1").get(cid);
  ok("a send row exists for step 1", !!send1);
  ok("it was sent", send1.state === "SENT", send1.state + " " + (send1.skip_reason || ""));
  ok("the subject rendered with the company name",
    /Northgate Soccer Club player records/.test(send1.subject), send1.subject);
  ok("the body rendered the first name", /Hi Sam,/.test(send1.body), send1.body.slice(0, 60));
  ok("the body carries the city", /Oshawa/.test(send1.body));
  ok("no placeholder survived into the body", !/\{\{/.test(send1.body));
  ok("the footer and unsubscribe are present",
    /Unsubscribe here: https:\/\//.test(send1.body) && /T Inc\./.test(send1.body));

  const lead = db.prepare("SELECT * FROM campaign_leads WHERE campaign_id=? AND contact_id=?").get(cid, ct);
  ok("the lead advanced to step 1", lead.step === 1, "step=" + lead.step);
  ok("the lead is Active", lead.status === "Active", lead.status);

  const nextJob = db.prepare("SELECT * FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ? AND payload_json LIKE '%\"step\":2%'").get('%' + ct + '%');
  ok("step 2 was queued", !!nextJob);
  ok("step 2 is scheduled ~72h out",
    nextJob && Math.abs((nextJob.run_at - Date.now()) - 72 * 3600000) < 60000,
    nextJob && Math.round((nextJob.run_at - Date.now()) / 3600000) + "h");

  // Fast-forward and run step 2.
  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, nextJob.id);
  await runner.drain(db, { batchSize: 10 });
  const send2 = db.prepare("SELECT * FROM sends WHERE campaign_id=? AND step=2").get(cid);
  ok("step 2 sent", send2 && send2.state === "SENT", send2 && send2.state);
  ok("the sequence is marked complete",
    db.prepare("SELECT status FROM campaign_leads WHERE campaign_id=? AND contact_id=?").get(cid, ct).status === "Done");
}

section("A reply ends the sequence");
{
  const cid = mkCampaign(SEQ2);
  const ct = mkContact("replier@replyclub.example", "Pat Director");
  seqs.enrol(db, ORG, cid, [ct]);
  await runner.drain(db, { batchSize: 10 });
  const send1 = db.prepare("SELECT * FROM sends WHERE campaign_id=? AND step=1").get(cid);
  ok("step 1 went out", send1 && send1.state === "SENT");

  // They reply.
  const replies = require("./replies.js");
  replies.ingestOne(db, ORG, {
    gmailId: "gm_seq_1", threadId: null, headers: {}, from: "replier@replyclub.example",
    fromName: "Pat", subject: "Re: records", at: Date.now(),
    body: "Yes, interested. What does it cost?", rawBody: "Yes, interested.",
  });

  // Step 2 is due.
  const job = db.prepare("SELECT * FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ? AND payload_json LIKE '%\"step\":2%'").get('%' + ct + '%');
  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, job.id);
  await runner.drain(db, { batchSize: 10 });

  const send2 = db.prepare("SELECT * FROM sends WHERE campaign_id=? AND step=2").get(cid);
  ok("step 2 did NOT send after a reply", !send2, send2 && send2.state);
  const lead = db.prepare("SELECT * FROM campaign_leads WHERE campaign_id=? AND contact_id=?").get(cid, ct);
  ok("the lead exited", lead.status === "Exited", lead.status);
  ok("the exit reason is recorded as replied", lead.exit_reason === "replied", lead.exit_reason);
  ok("the exit is timestamped", !!lead.exited_at);
}

section("An auto-reply does NOT end the sequence");
{
  const cid = mkCampaign(SEQ2);
  const ct = mkContact("away@awayclub.example", "Away Director");
  seqs.enrol(db, ORG, cid, [ct]);
  await runner.drain(db, { batchSize: 10 });

  require("./replies.js").ingestOne(db, ORG, {
    gmailId: "gm_seq_ooo", threadId: null, headers: { "auto-submitted": "auto-replied" },
    from: "away@awayclub.example", fromName: "Away", subject: "Automatic reply",
    at: Date.now(), body: "I am out of the office.", rawBody: "I am out of the office.",
  });
  ok("out-of-office is not treated as a reply",
    seqs.exitReason(db, ORG, cid, ct) === null, String(seqs.exitReason(db, ORG, cid, ct)));
}

section("Suppression and opt-out stop the sequence");
{
  const cid = mkCampaign(SEQ2);
  const ct = mkContact("gone@goneclub.example", "Gone Director");
  seqs.enrol(db, ORG, cid, [ct]);
  await runner.drain(db, { batchSize: 10 });
  const tok = sending.unsubToken(db, ORG, ct);
  sending.unsubscribe(db, ORG, tok);
  ok("the exit reason is suppression", seqs.exitReason(db, ORG, cid, ct) === "suppressed");

  const job = db.prepare("SELECT * FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ? AND payload_json LIKE '%\"step\":2%'").get('%' + ct + '%');
  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, job.id);
  await runner.drain(db, { batchSize: 10 });
  ok("no step 2 send exists",
    !db.prepare("SELECT 1 FROM sends WHERE campaign_id=? AND step=2").get(cid));
}

section("Rule 3 — a step cannot be sent twice");
{
  const cid = mkCampaign(SEQ2);
  const ct = mkContact("dupe@dupeclub.example", "Dupe Director");
  seqs.enrol(db, ORG, cid, [ct]);
  // Try hard to double-enqueue step 1 the way a retry or a second tick would.
  const key = "seq:" + cid + ":" + ct + ":1";
  const a = runner.enqueue(db, ORG, "sequence.step", { campaignId: cid, contactId: ct, step: 1 }, { idempotencyKey: key });
  const b = runner.enqueue(db, ORG, "sequence.step", { campaignId: cid, contactId: ct, step: 1 }, { idempotencyKey: key });
  ok("the duplicate enqueue is rejected", a.duplicate === true || b.duplicate === true);
  await runner.drain(db, { batchSize: 10 });
  await runner.drain(db, { batchSize: 10 });
  const n = db.prepare("SELECT COUNT(*) n FROM sends WHERE campaign_id=? AND contact_id=? AND step=1").get(cid, ct).n;
  ok("exactly one step-1 send exists", n === 1, "sends=" + n);
}

section("Rule 4 — the send window, in the mailbox timezone");
{
  // Monday 02:40 UTC: a weekday, but the middle of the night.
  const night = Date.UTC(2026, 9, 12, 2, 40);
  const w = { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 16 };
  const closed = seqs.windowCheck(w, "UTC", night);
  ok("02:40 is outside an 08-16 window", closed.inside === false);
  ok("the next opening is computed", closed.nextOpen > night, String(closed.nextOpen));
  ok("the next opening is inside the window",
    seqs.windowCheck(w, "UTC", closed.nextOpen).inside === true);

  const day = Date.UTC(2026, 9, 12, 10, 0);
  ok("10:00 Monday is inside", seqs.windowCheck(w, "UTC", day).inside === true);

  const sat = Date.UTC(2026, 9, 17, 10, 0);
  ok("Saturday is outside a weekdays-only window", seqs.windowCheck(w, "UTC", sat).inside === false);

  // Timezone actually matters: 10:00 UTC is 06:00 in Toronto, before the window.
  ok("the window is evaluated in the mailbox timezone, not UTC",
    seqs.windowCheck(w, "America/Toronto", day).inside === false,
    "10:00 UTC = 06:00 Toronto");

  ok("an invalid timezone is treated as closed rather than sending anyway",
    seqs.windowCheck(w, "Not/AZone", day).inside === false);

  // End to end: a step due at night is deferred, not dropped or sent.
  const cid = mkCampaign(SEQ2, { window: JSON.stringify(w) });
  const ct = mkContact("night@nightclub.example", "Night Director");
  seqs.enrol(db, ORG, cid, [ct]);
  const job = db.prepare("SELECT * FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ?").get('%' + ct + '%');
  const res = seqs.runStep(db, ORG, { campaignId: cid, contactId: ct, step: 1 }, night);
  ok("the step is deferred outside the window", res.decision === "deferred_outside_window",
    JSON.stringify(res));
  ok("nothing was sent", !db.prepare("SELECT 1 FROM sends WHERE campaign_id=?").get(cid));
  ok("it was re-queued for the window opening",
    db.prepare("SELECT COUNT(*) n FROM jobs WHERE kind='sequence.step' AND payload_json LIKE ?").get('%' + ct + '%').n >= 1);
}

section("Rule 1 — an unresolved variable blocks the send and raises an alert");
{
  const badSeq = [{ step: 1, subject: "About {{company}}", body: "Hi {{first_name}}, your {{sport_name}} programme." }];
  const cid = mkCampaign(badSeq);
  const ct = mkContact("tmpl@tmplclub.example", "Tee Director");
  // Enrolment catches it first, which is correct.
  const r = seqs.enrol(db, ORG, cid, [ct]);
  ok("enrolment rejects a template with an unknown variable",
    !!r.rejectedByReason.unresolved_template_variable, JSON.stringify(r.rejectedByReason));

  // Force the runtime path: enrol by hand, bypassing the dry run, as would
  // happen if the template were edited after enrolment.
  db.prepare("INSERT INTO campaign_leads (id,campaign_id,contact_id,status,step,added_at) VALUES (?,?,?,'Queued',0,?)")
    .run(id("cl"), cid, ct, Date.now());
  const res = seqs.runStep(db, ORG, { campaignId: cid, contactId: ct, step: 1 });
  ok("the run is blocked", res.decision === "blocked_unresolved_variable", JSON.stringify(res));
  ok("the missing variable is named", (res.missing || []).includes("sport_name"), JSON.stringify(res.missing));
  const skipped = db.prepare("SELECT * FROM sends WHERE campaign_id=? AND state='SKIPPED'").get(cid);
  ok("a skipped row records why", skipped && skipped.skip_reason === "unresolved_template_variable",
    skipped && skipped.skip_reason);
  ok("no body was stored for an unsent message", skipped && !skipped.body);
  ok("an alert names the campaign and the variable",
    sending.openAlerts(db, ORG).some((a) => a.kind === "template_variable_missing" && /sport_name/.test(a.detail || "")));
  ok("the lead is Blocked, not silently stuck",
    db.prepare("SELECT status FROM campaign_leads WHERE campaign_id=? AND contact_id=?").get(cid, ct).status === "Blocked");
}

section("A paused campaign stops sending");
{
  const cid = mkCampaign(SEQ2, { status: "Paused" });
  const ct = mkContact("paused@pausedclub.example", "Paused Director");
  db.prepare("INSERT INTO campaign_leads (id,campaign_id,contact_id,status,step,added_at) VALUES (?,?,?,'Queued',0,?)")
    .run(id("cl"), cid, ct, Date.now());
  const res = seqs.runStep(db, ORG, { campaignId: cid, contactId: ct, step: 1 });
  ok("a paused campaign does not send", res.decision === "campaign_not_active", JSON.stringify(res));
  ok("nothing was sent", !db.prepare("SELECT 1 FROM sends WHERE campaign_id=?").get(cid));
}

section("Status reporting answers 'where is everybody'");
{
  const cid = mkCampaign(SEQ2);
  const cts = [];
  for (let i = 0; i < 5; i++) cts.push(mkContact("st" + i + "@statusclub.example", "Person " + i));
  seqs.enrol(db, ORG, cid, cts);
  await runner.drain(db, { batchSize: 20 });
  const st = seqs.status(db, ORG, cid);
  ok("leads are counted by status", Object.keys(st.leadsByStatus).length > 0, JSON.stringify(st.leadsByStatus));
  ok("sends are counted by state", (st.sendsByState.SENT || 0) === 5, JSON.stringify(st.sendsByState));
  ok("pending steps are counted", st.stepsPending === 5, "pending=" + st.stepsPending);
  ok("reply rate is null before any reply", st.replyRatePct === 0 || st.replyRatePct === null,
    String(st.replyRatePct));
  ok("skip reasons are listed", Array.isArray(st.skipReasons));
}

  console.log("\n" + "=".repeat(62));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nA half-rendered message never sends, a reply ends the sequence,");
    console.log("a step cannot go twice, nothing goes out at 3am, and every stop");
    console.log("is recorded with a reason.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(62));
  db.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("sequence tests crashed:", e); process.exit(1); });
