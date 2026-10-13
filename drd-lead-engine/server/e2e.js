#!/usr/bin/env node
/* End-to-end over real HTTP: empty database -> import -> readiness -> arm.
 *
 *   node server/e2e.js
 *
 * server/stress.js exercises the modules directly; this exercises them through
 * the server, which is how the integration bugs show up. It caught one the unit
 * paths could not: the request handler short-circuited every path outside /v1/
 * to the static file server, so the public unsubscribe link in every outgoing
 * message 404'd. Nothing below the HTTP layer could have found that.
 */
const os=require("os"),fs=require("fs"),nodePath=require("path");
const path=nodePath.join(fs.mkdtempSync(nodePath.join(os.tmpdir(),"drd-e2e-")),"e2e.db");
process.env.DRD_DB_PATH=path;
process.env.DRD_PUBLIC_URL="https://leads.example.invalid";
process.env.DRD_ADMIN_PASSWORD="e2e-test-password";
const {open,id}=require("./db.js");
// minimal real org, no demo data at all
const db=open(path);
db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at,send_armed,demo_data,legal_name,mailing_address,contact_email) VALUES ('org_root','EdVisingU','Growth',5000,0,1,?,0,0,?,?,?)")
  .run(Date.now(),"EdVisingU Inc.","123 Example Ave, Pickering ON, Canada","andre@example.invalid");
db.prepare("INSERT INTO users (id,org_id,email,name,role,created_at) VALUES ('usr_root','org_root','a@b.c','Andre','owner',?)").run(Date.now());
const crypto=require("crypto");
const tok="drd_live_e2etoken";
db.prepare("INSERT INTO api_keys (id,org_id,name,token_hash,prefix,created_at,revoked) VALUES ('key_e2e','org_root','E2E',?,?,?,0)")
  .run(crypto.createHash("sha256").update(tok).digest("hex"),tok.slice(0,13),Date.now());
db.close();

