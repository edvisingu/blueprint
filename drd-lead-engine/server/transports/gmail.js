/* Gmail transport. Sends, or drafts, through a Google Workspace account.
 *
 * Why Workspace rather than a cold-email vendor, per the sending-infrastructure
 * research: no third-party acceptable-use exposure, caps roughly 20x our
 * expected volume, ~$0 marginal cost, and — the part that actually matters for
 * institutional outreach — an institution receiving the mail can verify the
 * sender. A lookalike domain from a rented mailbox farm cannot be verified by
 * the registrar's office it is trying to reach.
 *
 * TWO MODES, and the default is the careful one:
 *
 *   mode "draft"  (default) — creates a Gmail draft. Nothing is delivered.
 *                 A human opens it, reads it, and sends. For a first campaign
 *                 this is the correct posture: it makes an accidental send
 *                 structurally impossible rather than policy-impossible.
 *   mode "send"   — delivers immediately via the API. Only worth enabling once
 *                 drafts have been read for a while and are consistently right.
 *
 * CREDENTIALS come from the environment and never from the database or this
 * repository. Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and a per
 * mailbox refresh token named by the mailbox's credential_env column.
 *
 * ZERO DEPENDENCIES: node:https plus the standard library, consistent with the
 * rest of the server.
 *
 * NOT INTEGRATION-TESTED AGAINST GOOGLE. The build environment's egress gateway
 * denies general web hosts, so no call to gmail.googleapis.com has been made
 * from here. What IS tested, in server/gmail.test.js, is the part that is easy
 * to get silently wrong and impossible to check by eye: RFC 822 construction,
 * header encoding, base64url, and the one-click unsubscribe headers. Run
 * `node server/gmail.test.js` after wiring real credentials to confirm the
 * network half.
 */
"use strict";

const https = require("node:https");
const crypto = require("node:crypto");

const TOKEN_HOST = "oauth2.googleapis.com";
const API_HOST = "gmail.googleapis.com";

/* ------------------------------------------------------------------ MIME */

/* RFC 2047 encoding for any header value that is not plain ASCII.
 *
 * Each encoded-word is capped at 75 characters including the "=?UTF-8?B?" and
 * "?=" delimiters, and a long value becomes SEVERAL encoded-words separated by
 * folding whitespace — not one long one. A single over-length encoded-word is
 * the subtle failure here: Gmail tolerates it, stricter receivers display the
 * raw "=?UTF-8?B?..." to the recipient, which looks like a broken mail merge.
 *
 * The split has to land on UTF-8 character boundaries. Splitting mid-sequence
 * produces a replacement character in the middle of someone's name.
 */
const EW_PREFIX = "=?UTF-8?B?";
const EW_SUFFIX = "?=";
// 75 total, minus delimiters, rounded down to a multiple of 4 so each chunk is
// self-contained base64: 60 base64 characters encode 45 bytes.
const EW_BYTES = 45;

function encodeHeader(value) {
  const s = String(value == null ? "" : value);
  if (/^[\x20-\x7E]*$/.test(s)) return s;

  // Walk by code point so a surrogate pair or multi-byte character is never
  // cut in half, accumulating until the next character would overflow a chunk.
  const chunks = [];
  let buf = [];
  let bytes = 0;
  for (const ch of s) {
    const n = Buffer.byteLength(ch, "utf8");
    if (bytes + n > EW_BYTES && buf.length) { chunks.push(buf.join("")); buf = []; bytes = 0; }
    buf.push(ch); bytes += n;
  }
  if (buf.length) chunks.push(buf.join(""));

  return chunks
    .map((c) => EW_PREFIX + Buffer.from(c, "utf8").toString("base64") + EW_SUFFIX)
    .join("\r\n ");
}

/* True when a value is already encoded, so folding must leave it alone:
 * encoded-words are pre-sized and splitting one again would corrupt it. */
function isEncoded(v) { return String(v).includes(EW_PREFIX); }

/* A display name needs quoting if it contains specials; the address never
 * gets encoded, only the name part. */
