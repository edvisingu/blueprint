/* Reply ingestion. Closes the loop that currently stops at "sent".
 *
 * Pulls replies from the outreach mailbox, threads them onto the conversation
 * they belong to, classifies the intent with the existing 12-intent engine,
 * and acts on the two intents that must not wait for a human: an opt-out
 * request suppresses the address immediately, and a hot reply raises an alert.
 *
 * Design decisions worth stating:
 *
 *   MATCH ON THREAD, THEN MESSAGE-ID, THEN ADDRESS. Gmail's threadId is the
 *   strongest signal and is returned when we send. A reply that arrives via a
 *   forward or a changed subject can lose the thread, so the fallbacks matter.
 *   Matching on address alone is last because two brands may hold the same
 *   address and attributing a reply to the wrong campaign corrupts the stats.
 *
 *   AN OPT-OUT IN PROSE IS STILL AN OPT-OUT. "Take me off your list" in a
 *   reply body is a withdrawal of consent. CASL does not require the recipient
 *   to find the unsubscribe link, so the classifier's Unsubscribe and
 *   DoNotContact intents write a suppression directly rather than queueing a
 *   human decision. Over-suppressing costs one prospect; under-suppressing is
 *   a breach.
 *
 *   OUT-OF-OFFICE IS NOT A REPLY. Counting auto-responders as replies inflates
 *   the only metric that tells you whether the message works. They are stored,
 *   flagged, and excluded from reply-rate maths.
 *
 *   IDEMPOTENT. Each Gmail message id is recorded, so re-running the poll
 *   never double-counts a reply or re-classifies one already handled.
 *
 * NOT LEGAL ADVICE — see docs/COMPLIANCE.md.
 */
"use strict";

const https = require("node:https");
const { id } = require("./db");

/* Phrases that are an opt-out regardless of what the classifier decides. The
 * classifier is good but it is a model; these are checked first because the
 * cost of missing one is a compliance breach rather than a lost deal. */
const OPT_OUT_PATTERNS = [
  /\b(unsubscribe|opt[\s-]?out)\b/i,
  /\b(remove|take)\s+(me|us|my name|this email)\s+(off|from)\b/i,
  /\bdo not (contact|email|write|send)\b/i,
  /\bstop (emailing|contacting|sending)\b/i,
  /\bno longer wish to (receive|be contacted)\b/i,
  /\bdésabonner\b/i,
  /\bretirez-moi\b/i,
];

/* Auto-responder detection. Header-based first (reliable), then phrasing. */
function isAutoReply(msg) {
  const h = msg.headers || {};
  if (h["auto-submitted"] && !/^no$/i.test(h["auto-submitted"])) return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) return true;
  if (/^(vacation|autoreply|auto-reply)$/i.test(h["precedence"] || "")) return true;
  const s = (msg.subject || "") + " " + (msg.body || "").slice(0, 400);
  return /\b(out of (the )?office|on (vacation|annual leave|parental leave)|automatic reply|réponse automatique|away from my desk|maternity leave|currently out)\b/i.test(s);
}

/* Best-effort return date from an out-of-office body, so a follow-up can be
 * rescheduled rather than landing in an empty inbox. Returns null when it
 * cannot be read confidently — a wrong date is worse than none. */
function returnDate(text, now) {
  const base = now || Date.now();
  const s = String(text || "");
  // "until 14 March", "back on March 14", "returning 2026-03-14"
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (iso) {
    const t = Date.parse(iso[0] + "T09:00:00Z");
    if (Number.isFinite(t) && t > base) return t;
  }
  const m = /\b(?:until|back on|returning|return on|back in the office on)\s+(\d{1,2})?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{1,2})?/i.exec(s);
  if (m) {
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month = months.indexOf(m[2].toLowerCase());
    const day = Number(m[1] || m[3]);
    if (month >= 0 && day >= 1 && day <= 31) {
      const year = new Date(base).getUTCFullYear();
      let t = Date.UTC(year, month, day, 9);
      // A date already past means they meant next year.
      if (t < base) t = Date.UTC(year + 1, month, day, 9);
      // Beyond a year out is almost certainly a misparse.
      if (t - base < 400 * 86400000) return t;
    }
  }
  return null;
}

/* ------------------------------------------------------------ Gmail read */

