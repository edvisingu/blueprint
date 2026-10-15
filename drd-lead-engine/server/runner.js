/* Durable job runner. The architectural hole the competitive research ranked #1.
 *
 * Scheduled follow-ups, reply polling, recurring enrichment and signal checks
 * all need the same thing: work that survives a restart, runs once, retries on
 * failure, and gives up loudly instead of quietly. None of those features are
 * hard once this exists; none are possible until it does.
 *
 * Properties, and why each one matters here:
 *
 *   AT-LEAST-ONCE WITH LEASES. A worker claims a job by writing a lease
 *   expiry. If the process dies mid-job the lease lapses and another worker
 *   picks it up. The alternative — deleting on claim — loses work on a crash,
 *   which for a follow-up send means a prospect silently never hears back.
 *
 *   IDEMPOTENCY KEYS. Enqueueing is safe to repeat. "Send step 2 to contact X"
 *   carries a key, so a retried enqueue is a no-op rather than a second email
 *   to the same person. Duplicate outbound is the worst failure mode in this
 *   domain: it is visible to the prospect and unrecoverable.
 *
 *   BOUNDED RETRIES, THEN DEAD. Exponential backoff with jitter, then the job
 *   moves to DEAD and raises an alert. A job that retries forever is how a
 *   queue silently stops doing anything else.
 *
 *   NO SILENT ANYTHING. Every terminal state is recorded with its error. The
 *   runner surfaces counts so a stuck queue is visible rather than inferred
 *   from work not happening.
 *
 * node:sqlite is synchronous, so a claim inside a transaction is genuinely
 * atomic without extra locking. Handlers may be async.
 */
"use strict";

const { id } = require("./db");

const SEC = 1000;

const DEFAULTS = {
  maxAttempts: 5,
  leaseMs: 60 * SEC,
  batchSize: 10,
  // 10s, 40s, 2.5m, 10m, 40m — slow enough to outlast a brief outage, bounded
  // so a permanently broken job reaches DEAD within the hour.
  backoffBaseMs: 10 * SEC,
  backoffFactor: 4,
  backoffMaxMs: 60 * 60 * SEC,
  jitter: 0.2,
};

const handlers = new Map();

/* Register a handler. Signature: async (payload, ctx) => result
 * Throwing schedules a retry; returning marks the job done. */
function register(kind, fn) {
  if (typeof fn !== "function") throw new Error("handler for " + kind + " must be a function");
  handlers.set(kind, fn);
}
function registered() { return [...handlers.keys()]; }

function backoffFor(attempts, o) {
  const base = Math.min(o.backoffBaseMs * Math.pow(o.backoffFactor, attempts - 1), o.backoffMaxMs);
  // Jitter stops a batch of jobs that failed together from retrying in
  // lockstep and hammering whatever broke.
  const spread = base * o.jitter;
  return Math.round(base - spread + Math.random() * spread * 2);
}

/* Enqueue. Returns {id, duplicate} — duplicate:true means an idempotency key
 * matched an existing job and nothing new was created. */
function enqueue(db, orgId, kind, payload, opts) {
  const o = opts || {};
  const now = Date.now();
  const runAt = o.runAt || now;

  if (o.idempotencyKey) {
    const existing = db
      .prepare("SELECT id, state FROM jobs WHERE org_id=? AND idempotency_key=?")
      .get(orgId, o.idempotencyKey);
    if (existing) return { id: existing.id, duplicate: true, state: existing.state };
  }

  const jid = id("job");
  try {
    db.prepare(
      "INSERT INTO jobs (id,org_id,kind,payload_json,state,attempts,created_at,updated_at," +
        "run_at,max_attempts,idempotency_key,priority,repeat_every_ms)" +
        " VALUES (?,?,?,?,'QUEUED',0,?,?,?,?,?,?,?)"
    ).run(jid, orgId, kind, JSON.stringify(payload || {}), now, now, runAt,
      o.maxAttempts || DEFAULTS.maxAttempts, o.idempotencyKey || null,
      o.priority || 0, o.repeatEveryMs || null);
  } catch (e) {
    // A race on the unique idempotency index: the other writer won, which is
    // the correct outcome.
    if (/UNIQUE/i.test(e.message) && o.idempotencyKey) {
      const row = db.prepare("SELECT id, state FROM jobs WHERE org_id=? AND idempotency_key=?")
        .get(orgId, o.idempotencyKey);
      if (row) return { id: row.id, duplicate: true, state: row.state };
    }
    throw e;
  }
  return { id: jid, duplicate: false };
}