function address(email, name) {
  if (!name) return email;
  const encoded = encodeHeader(name);
  // An encoded-word must not be quoted; a plain name with specials must be.
  if (encoded !== name) return encoded + " <" + email + ">";
  return '"' + name.replace(/(["\\])/g, "\\$1") + '" <' + email + ">";
}

/* Fold a long header at 78 columns on whitespace, per RFC 5322. Gmail is
 * forgiving about this; other receivers are not. */
function fold(line) {
  if (line.length <= 78) return line;
  // Encoded-words were already sized and folded by encodeHeader; re-folding
  // on spaces inside base64 would break them.
  if (isEncoded(line)) return line;
  const out = [];
  let cur = "";
  for (const word of line.split(" ")) {
    if (cur && (cur + " " + word).length > 76) { out.push(cur); cur = " " + word; }
    else cur = cur ? cur + " " + word : word;
  }
  if (cur) out.push(cur);
  return out.join("\r\n");
}

function messageId(domain) {
  return "<" + crypto.randomBytes(16).toString("hex") + "@" + (domain || "localhost") + ">";
}

/* Build the full RFC 822 message.
 *
 * The body is base64 with charset=utf-8 rather than quoted-printable: it is
 * shorter to get right, and avoids the soft-line-break bugs that mangle URLs.
 */
function buildMime(msg) {
  const fromDomain = String(msg.from || "").split("@")[1] || "localhost";
  const headers = [];
  const H = (k, v) => { if (v !== undefined && v !== null && v !== "") headers.push(fold(k + ": " + v)); };

  H("From", address(msg.from, msg.fromName));
  H("To", address(msg.to, msg.toName));
  if (msg.replyTo) H("Reply-To", address(msg.replyTo));
  H("Subject", encodeHeader(msg.subject || ""));
  H("Date", new Date(msg.date || Date.now()).toUTCString().replace("GMT", "+0000"));
  H("Message-ID", msg.messageId || messageId(fromDomain));
  H("MIME-Version", "1.0");

  // Threading, so a follow-up sits in the same conversation rather than
  // arriving as an unrelated second email.
  if (msg.inReplyTo) { H("In-Reply-To", msg.inReplyTo); H("References", msg.references || msg.inReplyTo); }

  /* One-click unsubscribe. Both headers are required by RFC 8058 — the URI
   * alone does not satisfy it, and the POST header's value must be exactly
   * this. Note the hard external dependency: Google must include both headers
   * in its DKIM signature for this to count. We cannot verify that from here;
   * confirm it by inspecting a received message's DKIM h= tag. */
  if (msg.unsubscribeUrl) {
    H("List-Unsubscribe", "<" + msg.unsubscribeUrl + ">");
    H("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  }
  // Marks the mail as bulk-ish to filters that look for it, and keeps
  // auto-responders from replying to us in a loop.
  if (msg.precedence !== false) H("Auto-Submitted", "auto-generated");

  for (const [k, v] of Object.entries(msg.extraHeaders || {})) H(k, v);

  const body = String(msg.body || "");
  H("Content-Type", 'text/plain; charset="UTF-8"');
  H("Content-Transfer-Encoding", "base64");

  // base64 body wrapped at 76 chars, as the encoding requires.
  const encoded = Buffer.from(body, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  return headers.join("\r\n") + "\r\n\r\n" + encoded;
}

/* Gmail wants base64url with no padding. Ordinary base64 is rejected. */
function toRaw(mime) {
  return Buffer.from(mime, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ----------------------------------------------------------------- HTTP */

function request(host, path, method, headers, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host, path, method, headers, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on("timeout", () => { req.destroy(new Error("gmail request timed out")); });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/* Access tokens last an hour; cache per refresh token so a batch of sends
 * does not mint one per message. */
const tokenCache = new Map();

async function accessToken(refreshToken, clientId, clientSecret) {
  const hit = tokenCache.get(refreshToken);
  if (hit && hit.expires > Date.now() + 60000) return hit.token;

  const payload = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: "refresh_token",
  }).toString();

  const res = await request(TOKEN_HOST, "/token", "POST", {
    "content-type": "application/x-www-form-urlencoded",
    "content-length": Buffer.byteLength(payload),
  }, payload);

  if (res.status !== 200 || !res.json || !res.json.access_token) {
    const detail = (res.json && (res.json.error_description || res.json.error)) || res.text.slice(0, 200);
    // invalid_grant almost always means the refresh token was revoked, the
    // Workspace user was suspended, or consent was withdrawn. Say so, rather
    // than surfacing a bare 400.
    const hint = /invalid_grant/.test(detail)
      ? " (the refresh token is no longer valid: it may have been revoked, the user suspended, or the OAuth consent withdrawn — re-run the authorisation)"
      : "";
    throw new Error("Google token exchange failed [" + res.status + "]: " + detail + hint);
  }
  tokenCache.set(refreshToken, {
    token: res.json.access_token,
    expires: Date.now() + (res.json.expires_in || 3600) * 1000,
  });
  return res.json.access_token;
}

/* ------------------------------------------------------------ transport */

/* Create a transport the sending layer can register.
 *
 *   createTransport({ mode: "draft", credentialEnv: "GMAIL_REFRESH_OUTREACH" })
 *
 * Returns {name, send(msg)} matching the interface in sending.js, so the rest
 * of the system does not know or care which transport is in use.
 */
function createTransport(opts) {
  const o = opts || {};
  const mode = o.mode === "send" ? "send" : "draft";
  const name = "gmail-" + mode;

  return {
    name,
    mode,
    async send(msg) {
      const clientId = o.clientId || process.env.GOOGLE_CLIENT_ID;
      const clientSecret = o.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
      const refresh = o.refreshToken || process.env[o.credentialEnv || "GMAIL_REFRESH_TOKEN"];

      const missing = [];
      if (!clientId) missing.push("GOOGLE_CLIENT_ID");
      if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
      if (!refresh) missing.push(o.credentialEnv || "GMAIL_REFRESH_TOKEN");
      if (missing.length) {
        return { ok: false, error: "missing_credentials: " + missing.join(", ") +
          " not set in the environment. Credentials never live in the database." };
      }

      // Generate the Message-ID here rather than letting buildMime do it
      // anonymously, so it can be returned and stored against the send.
      const rfcId = messageId(String(msg.from || "").split("@")[1] || "localhost");
      const mime = buildMime({
        messageId: rfcId,
        from: msg.from, fromName: msg.fromName,
        to: msg.to, toName: msg.toName,
        replyTo: o.replyTo,
        subject: msg.subject, body: msg.body,
        unsubscribeUrl: (msg.headers && msg.headers["List-Unsubscribe"] || "").replace(/^<|>$/g, "") || undefined,
        inReplyTo: msg.inReplyTo, references: msg.references,
      });
      const raw = toRaw(mime);

      let token;
      try {
        token = await accessToken(refresh, clientId, clientSecret);
      } catch (e) {
        return { ok: false, error: e.message };
      }

      const path = mode === "send"
        ? "/gmail/v1/users/me/messages/send"
        : "/gmail/v1/users/me/drafts";
      const payload = JSON.stringify(mode === "send" ? { raw } : { message: { raw } });

      const res = await request(API_HOST, path, "POST", {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
      }, payload);

      if (res.status === 200 || res.status === 201) {
        const id = res.json && (res.json.id || (res.json.message && res.json.message.id));
        return {
          ok: true, id, rfcMessageId: rfcId,
          // A draft is explicitly NOT a delivery. The sending layer records
          // this so a dashboard never counts drafts as sent mail.
          delivered: mode === "send",
          draft: mode === "draft",
          threadId: res.json && (res.json.threadId || (res.json.message && res.json.message.threadId)),
        };
      }
      const err = (res.json && res.json.error && (res.json.error.message || res.json.error.status)) ||
        res.text.slice(0, 300);
      // Translate the failures that have a specific cause worth acting on.
      let hint = "";
      if (res.status === 403 && /insufficient|scope/i.test(err)) {
        hint = " (the OAuth grant lacks the needed scope: drafts need gmail.compose, sending needs gmail.send)";
      } else if (res.status === 400 && /From/i.test(err)) {
        hint = " (Gmail only accepts a From address the authenticated user owns — add it as a verified send-as alias first)";
      } else if (res.status === 429 || /rate|quota/i.test(err)) {
        hint = " (Gmail API quota or per-user rate limit — back off; this is not a list problem)";
      }
      return { ok: false, error: "gmail_" + res.status + ": " + err + hint };
    },
  };
}

module.exports = { createTransport, buildMime, toRaw, encodeHeader, address, fold, isEncoded, messageId, accessToken };
