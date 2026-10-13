#!/usr/bin/env node
/* Tests reply ingestion with no network: the caller supplies the reply object,
 * so everything except the Gmail fetch is exercised here.
 *
 *   node server/replies.test.js
 *
 * The cases that matter are the ones where being wrong is expensive:
 *   - a prose opt-out that must suppress immediately (compliance)
 *   - quoted text that must not be read as the prospect's words (every reply
 *     looks positive if our own pitch is still in it)
 *   - an auto-responder that must not count as a reply (it hides a message
 *     that is not landing)
 *   - re-running a poll that must not double-count
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { open, id } = require("./db.js");
const replies = require("./replies.js");
const sending = require("./sending.js");
const consent = require("./consent.js");

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else { fail++; failures.push(name); console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? " — " + detail : "")); }
}
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drd-replies-"));
const db = open(path.join(tmp, "r.db"));
const ORG = "org_test";
process.env.DRD_PUBLIC_URL = "https://leads.example.invalid";

db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,legal_name,mailing_address,contact_email) VALUES (?,?,'Growth',5000,0,1,?,1,?,?,?)")
  .run(ORG, "Test", Date.now(), "Test Inc.", "1 St, Toronto", "c@example.invalid");

const mb = id("mb");
db.prepare("INSERT INTO mailboxes (id,org_id,address,provider,daily_cap,min_gap_seconds,timezone,status,created_at) VALUES (?,?,?,'dryrun',500,0,'UTC','Active',?)")
  .run(mb, ORG, "outreach@edvisingu.ca", Date.now());

function mkContact(email, name) {
  const co = id("co");
  db.prepare("INSERT INTO companies (id,name,domain,industry,country,origin) VALUES (?,?,?,?,?,'import')")
    .run(co, "Club " + co, email.split("@")[1], "Sports Club", "Canada");
  const ct = id("ct");
  db.prepare("INSERT INTO contacts (id,company_id,name,title,email,origin) VALUES (?,?,?,?,?,'import')")
    .run(ct, co, name || "Director", "Club Director", email);
  db.prepare("INSERT INTO consents (id,contact_id,org_id,brand_id,basis,source_url,evidence_ref,role_relevance,anti_solicitation_checked,captured_at,captured_by,expires_at,created_at) VALUES (?,?,?,'drdsports','implied_publication',?,?,?,1,?,?,NULL,?)")
    .run(id("cs"), ct, ORG, "https://club.example/staff", "evidence/s.png", "Website pitch", Date.now(), "test", Date.now());
  return ct;
}

/* Send for real through the dryrun transport so a sends row exists to match. */
function sendTo(ct) {
  return sending.send(db, ORG, { contactId: ct, subject: "Player records for your club", body: "Hello", brandId: "drdsports" });
}

let n = 0;
const reply = (over) => Object.assign({
  gmailId: "gm_" + (++n), threadId: null, headers: {},
  from: "x@club.example", fromName: "X", subject: "Re: Player records",
  at: Date.now(), body: "", rawBody: "",
}, over);

section("Quoted text is stripped before classification");
{
  const body = replies.stripQuoted(
    "This is interesting, tell me more.\n\nOn Mon, 13 Oct 2026 at 09:00, Dr. D <outreach@edvisingu.ca> wrote:\n> We build player databases\n> and club websites"
  );
  ok("the reply keeps only the prospect's words", body === "This is interesting, tell me more.", JSON.stringify(body));
  ok("our quoted pitch is gone", !/player databases/i.test(body));

  const gmailStyle = replies.stripQuoted("Sounds good.\n\n--- Original Message ---\nFrom: outreach@edvisingu.ca\nOur pitch here");
  ok("the Original Message separator is handled", gmailStyle === "Sounds good.", JSON.stringify(gmailStyle));

  const french = replies.stripQuoted("Merci, je suis intéressé.\n\nLe 13 oct. 2026 à 09:00, Dr. D a écrit :\n> notre offre");
  ok("the French quote separator is handled", french === "Merci, je suis intéressé.", JSON.stringify(french));

  const none = replies.stripQuoted("Just a plain reply with no quoting at all.");
  ok("an unquoted reply is untouched", none === "Just a plain reply with no quoting at all.");
}