/* Claim up to `limit` due jobs for this worker, atomically.
 *
 * Due means: QUEUED and run_at has passed, OR RUNNING with an expired lease
 * (the previous worker died). Highest priority first, then oldest run_at, so
 * a backlog drains in a predictable order.
 */
function claim(db, workerId, limit, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const now = Date.now();
  const claimed = [];

  db.exec("BEGIN IMMEDIATE");
  try {
    const due = db
      .prepare(
        "SELECT * FROM jobs WHERE" +
          " (state='QUEUED' AND run_at <= ?)" +
          " OR (state='RUNNING' AND lease_until IS NOT NULL AND lease_until < ?)" +
          " ORDER BY priority DESC, run_at ASC LIMIT ?"
      )
      .all(now, now, limit || o.batchSize);

    const upd = db.prepare(
      "UPDATE jobs SET state='RUNNING', lease_until=?, worker=?, attempts=attempts+1, updated_at=?" +
        " WHERE id=? AND state IN ('QUEUED','RUNNING')"
    );
    for (const job of due) {
      const r = upd.run(now + o.leaseMs, workerId, now, job.id);
      if (r.changes === 1) claimed.push(Object.assign({}, job, { attempts: job.attempts + 1 }));
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return claimed;
}

/* Run one claimed job. Never throws: a handler failure is data. */
async function runOne(db, job, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const fn = handlers.get(job.kind);
  const now = () => Date.now();

  if (!fn) {
    // An unregistered kind is a deployment mistake, not a transient fault, so
    // it goes straight to DEAD rather than burning five attempts.
    db.prepare("UPDATE jobs SET state='DEAD', error=?, updated_at=? WHERE id=?")
      .run("no handler registered for kind '" + job.kind + "'", now(), job.id);
    alert(db, job.org_id, "job_no_handler", "critical", job.kind,
      "Jobs of kind '" + job.kind + "' are being enqueued but no handler is registered.");
    return { id: job.id, state: "DEAD", error: "no_handler" };
  }

  let payload = {};
  try { payload = JSON.parse(job.payload_json || "{}"); } catch (e) {}

  try {
    const result = await fn(payload, { db, job, orgId: job.org_id });

    // A recurring job re-arms itself on success rather than being re-enqueued
    // by a caller, so the schedule survives a restart with no external cron.
    if (job.repeat_every_ms) {
      db.prepare(
        "UPDATE jobs SET state='QUEUED', run_at=?, lease_until=NULL, worker=NULL," +
          " attempts=0, error=NULL, result_json=?, updated_at=? WHERE id=?"
      ).run(now() + job.repeat_every_ms, JSON.stringify(result === undefined ? null : result),
        now(), job.id);
      return { id: job.id, state: "QUEUED", repeated: true, result };
    }

    db.prepare("UPDATE jobs SET state='DONE', lease_until=NULL, result_json=?, error=NULL, updated_at=? WHERE id=?")
      .run(JSON.stringify(result === undefined ? null : result), now(), job.id);
    return { id: job.id, state: "DONE", result };
  } catch (e) {
    const message = (e && e.message) || String(e);
    const permanent = e && e.permanent === true;
    const exhausted = job.attempts >= (job.max_attempts || o.maxAttempts);

    if (permanent || exhausted) {
      db.prepare("UPDATE jobs SET state='DEAD', lease_until=NULL, error=?, updated_at=? WHERE id=?")
        .run(message, now(), job.id);
      alert(db, job.org_id, "job_dead", "warn", job.kind,
        "A " + job.kind + " job gave up after " + job.attempts + " attempt(s): " + message);
      return { id: job.id, state: "DEAD", error: message };
    }
    const delay = backoffFor(job.attempts, o);
    db.prepare("UPDATE jobs SET state='QUEUED', lease_until=NULL, worker=NULL, run_at=?, error=?, updated_at=? WHERE id=?")
      .run(now() + delay, message, now(), job.id);
    return { id: job.id, state: "QUEUED", retryInMs: delay, error: message };
  }
}

/* Raise an alert through the sending module's table, so queue problems show up
 * in the same place as deliverability problems. Required lazily to avoid a
 * circular import at load time. */
function alert(db, orgId, kind, severity, subject, detail) {
  try { require("./sending.js").raise(db, orgId, kind, severity, subject, detail); }
  catch (e) { /* alerts are best-effort; never fail a job over one */ }
}

/* Drain: claim and run one batch. Returns a summary. Call on a timer, or from
 * a request handler, or from a test — it does not assume a long-lived loop. */
async function drain(db, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const workerId = o.workerId || ("w_" + process.pid + "_" + Math.random().toString(36).slice(2, 6));
  const jobs = claim(db, workerId, o.batchSize, o);
  const results = [];
  for (const job of jobs) results.push(await runOne(db, job, o));
  return {
    worker: workerId,
    claimed: jobs.length,
    done: results.filter((r) => r.state === "DONE").length,
    repeated: results.filter((r) => r.repeated).length,
    retried: results.filter((r) => r.state === "QUEUED" && !r.repeated).length,
    dead: results.filter((r) => r.state === "DEAD").length,
    results,
  };
}

/* Queue health. The numbers that make a stuck queue visible. */
function stats(db, orgId) {
  const where = orgId ? " WHERE org_id=?" : "";
  const args = orgId ? [orgId] : [];
  const byState = db.prepare("SELECT state, COUNT(*) n FROM jobs" + where + " GROUP BY state").all(...args);
  const now = Date.now();
  const overdue = db
    .prepare("SELECT COUNT(*) n FROM jobs" + (orgId ? " WHERE org_id=? AND" : " WHERE") +
      " state='QUEUED' AND run_at < ?")
    .get(...args, now - 5 * 60 * SEC).n;
  const stalled = db
    .prepare("SELECT COUNT(*) n FROM jobs" + (orgId ? " WHERE org_id=? AND" : " WHERE") +
      " state='RUNNING' AND lease_until < ?")
    .get(...args, now).n;
  const dead = db
    .prepare("SELECT kind, COUNT(*) n, MAX(error) last_error FROM jobs" +
      (orgId ? " WHERE org_id=? AND" : " WHERE") + " state='DEAD' GROUP BY kind")
    .all(...args);
  return {
    byState: byState.reduce((m, r) => { m[r.state] = r.n; return m; }, {}),
    // Queued and past due by more than 5 minutes: nothing is draining.
    overdue,
    // Claimed but the lease expired: a worker died mid-job.
    stalled,
    dead,
    handlers: registered(),
  };
}

/* Requeue a dead job after the cause has been fixed. */
function revive(db, orgId, jobId) {
  const r = db.prepare("SELECT * FROM jobs WHERE id=? AND org_id=?").get(jobId, orgId);
  if (!r) return { ok: false, error: "job_not_found" };
  if (r.state !== "DEAD") return { ok: false, error: "not_dead", state: r.state };
  db.prepare("UPDATE jobs SET state='QUEUED', attempts=0, run_at=?, error=NULL, lease_until=NULL, updated_at=? WHERE id=?")
    .run(Date.now(), Date.now(), jobId);
  return { ok: true, id: jobId };
}

/* Start a polling loop. Returns a stop function. The server calls this; tests
 * call drain() directly so they never depend on wall-clock timing. */
function start(db, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  const everyMs = o.pollMs || 5 * SEC;
  let stopped = false, timer = null, running = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try { await drain(db, o); }
    catch (e) { alert(db, "org_root", "job_runner_error", "critical", "runner", e.message); }
    finally { running = false; }
  };
  timer = setInterval(tick, everyMs);
  // Do not hold the process open on this timer alone.
  if (timer.unref) timer.unref();
  return function stop() { stopped = true; if (timer) clearInterval(timer); };
}

module.exports = {
  register, registered, enqueue, claim, runOne, drain, stats, revive, start,
  backoffFor, DEFAULTS, handlers,
};
