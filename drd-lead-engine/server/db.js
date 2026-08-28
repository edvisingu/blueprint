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
`;

const DEFAULT_DB = process.env.DRD_DB_PATH || path.join(__dirname, "drd.db");

function open(file) {
  const db = new DatabaseSync(file || DEFAULT_DB);
  db.exec(SCHEMA);
  return db;
}

const id = (p) => p + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

module.exports = { open, id, SCHEMA, DEFAULT_DB };