function gmailGet(token, path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host: "gmail.googleapis.com", path, method: "GET", timeout: 20000,
        headers: { authorization: "Bearer " + token } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try { json = JSON.parse(text); } catch (e) {}
          resolve({ status: res.statusCode, json, text });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("gmail read timed out")));
    req.on("error", reject);
    req.end();
  });
}

/* Flatten a Gmail message resource into the shape this module works with. */
function flatten(m) {
  const headers = {};
  const hs = (m.payload && m.payload.headers) || [];
  for (const h of hs) headers[String(h.name).toLowerCase()] = h.value;

  // Walk the MIME tree for the first text/plain part; fall back to text/html
  // stripped, then to the snippet, so a reply is never lost to an odd shape.
  let plain = null, html = null;
  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || "";
    const data = part.body && part.body.data;
    if (data) {
      const text = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      if (mime === "text/plain" && plain === null) plain = text;
      else if (mime === "text/html" && html === null) html = text;
    }
    (part.parts || []).forEach(walk);
  };
  walk(m.payload);
  const body = plain
    || (html ? html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() : null)
    || m.snippet || "";

  const from = headers.from || "";
  const emailMatch = /<([^>]+)>/.exec(from) || [null, from.trim()];
  return {
    gmailId: m.id,
    threadId: m.threadId,
    headers,
    from: String(emailMatch[1] || "").toLowerCase().trim(),
    fromName: from.replace(/<[^>]*>/, "").replace(/"/g, "").trim() || null,
    subject: headers.subject || "",
    inReplyTo: headers["in-reply-to"] || null,
    references: headers.references || null,
    at: Number(m.internalDate) || Date.now(),
    body: stripQuoted(body),
    rawBody: body,
  };
}

/* Remove the quoted original so the classifier reads the reply, not our own
 * pitch quoted back at us. Getting this wrong makes every reply look positive,
 * because our own copy is in it. */
function stripQuoted(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*On .{10,80}\bwrote:\s*$/.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*From:\s.+@/.test(line) && out.length) break;
    if (/^\s*Le .{10,80}\ba écrit\s*:\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim() || String(text || "").trim();
}

/* -------------------------------------------------------------- matching */

/* Find the send this reply answers. Strongest signal first. */
function matchSend(db, orgId, reply) {
  // 1. Gmail thread id, recorded when we sent.
  if (reply.threadId) {
    const byThread = db
      .prepare("SELECT * FROM sends WHERE org_id=? AND provider_thread_id=? ORDER BY queued_at DESC LIMIT 1")
      .get(orgId, reply.threadId);
    if (byThread) return { send: byThread, via: "thread" };
  }
  // 2. Our Message-ID echoed in In-Reply-To or References.
  const ids = [reply.inReplyTo, reply.references].filter(Boolean).join(" ");
  const found = ids.match(/<[^>]+>/g) || [];
  for (const mid of found) {
    const bySelf = db
      .prepare("SELECT * FROM sends WHERE org_id=? AND rfc_message_id=? LIMIT 1")
      .get(orgId, mid);
    if (bySelf) return { send: bySelf, via: "message-id" };
  }
  // 3. The sender's address against a contact we messaged. Last because the
  //    same address can exist under more than one brand, and attributing a
  //    reply to the wrong campaign corrupts that campaign's numbers.
  const byAddress = db
    .prepare(
      "SELECT s.* FROM sends s JOIN contacts c ON c.id = s.contact_id" +
        " WHERE s.org_id=? AND lower(c.email)=? AND s.state IN ('SENT','DRAFTED')" +
        " ORDER BY s.queued_at DESC LIMIT 1"
    )
    .get(orgId, reply.from);
  if (byAddress) return { send: byAddress, via: "address" };
  return { send: null, via: null };
}

/* ------------------------------------------------------------- ingestion */

/* Record one reply. Returns a summary of what was decided and why.
 * Pure with respect to the network: callers supply the reply object, so this
 * is fully testable without Gmail. */
