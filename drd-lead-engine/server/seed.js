/* Seeds a real database: org, user, API key, project, ICPs, the company/contact
 * graph, campaigns, conversations, meetings, suppressions and usage events. */
const crypto = require("crypto");
const { DATA, ENGINE } = require("./shared.js");
const { open, id } = require("./db.js");

const DAY = 86400000;
const REPLY_BANK = [
  "Thanks for reaching out. This is timely, our board asked for an AI plan last month and we have nothing formal. What does the audit actually involve?",
  "Interested. Can you send pricing for a faculty cohort of about 40 people?",
  "I'm not the right person for this. Reach out to our Director of Teaching and Learning, she owns this file.",
  "Let's talk. I have Tuesday or Thursday afternoon open next week, what works on your end?",
  "We already have an internal working group on this. Not a priority for us right now.",
  "Out of the office until the 14th with limited access to email. I'll respond when I'm back.",
  "How does this differ from the generic AI training vendors that have been emailing us all year?",
  "Please remove me from your list and do not contact me again.",
  "Not interested, thanks.",
  "Circle back next quarter, our budget cycle restarts in April and I'd rather talk with real numbers.",
  "This looks useful. What would a three-week engagement cost for a department of our size?",
  "Can you clarify whether this covers assessment policy or just tool training? That distinction matters for us.",
  "Happy to book something. Send an invite for any morning that week.",
  "We're mid-procurement on something similar. Worth a conversation anyway, what's your availability?",
  "Forwarding this to our AVP Innovation, he's leading the initiative.",
];

function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function hashToken(t) { return crypto.createHash("sha256").update(t).digest("hex"); }

