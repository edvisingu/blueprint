#!/usr/bin/env node
/* Loads a campaign definition from campaigns/*.json into the database.
 *
 *   node server/load-campaign.js campaigns/drdsports.json clubs
 *   node server/load-campaign.js campaigns/drdsports.json school_athletics
 *
 * Validates the sequence before writing, so a malformed definition is rejected
 * at load rather than discovered when a lead is already enrolled. Creates the
 * campaign in Draft: nothing can send until it is set Active AND the org is
 * armed AND the readiness gate passes.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { open, id } = require("./db.js");
const sequences = require("./sequences.js");

function load(file, key, opts) {
  const o = opts || {};
  const def = JSON.parse(fs.readFileSync(file, "utf8"));
  const seqDef = def.sequences && def.sequences[key];
  if (!seqDef) {
    throw new Error("no sequence '" + key + "' in " + file +
      " (available: " + Object.keys(def.sequences || {}).join(", ") + ")");
  }
  const errors = sequences.validateSequence(seqDef.steps);
  if (errors.length) throw new Error("invalid sequence:\n  " + errors.join("\n  "));

  const db = open(o.dbFile);
  const org = db.prepare("SELECT id FROM organizations ORDER BY created_at LIMIT 1").get();
  if (!org) throw new Error("no organization in the database yet");
  let project = db.prepare("SELECT id FROM projects WHERE org_id=? ORDER BY created_at LIMIT 1").get(org.id);
  if (!project) {
    const pid = id("prj");
    db.prepare("INSERT INTO projects (id,org_id,name,autopilot,created_at) VALUES (?,?,?,0,?)")
      .run(pid, org.id, def.brand || "default", Date.now());
    project = { id: pid };
  }

  // Replace an existing campaign of the same name rather than making a second
  // one: re-running the loader after a copy edit is the normal case.
  const existing = db.prepare("SELECT id FROM campaigns WHERE project_id=? AND name=?")
    .get(project.id, seqDef.name);
  const window = JSON.stringify(def.send_window || null);
  let cid;
  if (existing) {
    cid = existing.id;
    db.prepare("UPDATE campaigns SET goal=?, sequence_json=?, send_window_json=?, brand_id=? WHERE id=?")
      .run(seqDef.goal, JSON.stringify(seqDef.steps), window, def.brand, cid);
  } else {
    cid = id("cmp");
    db.prepare(
      "INSERT INTO campaigns (id,project_id,name,goal,tone,status,autopilot,budget,sequence_json,created_at,brand_id,send_window_json)" +
        " VALUES (?,?,?,?,'direct','Draft',0,0,?,?,?,?)"
    ).run(cid, project.id, seqDef.name, seqDef.goal, JSON.stringify(seqDef.steps),
      Date.now(), def.brand, window);
  }
  const out = {
    campaignId: cid, name: seqDef.name, brand: def.brand,
    steps: seqDef.steps.length, status: existing ? "updated" : "created",
    audience: seqDef.audience,
    sendWindow: def.send_window,
    variablesUsed: [...new Set(seqDef.steps.flatMap((s) =>
      [...String(s.subject + " " + s.body).matchAll(/\{\{\s*([a-zA-Z0-9_.]+)/g)].map((m) => m[1])))],
  };
  db.close();
  return out;
}

if (require.main === module) {
  const [file, key] = process.argv.slice(2);
  if (!file || !key) {
    console.error("usage: node server/load-campaign.js <definition.json> <sequence-key>");
    process.exit(2);
  }
  const r = load(path.resolve(file), key);
  console.log(JSON.stringify(r, null, 2));
  console.log("\nStatus is Draft. Before anything can send:");
  console.log("  1. Import contacts with consent provenance  (GET /v1/import/template)");
  console.log("  2. Preview against a real contact           (POST /v1/campaigns/" + r.campaignId + "/preview)");
  console.log("  3. Enrol them                               (POST /v1/campaigns/" + r.campaignId + "/enrol)");
  console.log("  4. Set the campaign Active, pass the readiness gate, and arm");
}
module.exports = { load };
