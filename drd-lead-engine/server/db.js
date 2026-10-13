/* Relational persistence layer (spec §S). Zero dependencies: node:sqlite. */
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'Growth',
  credits_included INTEGER NOT NULL DEFAULT 5000, credits_used INTEGER NOT NULL DEFAULT 0,
  autopilot INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_used_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL, website TEXT, profile_json TEXT, autopilot INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL,
  industry TEXT, sub TEXT, country TEXT, region TEXT, city TEXT,
  size INTEGER, revenue TEXT, founded INTEGER, traffic INTEGER,
  tech_json TEXT, signals_json TEXT, funding_json TEXT, description TEXT, pains_json TEXT);
CREATE INDEX IF NOT EXISTS idx_co_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_co_country ON companies(country);
CREATE INDEX IF NOT EXISTS idx_co_size ON companies(size);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL, title TEXT, seniority TEXT, department TEXT,
  email TEXT, email_status TEXT, verified INTEGER, phone TEXT, linkedin TEXT,
  city TEXT, country TEXT);
CREATE INDEX IF NOT EXISTS idx_ct_company ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_ct_email ON contacts(email);

CREATE TABLE IF NOT EXISTS icps (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, fit INTEGER, industry TEXT, country TEXT, size_min INTEGER,
  approved INTEGER NOT NULL DEFAULT 0, why TEXT, buyers_json TEXT);

CREATE TABLE IF NOT EXISTS saved_searches (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, query TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS research_reports (
  id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
  contact_id TEXT, report_json TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'deterministic',
  created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rr_company ON research_reports(company_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL, icp_id TEXT, goal TEXT, tone TEXT,
  status TEXT NOT NULL DEFAULT 'Draft', autopilot INTEGER NOT NULL DEFAULT 0,
  budget REAL NOT NULL DEFAULT 0, spend REAL NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0,
  positive INTEGER NOT NULL DEFAULT 0, sequence_json TEXT, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS campaign_leads (
  id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'Queued', step INTEGER NOT NULL DEFAULT 0,
  score INTEGER, added_at INTEGER NOT NULL,
  UNIQUE(campaign_id, contact_id));
CREATE INDEX IF NOT EXISTS idx_cl_campaign ON campaign_leads(campaign_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id), company_id TEXT NOT NULL REFERENCES companies(id),
  subject TEXT, status TEXT NOT NULL DEFAULT 'Sent',
  intent TEXT, intent_confidence INTEGER, intent_json TEXT,
  hot INTEGER NOT NULL DEFAULT 0, last_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cv_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_cv_hot ON conversations(hot);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, body TEXT NOT NULL, subject TEXT, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ms_conv ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY, campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id TEXT NOT NULL REFERENCES contacts(id), company_id TEXT NOT NULL REFERENCES companies(id),
  title TEXT, at INTEGER NOT NULL, duration INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Proposed', created_at INTEGER NOT NULL,
  UNIQUE(contact_id));

CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  type TEXT NOT NULL, value TEXT NOT NULL, reason TEXT, scope TEXT NOT NULL DEFAULT 'Global',
  created_at INTEGER NOT NULL, UNIQUE(org_id, value));

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL, credits INTEGER NOT NULL, cost REAL NOT NULL DEFAULT 0,
  ref TEXT, at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  url TEXT NOT NULL, events_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY, webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL, payload_json TEXT NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL, kind TEXT NOT NULL, payload_json TEXT,
  state TEXT NOT NULL DEFAULT 'QUEUED', attempts INTEGER NOT NULL DEFAULT 0,
  result_json TEXT, error TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);

/* ============================================================ GO-LIVE LAYER
 * Everything below exists so this system can run on real contacts and real
 * sends. Three invariants it enforces, in order of importance:
 *
 *   1. A generated (demo) contact can never be emailed. Demo rows carry
 *      origin='demo' and the send path refuses them unconditionally, so
 *      fiction cannot leak into a real campaign even by mistake.
 *   2. A contact with no valid, unexpired consent basis can never be emailed.
 *      Consent lives in its own audited table, not a boolean, because CASL
 *      puts the burden of proof on the sender.
 *   3. Every send attempt is written to "sends" BEFORE it is attempted, with
 *      its outcome recorded after. That makes the denominator for bounce and
 *      complaint rates "messages we actually sent", not "rows in a list".
 *
 * Nothing here is legal advice. The consent model reflects our reading of
 * CASL and is pending qualified Canadian legal review; docs/COMPLIANCE.md
 * records what is settled and what is not.
 */

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  -- Consent is scoped to (contact x brand), not to the contact. CASL's
  -- relevance test is applied per message, so the same institutional contact
  -- may have a valid basis for one brand and none for another: an athletic
  -- director's published address is relevant to a sports-websites pitch and
  -- not to an unrelated credentials product. NULL means it applies to every
  -- brand, which is correct for express consent given to the operator as a
  -- whole. With five brands this is the most consequential scoping decision
  -- in the schema.
  brand_id TEXT,
  -- express | implied_publication | implied_inquiry | implied_transaction | b2b_exemption
  basis TEXT NOT NULL,
  source_url TEXT,                     -- where the address was published/collected
  source_note TEXT,                    -- how it was obtained, in words
  evidence_ref TEXT,                   -- path/URL to captured evidence (screenshot, PDF)
  role_relevance TEXT,                 -- why the message relates to this person's role
  anti_solicitation_checked INTEGER NOT NULL DEFAULT 0,
  captured_at INTEGER NOT NULL,
  captured_by TEXT NOT NULL,
  expires_at INTEGER,                  -- NULL = no clock (express, publication)
  revoked_at INTEGER,
  revoke_reason TEXT,
  created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cs_contact ON consents(contact_id);