function seed(dbFile, opts) {
  opts = opts || {};
  const db = open(dbFile);
  const rnd = mulberry32(4242);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const now = Date.now();

  // wipe (children first)
  ["webhook_deliveries","jobs","usage_events","audit_logs","messages","conversations","meetings",
   "campaign_leads","campaigns","research_reports","saved_searches","icps","suppressions",
   "webhooks","api_keys","projects","users","contacts","companies","organizations"]
    .forEach((t) => db.exec("DELETE FROM " + t));

  const orgId = "org_root", projectId = "prj_root";
  db.prepare("INSERT INTO organizations (id,name,plan,credits_included,credits_used,autopilot,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(orgId, "EdVisingU", "Growth", 5000, 0, 1, now - 90 * DAY);
  db.prepare("INSERT INTO users (id,org_id,email,name,role,created_at) VALUES (?,?,?,?,?,?)")
    .run("usr_root", orgId, "andre@edvisingu.ca", "Andre", "owner", now - 90 * DAY);

  const token = opts.apiToken || "drd_live_" + crypto.randomBytes(16).toString("hex");
  db.prepare("INSERT INTO api_keys (id,org_id,name,token_hash,prefix,created_at,last_used_at,revoked) VALUES (?,?,?,?,?,?,?,0)")
    .run("key_root", orgId, "Production", hashToken(token), token.slice(0, 13), now - 60 * DAY, now - 2 * DAY);

  db.prepare("INSERT INTO projects (id,org_id,name,website,profile_json,autopilot,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(projectId, orgId, "EdVisingU GTM", DATA.businessProfile.website, JSON.stringify(DATA.businessProfile), 1, now - 90 * DAY);

  // --- graph -----------------------------------------------------------
  const insCo = db.prepare(`INSERT INTO companies
    (id,name,domain,industry,sub,country,region,city,size,revenue,founded,traffic,tech_json,signals_json,funding_json,description,pains_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  DATA.companies.forEach((c) => insCo.run(c.id, c.name, c.domain, c.industry, c.sub, c.country, c.region, c.city,
    c.size, c.revenue, c.founded, c.traffic, JSON.stringify(c.tech), JSON.stringify(c.signals),
    c.funding ? JSON.stringify(c.funding) : null, c.desc, JSON.stringify(c.pains || [])));

  const insCt = db.prepare(`INSERT INTO contacts
    (id,company_id,name,title,seniority,department,email,email_status,verified,phone,linkedin,city,country)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  DATA.people.forEach((p) => insCt.run(p.id, p.companyId, p.name, p.title, p.seniority, p.department,
    p.email, p.emailStatus, p.verified ? 1 : 0, p.phone, p.linkedin, p.city, p.country));

  const insIcp = db.prepare("INSERT INTO icps (id,project_id,name,fit,industry,country,size_min,approved,why,buyers_json) VALUES (?,?,?,?,?,?,?,?,?,?)");
  DATA.icps.forEach((i) => insIcp.run(i.id, projectId, i.name, i.fit, i.industry, i.country, i.sizeMin,
    i.approved ? 1 : 0, i.why, JSON.stringify(i.buyers)));

  // --- campaigns -------------------------------------------------------
  const defs = [
    { name: "Ontario Colleges — Readiness Audit", icp: "icp_1", goal: "Book a 20-minute readiness call", tone: "consultative", status: "Active", budget: 900, autopilot: 1 },
    { name: "EdTech Partnerships — Q3", icp: "icp_2", goal: "Book a partnership intro", tone: "direct", status: "Active", budget: 600, autopilot: 1 },
    { name: "Enterprise L&D — AI Upskilling", icp: "icp_3", goal: "Book a scoping call", tone: "executive", status: "Active", budget: 750, autopilot: 0 },
    { name: "US Universities — Pilot Expansion", icp: "icp_1", goal: "Book a pilot conversation", tone: "consultative", status: "Paused", budget: 400, autopilot: 0 },
    { name: "Professional Services — Warm Test", icp: "icp_4", goal: "Gauge interest in partner training", tone: "warm", status: "Draft", budget: 250, autopilot: 0 },
  ];
  const seq = JSON.stringify([{ step: 1, day: 0, label: "Personalized opener" },
    { step: 2, day: 3, label: "Follow-up" }, { step: 3, day: 8, label: "Close the loop" }]);

  const insCamp = db.prepare(`INSERT INTO campaigns
    (id,project_id,name,icp_id,goal,tone,status,autopilot,budget,spend,sent,replies,positive,sequence_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insLead = db.prepare("INSERT OR IGNORE INTO campaign_leads (id,campaign_id,contact_id,status,step,score,added_at) VALUES (?,?,?,?,?,?,?)");
  const insConv = db.prepare(`INSERT INTO conversations
    (id,campaign_id,contact_id,company_id,subject,status,intent,intent_confidence,intent_json,hot,last_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insMsg = db.prepare("INSERT INTO messages (id,conversation_id,direction,body,subject,at) VALUES (?,?,?,?,?,?)");
  const insMeet = db.prepare("INSERT OR IGNORE INTO meetings (id,campaign_id,contact_id,company_id,title,at,duration,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
  const insUsage = db.prepare("INSERT INTO usage_events (id,org_id,kind,credits,cost,ref,at) VALUES (?,?,?,?,?,?,?)");

  let totalSent = 0, convN = 0;
  defs.forEach((d, di) => {
    const icp = DATA.icps.find((i) => i.id === d.icp);
    const pool = DATA.companies.filter((c) => c.industry === icp.industry &&
      (!icp.country || c.country === icp.country) && (!icp.sizeMin || c.size >= icp.sizeMin));
    const chosen = pool.slice(0, d.status === "Draft" ? 14 : d.status === "Paused" ? 18 : 26);
    const leads = [];
    chosen.forEach((c) => (DATA.peopleByCompany[c.id] || []).slice(0, 2).forEach((p) => leads.push(p)));

    const live = d.status !== "Draft";
    const sent = live ? Math.floor(leads.length * (d.status === "Active" ? 1.75 : 0.9)) : 0;
    const replies = live ? Math.max(2, Math.round(sent * (0.07 + rnd() * 0.09))) : 0;
    const positive = Math.max(1, Math.round(replies * (0.32 + rnd() * 0.25)));
    const cid = "cmp_" + (di + 1);
    const spend = +(sent * 0.031).toFixed(2);
    totalSent += sent;

    insCamp.run(cid, projectId, d.name, d.icp, d.goal, d.tone, d.status, d.autopilot, d.budget, spend,
      sent, replies, positive, seq, now - (30 - di * 4) * DAY);
    if (sent) insUsage.run(id("use"), orgId, "email", sent, spend, cid, now - (30 - di * 4) * DAY);

    leads.forEach((p) => {
      const co = DATA.companies.find((c) => c.id === p.companyId);
      const sc = ENGINE.scoreCompany(co, ENGINE.parseQuery(""), icp);
      insLead.run(id("cl"), cid, p.id, live ? "Contacted" : "Queued", live ? 1 : 0, sc.total, now - 20 * DAY);
    });

    leads.slice(0, replies).forEach((p, i) => {
      const co = DATA.companies.find((c) => c.id === p.companyId);
      const text = REPLY_BANK[(di * 5 + i) % REPLY_BANK.length];
      const cls = ENGINE.classifyReply(text);
      const em = ENGINE.generateEmail(co, p, { tone: d.tone, goal: d.goal });
      const at = now - int(1, 21) * DAY;
      const convId = "cnv_" + (++convN);
      const closed = cls.intent === "Unsubscribe" || cls.intent === "Negative";
      insConv.run(convId, cid, p.id, co.id, em.subject, closed ? "Closed" : "Need Reply",
        cls.intent, cls.confidence, JSON.stringify(cls), cls.hot ? 1 : 0, at);
      insMsg.run(id("ms"), convId, "out", em.body, em.subject, at - 2 * DAY);
      insMsg.run(id("ms"), convId, "in", text, "Re: " + em.subject, at);

      if (cls.hot && rnd() < 0.62) {
        insMeet.run(id("mtg"), cid, p.id, co.id, co.name + " — AI readiness intro",
          now + int(-4, 18) * DAY, 30, pick(["Confirmed", "Confirmed", "Proposed"]), now);
      }
      if (closed) {
        db.prepare("INSERT OR IGNORE INTO suppressions (id,org_id,type,value,reason,scope,created_at) VALUES (?,?,?,?,?,?,?)")
          .run(id("sup"), orgId, "Person", p.email,
            cls.intent === "Unsubscribe" ? "Unsubscribe request" : "Explicit negative reply", "Global", at);
      }
    });
  });

  // historical completed meetings so analytics has depth
  const contacted = new Set(db.prepare("SELECT contact_id FROM conversations").all().map((r) => r.contact_id));
  const allLeads = db.prepare("SELECT campaign_id, contact_id FROM campaign_leads").all();
  for (const l of allLeads) {
    const cnt = db.prepare("SELECT COUNT(*) n FROM meetings").get().n;
    if (cnt >= 20) break;
    if (contacted.has(l.contact_id)) continue;
    if (rnd() > 0.25) continue;
    const p = DATA.people.find((x) => x.id === l.contact_id); if (!p) continue;
    const co = DATA.companies.find((c) => c.id === p.companyId);
    insMeet.run(id("mtg"), l.campaign_id, p.id, co.id, co.name + " — AI readiness intro",
      now - int(3, 45) * DAY, 30, "Completed", now - 40 * DAY);
  }

  db.prepare("INSERT OR IGNORE INTO suppressions (id,org_id,type,value,reason,scope,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id("sup"), orgId, "Domain", "competitorgroup.com", "Competitor, do not contact", "Global", now - 40 * DAY);

  db.prepare("INSERT INTO webhooks (id,org_id,url,events_json,active,created_at) VALUES (?,?,?,?,1,?)")
    .run("wh_1", orgId, "https://edvisingu.app.n8n.cloud/webhook/drd-hot-lead",
      JSON.stringify(["lead.hot", "meeting.booked", "unsubscribe.received"]), now - 30 * DAY);

  const research = 31;
  insUsage.run(id("use"), orgId, "research", research * 4, research * 0.12, null, now - 10 * DAY);
  db.prepare("UPDATE organizations SET credits_used = ? WHERE id = ?").run(totalSent + research * 4, orgId);

  // Local-dev convenience: hand the raw token to the browser client via /config.js.
  // A real deployment replaces this with a login flow issuing per-user sessions.
  try { require("fs").writeFileSync(require("path").join(__dirname, ".dev-token"), token); } catch (e) {}

  const counts = {};
  ["companies","contacts","campaigns","campaign_leads","conversations","messages","meetings","suppressions","icps","usage_events"]
    .forEach((t) => (counts[t] = db.prepare("SELECT COUNT(*) n FROM " + t).get().n));

  db.close();
  return { token, counts };
}

if (require.main === module) {
  const out = seed(process.argv[2], { apiToken: process.env.DRD_SEED_TOKEN });
  console.log("seeded:", JSON.stringify(out.counts));
  console.log("api token:", out.token);
}
module.exports = { seed, hashToken };
