#!/usr/bin/env node
/* The public unsubscribe route, end to end, including an XSS probe.
 *
 *   node server/unsubscribe.test.js
 *
 * This route is the only unauthenticated, state-changing surface in the
 * system, and it renders an address that arrived from an imported CSV back to
 * whoever opens the link. Two findings from the security pass are locked down
 * here:
 *
 *   1. STORED XSS. The importer's email validator rejects whitespace, @ and ;
 *      but permits angle brackets and quotes, so an address such as
 *      "><script>...</script>@example.com passes validation. It was being
 *      interpolated into the page unescaped.
 *   2. STATE CHANGE ON GET. The route used to unsubscribe on GET. Mail
 *      clients, link scanners and corporate security gateways fetch the URLs
 *      in a message with no human involved, so a real prospect would have been
 *      silently unsubscribed by their employer's mail filter and we would have
 *      read it as disinterest. GET now confirms; POST acts.
 */
const fs=require('fs'),os=require('os'),pathm=require('path');
const dir=fs.mkdtempSync(pathm.join(os.tmpdir(),'drd-unsub-'));
const p=pathm.join(dir,'u.db');
process.env.DRD_DB_PATH=p; process.env.DRD_PUBLIC_URL="https://leads.example.invalid";
const {open,id}=require(require("path").join(__dirname,"db.js"));
const db=open(p);
db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,legal_name,mailing_address,contact_email) VALUES ('org_root','T','Growth',5000,0,1,?,1,'T Inc.','1 St','c@x.invalid')").run(Date.now());
db.prepare("INSERT INTO users (id,org_id,email,name,role,created_at) VALUES ('u','org_root','a@b.c','A','owner',?)").run(Date.now());
const co=id('co');
db.prepare("INSERT INTO companies (id,name,domain,origin) VALUES (?,?,?,'import')").run(co,'C','evil.com');
// An address that PASSES importer.EMAIL_RE but carries HTML.
const XSS='"><script>alert(1)</script>@evil.com';
const ct=id('ct');
db.prepare("INSERT INTO contacts (id,company_id,name,email,origin) VALUES (?,?,?,?,'import')").run(ct,co,'Evil',XSS);
const ct2=id('ct');
db.prepare("INSERT INTO contacts (id,company_id,name,email,origin) VALUES (?,?,?,?,'import')").run(ct2,co,'Normal','normal@evil.com');
const sending=require(require("path").join(__dirname,"sending.js"));
const tokXss=sending.unsubToken(db,'org_root',ct);
const tokOk=sending.unsubToken(db,'org_root',ct2);
db.close();
const srv=require(require("path").join(__dirname,"server.js")).create();
srv.listen(0,'127.0.0.1',async()=>{
  const base='http://127.0.0.1:'+srv.address().port;
  let n=0,f=0; const ok=(name,c,d)=>{if(c){n++;console.log('  PASS '+name)}else{f++;console.log('  FAIL '+name+(d?' -- '+d:''))}};
  const db2=()=>open(p);

  console.log("\n1. GET must NOT unsubscribe (prefetch safety)");
  const g=await fetch(base+'/u/'+tokOk,{headers:{accept:'text/html'}});
  const gh=await g.text();
  ok('GET returns 200',g.status===200,g.status);
  ok('GET shows a confirm button',/Unsubscribe me/.test(gh));
  ok('GET says it is permanent',/permanent/i.test(gh));
  let d=db2();
  ok('GET did NOT write a suppression',d.prepare("SELECT COUNT(*) n FROM suppressions").get().n===0);
  ok('GET did NOT mark the token used',!d.prepare("SELECT used_at FROM unsubscribe_tokens WHERE token=?").get(tokOk).used_at);
  d.close();

  console.log("\n2. POST performs it");
  const pr=await fetch(base+'/u/'+tokOk,{method:'POST',headers:{accept:'text/html'}});
  const ph=await pr.text();
  ok('POST returns 200',pr.status===200,pr.status);
  ok('POST confirms by address',/normal@evil\.com/.test(ph));
  ok('POST says it covers every brand',/all of our brands/.test(ph));
  d=db2();
  ok('a suppression now exists',d.prepare("SELECT COUNT(*) n FROM suppressions WHERE value=?").get('normal@evil.com').n===1);
  ok('the token is marked used',!!d.prepare("SELECT used_at FROM unsubscribe_tokens WHERE token=?").get(tokOk).used_at);
  d.close();
  const again=await fetch(base+'/u/'+tokOk,{headers:{accept:'text/html'}});
  ok('a used token shows already-unsubscribed',/[Aa]lready/.test(await again.text()));

  console.log("\n3. One-click POST without an HTML Accept gets JSON");
  const j=await fetch(base+'/u/'+tokXss,{method:'POST'});
  const jb=await j.json();
  ok('returns JSON for a mail provider',j.status===200&&jb.ok===true,JSON.stringify(jb).slice(0,80));

  console.log("\n4. XSS probe: a crafted address must be escaped");
  const x=await fetch(base+'/u/'+tokXss,{headers:{accept:'text/html'}});
  const xh=await x.text();
  ok('the raw script tag does NOT appear',!/<script>alert\(1\)<\/script>/.test(xh),
     (xh.match(/.{0,40}script.{0,40}/)||[''])[0]);
  ok('it is rendered escaped instead',/&lt;script&gt;/.test(xh),(xh.match(/.{0,50}&lt;.{0,30}/)||[''])[0]);
  ok('the quote that would break the attribute is escaped',!/"><script/.test(xh));

  console.log("\n5. An unknown token is a dead end");
  const u=await fetch(base+'/u/doesnotexist',{headers:{accept:'text/html'}});
  ok('unknown token 404s',u.status===404,u.status);
  const ut=await u.text();
  ok('and tells them what to do instead',/[Rr]eply to the message/.test(ut));

  console.log("\n"+"=".repeat(48));
  console.log(f===0?`ALL ${n} UNSUBSCRIBE CHECKS PASSED`:`${n} passed, ${f} FAILED`);
  srv.close(()=>process.exit(f===0?0:1));
});