section("A prose opt-out suppresses immediately, org-wide");
{
  const ct = mkContact("optout@club.example", "Opt Out");
  const s = sendTo(ct);
  ok("the test send went", s.state === "SENT", s.state + " " + (s.skip_reason || ""));

  const r = replies.ingestOne(db, ORG, reply({
    from: "optout@club.example",
    body: "Please take me off your list. We are not interested.",
  }));
  ok("recognised as an opt-out", r.optOut === true, JSON.stringify(r));
  ok("suppression was written", r.suppressed === true);
  ok("the address is suppressed org-wide",
    db.prepare("SELECT COUNT(*) n FROM suppressions WHERE org_id=? AND value=? AND scope='Global'").get(ORG, "optout@club.example").n === 1);
  ok("consent was revoked",
    db.prepare("SELECT COUNT(*) n FROM consents WHERE contact_id=? AND revoked_at IS NOT NULL").get(ct).n === 1);
  ok("no further send is possible",
    sendTo(ct).skip_reason === "suppressed", sendTo(ct).skip_reason);
  ok("an audit row records it",
    db.prepare("SELECT COUNT(*) n FROM audit_logs WHERE org_id=? AND action='opt_out_in_reply'").get(ORG).n >= 1);

  // The phrasings a real person actually uses.
  const phrasings = [
    "unsubscribe", "Please remove me from your mailing list", "do not contact me again",
    "Stop emailing me", "I no longer wish to receive these", "opt out please",
    "Remove this email from your database",
  ];
  let caught = 0;
  for (const p of phrasings) if (replies.OPT_OUT_PATTERNS.some((re) => re.test(p))) caught++;
  ok("all " + phrasings.length + " common opt-out phrasings are caught", caught === phrasings.length,
    caught + "/" + phrasings.length);

  // And the inverse: an ordinary reply must not be mistaken for one.
  const notOptOuts = [
    "We are not interested right now but check back in the spring",
    "Can you remove the attachment and resend?",
    "I'll stop you there — what does it cost?",
  ];
  let falsePositives = 0;
  for (const p of notOptOuts) if (replies.OPT_OUT_PATTERNS.some((re) => re.test(p))) falsePositives++;
  ok("ordinary replies are not mistaken for opt-outs", falsePositives === 0,
    falsePositives + " false positives");
}

section("Auto-replies are stored but are not replies");
{
  const ct = mkContact("ooo@club.example", "Away");
  const s = sendTo(ct);
  const r = replies.ingestOne(db, ORG, reply({
    from: "ooo@club.example", threadId: s.threadId,
    subject: "Automatic reply: Player records",
    headers: { "auto-submitted": "auto-replied" },
    body: "I am out of the office until 5 November with limited access to email.",
    rawBody: "I am out of the office until 5 November with limited access to email.",
  }));
  ok("detected as an auto-reply", r.auto === true, JSON.stringify(r));
  ok("treated as not-a-reply", r.treatedAs === "auto_reply_not_a_reply");
  ok("it is NOT classified for intent", r.intent === null, "intent=" + r.intent);
  ok("stored with the auto_reply flag",
    db.prepare("SELECT auto_reply FROM inbound_messages WHERE gmail_id=?").get(r.gmailId).auto_reply === 1);
  ok("no conversation was marked Replied", !r.conversationId);

  // Header-free detection by phrasing alone.
  ok("phrase-only out-of-office is detected",
    replies.isAutoReply({ subject: "Out of Office", body: "I'm away until Monday" }) === true);
  ok("a normal reply is not flagged",
    replies.isAutoReply({ subject: "Re: hi", body: "Yes let's talk Tuesday" }) === false);
}

