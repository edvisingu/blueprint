#!/usr/bin/env node
/* The operator journey, driven through the real UI against the real server:
 * empty database -> paste CSV -> read the report -> watch the gate change ->
 * try to arm and be refused.
 *
 *   node server/ui/flow.test.js
 *
 * Needs Chromium via playwright-core. Skips cleanly if neither is present, so
 * it never breaks a checkout that has no browser.
 *
 * This layer found three bugs the API tests could not:
 *   - the readiness view called a repaint function that did not exist, so it
 *     spun forever behind a toast nobody reads
 *   - a successful import repainted the page, destroying the import report
 *     that is the only record of which rows were rejected and why
 *   - the repaint also reset the operator's toggle, silently changing what the
 *     next import would do
 */
let chromium;
try { chromium = require("playwright-core").chromium; }
catch (e) {
  try { chromium = require("/opt/node-tools/node_modules/playwright-core").chromium; }
  catch (e2) { console.log("SKIP: playwright-core not installed"); process.exit(0); }
}
const BROWSER = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
if (!require("fs").existsSync(BROWSER)) { console.log("SKIP: no chromium at " + BROWSER); process.exit(0); }
const fs = require('fs');
const p = require("path").join(require("fs").mkdtempSync(require("path").join(require("os").tmpdir(),"drd-ui-")),"uiflow.db");
process.env.DRD_DB_PATH = p;
process.env.DRD_PUBLIC_URL = "https://leads.example.invalid";
const { open } = require(require("path").join(__dirname,"..","db.js"));
const db = open(p);
db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,demo_data,legal_name,mailing_address,contact_email) VALUES ('org_root','EdVisingU','Growth',5000,0,1,?,0,0,?,?,?)")
  .run(Date.now(), "EdVisingU Inc.", "123 Example Ave, Pickering ON", "andre@example.invalid");
db.prepare("INSERT INTO users (id,org_id,email,name,role,created_at) VALUES ('u','org_root','a@b.c','Andre','owner',?)").run(Date.now());
db.close();

let n=0,f=0;
const ok=(name,c,d)=>{if(c){n++;console.log("  PASS "+name)}else{f++;console.log("  FAIL "+name+(d?" -- "+d:""))}};