CREATE INDEX IF NOT EXISTS idx_cs_basis ON consents(basis);

CREATE TABLE IF NOT EXISTS mailboxes (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  address TEXT NOT NULL, display_name TEXT,
  provider TEXT NOT NULL,              -- dryrun | smtp | google | microsoft
  -- Credentials NEVER live here. This names the env var holding them.
  credential_env TEXT,
  daily_cap INTEGER NOT NULL DEFAULT 20,
  min_gap_seconds INTEGER NOT NULL DEFAULT 180,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'Disabled',   -- Disabled | Active | Paused
  pause_reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(org_id, address));

CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  domain TEXT NOT NULL,
  spf_ok INTEGER, dkim_ok INTEGER, dmarc_ok INTEGER,
  -- Alignment is the part most tools skip: a passing SPF record on a
  -- different domain than the From header does not protect you.
  alignment_ok INTEGER,
  detail_json TEXT, checked_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(org_id, domain));

CREATE TABLE IF NOT EXISTS sends (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id TEXT NOT NULL REFERENCES contacts(id),
  mailbox_id TEXT REFERENCES mailboxes(id),
  step INTEGER NOT NULL DEFAULT 0,
  -- QUEUED | DRAFTED | SENT | SKIPPED | FAILED | BOUNCED | COMPLAINED | UNSUBSCRIBED
  -- DRAFTED is deliberately distinct from SENT: a Gmail draft awaiting human
  -- review has reached nobody, consumes no sending reputation, and must never
  -- be counted as delivered mail.
  state TEXT NOT NULL DEFAULT 'QUEUED',
  -- Why a send did not happen. Never silent: every skip is a row.
  skip_reason TEXT,
  subject TEXT, body TEXT,
  dry_run INTEGER NOT NULL DEFAULT 1,
  provider_message_id TEXT, error TEXT,
  -- The consent record this send relied on, captured at send time. CompuFinder
  -- failed on log granularity rather than consent quality: without knowing who
  -- received which message when, it could not produce evidence of consent for
  -- a given recipient. A per-send snapshot makes that reconstructable.
  consent_id TEXT REFERENCES consents(id),
  brand_id TEXT,
  queued_at INTEGER NOT NULL, attempted_at INTEGER, settled_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_sn_state ON sends(state);
CREATE INDEX IF NOT EXISTS idx_sn_mailbox_day ON sends(mailbox_id, attempted_at);
CREATE INDEX IF NOT EXISTS idx_sn_contact ON sends(contact_id);

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id),
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, used_at INTEGER);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  kind TEXT NOT NULL,                  -- stable machine key, e.g. mailbox_paused
  severity TEXT NOT NULL DEFAULT 'warn',   -- info | warn | critical
  subject TEXT NOT NULL, detail TEXT,
  state TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | ACK | RESOLVED
  count INTEGER NOT NULL DEFAULT 1,
  first_at INTEGER NOT NULL, last_at INTEGER NOT NULL,
  UNIQUE(org_id, kind, subject));
CREATE INDEX IF NOT EXISTS idx_al_state ON alerts(state);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  filename TEXT, rows_total INTEGER NOT NULL DEFAULT 0,
  rows_accepted INTEGER NOT NULL DEFAULT 0, rows_rejected INTEGER NOT NULL DEFAULT 0,
  report_json TEXT, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS inbound_messages (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  -- Provider message id. UNIQUE per org makes ingestion idempotent at the
  -- database level: re-running a poll cannot double-count a reply or inflate
  -- the only metric that says whether the message works.
  gmail_id TEXT NOT NULL,
  thread_id TEXT,
  send_id TEXT REFERENCES sends(id),
  contact_id TEXT REFERENCES contacts(id),
  conversation_id TEXT REFERENCES conversations(id),
  from_email TEXT NOT NULL, from_name TEXT,
  subject TEXT, body TEXT,
  intent TEXT, confidence INTEGER,
  -- An out-of-office is stored but is NOT a reply: counting auto-responders
  -- as replies inflates reply rate and hides a message that is not landing.
  auto_reply INTEGER NOT NULL DEFAULT 0,
  opt_out INTEGER NOT NULL DEFAULT 0,
  matched_via TEXT,
  received_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(org_id, gmail_id));
CREATE INDEX IF NOT EXISTS idx_in_contact ON inbound_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_in_intent ON inbound_messages(intent);