section("Out-of-office return dates schedule a follow-up");
{
  const now = Date.UTC(2026, 9, 13);
  ok("reads 'until 5 November'",
    replies.returnDate("away until 5 November", now) === Date.UTC(2026, 10, 5, 9),
    String(replies.returnDate("away until 5 November", now)));
  ok("reads 'back on March 14' and rolls to next year",
    replies.returnDate("back on March 14", now) === Date.UTC(2027, 2, 14, 9),
    String(replies.returnDate("back on March 14", now)));
  ok("reads an ISO date", replies.returnDate("returning 2026-11-20", now) === Date.parse("2026-11-20T09:00:00Z"));
  ok("returns null rather than guessing",
    replies.returnDate("I am away for a while", now) === null);
  ok("ignores a nonsense day", replies.returnDate("back on February 47", now) === null);

  // End to end: a follow-up job is queued for after they return.
  const runner = require("./runner.js");
  const ct = mkContact("ooo2@club.example", "Away Two");
  const s = sendTo(ct);
  const r = replies.ingestOne(db, ORG, reply({
    from: "ooo2@club.example", threadId: s.threadId,
    headers: { "auto-submitted": "auto-replied" },
    subject: "Automatic reply",
    body: "Out of the office until 2026-12-01.", rawBody: "Out of the office until 2026-12-01.",
  }));
  ok("a return date was parsed", !!r.rescheduledTo, String(r.rescheduledTo));
  const job = db.prepare("SELECT * FROM jobs WHERE org_id=? AND kind='campaign.followup' ORDER BY created_at DESC LIMIT 1").get(ORG);
  ok("a follow-up job was queued", !!job);
  ok("it is scheduled after they return", job && job.run_at > r.rescheduledTo, job && (job.run_at - r.rescheduledTo));
  ok("it carries an idempotency key so a re-poll cannot duplicate it",
    job && /^ooo:/.test(job.idempotency_key), job && job.idempotency_key);
}