const srv = require(require("path").join(__dirname,"..","server.js")).create();
srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch({ executablePath: BROWSER });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1100 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  // A 400 for the deliberately-bad import and a 409 for the refused arm are
  // correct HTTP responses, not JavaScript errors.
  pg.on('console', m => {
    if (m.type() !== 'error') return;
    if (/status of (400|409)/.test(m.text())) return;
    errs.push('CONSOLE: ' + m.text());
  });
  await pg.goto(base + '/', { waitUntil: 'load' });
  await pg.waitForTimeout(1800);
  const toGoLive = async () => {
    await pg.evaluate(() => {
      const btn = [...document.querySelectorAll('.js-nav button')].find(b => /Go live/.test(b.textContent));
      if (btn) btn.click();
    });
    await pg.waitForTimeout(1800);
  };
  await toGoLive();

  console.log("\n1. Template button fills the box");
  await pg.click('[data-act="imp-template"]');
  await pg.waitForTimeout(900);
  const tmpl = await pg.inputValue('#imp-csv');
  ok("template loaded into the textarea", /consent_basis/.test(tmpl), tmpl.slice(0,60));

  console.log("\n2. A file with no provenance is rejected, visibly");
  await pg.fill('#imp-csv', "email,name,company\nx@y.example,X,Y\n");
  await pg.evaluate(() => { const c=document.getElementById('imp-skipmx'); c.checked=true; });
  await pg.click('[data-act="imp-run"]');
  await pg.waitForTimeout(1200);
  let report = await pg.textContent('#imp-out');
  ok("the error names the missing columns", /consent_basis/.test(report), report.slice(0,160));
  ok("the error explains why provenance is required up front",
    /cannot be reconstructed/.test(report), report.slice(0,220));

  console.log("\n3. A real file imports, and the report names each rejection");
  const today = new Date().toISOString().slice(0,10);
  const csv = [
    "email,name,company,consent_basis,consent_captured_at,consent_source,consent_evidence,role_relevance,anti_solicitation_checked",
    "director@northgate.example,Jane Coach,Northgate Soccer Club,implied_publication,"+today+",https://northgate.example/staff,evidence/n.png,Website and records pitch,yes",
    "ad@templeton.example,Sam Reid,Templeton High School Athletics,implied_publication,"+today+",https://templeton.example/athletics,evidence/t.png,Athlete records pitch,yes",
    "bought@vendor.example,Bought Lead,ListVendor,purchased_list,"+today+",a data vendor,,,",
    "nodate@club.example,No Date,Some Club,express,whenever,Signed up,,,"
  ].join("\n")+"\n";
  await pg.fill('#imp-csv', csv);
  await pg.click('[data-act="imp-run"]');
  await pg.waitForTimeout(1600);
  report = await pg.textContent('#imp-out');
  const accepted = await pg.evaluate(() => {
    const t = [...document.querySelectorAll('#imp-out .stat')].find(s => /Accepted/.test(s.textContent));
    return t ? Number((t.textContent.match(/Accepted\s*([0-9,]+)/) || [])[1]) : null;
  });
  ok("exactly 2 rows accepted", accepted === 2, "accepted=" + accepted);
  ok("rejections are listed by reason", /consent invalid|consent_invalid/.test(report), report.slice(0,200));
  ok("the rejected rows table shows line numbers",
    await pg.evaluate(() => !!document.querySelector('#imp-out table.tbl tbody tr')));
  ok("verification-skipped is stated, not hidden", /Verification was skipped/.test(report));

  console.log("\n4. The gate updates after the import");
  await pg.waitForTimeout(1200);
  const after = await pg.evaluate(() => {
    const txt = [...document.querySelectorAll('.stat')].map(s => s.textContent.replace(/\s+/g,' ').trim());
    const rows = [...document.querySelectorAll('table.tbl tbody tr')].map(r => r.textContent.replace(/\s+/g,' ').trim());
    return {
      tiles: txt.slice(0,4),
      realContactsPass: rows.some(r => /has real contacts/i.test(r) && /PASS/.test(r)),
      consentPass: rows.some(r => /consent coverage/i.test(r) && /PASS/.test(r)),
      mailboxFail: rows.some(r => /has active mailbox/i.test(r) && /FAIL/.test(r)),
      clearanceFail: rows.some(r => /clearance recorded/i.test(r) && /FAIL/.test(r)),
      armDisabled: (document.querySelector('[data-act="gl-arm"]')||{}).disabled,
    };
  });
  console.log("   tiles:", JSON.stringify(after.tiles));
  ok("has-real-contacts now passes", after.realContactsPass);
  ok("consent coverage now passes", after.consentPass);
  ok("no mailbox still fails", after.mailboxFail);
  ok("missing clearance still fails", after.clearanceFail);
  ok("arming is still refused", after.armDisabled === true);

  console.log("\n5. Arming is refused and the operator is told");
  // Force-enable the button to prove the server refuses, not just the UI.
  await pg.evaluate(() => { const b=document.querySelector('[data-act="gl-arm"]'); if(b) b.disabled=false; });
  await pg.click('[data-act="gl-arm"]');
  await pg.waitForTimeout(1500);
  const toast = await pg.evaluate(() => (document.querySelector('.toast')||{}).textContent || "");
  ok("a refusal toast is shown", /Refused|readiness/i.test(toast), toast);
  const armedPill = await pg.evaluate(() => [...document.querySelectorAll('.pill')].some(p => p.textContent === 'ARMED'));
  ok("the system did NOT become armed", armedPill === false);

  await pg.screenshot({ path: require('path').join(require('os').tmpdir(),'drd-uiflow.png') });
  console.log("\n" + "=".repeat(52));
  console.log(f===0 && errs.length===0 ? `ALL ${n} UI FLOW CHECKS PASSED` : `${n} passed, ${f} failed, ${errs.length} js errors`);
  errs.slice(0,4).forEach(e=>console.log(e));
  await b.close(); srv.close(()=>process.exit(f===0&&errs.length===0?0:1));
});