CREATE TABLE IF NOT EXISTS clearances (
  id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
  subject TEXT NOT NULL, granted_by TEXT NOT NULL,
  recorded_by TEXT NOT NULL, note TEXT, at INTEGER NOT NULL);
`;


const DEFAULT_DB = process.env.DRD_DB_PATH || path.join(__dirname, "drd.db");

/* Columns added to tables that already exist in deployed databases.
 * CREATE TABLE IF NOT EXISTS will not alter them, so each is applied
 * idempotently by inspecting pragma table_info first. */
const ADDED_COLUMNS = [
  // Provenance of every company/contact row. 'demo' rows are permanently
  // ineligible to be sent to — see sending.js.
  ["companies", "origin", "TEXT NOT NULL DEFAULT 'demo'"],
  ["contacts", "origin", "TEXT NOT NULL DEFAULT 'demo'"],
  ["contacts", "import_id", "TEXT"],
  ["contacts", "verified_at", "INTEGER"],
  ["contacts", "verify_result", "TEXT"],
  // Arming is explicit and separate from autopilot: a system can be fully
  // configured and still refuse to send until armed.
  ["organizations", "send_armed", "INTEGER NOT NULL DEFAULT 0"],
  ["organizations", "demo_data", "INTEGER NOT NULL DEFAULT 0"],
  // CASL requires the sender to identify itself and give a mailing address.
  ["organizations", "legal_name", "TEXT"],
  ["organizations", "mailing_address", "TEXT"],
  ["organizations", "contact_email", "TEXT"],
  ["organizations", "contact_phone", "TEXT"],
  // Job runner: durable scheduling, leases, retries, idempotency.
  ["jobs", "run_at", "INTEGER NOT NULL DEFAULT 0"],
  ["jobs", "lease_until", "INTEGER"],
  ["jobs", "worker", "TEXT"],
  ["jobs", "max_attempts", "INTEGER NOT NULL DEFAULT 5"],
  ["jobs", "idempotency_key", "TEXT"],
  ["jobs", "priority", "INTEGER NOT NULL DEFAULT 0"],
  ["jobs", "repeat_every_ms", "INTEGER"],
  // Sequence executor.
  ["campaigns", "brand_id", "TEXT"],
  ["campaigns", "send_window_json", "TEXT"],
  ["campaign_leads", "exit_reason", "TEXT"],
  ["campaign_leads", "exited_at", "INTEGER"],
  ["campaign_leads", "last_sent_at", "INTEGER"],
  // Pipeline fields worth having at this scale. Deliberately not probabilities
  // or a weighted forecast: weighted forecasting assumes the law of large
  // numbers and breaks below roughly 20 open deals, which is the likely steady
  // state for a one-person operation. These four give velocity and staleness.
  ["conversations", "stage", "TEXT NOT NULL DEFAULT 'New'"],
  ["conversations", "stage_entered_at", "INTEGER"],
  ["conversations", "last_activity_at", "INTEGER"],
  ["conversations", "lost_reason", "TEXT"],
  ["conversations", "next_action", "TEXT"],
  ["conversations", "next_action_at", "INTEGER"],
  ["consents", "brand_id", "TEXT"],
  ["sends", "consent_id", "TEXT"],
  // Reply matching: the provider's thread id and the RFC 822 Message-ID we
  // generated. Thread id is the strongest signal; Message-ID survives a
  // forward that loses the thread.
  ["sends", "provider_thread_id", "TEXT"],
  ["sends", "rfc_message_id", "TEXT"],
  ["sends", "brand_id", "TEXT"],
  ["suppressions", "channel", "TEXT NOT NULL DEFAULT 'email'"],
  ["suppressions", "honored_at", "INTEGER"],
];

function migrate(db) {
  for (const [table, column, decl] of ADDED_COLUMNS) {
    const cols = db.prepare("SELECT name FROM pragma_table_info(?)").all(table);
    if (!cols.length) continue;                       // table not present yet
    if (cols.some((c) => c.name === column)) continue; // already migrated
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

/* Indexes over columns that migrate() adds. They cannot live in SCHEMA because
 * the columns do not exist on first run, so they are created after migration. */
const POST_MIGRATION = `
CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(state, run_at);
CREATE INDEX IF NOT EXISTS idx_jobs_lease ON jobs(state, lease_until);
-- Idempotency is enforced by the database, not by a check-then-insert in
-- application code: two workers racing to enqueue the same follow-up must not
-- both succeed, and a duplicate outbound email is visible to the prospect.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idem ON jobs(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ct_origin ON contacts(origin);
CREATE INDEX IF NOT EXISTS idx_sends_brand ON sends(brand_id, state);
`;

function open(file) {
  const db = new DatabaseSync(file || DEFAULT_DB);
  db.exec(SCHEMA);
  migrate(db);
  db.exec(POST_MIGRATION);
  return db;
}

const id = (p) => p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

module.exports = { open, id, SCHEMA, DEFAULT_DB, migrate, ADDED_COLUMNS };
