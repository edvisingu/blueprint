/* Integration tests: boots a real server against a real seeded database and
 * exercises the API over HTTP. No mocks. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { seed } = require("./seed.js");
const { create } = require("./server.js");

const DB = path.join(os.tmpdir(), "drd-test-" + Date.now() + ".db");
let TOKEN, BASE, server;
let pass = 0, fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) { pass++; console.log("  \x1b[32mPASS\x1b[0m " + name); }
  else { fail++; failures.push(name + (detail ? " — " + detail : "")); console.log("  \x1b[31mFAIL\x1b[0m " + name + (detail ? "  (" + detail + ")" : "")); }
}
const eq = (name, a, b) => ok(name, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

async function api(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: Object.assign({ "content-type": "application/json" },
      token === null ? {} : { authorization: "Bearer " + (token || TOKEN) }),
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}

function section(t) { console.log("\n\x1b[1m" + t + "\x1b[0m"); }

(async () => {
  const s = seed(DB, { apiToken: "drd_live_testtoken" });
  TOKEN = s.token;
  console.log("seeded:", JSON.stringify(s.counts));

  server = create({ dbFile: DB, quiet: true });
  await new Promise((r) => server.listen(0, r));
  BASE = "http://127.0.0.1:" + server.address().port;

  // ---------------------------------------------------------------- auth
  section("Auth");
  eq("health is public", (await api("GET", "/v1/health", null, null)).status, 200);
  eq("no token -> 401", (await api("GET", "/v1/campaigns", null, null)).status, 401);
  eq("bad token -> 401", (await api("GET", "/v1/campaigns", null, "drd_live_wrong")).status, 401);
  eq("valid token -> 200", (await api("GET", "/v1/campaigns")).status, 200);

  // -------------------------------------------------------------- search
  section("Search");
  const cs = await api("GET", "/v1/search/companies?q=" + encodeURIComponent("Ontario colleges with more than 200 employees"));
  eq("company search 200", cs.status, 200);
  ok("company search returns rows", cs.body.total > 0, "total=" + cs.body.total);
  ok("parses industry", cs.body.criteria.industries.includes("Higher Education"), JSON.stringify(cs.body.criteria.industries));
  eq("parses region", cs.body.criteria.region, "Ontario");
  eq("parses size floor", cs.body.criteria.sizeMin, 200);
  ok("every result honours size floor", cs.body.data.every((c) => c.size >= 200), "min=" + Math.min(...cs.body.data.map((c) => c.size)));
  ok("every result honours industry", cs.body.data.every((c) => c.industry === "Higher Education"), "");
  ok("results carry score breakdown", !!cs.body.data[0].breakdown && cs.body.data[0].fit_score > 0, "");
  eq("empty query -> 400", (await api("GET", "/v1/search/companies")).status, 400);

  const ps = await api("GET", "/v1/search/people?q=" + encodeURIComponent("directors of teaching and learning at Ontario colleges"));
  eq("people search 200", ps.status, 200);
  ok("people search returns rows", ps.body.total > 0, "total=" + ps.body.total);

  const coId = cs.body.data[0].id;
  const detail = await api("GET", "/v1/companies/" + coId);
  eq("company detail 200", detail.status, 200);
  ok("company detail has contacts", detail.body.data.contacts.length > 0, "");
  eq("unknown company -> 404", (await api("GET", "/v1/companies/co_nope")).status, 404);

  const look = await api("GET", "/v1/companies/" + coId + "/lookalikes");
  eq("lookalikes 200", look.status, 200);
  ok("lookalikes returned with reasons", look.body.data.length > 0 && !!look.body.data[0].reason, "");
  ok("lookalikes exclude source", !look.body.data.some((x) => x.id === coId), "");

  // ------------------------------------------------------------ research
  section("Research & generation");
  const before = (await api("GET", "/v1/usage")).body.data.credits_used;
  const rr = await api("POST", "/v1/research", { company_id: coId });
  eq("research 201", rr.status, 201);
  ok("research has all sections", ["overview","whyNow","productFit","angles","recommendation"].every((k) => rr.body.data[k]), "");
  const after = (await api("GET", "/v1/usage")).body.data.credits_used;
  eq("research meters 4 credits", after - before, 4);
  eq("research is retrievable", (await api("GET", "/v1/research/" + rr.body.id)).status, 200);

  const contactId = detail.body.data.contacts[0].id;
  const em = await api("POST", "/v1/emails/generate", { contact_id: contactId, tone: "direct" });
  eq("email generate 200", em.status, 200);
  ok("email has subject and body", !!em.body.data.subject && em.body.data.body.length > 60, "");

  // ----------------------------------------------------------- campaigns
  section("Campaigns");
  const nc = await api("POST", "/v1/campaigns", { name: "Test Campaign", goal: "Book a call", budget: 5 });
  eq("create campaign 201", nc.status, 201);
  const cid = nc.body.data.id;
  eq("new campaign is Draft", nc.body.data.status, "Draft");
  eq("create without name -> 400", (await api("POST", "/v1/campaigns", {})).status, 400);

  // import: suppression + dedupe + unmatched all enforced
  const supEmail = detail.body.data.contacts[0].email;
  await api("POST", "/v1/suppressions", { value: supEmail, reason: "test suppression" });
  const others = ps.body.data.slice(0, 3).map((p) => ({ email: p.email }));
  const imp = await api("POST", "/v1/campaigns/" + cid + "/import", {
    leads: others.concat([{ email: supEmail }, { email: "nobody@nowhere.test" }, { notanemail: 1 }]),
  });
  eq("import 200", imp.status, 200);
  eq("suppressed lead rejected", imp.body.suppressed, 1);
  eq("unmatched lead reported", imp.body.unmatched, 1);
  eq("malformed row reported", imp.body.errors.length, 1);
  ok("valid leads imported", imp.body.imported === others.length, "imported=" + imp.body.imported);
  const imp2 = await api("POST", "/v1/campaigns/" + cid + "/import", { leads: others });
  eq("re-import dedupes", imp2.body.duplicate, others.length);
  eq("import without leads -> 400", (await api("POST", "/v1/campaigns/" + cid + "/import", {})).status, 400);

  // send gated on status
  eq("send on Draft -> 409", (await api("POST", "/v1/campaigns/" + cid + "/send", { limit: 5 })).status, 409);
  eq("start campaign", (await api("POST", "/v1/campaigns/" + cid + "/start")).body.status, "Active");
  const sent = await api("POST", "/v1/campaigns/" + cid + "/send", { limit: 5 });
  eq("send 200", sent.status, 200);
  ok("sent at least one", sent.body.sent > 0, JSON.stringify(sent.body));
  const analytics1 = await api("GET", "/v1/campaigns/" + cid + "/analytics");
  eq("campaign analytics reflects sends", analytics1.body.data.sent, sent.body.sent);

  // budget ceiling actually stops sending
  const big = await api("POST", "/v1/campaigns", { name: "Budget Test", budget: 0.05 });
  await api("POST", "/v1/campaigns/" + big.body.data.id + "/start");
  await api("POST", "/v1/campaigns/" + big.body.data.id + "/import", { leads: ps.body.data.slice(3, 9).map((p) => ({ email: p.email })) });
  const bsend = await api("POST", "/v1/campaigns/" + big.body.data.id + "/send", { limit: 6 });
  ok("budget ceiling blocks sends", bsend.body.skipped_budget > 0, JSON.stringify(bsend.body));
  const bc = await api("GET", "/v1/campaigns/" + big.body.data.id);
  ok("spend never exceeds budget", bc.body.data.spend <= bc.body.data.budget, `spend=${bc.body.data.spend} budget=${bc.body.data.budget}`);

  eq("pause campaign", (await api("POST", "/v1/campaigns/" + cid + "/pause")).body.status, "Paused");

  // ------------------------------------------------------- inbox / intent
  section("Inbox & reply intelligence");
  const convs = await api("GET", "/v1/conversations?status=Need%20Reply");
  eq("conversations 200", convs.status, 200);
  ok("need-reply threads exist", convs.body.total > 0, "total=" + convs.body.total);

  const fresh = (await api("GET", "/v1/conversations")).body.data.find((c) => c.status === "Sent");
  ok("found a sent thread to reply into", !!fresh, "");

  const inb = await api("POST", "/v1/conversations/" + fresh.id + "/inbound", { body: "Let's talk. What times are you free next week?" });
  eq("inbound 200", inb.status, 200);
  eq("meeting intent classified", inb.body.classification.intent, "Meeting Request");
  eq("meeting intent marked hot", inb.body.classification.hot, true);

  const hot = await api("GET", "/v1/leads/hot");
  ok("hot lead surfaces in hot list", hot.body.data.some((h) => h.conversation_id === fresh.id), "");

  // compliance intent auto-suppresses
  const fresh2 = (await api("GET", "/v1/conversations")).body.data.find((c) => c.status === "Sent");
  if (fresh2) {
    const un = await api("POST", "/v1/conversations/" + fresh2.id + "/inbound", { body: "Please remove me from your list and do not contact me again." });
    eq("unsubscribe classified", un.body.classification.intent, "Unsubscribe");
    eq("unsubscribe auto-suppressed", un.body.suppressed, true);
    const sups = await api("GET", "/v1/suppressions");
    const email = (await api("GET", "/v1/conversations/" + fresh2.id)).body.data.contact.email;
    ok("suppression row written", sups.body.data.some((s) => s.value === email), "");
    const blocked = await api("POST", "/v1/conversations/" + fresh2.id + "/reply", { body: "hello again" });
    eq("reply to suppressed contact -> 409", blocked.status, 409);
  }

  const rep = await api("POST", "/v1/conversations/" + fresh.id + "/reply", { body: "Tuesday 10am works." });
  eq("reply 200", rep.status, 200);
  eq("reply marks thread Replied", (await api("GET", "/v1/conversations/" + fresh.id)).body.data.status, "Replied");

  // ------------------------------------------------------------ meetings
  section("Meetings");
  const mk = await api("POST", "/v1/meetings", { contact_id: fresh.contact.id, campaign_id: fresh.campaign_id });
  eq("book meeting 201", mk.status, 201);
  eq("double-book -> 409", (await api("POST", "/v1/meetings", { contact_id: fresh.contact.id })).status, 409);
  ok("meeting appears in list", (await api("GET", "/v1/meetings")).body.data.some((m) => m.id === mk.body.data.id), "");

  // --------------------------------------------------- suppression admin
  section("Suppression & compliance");
  const addDom = await api("POST", "/v1/suppressions", { value: "blocked-domain.test", reason: "QA" });
  eq("add domain suppression 201", addDom.status, 201);
  eq("duplicate suppression -> 409", (await api("POST", "/v1/suppressions", { value: "blocked-domain.test" })).status, 409);
  eq("delete suppression 200", (await api("DELETE", "/v1/suppressions/" + addDom.body.id)).status, 200);
  eq("delete unknown -> 404", (await api("DELETE", "/v1/suppressions/sup_nope")).status, 404);

  // ------------------------------------------------- analytics / audit
  section("Analytics, audit & webhooks");
  const an = await api("GET", "/v1/analytics");
  eq("analytics 200", an.status, 200);
  ok("analytics has totals", an.body.data.sent > 0 && an.body.data.byCampaign.length > 0, "");
  ok("analytics produces insights", an.body.data.insights.length > 0, "");

  const aud = await api("GET", "/v1/audit");
  ok("audit log recorded actions", aud.body.data.length > 0, "n=" + aud.body.data.length);
  ok("audit captured the import", aud.body.data.some((a) => a.action === "campaign.import"), "");
  ok("audit captured auto-suppression", aud.body.data.some((a) => a.action === "suppression.auto"), "");

  const whd = await api("GET", "/v1/webhooks/deliveries");
  ok("webhook fired for hot lead", whd.body.data.some((d) => d.event === "lead.hot"), "");
  ok("webhook fired for meeting", whd.body.data.some((d) => d.event === "meeting.booked"), "");
  ok("webhook fired for unsubscribe", whd.body.data.some((d) => d.event === "unsubscribe.received"), "");
  // The default hook does NOT subscribe to lead.replied, so it must never receive it.
  ok("unsubscribed event is filtered out", !whd.body.data.some((d) => d.event === "lead.replied"),
    "lead.replied leaked to a hook that never subscribed to it");

  const wl = await api("GET", "/v1/webhooks");
  eq("list webhooks 200", wl.status, 200);
  ok("default hook listed with its events", wl.body.data.length > 0 && wl.body.data[0].events.includes("lead.hot"), "");
  const wnew = await api("POST", "/v1/webhooks", { url: "https://example.test/hook", events: ["lead.replied"] });
  eq("create webhook 201", wnew.status, 201);
  eq("reject unknown event", (await api("POST", "/v1/webhooks", { url: "https://x.test", events: ["nope.bad"] })).status, 400);
  eq("reject empty events", (await api("POST", "/v1/webhooks", { url: "https://x.test", events: [] })).status, 400);
  eq("reject missing url", (await api("POST", "/v1/webhooks", { events: ["lead.hot"] })).status, 400);

  // now that a hook subscribes to lead.replied, a new inbound must reach it
  const fresh3 = (await api("GET", "/v1/conversations")).body.data.find((c) => c.status === "Sent");
  if (fresh3) {
    await api("POST", "/v1/conversations/" + fresh3.id + "/inbound", { body: "Thanks, I will take a look." });
    const whd2 = await api("GET", "/v1/webhooks/deliveries");
    ok("newly subscribed hook receives its event", whd2.body.data.some((d) => d.event === "lead.replied"), "");
  }
  eq("delete webhook 200", (await api("DELETE", "/v1/webhooks/" + wnew.body.id)).status, 200);
  eq("delete unknown webhook -> 404", (await api("DELETE", "/v1/webhooks/wh_nope")).status, 404);

  // ------------------------------------------------------------- errors
  section("Error handling");
  eq("unknown route -> 404", (await api("GET", "/v1/nope")).status, 404);
  const badJson = await fetch(BASE + "/v1/campaigns", { method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + TOKEN }, body: "{oops" });
  eq("malformed JSON -> 400", badJson.status, 400);
  eq("unknown conversation -> 404", (await api("GET", "/v1/conversations/cnv_nope")).status, 404);

  // ------------------------------------------------------------- static
  section("Static client");
  const idx = await fetch(BASE + "/index.html");
  eq("serves the web client", idx.status, 200);
  ok("client html looks right", (await idx.text()).includes("Dr. D Lead"), "");

  console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m`);
  if (failures.length) { console.log("\nFailures:"); failures.forEach((f) => console.log(" - " + f)); }
  server.close();
  try { fs.unlinkSync(DB); fs.unlinkSync(DB + "-wal"); fs.unlinkSync(DB + "-shm"); } catch (e) {}
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); try { server && server.close(); } catch (x) {} process.exit(1); });
