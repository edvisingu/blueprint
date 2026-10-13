#!/usr/bin/env node
/* Tests the parts of booking that silently produce a WRONG answer: busy-block
 * merging, slot arithmetic, buffers, lead time and timezone handling.
 *
 *   node server/calendar.test.js
 *
 * The Google calls are thin and untested here (this environment cannot reach
 * googleapis.com). The arithmetic is where a bug offers a prospect a time that
 * is not actually free, which is worse than offering nothing.
 */
"use strict";
const cal = require("./calendar.js");

let pass = 0, fail = 0; const failures = [];
const ok = (n, c, d) => { if (c) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + n); }
  else { fail++; failures.push(n); console.log("  \x1b[31mFAIL\x1b[0m " + n + (d ? " — " + d : "")); } };
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");
const H = 3600000, M = 60000;

section("Busy intervals are merged before the search sees them");
{
  const merged = cal.mergeBusy([
    { start: 100, end: 200 }, { start: 150, end: 250 }, { start: 400, end: 500 },
  ]);
  ok("overlapping blocks merge", merged.length === 2 && merged[0].end === 250, JSON.stringify(merged));
  const touching = cal.mergeBusy([{ start: 0, end: 100 }, { start: 100, end: 200 }]);
  ok("touching blocks merge, leaving no phantom gap", touching.length === 1 && touching[0].end === 200,
    JSON.stringify(touching));
  const unsorted = cal.mergeBusy([{ start: 500, end: 600 }, { start: 0, end: 100 }]);
  ok("input order does not matter", unsorted[0].start === 0, JSON.stringify(unsorted));
  ok("zero-length and reversed blocks are discarded",
    cal.mergeBusy([{ start: 5, end: 5 }, { start: 9, end: 2 }]).length === 0);
  ok("an empty list is handled", cal.mergeBusy([]).length === 0);
}

section("Slots respect the working window");
{
  // Monday 2026-10-12, 00:00 UTC. Use UTC so the arithmetic is readable.
  const mon = Date.UTC(2026, 9, 12);
  const slots = cal.findSlots({
    from: mon, days: 5, timezone: "UTC", leadTimeHours: 0, maxSlots: 50, perDay: 50,
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 }, busy: [],
  });
  ok("slots were found", slots.length > 0, "n=" + slots.length);
  const hours = slots.map((s) => new Date(s.start).getUTCHours());
  ok("no slot starts before 09:00", Math.min(...hours) >= 9, "min=" + Math.min(...hours));
  ok("no slot starts at or after 16:00", Math.max(...hours) < 16, "max=" + Math.max(...hours));
  const days = [...new Set(slots.map((s) => new Date(s.start).getUTCDay()))];
  ok("no weekend slots", !days.includes(0) && !days.includes(6), days.join(","));
  ok("slots land on the step grid",
    slots.every((s) => new Date(s.start).getUTCMinutes() % 30 === 0),
    slots.slice(0, 3).map((s) => new Date(s.start).toISOString()).join(" "));
  ok("the whole meeting fits inside the window",
    slots.every((s) => new Date(s.end).getUTCHours() < 16 ||
      (new Date(s.end).getUTCHours() === 16 && new Date(s.end).getUTCMinutes() === 0)));
}

section("Busy blocks are avoided, with a buffer on both sides");
{
  const mon = Date.UTC(2026, 9, 12);
  const busyStart = mon + 10 * H;           // 10:00 to 11:00 is taken
  const slots = cal.findSlots({
    from: mon, days: 1, timezone: "UTC", leadTimeHours: 0, maxSlots: 50, perDay: 50,
    durationMin: 15, bufferMin: 15,
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 },
    busy: [{ start: busyStart, end: busyStart + H }],
  });
  const clashes = slots.filter((s) => s.start < busyStart + H && s.end > busyStart);
  ok("no slot overlaps the busy block", clashes.length === 0, JSON.stringify(clashes));
  // The 15 minute buffer should also remove the 09:45 and 11:00 adjacents.
  const tooClose = slots.filter((s) =>
    (s.end > busyStart - 15 * M && s.start < busyStart) ||
    (s.start < busyStart + H + 15 * M && s.end > busyStart + H));
  ok("the buffer keeps slots off the edges of a commitment", tooClose.length === 0,
    tooClose.map((s) => new Date(s.start).toISOString()).join(","));
  ok("a fully booked day yields nothing rather than something wrong",
    cal.findSlots({ from: mon, days: 1, timezone: "UTC", leadTimeHours: 0,
      window: { days: [1], startHour: 9, endHour: 16 },
      busy: [{ start: mon, end: mon + 24 * H }] }).length === 0);
}