function ingestOne(db, orgId, reply, opts) {
  const o = opts || {};
  const E = o.engine || (typeof window !== "undefined" ? window.DRD_ENGINE : null) || require("./shared.js").ENGINE;
  const sending = require("./sending.js");
  const now = Date.now();

  // Idempotent: the same Gmail message is never processed twice.
  const seen = db.prepare("SELECT id FROM inbound_messages WHERE org_id=? AND gmail_id=?")
    .get(orgId, reply.gmailId);
  if (seen) return { gmailId: reply.gmailId, skipped: "already_ingested" };

  const { send, via } = matchSend(db, orgId, reply);
  const auto = isAutoReply(reply);

  // Classify. An auto-responder is not put through the intent model: it would
  // return something confident and meaningless.
  let intent = null, confidence = null;
  if (!auto && E && typeof E.classifyReply === "function") {
    try {
      const c = E.classifyReply(reply.body);
      intent = c && (c.intent || c.label || null);
      confidence = c && (c.confidence != null ? c.confidence : null);
    } catch (e) { /* classification is best-effort; the reply is still stored */ }
  }

  // An explicit opt-out in prose overrides whatever the model said.
  const optOut = OPT_OUT_PATTERNS.some((re) => re.test(reply.body)) ||
    intent === "Unsubscribe" || intent === "DoNotContact";

  const rowId = id("in");
  db.prepare(
    "INSERT INTO inbound_messages (id,org_id,gmail_id,thread_id,send_id,contact_id,from_email,from_name," +
      "subject,body,intent,confidence,auto_reply,opt_out,matched_via,received_at,created_at)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
  ).run(rowId, orgId, reply.gmailId, reply.threadId || null, send ? send.id : null,
    send ? send.contact_id : null, reply.from, reply.fromName, reply.subject,
    reply.body, intent, confidence, auto ? 1 : 0, optOut ? 1 : 0, via, reply.at, now);

  const outcome = { gmailId: reply.gmailId, id: rowId, matchedVia: via, intent, auto, optOut };

  if (!send) {
    // A reply we cannot attribute is still worth knowing about: it may be a
    // forward to a colleague, which is a buying signal, or a bounce from an
    // address we never sent to, which is a bug.
    sending.raise(db, orgId, "reply_unmatched", "info", reply.from,
      "A reply arrived that could not be matched to a send. Subject: " + (reply.subject || "(none)"));
    outcome.unmatched = true;
  }

  // Act on an opt-out immediately. Not queued for review: under CASL a
  // withdrawal does not require the recipient to use our link, and the cost
  // of over-suppressing is one prospect while under-suppressing is a breach.
  if (optOut) {
    try {
      db.prepare(
        "INSERT INTO suppressions (id,org_id,type,value,reason,scope,created_at,channel,honored_at)" +
          " VALUES (?,?,'Person',?,?,'Global',?,'email',?)"
      ).run(id("sup"), orgId, reply.from, "Opt-out requested in a reply", now, now);
    } catch (e) { /* already suppressed */ }
    if (send && send.contact_id) {
      db.prepare("UPDATE consents SET revoked_at=?, revoke_reason='opt_out_in_reply' WHERE contact_id=? AND revoked_at IS NULL")
        .run(now, send.contact_id);
    }
    db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
      .run(id("au"), orgId, "recipient", "opt_out_in_reply",
        reply.from + " asked to be removed in a reply; suppressed org-wide", now);
    outcome.suppressed = true;
  }

  // Out of office: reschedule rather than treating silence as disinterest.
  if (auto) {
    const back = returnDate(reply.rawBody, now);
    if (back && send) {
      outcome.rescheduledTo = back;
      try {
        require("./runner.js").enqueue(db, orgId, "campaign.followup", {
          contactId: send.contact_id, campaignId: send.campaign_id,
          brandId: send.brand_id, step: (send.step || 0) + 1,
        }, {
          runAt: back + 86400000,   // the day after they are back, not the day of
          idempotencyKey: "ooo:" + send.id + ":" + back,
        });
      } catch (e) { /* the reply is recorded either way */ }
    }
    return Object.assign(outcome, { treatedAs: "auto_reply_not_a_reply" });
  }

  // Attach to a conversation so the reply shows up in the inbox view, and mark
  // hot intents for the operator.
  if (send && send.contact_id) {
    const HOT = new Set(["Interested", "MeetingRequest", "PricingRequest", "InfoRequest", "Referral"]);
    const hot = intent ? HOT.has(intent) : false;
    let conv = db.prepare("SELECT * FROM conversations WHERE contact_id=? ORDER BY last_at DESC LIMIT 1")
      .get(send.contact_id);
    if (!conv) {
      const contact = db.prepare("SELECT company_id FROM contacts WHERE id=?").get(send.contact_id);
      const cid = id("cv");
      db.prepare(
        "INSERT INTO conversations (id,campaign_id,contact_id,company_id,subject,status,intent," +
          "intent_confidence,hot,last_at) VALUES (?,?,?,?,?,'Replied',?,?,?,?)"
      ).run(cid, send.campaign_id || null, send.contact_id,
        (contact && contact.company_id) || null, reply.subject, intent, confidence, hot ? 1 : 0, reply.at);
      conv = { id: cid };
    } else {
      db.prepare("UPDATE conversations SET status='Replied', intent=?, intent_confidence=?, hot=?, last_at=? WHERE id=?")
        .run(intent, confidence, hot ? 1 : 0, reply.at, conv.id);
    }
    db.prepare("INSERT INTO messages (id,conversation_id,direction,body,subject,at) VALUES (?,?,'in',?,?,?)")
      .run(id("ms"), conv.id, reply.body, reply.subject, reply.at);
    db.prepare("UPDATE inbound_messages SET conversation_id=? WHERE id=?").run(conv.id, rowId);
    outcome.conversationId = conv.id;
    outcome.hot = hot;

    if (hot) {
      const contact = db.prepare("SELECT name, email FROM contacts WHERE id=?").get(send.contact_id);
      sending.raise(db, orgId, "hot_reply", "warn", (contact && contact.email) || reply.from,
        (intent || "A positive reply") + " from " + ((contact && contact.name) || reply.from) +
        ': "' + reply.body.slice(0, 160).replace(/\s+/g, " ") + '"');
    }
    if (send.campaign_id) {
      db.prepare("UPDATE campaigns SET replies=replies+1, positive=positive+? WHERE id=?")
        .run(hot ? 1 : 0, send.campaign_id);
    }
  }
  return outcome;
}

