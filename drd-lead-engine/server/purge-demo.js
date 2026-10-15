#!/usr/bin/env node
/* Removes every generated sample row from a database, and everything that
 * hangs off it, so the remaining contents are only what was really imported.
 *
 *   node server/purge-demo.js [db-path] [--dry-run]
 *
 * Demo rows can never be sent to regardless (the send path refuses
 * origin='demo'), but while they are present every count, chart and pipeline
 * figure is meaningless. The readiness gate blocks arming until they are gone.
 */
"use strict";
const { open } = require("./db.js");

function purge(dbFile, opts) {
  const o = opts || {};
  const db = open(dbFile);
  const before = {};
  const tables = ["companies", "contacts", "campaigns", "campaign_leads", "conversations",
    "messages", "meetings", "consents", "sends", "research_reports", "icps", "suppressions"];
  tables.forEach((t) => { before[t] = db.prepare("SELECT COUNT(*) n FROM " + t).get().n; });

  const demoContacts = db.prepare("SELECT COUNT(*) n FROM contacts WHERE origin='demo'").get().n;
  const demoCompanies = db.prepare("SELECT COUNT(*) n FROM companies WHERE origin='demo'").get().n;

  if (o.dryRun) {
    db.close();
    return { dryRun: true, wouldDelete: { contacts: demoContacts, companies: demoCompanies }, before };
  }

  db.exec("BEGIN");
  try {
    // Order matters: children first, since foreign keys are enforced.
    db.exec(`
      DELETE FROM messages WHERE conversation_id IN
        (SELECT id FROM conversations WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo'));
      DELETE FROM conversations WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM meetings WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM campaign_leads WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM sends WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM consents WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM unsubscribe_tokens WHERE contact_id IN (SELECT id FROM contacts WHERE origin='demo');
      DELETE FROM contacts WHERE origin='demo';
      DELETE FROM research_reports WHERE company_id IN (SELECT id FROM companies WHERE origin='demo');
      DELETE FROM companies WHERE origin='demo'
        AND id NOT IN (SELECT DISTINCT company_id FROM contacts);
    `);
    db.prepare("UPDATE organizations SET demo_data=0").run();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    db.close();
    throw e;
  }
  const after = {};
  tables.forEach((t) => { after[t] = db.prepare("SELECT COUNT(*) n FROM " + t).get().n; });
  const remainingDemo = db.prepare("SELECT COUNT(*) n FROM contacts WHERE origin='demo'").get().n;
  db.close();
  return { before, after, deleted: { contacts: demoContacts, companies: demoCompanies }, remainingDemo };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  const r = purge(file, { dryRun });
  if (r.dryRun) {
    console.log("dry run — would delete", r.wouldDelete.contacts, "contacts and",
      r.wouldDelete.companies, "companies tagged origin='demo'");
  } else {
    console.log("purged", r.deleted.contacts, "demo contacts and", r.deleted.companies, "demo companies");
    console.log("remaining demo contacts:", r.remainingDemo, "(must be 0)");
    console.log("rows now:", JSON.stringify(r.after));
  }
}
module.exports = { purge };