section("Lead time and volume");
{
  const mon = Date.UTC(2026, 9, 12);
  const slots = cal.findSlots({
    from: mon, days: 10, timezone: "UTC", leadTimeHours: 24, maxSlots: 50, perDay: 50,
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 }, busy: [],
  });
  ok("nothing is offered inside the lead time",
    slots.every((s) => s.start >= mon + 24 * H),
    new Date(Math.min(...slots.map((s) => s.start))).toISOString());

  const few = cal.findSlots({
    from: mon, days: 10, timezone: "UTC", leadTimeHours: 0,
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 }, busy: [],
  });
  ok("the default offers a short list, not everything", few.length <= 4, "n=" + few.length);
  const perDay = {};
  few.forEach((s) => { const k = new Date(s.start).toISOString().slice(0, 10); perDay[k] = (perDay[k] || 0) + 1; });
  ok("at most two per day, so it does not read as desperate",
    Object.values(perDay).every((v) => v <= 2), JSON.stringify(perDay));
}

section("Timezone is the host's, not UTC");
{
  const mon = Date.UTC(2026, 9, 12);
  const toronto = cal.findSlots({
    from: mon, days: 2, timezone: "America/Toronto", leadTimeHours: 0, maxSlots: 50, perDay: 50,
    window: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 16 }, busy: [],
  });
  const utcHours = toronto.map((s) => new Date(s.start).getUTCHours());
  // Toronto is UTC-4 in October, so 09:00-16:00 local is 13:00-20:00 UTC.
  ok("a 09:00 local start is 13:00 UTC", Math.min(...utcHours) === 13,
    "min UTC hour=" + Math.min(...utcHours));
  ok("the window closes at 16:00 local, which is 20:00 UTC", Math.max(...utcHours) < 20,
    "max UTC hour=" + Math.max(...utcHours));
  ok("an invalid timezone offers nothing rather than guessing",
    cal.findSlots({ from: mon, days: 2, timezone: "Not/AZone", leadTimeHours: 0, busy: [] }).length === 0);
}

section("Slots are described in words a recipient can act on");
{
  const s = [{ start: Date.UTC(2026, 9, 14, 14, 0), end: Date.UTC(2026, 9, 14, 14, 15) }];
  const d = cal.describeSlots(s, "America/Toronto");
  ok("the day is named", /Wednesday/.test(d[0]), d[0]);
  ok("the month and date are named", /October 14/.test(d[0]), d[0]);
  ok("the local time is given", /10:00/.test(d[0]), d[0]);
}

section("Credentials fail permanently, not forever");
(async () => {
  const saved = process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_ID;
  let err = null;
  try { await cal.freeBusy(["primary"], Date.now(), Date.now() + H); } catch (e) { err = e; }
  ok("it throws without credentials", !!err);
  ok("marked permanent so the runner does not retry forever", err && err.permanent === true);
  ok("the message names the scope needed",
    err && /auth\/calendar/.test(err.message), err && err.message.slice(0, 120));
  if (saved) process.env.GOOGLE_CLIENT_ID = saved;

  console.log("\n" + "=".repeat(58));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nSlot arithmetic verified. Google free/busy stays the authority:");
    console.log("an unreadable calendar is an error, never treated as free.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(58));
  process.exit(fail === 0 ? 0 : 1);
})();
