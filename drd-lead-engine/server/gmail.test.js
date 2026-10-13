#!/usr/bin/env node
/* Tests the half of the Gmail transport that can be verified offline: message
 * construction. This is the part that fails silently — a malformed header or a
 * missing unsubscribe header does not throw, it just produces mail that gets
 * filtered or that breaches the one-click unsubscribe expectation.
 *
 *   node server/gmail.test.js
 *
 * The network half (OAuth, the API call) cannot be exercised here: this build
 * environment's egress gateway denies general web hosts. Those paths are
 * covered by asserting the error handling instead, and must be confirmed
 * against a real account once credentials exist.
 */
"use strict";

const g = require("./transports/gmail.js");

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else { fail++; failures.push(name); console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? " — " + detail : "")); }
}
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

/* Parse a built MIME string back into headers for assertions, unfolding
 * continuation lines as a real parser would. */
function parse(mime) {
  const [head, body] = mime.split("\r\n\r\n");
  const headers = {};
  const lines = head.split("\r\n");
  let current = null;
  for (const line of lines) {
    if (/^\s/.test(line) && current) {
      headers[current] = (headers[current] ? headers[current] + " " : "") + line.trim();
      continue;
    }
    const i = line.indexOf(":");
    if (i < 0) continue;
    current = line.slice(0, i);
    headers[current] = line.slice(i + 1).trim();
  }
  return { headers, body };
}