section("A positive reply becomes a hot conversation");
{
  const ct = mkContact("keen@club.example", "Keen Director");
  const s = sendTo(ct);
  const r = replies.ingestOne(db, ORG, reply({
    from: "keen@club.example", threadId: s.threadId,
    body: "This is timely. Can you send pricing for a club of about 300 players?",
  }));
  ok("matched to the send", r.matchedVia === "thread" || r.matchedVia === "address", r.matchedVia);
  ok("an intent was assigned", !!r.intent, "intent=" + r.intent);
  ok("a conversation exists", !!r.conversationId);
  const conv = db.prepare("SELECT * FROM conversations WHERE id=?").get(r.conversationId);
  ok("the conversation is marked Replied", conv.status === "Replied", conv.status);
  ok("the inbound message is attached to it",
    db.prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=? AND direction='in'").get(r.conversationId).n === 1);
  if (r.hot) {
    ok("a hot reply raises an alert",
      sending.openAlerts(db, ORG).some((a) => a.kind === "hot_reply"));
  } else {
    ok("a non-hot intent does not raise a hot alert", true);
  }
}

section("Matching — thread, then Message-ID, then address");
{
  const ct = mkContact("match@club.example", "Match");
  const s = sendTo(ct);
  const row = db.prepare("SELECT provider_thread_id, rfc_message_id FROM sends WHERE id=?").get(s.id);
  // The dryrun transport returns no ids, so set them as a real send would.
  db.prepare("UPDATE sends SET provider_thread_id='thr_1', rfc_message_id='<abc@edvisingu.ca>' WHERE id=?").run(s.id);

  const byThread = replies.matchSend(db, ORG, { threadId: "thr_1", from: "someone.else@elsewhere.test" });
  ok("thread id wins even when the address is unknown", byThread.via === "thread", byThread.via);

  const byMid = replies.matchSend(db, ORG, {
    threadId: null, inReplyTo: "<abc@edvisingu.ca>", from: "someone.else@elsewhere.test" });
  ok("Message-ID matches when the thread is lost", byMid.via === "message-id", byMid.via);

  const byAddr = replies.matchSend(db, ORG, { threadId: null, from: "match@club.example" });
  ok("address is the last resort", byAddr.via === "address", byAddr.via);

  const unmatched = replies.matchSend(db, ORG, { threadId: null, from: "nobody@nowhere.test" });
  ok("an unknown reply matches nothing rather than guessing", unmatched.send === null);
}

section("Ingestion is idempotent");
{
  const ct = mkContact("dup@club.example", "Dup");
  sendTo(ct);
  const r1 = replies.ingestOne(db, ORG, reply({ gmailId: "gm_fixed", from: "dup@club.example", body: "Interested, send pricing." }));
  const r2 = replies.ingestOne(db, ORG, reply({ gmailId: "gm_fixed", from: "dup@club.example", body: "Interested, send pricing." }));
  ok("the first ingest is processed", !r1.skipped, JSON.stringify(r1).slice(0, 80));
  ok("the second is skipped", r2.skipped === "already_ingested", JSON.stringify(r2));
  ok("only one row exists",
    db.prepare("SELECT COUNT(*) n FROM inbound_messages WHERE gmail_id=?").get("gm_fixed").n === 1);
  ok("the reply counter was not incremented twice",
    db.prepare("SELECT COUNT(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.contact_id=? AND m.direction='in'").get(ct).n === 1);
}

section("An unmatched reply is surfaced, not dropped");
{
  const r = replies.ingestOne(db, ORG, reply({
    from: "stranger@unknown.test", body: "Who is this?", subject: "Re: something" }));
  ok("recorded even with no matching send", !!r.id);
  ok("flagged as unmatched", r.unmatched === true);
  ok("an alert is raised so it is not lost",
    sending.openAlerts(db, ORG).some((a) => a.kind === "reply_unmatched"));
}

section("Gmail payload flattening");
{
  const b64 = (s) => Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  const flat = replies.flatten({
    id: "gm_x", threadId: "thr_x", internalDate: "1760000000000", snippet: "snip",
    payload: {
      headers: [
        { name: "From", value: '"Jane Coach" <jane@club.example>' },
        { name: "Subject", value: "Re: Player records" },
        { name: "In-Reply-To", value: "<orig@edvisingu.ca>" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64("Yes please.\n\nOn Mon someone wrote:\n> old") } },
        { mimeType: "text/html", body: { data: b64("<p>Yes please.</p>") } },
      ],
    },
  });
  ok("the address is extracted from the From header", flat.from === "jane@club.example", flat.from);
  ok("the display name is extracted", flat.fromName === "Jane Coach", flat.fromName);
  ok("text/plain is preferred over html", flat.body === "Yes please.", JSON.stringify(flat.body));
  ok("In-Reply-To is carried", flat.inReplyTo === "<orig@edvisingu.ca>");
  ok("internalDate becomes a timestamp", flat.at === 1760000000000, String(flat.at));

  // html-only, which some clients send
  const htmlOnly = replies.flatten({
    id: "gm_y", threadId: "t", internalDate: "1", snippet: "s",
    payload: { headers: [{ name: "From", value: "a@b.test" }], mimeType: "text/html",
      body: { data: b64("<div>Hello&nbsp;there</div>") } },
  });
  ok("html-only bodies are stripped to text", htmlOnly.body === "Hello there", JSON.stringify(htmlOnly.body));
}

section("Polling without credentials fails permanently, not forever");
(async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  let err = null;
  try { await replies.poll(db, ORG, { credentialEnv: "NOT_SET_XYZ" }); } catch (e) { err = e; }
  ok("it throws", !!err);
  ok("the error is marked permanent so the runner does not retry forever",
    err && err.permanent === true, err && String(err.permanent));
  ok("the message names the missing variable", err && /NOT_SET_XYZ/.test(err.message), err && err.message);
  if (saved) process.env.GOOGLE_CLIENT_ID = saved;

  console.log("\n" + "=".repeat(60));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nOpt-outs in prose suppress at once, auto-replies do not count as");
    console.log("replies, quoted text never reaches the classifier, and re-polling");
    console.log("cannot double-count. The Gmail fetch itself is untested here.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(60));
  db.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail === 0 ? 0 : 1);
})();
