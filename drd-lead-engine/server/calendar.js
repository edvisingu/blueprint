/* Meeting booking against Google Calendar.
 *
 * The hard part here is not the API, it is AUTHORITY. Our meetings table knows
 * about meetings this system booked. Google Calendar knows about everything
 * else: the dentist, the school run, the other call booked ten minutes ago
 * from a different device. Offering slots computed from our own table would
 * double-book the real calendar, and a prospect who accepts a slot that was
 * never free is a worse outcome than no booking at all.
 *
 * So free/busy comes from Google, every time, and our table is downstream.
 *
 * Deliberately NOT built, with reasons:
 *
 *   ROUND ROBIN. That is multi-host routing for a team. This is one person.
 *   The research also noted that even HubSpot's round robin cannot see a rep
 *   on leave, so it books into absences.
 *
 *   A HOSTED BOOKING PAGE. That is a public web surface with its own abuse
 *   and privacy surface. Slots are offered inside the reply we send, which is
 *   where the conversation already is.
 *
 * NOT INTEGRATION-TESTED AGAINST GOOGLE: this environment's egress gateway
 * denies general web hosts. The slot arithmetic, the busy-interval merging and
 * the timezone handling are tested offline in calendar.test.js, because those
 * are the parts that silently produce a wrong answer. The HTTP calls are
 * thin and must be confirmed against a real calendar.
 */
"use strict";

const https = require("node:https");
const { id } = require("./db");

const MIN = 60000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const API_HOST = "www.googleapis.com";

/* ------------------------------------------------------------------ HTTP */

function call(token, method, path, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;
    const headers = { authorization: "Bearer " + token };
    if (body) {
      headers["content-type"] = "application/json";
      headers["content-length"] = Buffer.byteLength(body);
    }
    const req = https.request({ host: API_HOST, path, method, headers, timeout: 20000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, json, text });
      });
    });
    req.on("timeout", () => req.destroy(new Error("calendar request timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function token() {
  const gmail = require("./transports/gmail.js");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_CALENDAR_REFRESH || process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) {
    const e = new Error("Calendar credentials not configured: GOOGLE_CLIENT_ID, " +
      "GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_REFRESH (or GMAIL_REFRESH_TOKEN) must be set. " +
      "The calendar scope is https://www.googleapis.com/auth/calendar.");
    e.permanent = true;   // no amount of retrying supplies a credential
    throw e;
  }
  return gmail.accessToken(refresh, clientId, clientSecret);
}

/* ------------------------------------------------------- slot arithmetic */

/* Merge overlapping or touching intervals, so the slot search sees one busy
 * block rather than three. Without this, adjacent events leave phantom gaps. */
function mergeBusy(intervals) {
  const sorted = intervals
    .map((i) => ({ start: Number(i.start), end: Number(i.end) }))
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .sort((a, b) => a.start - b.start);
  const out = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ start: i.start, end: i.end });
  }
  return out;
}

/* Find bookable slots.
 *
 * `busy` is the merged list from Google. `window` is the working day in the
 * host's timezone. Slots are aligned to the step so offered times are round
 * (09:00, 09:30) rather than 09:07, which reads as machine-generated.
 */
function findSlots(opts) {
  const o = Object.assign({
    from: Date.now(),
    days: 10,
    durationMin: 15,
    stepMin: 30,
    bufferMin: 15,       // never butt a call against another commitment
    leadTimeHours: 24,   // nothing tomorrow morning; people need notice
    maxSlots: 4,
    perDay: 2,           // offering eight slots looks desperate
    timezone: "America/Toronto",
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 },
    busy: [],
  }, opts || {});

  const busy = mergeBusy(o.busy);
  const duration = o.durationMin * MIN;
  const buffer = o.bufferMin * MIN;
  const step = o.stepMin * MIN;
  const earliest = o.from + o.leadTimeHours * HOUR;

  // Local-time parts for a timestamp, in the host's zone.
  const partsAt = (t) => {
    try {
      const f = new Intl.DateTimeFormat("en-US", {
        timeZone: o.timezone, weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
      }).formatToParts(new Date(t));
      const m = {};
      for (const p of f) m[p.type] = p.value;
      return {
        day: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[m.weekday],
        hour: Number(m.hour) % 24,
        minute: Number(m.minute),
      };
    } catch (e) { return null; }
  };

  const slots = [];
  const byDay = {};
  // Walk the step grid, aligned so offered times land on the step boundary.
  const start = Math.ceil(earliest / step) * step;
  for (let t = start; t < o.from + o.days * DAY && slots.length < o.maxSlots; t += step) {
    const p = partsAt(t);
    if (!p) break;                                   // bad timezone: offer nothing
    if (!o.window.days.includes(p.day)) continue;
    if (p.hour < o.window.startHour) continue;
    // The whole meeting must finish inside the window, not just start in it.
    const endParts = partsAt(t + duration);
    if (!endParts) break;
    if (p.hour >= o.window.endHour) continue;
    if (endParts.hour > o.window.endHour || (endParts.hour === o.window.endHour && endParts.minute > 0)) continue;

    // Buffer applies on both sides of the proposed meeting.
    const wantStart = t - buffer;
    const wantEnd = t + duration + buffer;
    const clash = busy.some((b) => b.start < wantEnd && b.end > wantStart);
    if (clash) continue;

    const dayKey = new Date(t).toISOString().slice(0, 10);
    if ((byDay[dayKey] || 0) >= o.perDay) continue;
    byDay[dayKey] = (byDay[dayKey] || 0) + 1;
    slots.push({ start: t, end: t + duration });
  }
  return slots;
}