section("Headers — the basics");
{
  const mime = g.buildMime({
    from: "outreach@edvisingu.ca", fromName: "Dr. D",
    to: "ad@examplehigh.ca", toName: "Sample Director",
    subject: "Athletics website and player records",
    body: "Hello there.\n\nRegards",
  });
  const { headers, body } = parse(mime);
  ok("From carries the display name", headers.From === '"Dr. D" <outreach@edvisingu.ca>', headers.From);
  ok("To carries the display name", headers.To === '"Sample Director" <ad@examplehigh.ca>', headers.To);
  ok("Subject is present", headers.Subject === "Athletics website and player records", headers.Subject);
  ok("MIME-Version set", headers["MIME-Version"] === "1.0");
  ok("Message-ID is angle-bracketed and domain-qualified",
    /^<[0-9a-f]{32}@edvisingu\.ca>$/.test(headers["Message-ID"]), headers["Message-ID"]);
  ok("Date is RFC 822", !Number.isNaN(Date.parse(headers.Date)), headers.Date);
  ok("charset is declared utf-8", /charset="UTF-8"/i.test(headers["Content-Type"]), headers["Content-Type"]);
  ok("transfer encoding is base64", headers["Content-Transfer-Encoding"] === "base64");
  ok("body round-trips exactly",
    Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8") === "Hello there.\n\nRegards");
  ok("headers and body separated by a blank line", mime.includes("\r\n\r\n"));
  ok("every line ends CRLF", !/[^\r]\n/.test(mime));
}

section("One-click unsubscribe — RFC 8058");
{
  const url = "https://leads.edvisingu.ca/u/abc-123_XYZ";
  const mime = g.buildMime({
    from: "o@edvisingu.ca", to: "x@y.ca", subject: "s", body: "b", unsubscribeUrl: url,
  });
  const { headers } = parse(mime);
  ok("List-Unsubscribe is angle-bracketed", headers["List-Unsubscribe"] === "<" + url + ">",
    headers["List-Unsubscribe"]);
  // The value must be exactly this. A variation is not honoured and the
  // sender gets no benefit while believing it has one.
  ok("List-Unsubscribe-Post is exactly the required value",
    headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click",
    headers["List-Unsubscribe-Post"]);
  ok("the URL is https", /^https:/.test(url));

  const without = parse(g.buildMime({ from: "o@e.ca", to: "x@y.ca", subject: "s", body: "b" }));
  ok("no unsubscribe headers when no URL is supplied",
    !without.headers["List-Unsubscribe"] && !without.headers["List-Unsubscribe-Post"]);
}

section("Non-ASCII — encoded-words, not mojibake");
{
  const mime = g.buildMime({
    from: "o@edvisingu.ca", fromName: "André de Freitas",
    to: "x@y.ca", toName: "Zoë Müller",
    subject: "Évaluation de l'état de préparation à l'IA",
    body: "Bonjour — ça va?",
  });
  const { headers, body } = parse(mime);
  ok("accented subject is RFC 2047 encoded", /^=\?UTF-8\?B\?/.test(headers.Subject), headers.Subject);
  const decodeEW = (v) => String(v).split(/\s+/)
    .map((w) => /^=\?UTF-8\?B\?.*\?=$/.test(w)
      ? Buffer.from(w.slice(10, -2), "base64").toString("utf8") : w)
    .join("");
  ok("encoded subject decodes back",
    decodeEW(headers.Subject) === "Évaluation de l'état de préparation à l'IA",
    decodeEW(headers.Subject));
  // Each encoded-word must fit the 75-character limit on its own.
  const words = String(headers.Subject).split(/\s+/).filter((w) => w.startsWith("=?"));
  ok("the value is split into several encoded-words", words.length > 1, "words=" + words.length);
  ok("every encoded-word is within the 75-character limit",
    words.every((w) => w.length <= 75), words.map((w) => w.length).join(","));
  ok("accented display name is encoded, not quoted",
    headers.From.startsWith("=?UTF-8?B?") && headers.From.includes("<o@edvisingu.ca>"), headers.From);
  ok("accented body round-trips",
    Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8") === "Bonjour — ça va?");
  ok("no raw non-ASCII leaks into the header block",
    /^[\x00-\x7F]*$/.test(mime.split("\r\n\r\n")[0]));
}

section("Header injection cannot smuggle headers");
{
  // A contact name from an imported CSV is untrusted input. If it reaches a
  // header unescaped, a crafted value could add Bcc and silently copy mail
  // to a third party.
  const mime = g.buildMime({
    from: "o@edvisingu.ca", to: "x@y.ca",
    toName: 'Evil"\r\nBcc: attacker@elsewhere.test',
    subject: "Innocent\r\nBcc: attacker@elsewhere.test",
    body: "b",
  });
  const head = mime.split("\r\n\r\n")[0];
  ok("a CRLF in a display name does not create a new header",
    !/^Bcc:/im.test(head), head.slice(0, 300));
  ok("a CRLF in the subject does not create a new header",
    !/^Bcc:/im.test(head));
  ok("no attacker address appears in the header block",
    !head.includes("attacker@elsewhere.test"), head.slice(0, 300));
}

section("Long headers fold at 78 columns");
{
  const long = "Re: " + "a very long subject line about athletic department records ".repeat(4);
  const mime = g.buildMime({ from: "o@e.ca", to: "x@y.ca", subject: long, body: "b" });
  const head = mime.split("\r\n\r\n")[0];
  const over = head.split("\r\n").filter((l) => l.length > 78);
  ok("no header line exceeds 78 characters", over.length === 0, over[0]);
  const { headers } = parse(mime);
  ok("the folded subject unfolds to the original",
    headers.Subject.replace(/\s+/g, " ") === long.replace(/\s+/g, " ").trim(), headers.Subject);
}

section("Threading — a follow-up joins the conversation");
{
  const first = g.messageId("edvisingu.ca");
  const mime = g.buildMime({
    from: "o@e.ca", to: "x@y.ca", subject: "Re: s", body: "b",
    inReplyTo: first,
  });
  const { headers } = parse(mime);
  ok("In-Reply-To is set", headers["In-Reply-To"] === first);
  ok("References defaults to In-Reply-To when not given", headers.References === first);
}

section("base64url encoding for the API");
{
  const raw = g.toRaw("From: a@b.ca\r\n\r\n" + "ÿþ".repeat(20));
  ok("no plus characters", !raw.includes("+"));
  ok("no slash characters", !raw.includes("/"));
  ok("no padding", !raw.includes("="));
  ok("decodes back to the original",
    Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      .startsWith("From: a@b.ca"));
}

section("Credential handling — fail loudly, never silently");
(async () => {
  const t = g.createTransport({ mode: "draft", credentialEnv: "DEFINITELY_NOT_SET_12345" });
  const saved = { id: process.env.GOOGLE_CLIENT_ID, sec: process.env.GOOGLE_CLIENT_SECRET };
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const r = await t.send({ from: "o@e.ca", to: "x@y.ca", subject: "s", body: "b" });
  ok("missing credentials produce a failure, not a silent success", r.ok === false, JSON.stringify(r));
  ok("the error names every missing variable",
    /GOOGLE_CLIENT_ID/.test(r.error) && /GOOGLE_CLIENT_SECRET/.test(r.error) &&
    /DEFINITELY_NOT_SET_12345/.test(r.error), r.error);
  ok("the error states credentials are not stored in the database",
    /never live in the database/.test(r.error));
  if (saved.id) process.env.GOOGLE_CLIENT_ID = saved.id;
  if (saved.sec) process.env.GOOGLE_CLIENT_SECRET = saved.sec;

  ok("draft is the default mode", g.createTransport({}).mode === "draft");
  ok("send mode must be asked for explicitly", g.createTransport({ mode: "send" }).mode === "send");
  ok("an unrecognised mode falls back to draft", g.createTransport({ mode: "blast" }).mode === "draft");
  ok("the transport name says which mode it is", g.createTransport({}).name === "gmail-draft");

  console.log("\n" + "=".repeat(60));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nMessage construction verified. The network half (OAuth, the API");
    console.log("call, and whether Google's DKIM signs the List-Unsubscribe headers)");
    console.log("needs a real account and is NOT covered here.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(60));
  process.exit(fail === 0 ? 0 : 1);
})();
