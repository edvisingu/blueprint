#!/usr/bin/env node
/* Tests the job runner's guarantees, not its happy path.
 *
 *   node server/runner.test.js
 *
 * The cases that matter are the ones where a naive queue loses or duplicates
 * work: a worker dying mid-job, two workers racing for the same job, a
 * duplicate enqueue, a handler that always fails, and a recurring job that
 * must survive a restart. In this domain duplicate work means a second email
 * to a prospect, so these are correctness tests rather than polish.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { open } = require("./db.js");
const runner = require("./runner.js");

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else { fail++; failures.push(name); console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? " — " + detail : "")); }
}
const section = (t) => console.log("\n\x1b[1m" + t + "\x1b[0m");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "drd-runner-"));
const db = open(path.join(tmp, "r.db"));
const ORG = "org_test";
db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at) VALUES (?,?,'Growth',5000,0,1,?)")
  .run(ORG, "Test", Date.now());

(async () => {

section("Basic lifecycle");
{
  const seen = [];
  runner.register("echo", async (payload) => { seen.push(payload.n); return { got: payload.n }; });
  const e = runner.enqueue(db, ORG, "echo", { n: 1 });
  ok("enqueue returns an id", !!e.id);
  ok("not flagged duplicate", e.duplicate === false);
  const r = await runner.drain(db);
  ok("one job claimed and run", r.claimed === 1 && r.done === 1, JSON.stringify(r).slice(0, 120));
  ok("the handler actually ran", seen[0] === 1);
  const row = db.prepare("SELECT state, result_json FROM jobs WHERE id=?").get(e.id);
  ok("state is DONE", row.state === "DONE", row.state);
  ok("the result is stored", JSON.parse(row.result_json).got === 1);
  const again = await runner.drain(db);
  ok("a DONE job is not re-run", again.claimed === 0, "claimed=" + again.claimed);
}

section("Scheduling — a future job is not run early");
{
  runner.register("later", async () => "ran");
  const e = runner.enqueue(db, ORG, "later", {}, { runAt: Date.now() + 60000 });
  const r = await runner.drain(db);
  ok("a job scheduled for the future is not claimed", r.claimed === 0, "claimed=" + r.claimed);
  // Move it into the past and confirm it then runs.
  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, e.id);
  const r2 = await runner.drain(db);
  ok("it runs once due", r2.done === 1, JSON.stringify(r2).slice(0, 100));
}

section("Idempotency — a repeated enqueue does not duplicate work");
{
  let runs = 0;
  runner.register("once", async () => { runs++; return runs; });
  const key = "followup:contact_42:step_2";
  const a = runner.enqueue(db, ORG, "once", {}, { idempotencyKey: key });
  const b = runner.enqueue(db, ORG, "once", {}, { idempotencyKey: key });
  const c = runner.enqueue(db, ORG, "once", {}, { idempotencyKey: key });
  ok("the second enqueue is reported as a duplicate", b.duplicate === true);
  ok("the third too", c.duplicate === true);
  ok("all three refer to one job", a.id === b.id && b.id === c.id, a.id + " " + b.id + " " + c.id);
  ok("only one row exists",
    db.prepare("SELECT COUNT(*) n FROM jobs WHERE idempotency_key=?").get(key).n === 1);
  await runner.drain(db);
  ok("the handler ran exactly once", runs === 1, "runs=" + runs);

  // The database enforces it, not just the application check.
  let threw = false;
  try {
    db.prepare("INSERT INTO jobs (id,org_id,kind,payload_json,state,attempts,created_at,updated_at,run_at,max_attempts,idempotency_key,priority) VALUES ('job_x',?,?,'{}','QUEUED',0,?,?,?,5,?,0)")
      .run(ORG, "once", Date.now(), Date.now(), Date.now(), key);
  } catch (e) { threw = /UNIQUE/i.test(e.message); }
  ok("a direct duplicate insert is rejected by the unique index", threw);
}

section("Retries — transient failure backs off, then gives up");
{
  let attempts = 0;
  runner.register("flaky", async () => { attempts++; throw new Error("upstream 503"); });
  const e = runner.enqueue(db, ORG, "flaky", {}, { maxAttempts: 3 });

  const r1 = await runner.drain(db);
  ok("first failure schedules a retry", r1.retried === 1, JSON.stringify(r1).slice(0, 120));
  let row = db.prepare("SELECT state, attempts, error, run_at FROM jobs WHERE id=?").get(e.id);
  ok("state back to QUEUED", row.state === "QUEUED", row.state);
  ok("the error is recorded", /upstream 503/.test(row.error), row.error);
  ok("the retry is scheduled in the future", row.run_at > Date.now(), row.run_at - Date.now() + "ms");

  // Fast-forward through the remaining attempts.
  for (let i = 0; i < 2; i++) {
    db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, e.id);
    await runner.drain(db);
  }
  row = db.prepare("SELECT state, attempts, error FROM jobs WHERE id=?").get(e.id);
  ok("after maxAttempts the job is DEAD", row.state === "DEAD", row.state);
  ok("it attempted exactly 3 times", attempts === 3, "attempts=" + attempts);
  ok("the final error is kept", /upstream 503/.test(row.error));
  const alerts = require("./sending.js").openAlerts(db, ORG);
  ok("a dead job raises an alert", alerts.some((a) => a.kind === "job_dead"),
    alerts.map((a) => a.kind).join(","));

  const rev = runner.revive(db, ORG, e.id);
  ok("a dead job can be revived once the cause is fixed", rev.ok === true);
  ok("revival resets the attempt count",
    db.prepare("SELECT attempts, state FROM jobs WHERE id=?").get(e.id).attempts === 0);
}

section("Permanent failure skips the retry budget");
{
  let runs = 0;
  runner.register("nope", async () => {
    runs++;
    const e = new Error("contact has no email address");
    e.permanent = true;   // a bad row will not become good by waiting
    throw e;
  });
  const e = runner.enqueue(db, ORG, "nope", {}, { maxAttempts: 5 });
  await runner.drain(db);
  const row = db.prepare("SELECT state FROM jobs WHERE id=?").get(e.id);
  ok("a permanent error goes straight to DEAD", row.state === "DEAD", row.state);
  ok("it did not burn the retry budget", runs === 1, "runs=" + runs);
}

section("An unregistered kind is a deployment error, not a retry loop");
{
  const e = runner.enqueue(db, ORG, "kind_that_does_not_exist", {});
  await runner.drain(db);
  const row = db.prepare("SELECT state, error FROM jobs WHERE id=?").get(e.id);
  ok("goes straight to DEAD", row.state === "DEAD", row.state);
  ok("the error names the missing kind", /no handler registered/.test(row.error), row.error);
  ok("a critical alert is raised",
    require("./sending.js").openAlerts(db, ORG).some((a) => a.kind === "job_no_handler"));
}

section("Crash safety — an expired lease is reclaimed");
{
  runner.register("slow", async () => "finished");
  const e = runner.enqueue(db, ORG, "slow", {});
  // Simulate a worker claiming the job and then dying: RUNNING with a lease
  // that has already lapsed, which is exactly the state a killed process
  // leaves behind.
  const claimed = runner.claim(db, "worker_that_dies", 1);
  ok("the job was claimed", claimed.length === 1);
  ok("state is RUNNING", db.prepare("SELECT state FROM jobs WHERE id=?").get(e.id).state === "RUNNING");

  const fresh = await runner.drain(db);
  ok("a live lease is not stolen by another worker", fresh.claimed === 0, "claimed=" + fresh.claimed);

  db.prepare("UPDATE jobs SET lease_until=? WHERE id=?").run(Date.now() - 1000, e.id);
  const st = runner.stats(db, ORG);
  ok("stats surface the stalled job", st.stalled >= 1, "stalled=" + st.stalled);

  const recovered = await runner.drain(db);
  ok("the expired lease is reclaimed and the job completes", recovered.done === 1,
    JSON.stringify(recovered).slice(0, 120));
  ok("work was not lost", db.prepare("SELECT state FROM jobs WHERE id=?").get(e.id).state === "DONE");
}

section("Two workers cannot claim the same job");
{
  runner.register("contended", async () => "ok");
  for (let i = 0; i < 8; i++) runner.enqueue(db, ORG, "contended", { i });
  const a = runner.claim(db, "worker_a", 8);
  const b = runner.claim(db, "worker_b", 8);
  const overlap = a.filter((j) => b.some((k) => k.id === j.id));
  ok("worker A claimed the batch", a.length === 8, "a=" + a.length);
  ok("worker B claimed nothing already held", b.length === 0, "b=" + b.length);
  ok("no job was claimed twice", overlap.length === 0, "overlap=" + overlap.length);
  for (const j of a) await runner.runOne(db, j);
}

section("Recurring jobs re-arm themselves");
{
  let ticks = 0;
  runner.register("poll", async () => { ticks++; return ticks; });
  const e = runner.enqueue(db, ORG, "poll", {}, { repeatEveryMs: 60000 });
  await runner.drain(db);
  let row = db.prepare("SELECT state, run_at, attempts FROM jobs WHERE id=?").get(e.id);
  ok("after running, a recurring job returns to QUEUED", row.state === "QUEUED", row.state);
  ok("it is rescheduled into the future", row.run_at > Date.now(), row.run_at - Date.now() + "ms");
  ok("its attempt count is reset", row.attempts === 0, "attempts=" + row.attempts);
  ok("it ran once so far", ticks === 1, "ticks=" + ticks);

  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 1, e.id);
  await runner.drain(db);
  ok("it runs again when next due", ticks === 2, "ticks=" + ticks);
  ok("there is still exactly one row for it",
    db.prepare("SELECT COUNT(*) n FROM jobs WHERE id=?").get(e.id).n === 1);
}

section("Priority and ordering");
{
  runner.register("ordered", async () => "ok");
  const order = [];
  runner.register("ordered", async (p) => { order.push(p.tag); return "ok"; });
  runner.enqueue(db, ORG, "ordered", { tag: "low" }, { priority: 0 });
  runner.enqueue(db, ORG, "ordered", { tag: "high" }, { priority: 10 });
  runner.enqueue(db, ORG, "ordered", { tag: "mid" }, { priority: 5 });
  await runner.drain(db, { batchSize: 3 });
  ok("higher priority runs first", order[0] === "high" && order[1] === "mid" && order[2] === "low",
    order.join(","));
}

section("Backoff is bounded and jittered");
{
  const o = runner.DEFAULTS;
  const d1 = runner.backoffFor(1, o), d5 = runner.backoffFor(5, o), d20 = runner.backoffFor(20, o);
  ok("backoff grows with attempts", d5 > d1, d1 + " -> " + d5);
  ok("backoff is capped", d20 <= o.backoffMaxMs * (1 + o.jitter), d20 + " vs cap " + o.backoffMaxMs);
  const samples = new Set();
  for (let i = 0; i < 20; i++) samples.add(runner.backoffFor(3, o));
  ok("jitter means retries do not fire in lockstep", samples.size > 1, "distinct=" + samples.size);
}

section("Queue health is observable");
{
  const st = runner.stats(db, ORG);
  ok("states are counted", typeof st.byState === "object" && Object.keys(st.byState).length > 0,
    JSON.stringify(st.byState));
  ok("dead jobs are grouped by kind", Array.isArray(st.dead));
  ok("registered handlers are listed", st.handlers.includes("echo"));
  // Make something overdue and confirm it is reported: this is how "nothing is
  // draining" becomes visible instead of being inferred from silence.
  runner.register("stuck", async () => "ok");
  const e = runner.enqueue(db, ORG, "stuck", {});
  db.prepare("UPDATE jobs SET run_at=? WHERE id=?").run(Date.now() - 10 * 60 * 1000, e.id);
  ok("an overdue job is reported", runner.stats(db, ORG).overdue >= 1,
    "overdue=" + runner.stats(db, ORG).overdue);
}

section("A handler throwing does not stop the batch");
{
  const done = [];
  runner.register("mixed", async (p) => {
    if (p.bad) throw new Error("this one fails");
    done.push(p.i);
    return "ok";
  });
  for (let i = 0; i < 5; i++) runner.enqueue(db, ORG, "mixed", { i, bad: i === 2 });
  const r = await runner.drain(db, { batchSize: 10 });
  ok("the good jobs still completed", done.length >= 4, "done=" + done.join(","));
  ok("the failure was recorded as a retry, not a crash", r.retried >= 1, JSON.stringify(r).slice(0, 140));
}

  console.log("\n" + "=".repeat(60));
  if (fail === 0) {
    console.log("\x1b[1m\x1b[32m" + pass + " passed, 0 failed\x1b[0m");
    console.log("\nWork survives a crash, runs once, retries with bounded backoff,");
    console.log("and gives up loudly. Duplicate enqueues are rejected by the database.");
  } else {
    console.log("\x1b[1m\x1b[31m" + pass + " passed, " + fail + " FAILED\x1b[0m");
    failures.forEach((f) => console.log("  - " + f));
  }
  console.log("=".repeat(60));
  db.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("runner tests crashed:", e); process.exit(1); });