/* Poll the outreach mailbox and ingest anything new.
 * `query` is Gmail search syntax; the default takes unread inbox mail from the
 * last week, which is the window a campaign actually cares about. */
async function poll(db, orgId, opts) {
  const o = opts || {};
  const gmail = require("./transports/gmail.js");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env[o.credentialEnv || "GMAIL_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refresh) {
    const e = new Error("Gmail credentials not configured for reply polling (" +
      (o.credentialEnv || "GMAIL_REFRESH_TOKEN") + ")");
    e.permanent = true;   // waiting will not supply a credential
    throw e;
  }
  const token = await gmail.accessToken(refresh, clientId, clientSecret);
  const q = encodeURIComponent(o.query || "in:inbox newer_than:7d -category:promotions");
  const list = await gmailGet(token, "/gmail/v1/users/me/messages?maxResults=" +
    (o.max || 50) + "&q=" + q);
  if (list.status !== 200) {
    throw new Error("gmail list failed [" + list.status + "]: " +
      ((list.json && list.json.error && list.json.error.message) || list.text.slice(0, 200)));
  }
  const ids = ((list.json && list.json.messages) || []).map((m) => m.id);
  const results = [];
  for (const mid of ids) {
    // Skip before fetching: one round trip saved per already-seen message.
    if (db.prepare("SELECT 1 FROM inbound_messages WHERE org_id=? AND gmail_id=?").get(orgId, mid)) continue;
    const got = await gmailGet(token, "/gmail/v1/users/me/messages/" + mid + "?format=full");
    if (got.status !== 200 || !got.json) continue;
    results.push(ingestOne(db, orgId, flatten(got.json), o));
  }
  return {
    scanned: ids.length,
    ingested: results.length,
    hot: results.filter((r) => r.hot).length,
    optOuts: results.filter((r) => r.optOut).length,
    autoReplies: results.filter((r) => r.auto).length,
    unmatched: results.filter((r) => r.unmatched).length,
    results,
  };
}

/* Register the recurring poll with the job runner. */
function registerJobs(runner) {
  runner.register("replies.poll", async (payload, ctx) => poll(ctx.db, ctx.orgId, payload));
}

module.exports = {
  poll, ingestOne, flatten, stripQuoted, isAutoReply, returnDate, matchSend,
  registerJobs, OPT_OUT_PATTERNS,
};