const srv=require("./server.js").create();
srv.listen(0,"127.0.0.1",async()=>{
  const base="http://127.0.0.1:"+srv.address().port;
  const H={"content-type":"application/json","authorization":"Bearer "+tok};
  const call=async(m,p,b)=>{const r=await fetch(base+p,{method:m,headers:H,body:b?JSON.stringify(b):undefined});
    let j=null; try{j=await r.json()}catch(e){} return {status:r.status,body:j};};
  let n=0,f=0;
  const ok=(name,c,d)=>{if(c){n++;console.log("  PASS "+name)}else{f++;console.log("  FAIL "+name+(d?" -- "+d:""))}};

  console.log("\n1. Readiness on an empty live database");
  let r=await call("GET","/v1/readiness?skip_dns=1");
  ok("readiness returns 200",r.status===200,r.status);
  ok("cannot arm",r.body.canArm===false);
  ok("reports no real contacts",r.body.checks.some(c=>c.key==="has_real_contacts"&&c.status==="fail"));
  ok("reports no demo data present",r.body.checks.some(c=>c.key==="no_demo_data"&&c.status==="pass"));

  console.log("\n2. Import template is discoverable");
  r=await call("GET","/v1/import/template");
  ok("template returns columns",r.status===200&&Array.isArray(r.body.columns));
  ok("consent_basis is required",r.body.required.includes("consent_basis"));

  console.log("\n3. Import rejects a file with no provenance");
  r=await call("POST","/v1/import",{csv:"email,name,company\nx@y.example,X,Y\n",skip_mx:true});
  ok("rejected with 400",r.status===400,r.status);
  ok("names the missing columns",(r.body.missing||[]).includes("consent_basis"));

  console.log("\n4. Import a real file with provenance");
  const today=new Date().toISOString().slice(0,10);
  const csv=["email,name,company,consent_basis,consent_captured_at,consent_source,consent_evidence,role_relevance,anti_solicitation_checked",
    "ad@examplehigh.ca,Sample Director,Example High,implied_publication,"+today+",https://examplehigh.ca/staff,evidence/p.png,Athletics website pitch,yes",
    "bought@list.example,Bought Lead,ListVendor,purchased_list,"+today+",a data vendor,,,"].join("\n")+"\n";
  r=await call("POST","/v1/import",{csv,skip_mx:true,filename:"e2e.csv"});
  ok("import created",r.status===201,r.status+" "+JSON.stringify(r.body).slice(0,120));
  ok("1 accepted",r.body.accepted===1,"accepted="+r.body.accepted);
  ok("purchased-list row rejected",r.body.rejected===1&&!!r.body.rejectedByReason.consent_invalid,JSON.stringify(r.body.rejectedByReason));

  console.log("\n5. Readiness now reports contacts but still blocks");
  r=await call("GET","/v1/readiness?skip_dns=1");
  ok("has_real_contacts passes",r.body.checks.some(c=>c.key==="has_real_contacts"&&c.status==="pass"));
  ok("consent coverage passes",r.body.checks.some(c=>c.key==="consent_coverage"&&c.status==="pass"));
  ok("still cannot arm (no mailbox, no clearance)",r.body.canArm===false);

  console.log("\n6. Arming is refused, and says why");
  r=await call("POST","/v1/readiness/arm",{armed:true,skip_dns:true});
  ok("arm refused with 409",r.status===409,r.status);
  ok("lists the blocking checks",Array.isArray(r.body.checks)&&r.body.checks.length>0);

  console.log("\n7. Mailbox + clearance recorded");
  r=await call("POST","/v1/mailboxes",{address:"outreach@edvisingu.ca",provider:"dryrun",status:"Active",daily_cap:20,min_gap_seconds:0,timezone:"America/Toronto"});
  ok("mailbox created",r.status===201,r.status);
  r=await call("POST","/v1/clearance",{subject:"Outbound activation",granted_by:"Counsel and CPA",note:"recorded by operator"});
  ok("clearance recorded",r.status===201,r.status);
  r=await call("GET","/v1/readiness?skip_dns=1");
  const blocking=r.body.checks.filter(c=>c.blocking&&c.status!=="pass").map(c=>c.key+"="+c.status);
  ok("only DNS verification still blocks",blocking.length===1&&blocking[0].startsWith("email_authentication"),blocking.join(","));

  console.log("\n8. Unsubscribe works unauthenticated and is org-wide");
  const db2=open(path);
  const ct=db2.prepare("SELECT id,email FROM contacts WHERE origin='import'").get();
  const sending=require("./sending.js");
  const t=sending.unsubToken(db2,"org_root",ct.id); db2.close();

  // GET must only CONFIRM. Mail clients and security gateways fetch the links
  // in a message with no human involved, so acting on GET would unsubscribe
  // real prospects automatically.
  const u=await fetch(base+"/u/"+t,{method:"GET",headers:{accept:"text/html"}});
  const html=await u.text();
  ok("the confirm page returns 200",u.status===200,u.status);
  ok("returns HTML, not JSON",/text\/html/.test(u.headers.get("content-type")||""),u.headers.get("content-type"));
  ok("it names the address",html.includes(ct.email),html.slice(0,120));
  ok("it offers a single confirm button",/Unsubscribe me/.test(html));
  const mid=open(path);
  ok("GET wrote no suppression",mid.prepare("SELECT COUNT(*) n FROM suppressions WHERE value=?").get(ct.email).n===0);
  mid.close();

  // POST is the RFC 8058 one-click path and the form target.
  const post=await fetch(base+"/u/"+t,{method:"POST",headers:{accept:"text/html"}});
  const posted=await post.text();
  ok("POST returns 200",post.status===200,post.status);
  ok("it says the removal covers every brand",/all of our brands/.test(posted));
  const db3=open(path);
  ok("suppression written org-wide",db3.prepare("SELECT COUNT(*) n FROM suppressions WHERE value=? AND scope='Global'").get(ct.email).n===1);
  ok("consent revoked",db3.prepare("SELECT COUNT(*) n FROM consents WHERE contact_id=? AND revoked_at IS NOT NULL").get(ct.id).n===1);
  db3.close();
  const u2=await fetch(base+"/u/nonexistenttoken",{method:"GET",headers:{accept:"text/html"}});
  ok("unknown token 404s",u2.status===404,u2.status);

  console.log("\n9. Unauthenticated access to private routes is refused");
  const bad=await fetch(base+"/v1/readiness");
  ok("readiness requires auth",bad.status===401||bad.status===403,bad.status);

  console.log("\n"+"=".repeat(50));
  console.log(f===0?`ALL ${n} E2E CHECKS PASSED`:`${n} passed, ${f} FAILED`);
  srv.close(()=>process.exit(f===0?0:1));
});