/* Human-readable slot list for an email body, in the recipient's terms. */
function describeSlots(slots, timezone) {
  const tz = timezone || "America/Toronto";
  return slots.map((s) => {
    const d = new Date(s.start);
    const day = d.toLocaleDateString("en-CA", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
    const time = d.toLocaleTimeString("en-CA", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    return day + " at " + time;
  });
}

/* ----------------------------------------------------------- Google reads */

/* Busy intervals across one or more calendars. This is the authority. */
async function freeBusy(calendarIds, from, to) {
  const t = await token();
  const res = await call(t, "POST", "/calendar/v3/freeBusy", {
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(to).toISOString(),
    items: (calendarIds || ["primary"]).map((id) => ({ id })),
  });
  if (res.status !== 200 || !res.json) {
    throw new Error("freeBusy failed [" + res.status + "]: " +
      ((res.json && res.json.error && res.json.error.message) || res.text.slice(0, 200)));
  }
  const out = [];
  const cals = res.json.calendars || {};
  for (const key of Object.keys(cals)) {
    // A calendar we cannot read returns errors rather than busy blocks.
    // Treating that as "free" would book over it, so it is fatal.
    if (cals[key].errors && cals[key].errors.length) {
      throw new Error("cannot read calendar " + key + ": " +
        cals[key].errors.map((e) => e.reason).join(", ") +
        " (treating an unreadable calendar as free would double-book it)");
    }
    for (const b of cals[key].busy || []) {
      out.push({ start: Date.parse(b.start), end: Date.parse(b.end) });
    }
  }
  return mergeBusy(out);
}

/* Offer slots for a contact: reads Google, returns bookable times. */
async function offer(db, orgId, opts) {
  const o = opts || {};
  const from = o.from || Date.now();
  const to = from + (o.days || 10) * DAY;
  const busy = await freeBusy(o.calendarIds || [o.calendarId || "primary"], from, to);
  const slots = findSlots(Object.assign({}, o, { from, busy }));
  return {
    slots,
    described: describeSlots(slots, o.timezone),
    busyBlocks: busy.length,
    timezone: o.timezone || "America/Toronto",
  };
}

/* Book one. Writes to Google first, then our table: if Google refuses, we must
 * not hold a record of a meeting that does not exist. */
async function book(db, orgId, opts) {
  const o = opts || {};
  if (!o.start || !o.contactId) return { ok: false, error: "start and contactId are required" };
  const contact = db
    .prepare("SELECT ct.*, co.name company_name FROM contacts ct LEFT JOIN companies co ON co.id=ct.company_id WHERE ct.id=?")
    .get(o.contactId);
  if (!contact) return { ok: false, error: "contact_not_found" };

  const durationMin = o.durationMin || 15;
  const end = o.start + durationMin * MIN;

  // Re-check against the live calendar immediately before writing. A slot
  // offered an hour ago may have been taken since, from another device.
  const busy = await freeBusy(o.calendarIds || [o.calendarId || "primary"], o.start - HOUR, end + HOUR);
  if (busy.some((b) => b.start < end && b.end > o.start)) {
    return { ok: false, error: "slot_no_longer_free",
      message: "That time was taken since it was offered. Offer fresh slots rather than booking over it." };
  }

  const t = await token();
  const summary = o.summary || ((contact.company_name || contact.name) + " and Dr. D");
  const res = await call(t, "POST",
    "/calendar/v3/calendars/" + encodeURIComponent(o.calendarId || "primary") +
      "/events?sendUpdates=all",
    {
      summary,
      description: o.description || "Introductory call booked from an email reply.",
      start: { dateTime: new Date(o.start).toISOString() },
      end: { dateTime: new Date(end).toISOString() },
      attendees: [{ email: contact.email, displayName: contact.name }],
      reminders: { useDefault: true },
    });

  if (res.status !== 200 && res.status !== 201) {
    const msg = (res.json && res.json.error && res.json.error.message) || res.text.slice(0, 200);
    let hint = "";
    if (res.status === 403 && /insufficient|scope/i.test(msg)) {
      hint = " (the OAuth grant lacks https://www.googleapis.com/auth/calendar)";
    }
    return { ok: false, error: "calendar_" + res.status, message: msg + hint };
  }

  const ev = res.json;
  const mid = id("mt");
  try {
    db.prepare(
      "INSERT INTO meetings (id,campaign_id,contact_id,company_id,title,at,duration,status,created_at,external_id,external_link)" +
        " VALUES (?,?,?,?,?,?,?,'Confirmed',?,?,?)"
    ).run(mid, o.campaignId || null, o.contactId, contact.company_id, summary,
      o.start, durationMin, Date.now(), ev.id || null, ev.htmlLink || null);
  } catch (e) {
    // UNIQUE(contact_id): a meeting already exists for this contact. The
    // calendar event is real, so report it rather than pretending it failed.
    return { ok: true, warning: "meeting_row_exists", eventId: ev.id, link: ev.htmlLink };
  }
  db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
    .run(id("au"), orgId, o.actor || "system", "meeting.booked",
      contact.email + " at " + new Date(o.start).toISOString(), Date.now());
  return { ok: true, meetingId: mid, eventId: ev.id, link: ev.htmlLink, start: o.start, end };
}

module.exports = { mergeBusy, findSlots, describeSlots, freeBusy, offer, book, MIN, HOUR, DAY };
