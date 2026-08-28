/* Dr. D Lead Engineering System — HTTP API (spec §R).
 * Zero dependencies: node:http + node:sqlite.
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { open, id } = require("./db.js");
const { hashToken } = require("./seed.js");
const { DATA, ENGINE } = require("./shared.js");
const AI = require("./ai.js");

const ROOT = path.join(__dirname, "..");

// ---------------------------------------------------------------- security
// PUBLIC=1 (or NODE_ENV=production) means the server is internet-facing:
// an admin password and a stable session secret then become mandatory.
const PUBLIC = process.env.DRD_PUBLIC === "1" || process.env.NODE_ENV === "production";
const ADMIN_PASSWORD = process.env.DRD_ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.DRD_SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const COOKIE = "drd_session";

if (PUBLIC && !ADMIN_PASSWORD) {
  console.error("REFUSING TO START: DRD_ADMIN_PASSWORD must be set when DRD_PUBLIC=1.");
  console.error("A public deployment without a password would expose the whole API.");
  process.exit(1);
}
if (PUBLIC && !process.env.DRD_SESSION_SECRET) {
  console.error("REFUSING TO START: DRD_SESSION_SECRET must be set when DRD_PUBLIC=1.");
  console.error("Without a stable secret every restart would silently log everyone out.");
  process.exit(1);
}

function signSession(expires) {
  const mac = crypto.createHmac("sha256", SESSION_SECRET).update(String(expires)).digest("hex");
  return expires + "." + mac;
}
function verifySession(raw) {
  if (!raw || raw.indexOf(".") < 0) return false;
  const [exp, mac] = raw.split(".");
  if (!/^\d+$/.test(exp) || +exp < Date.now()) return false;
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update(exp).digest("hex");
  const a = Buffer.from(mac || "", "utf8"), b = Buffer.from(expect, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function isSecureReq(req) {
  return (req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}
// Constant-time password comparison, length-safe.
function passwordMatches(given) {
  if (!ADMIN_PASSWORD || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
const RATE = { windowMs: 60000, max: 300 };
const buckets = new Map();

function create(opts) {
  opts = opts || {};
  const db = open(opts.dbFile);
  const log = opts.quiet ? () => {} : console.log;

  // ---------------------------------------------------------------- helpers
  const J = (o) => JSON.stringify(o);
  const parseJSON = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

  function hydrateCompany(r) {
    if (!r) return null;
    return { id: r.id, name: r.name, domain: r.domain, industry: r.industry, sub: r.sub,
      country: r.country, region: r.region, city: r.city, size: r.size, revenue: r.revenue,
      founded: r.founded, traffic: r.traffic, tech: parseJSON(r.tech_json, []),
      signals: parseJSON(r.signals_json, []), funding: parseJSON(r.funding_json, null),
      desc: r.description, pains: parseJSON(r.pains_json, []) };
  }
  const hydrateContact = (r) => r && ({ id: r.id, companyId: r.company_id, name: r.name, title: r.title,
    seniority: r.seniority, department: r.department, email: r.email, emailStatus: r.email_status,
    verified: !!r.verified, phone: r.phone, linkedin: r.linkedin, city: r.city, country: r.country });

  const getCompany = (cid) => hydrateCompany(db.prepare("SELECT * FROM companies WHERE id=?").get(cid));
  const getContact = (cid) => hydrateContact(db.prepare("SELECT * FROM contacts WHERE id=?").get(cid));

  function audit(orgId, actor, action, detail) {
    db.prepare("INSERT INTO audit_logs (id,org_id,actor,action,detail,at) VALUES (?,?,?,?,?,?)")
      .run(id("aud"), orgId, actor, action, detail || "", Date.now());
  }
  function meter(orgId, kind, credits, cost, ref) {
    db.prepare("INSERT INTO usage_events (id,org_id,kind,credits,cost,ref,at) VALUES (?,?,?,?,?,?,?)")
      .run(id("use"), orgId, kind, credits, cost || 0, ref || null, Date.now());
    db.prepare("UPDATE organizations SET credits_used = credits_used + ? WHERE id=?").run(credits, orgId);
  }
  function isSuppressed(orgId, email) {
    if (!email) return false;
    const domain = String(email).split("@")[1] || "";
    const row = db.prepare("SELECT id FROM suppressions WHERE org_id=? AND (value=? OR value=?)").get(orgId, email, domain);
    return !!row;
  }
  const EVENTS = ["lead.hot", "lead.replied", "meeting.booked", "campaign.started",
    "campaign.paused", "campaign.completed", "unsubscribe.received"];
  function fireWebhook(orgId, event, payload) {
    const hooks = db.prepare("SELECT * FROM webhooks WHERE org_id=? AND active=1").all(orgId);
    hooks.forEach((h) => {
      if (!parseJSON(h.events_json, []).includes(event)) return;
      // Recorded rather than sent: outbound delivery is the integration point.
      db.prepare("INSERT INTO webhook_deliveries (id,webhook_id,event,payload_json,status,at) VALUES (?,?,?,?,?,?)")
        .run(id("whd"), h.id, event, J(payload), "recorded", Date.now());
    });
  }

  // ------------------------------------------------------------------ routes
  const routes = [];
  const R = (method, pattern, handler, publicRoute) => routes.push({ method, pattern, handler, publicRoute });

  R("POST", /^\/v1\/auth\/login$/, (ctx) => {
    if (!ADMIN_PASSWORD) return { status: 503, body: { error: "login_disabled", message: "No admin password configured on this server." } };
    if (!passwordMatches(ctx.body && ctx.body.password))
      return { status: 401, body: { error: "invalid_password" } };
    const expires = Date.now() + SESSION_TTL_MS;
    const flags = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=" + Math.floor(SESSION_TTL_MS / 1000)];
    if (isSecureReq(ctx.req) || PUBLIC) flags.push("Secure");
    return { status: 200, body: { ok: true, expires },
      headers: { "set-cookie": COOKIE + "=" + encodeURIComponent(signSession(expires)) + "; " + flags.join("; ") } };
  }, true);

  R("POST", /^\/v1\/auth\/logout$/, () => ({ status: 200, body: { ok: true },
    headers: { "set-cookie": COOKIE + "=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" } }), true);

  R("GET", /^\/v1\/auth\/me$/, (ctx) => ({ status: 200, body: {
    authenticated: !!ctx.org, login_required: !!ADMIN_PASSWORD } }), true);

  R("GET", /^\/v1\/health$/, () => ({ status: 200, body: { ok: true, provider: AI.provider(), model: AI.model } }), true);

  R("GET", /^\/v1\/projects$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT * FROM projects WHERE org_id=?").all(ctx.org.id).map((p) => ({
      id: p.id, name: p.name, website: p.website, autopilot: !!p.autopilot, profile: parseJSON(p.profile_json, {}) })) } }));

  R("PATCH", /^\/v1\/autopilot$/, (ctx) => {
    const on = ctx.body.autopilot ? 1 : 0;
    db.prepare("UPDATE organizations SET autopilot=? WHERE id=?").run(on, ctx.org.id);
    audit(ctx.org.id, ctx.actor, "autopilot." + (on ? "enabled" : "disabled"), "");
    return { status: 200, body: { autopilot: !!on } };
  });

  R("GET", /^\/v1\/icps$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT i.* FROM icps i JOIN projects p ON p.id=i.project_id WHERE p.org_id=?").all(ctx.org.id)
      .map((i) => ({ id: i.id, name: i.name, fit: i.fit, industry: i.industry, country: i.country,
        sizeMin: i.size_min, approved: !!i.approved, why: i.why, buyers: parseJSON(i.buyers_json, []) })) } }));

  R("PATCH", /^\/v1\/icps\/([\w-]+)$/, (ctx, m) => {
    const row = db.prepare("SELECT * FROM icps WHERE id=?").get(m[1]);
    if (!row) return { status: 404, body: { error: "icp_not_found" } };
    const approved = ctx.body.approved ? 1 : 0;
    db.prepare("UPDATE icps SET approved=? WHERE id=?").run(approved, m[1]);
    audit(ctx.org.id, ctx.actor, "icp." + (approved ? "approved" : "rejected"), row.name);
    return { status: 200, body: { id: m[1], approved: !!approved } };
  });

  // ---- search -----------------------------------------------------------
  R("GET", /^\/v1\/search\/companies$/, (ctx) => {
    const q = ctx.query.get("q") || "";
    if (!q) return { status: 400, body: { error: "missing_query", message: "Pass ?q= with a natural-language description." } };
    const icp = ctx.query.get("icp_id") ? db.prepare("SELECT * FROM icps WHERE id=?").get(ctx.query.get("icp_id")) : null;
    const icpObj = icp ? { name: icp.name, industry: icp.industry, country: icp.country, sizeMin: icp.size_min } : null;
    const out = ENGINE.searchCompanies(q, { icp: icpObj });
    const limit = Math.min(200, +(ctx.query.get("limit") || 50));
    return { status: 200, body: { criteria: out.criteria, total: out.results.length,
      data: out.results.slice(0, limit).map((c) => ({ id: c.id, name: c.name, domain: c.domain,
        industry: c.industry, sub: c.sub, city: c.city, country: c.country, size: c.size,
        revenue: c.revenue, founded: c.founded, tech: c.tech, signals: c.signals, funding: c.funding,
        fit_score: c._score, breakdown: c._breakdown, reason: c._reason,
        contacts: db.prepare("SELECT COUNT(*) n FROM contacts WHERE company_id=?").get(c.id).n })) } };
  });

  R("GET", /^\/v1\/search\/people$/, (ctx) => {
    const q = ctx.query.get("q") || "";
    if (!q) return { status: 400, body: { error: "missing_query" } };
    const out = ENGINE.searchPeople(q);
    const limit = Math.min(200, +(ctx.query.get("limit") || 50));
    return { status: 200, body: { criteria: out.criteria, total: out.results.length,
      data: out.results.slice(0, limit).map((p) => ({ id: p.id, name: p.name, title: p.title,
        seniority: p.seniority, department: p.department, email: p.email, email_status: p.emailStatus,
        phone: p.phone, linkedin: p.linkedin, city: p.city, country: p.country,
        company: { id: p.company.id, name: p.company.name, domain: p.company.domain,
          industry: p.company.industry, size: p.company.size },
        fit_score: p._score, reason: p._reason,
        suppressed: isSuppressed(ctx.org.id, p.email) })) } };
  });

  R("GET", /^\/v1\/companies\/([\w-]+)$/, (ctx, m) => {
    const c = getCompany(m[1]);
    if (!c) return { status: 404, body: { error: "company_not_found" } };
    const contacts = db.prepare("SELECT * FROM contacts WHERE company_id=?").all(m[1]).map(hydrateContact);
    return { status: 200, body: { data: Object.assign({}, c, { contacts,
      score: ENGINE.scoreCompany(c, ENGINE.parseQuery(""), null) }) } };
  });

  R("GET", /^\/v1\/companies\/([\w-]+)\/lookalikes$/, (ctx, m) => {
    const c = getCompany(m[1]);
    if (!c) return { status: 404, body: { error: "company_not_found" } };
    const out = ENGINE.lookalikes(c, +(ctx.query.get("limit") || 25));
    return { status: 200, body: { source: { id: c.id, name: c.name },
      data: out.map((x) => ({ id: x.id, name: x.name, domain: x.domain, industry: x.industry,
        city: x.city, country: x.country, size: x.size, similarity: x._score, reason: x._reason })) } };
  });

  R("GET", /^\/v1\/segments$/, () => ({ status: 200, body: { data: ENGINE.segments() } }));

  // ---- research (async job + inline result) ------------------------------
  R("POST", /^\/v1\/research$/, async (ctx) => {
    const c = getCompany(ctx.body.company_id);
    if (!c) return { status: 404, body: { error: "company_not_found" } };
    const contact = ctx.body.contact_id ? getContact(ctx.body.contact_id)
      : hydrateContact(db.prepare("SELECT * FROM contacts WHERE company_id=? LIMIT 1").get(c.id));
    const jobId = id("job");
    db.prepare("INSERT INTO jobs (id,org_id,kind,payload_json,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
      .run(jobId, ctx.org.id, "research", J(ctx.body), "RESEARCHING", Date.now(), Date.now());
    const report = await AI.deepResearch(c, contact);
    const rid = id("rr");
    db.prepare("INSERT INTO research_reports (id,company_id,contact_id,report_json,source,created_at) VALUES (?,?,?,?,?,?)")
      .run(rid, c.id, contact ? contact.id : null, J(report), report._provider || "deterministic", Date.now());
    db.prepare("UPDATE jobs SET state=?, result_json=?, updated_at=? WHERE id=?")
      .run("DONE", J({ report_id: rid }), Date.now(), jobId);
    meter(ctx.org.id, "research", 4, 0.12, c.id);
    audit(ctx.org.id, ctx.actor, "research.generated", c.name);
    return { status: 201, body: { id: rid, job_id: jobId, company_id: c.id, data: report } };
  });

  R("GET", /^\/v1\/research\/([\w-]+)$/, (ctx, m) => {
    const r = db.prepare("SELECT * FROM research_reports WHERE id=?").get(m[1]);
    if (!r) return { status: 404, body: { error: "report_not_found" } };
    return { status: 200, body: { id: r.id, company_id: r.company_id, source: r.source, data: parseJSON(r.report_json, {}) } };
  });

  // ---- email generation --------------------------------------------------
  R("POST", /^\/v1\/emails\/generate$/, async (ctx) => {
    const contact = getContact(ctx.body.contact_id);
    if (!contact) return { status: 404, body: { error: "contact_not_found" } };
    const c = getCompany(contact.companyId);
    const em = await AI.generateEmail(c, contact, { tone: ctx.body.tone, goal: ctx.body.goal });
    return { status: 200, body: { data: em, suppressed: isSuppressed(ctx.org.id, contact.email) } };
  });

  // ---- campaigns ---------------------------------------------------------
  const campaignRow = (c) => ({ id: c.id, name: c.name, icp_id: c.icp_id, goal: c.goal, tone: c.tone,
    status: c.status, autopilot: !!c.autopilot, budget: c.budget, spend: c.spend,
    sent: c.sent, replies: c.replies, positive: c.positive,
    sequence: parseJSON(c.sequence_json, []),
    leads: db.prepare("SELECT COUNT(*) n FROM campaign_leads WHERE campaign_id=?").get(c.id).n,
    hot: db.prepare("SELECT COUNT(*) n FROM conversations WHERE campaign_id=? AND hot=1").get(c.id).n,
    meetings: db.prepare("SELECT COUNT(*) n FROM meetings WHERE campaign_id=?").get(c.id).n });

  R("GET", /^\/v1\/campaigns$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT c.* FROM campaigns c JOIN projects p ON p.id=c.project_id WHERE p.org_id=?")
      .all(ctx.org.id).map(campaignRow) } }));

  R("POST", /^\/v1\/campaigns$/, (ctx) => {
    if (!ctx.body.name) return { status: 400, body: { error: "missing_name" } };
    const p = db.prepare("SELECT id FROM projects WHERE org_id=? LIMIT 1").get(ctx.org.id);
    const cid = id("cmp");
    db.prepare(`INSERT INTO campaigns (id,project_id,name,icp_id,goal,tone,status,autopilot,budget,spend,sent,replies,positive,sequence_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,0,0,0,0,?,?)`)
      .run(cid, p.id, ctx.body.name, ctx.body.icp_id || null, ctx.body.goal || "Book a call",
        ctx.body.tone || "consultative", "Draft", ctx.body.autopilot ? 1 : 0, ctx.body.budget || 250,
        J(ctx.body.sequence || [{ step: 1, day: 0, label: "Personalized opener" }]), Date.now());
    audit(ctx.org.id, ctx.actor, "campaign.created", ctx.body.name);
    return { status: 201, body: { data: campaignRow(db.prepare("SELECT * FROM campaigns WHERE id=?").get(cid)) } };
  });

  R("GET", /^\/v1\/campaigns\/([\w-]+)$/, (ctx, m) => {
    const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(m[1]);
    if (!c) return { status: 404, body: { error: "campaign_not_found" } };
    return { status: 200, body: { data: campaignRow(c) } };
  });

  ["start", "pause"].forEach((verb) => {
    R("POST", new RegExp("^/v1/campaigns/([\\w-]+)/" + verb + "$"), (ctx, m) => {
      const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(m[1]);
      if (!c) return { status: 404, body: { error: "campaign_not_found" } };
      const status = verb === "start" ? "Active" : "Paused";
      db.prepare("UPDATE campaigns SET status=? WHERE id=?").run(status, m[1]);
      audit(ctx.org.id, ctx.actor, "campaign." + verb, c.name);
      fireWebhook(ctx.org.id, verb === "start" ? "campaign.started" : "campaign.paused", { campaign_id: m[1] });
      return { status: 200, body: { id: m[1], status } };
    });
  });

  // Bulk import. Enforces suppression and dedupe — the two things that make
  // an import safe. Reports exactly what happened to every row.
  R("POST", /^\/v1\/campaigns\/([\w-]+)\/import$/, (ctx, m) => {
    const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(m[1]);
    if (!c) return { status: 404, body: { error: "campaign_not_found" } };
    const leads = Array.isArray(ctx.body.leads) ? ctx.body.leads : null;
    if (!leads) return { status: 400, body: { error: "missing_leads", message: "Body must include a leads array." } };
    const res = { imported: 0, suppressed: 0, duplicate: 0, unmatched: 0, errors: [] };
    const ins = db.prepare("INSERT OR IGNORE INTO campaign_leads (id,campaign_id,contact_id,status,step,score,added_at) VALUES (?,?,?,?,0,?,?)");
    leads.forEach((l, i) => {
      if (!l || !l.email) { res.errors.push({ row: i, error: "missing_email" }); return; }
      const row = db.prepare("SELECT * FROM contacts WHERE email=?").get(l.email);
      if (!row) { res.unmatched++; return; }
      if (isSuppressed(ctx.org.id, l.email)) { res.suppressed++; return; }
      const dupe = db.prepare("SELECT id FROM campaign_leads WHERE campaign_id=? AND contact_id=?").get(m[1], row.id);
      if (dupe) { res.duplicate++; return; }
      const co = getCompany(row.company_id);
      ins.run(id("cl"), m[1], row.id, "Queued", ENGINE.scoreCompany(co, ENGINE.parseQuery(""), null).total, Date.now());
      res.imported++;
    });
    audit(ctx.org.id, ctx.actor, "campaign.import", `${res.imported} imported, ${res.suppressed} suppressed, ${res.duplicate} duplicate`);
    return { status: 200, body: res };
  });

  R("GET", /^\/v1\/campaigns\/([\w-]+)\/analytics$/, (ctx, m) => {
    const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(m[1]);
    if (!c) return { status: 404, body: { error: "campaign_not_found" } };
    const meetings = db.prepare("SELECT COUNT(*) n FROM meetings WHERE campaign_id=?").get(m[1]).n;
    const hot = db.prepare("SELECT COUNT(*) n FROM conversations WHERE campaign_id=? AND hot=1").get(m[1]).n;
    return { status: 200, body: { data: { campaign_id: m[1], sent: c.sent, replies: c.replies,
      positive: c.positive, hot, meetings, spend: c.spend,
      reply_rate: c.sent ? +(c.replies / c.sent * 100).toFixed(1) : 0,
      cost_per_reply: c.replies ? +(c.spend / c.replies).toFixed(2) : 0,
      cost_per_meeting: meetings ? +(c.spend / meetings).toFixed(2) : 0 } } };
  });

  // ---- send (enforces suppression + budget) ------------------------------
  R("POST", /^\/v1\/campaigns\/([\w-]+)\/send$/, async (ctx, m) => {
    const c = db.prepare("SELECT * FROM campaigns WHERE id=?").get(m[1]);
    if (!c) return { status: 404, body: { error: "campaign_not_found" } };
    if (c.status !== "Active") return { status: 409, body: { error: "campaign_not_active", status: c.status } };
    const rate = 0.031;
    const limit = Math.min(+(ctx.body.limit || 10), 100);
    const queued = db.prepare("SELECT * FROM campaign_leads WHERE campaign_id=? AND status='Queued' LIMIT ?").all(m[1], limit);
    const res = { sent: 0, skipped_suppressed: 0, skipped_budget: 0 };
    for (const lead of queued) {
      if (c.spend + rate * (res.sent + 1) > c.budget) { res.skipped_budget++; continue; }
      const contact = getContact(lead.contact_id);
      if (isSuppressed(ctx.org.id, contact.email)) {
        db.prepare("UPDATE campaign_leads SET status='Suppressed' WHERE id=?").run(lead.id);
        res.skipped_suppressed++; continue;
      }
      const co = getCompany(contact.companyId);
      const em = await AI.generateEmail(co, contact, { tone: c.tone, goal: c.goal });
      const convId = id("cnv");
      db.prepare(`INSERT INTO conversations (id,campaign_id,contact_id,company_id,subject,status,hot,last_at)
        VALUES (?,?,?,?,?,'Sent',0,?)`).run(convId, m[1], contact.id, co.id, em.subject, Date.now());
      db.prepare("INSERT INTO messages (id,conversation_id,direction,body,subject,at) VALUES (?,?,?,?,?,?)")
        .run(id("ms"), convId, "out", em.body, em.subject, Date.now());
      db.prepare("UPDATE campaign_leads SET status='Contacted', step=1 WHERE id=?").run(lead.id);
      res.sent++;
    }
    if (res.sent) {
      db.prepare("UPDATE campaigns SET sent=sent+?, spend=ROUND(spend+?,2) WHERE id=?").run(res.sent, res.sent * rate, m[1]);
      meter(ctx.org.id, "email", res.sent, +(res.sent * rate).toFixed(2), m[1]);
    }
    audit(ctx.org.id, ctx.actor, "campaign.send", `${res.sent} sent, ${res.skipped_suppressed} suppressed`);
    return { status: 200, body: res };
  });

  // ---- leads / conversations --------------------------------------------
  R("GET", /^\/v1\/leads\/hot$/, (ctx) => {
    const rows = db.prepare(`SELECT cv.*, ct.name cname, ct.title ctitle, ct.email cemail, co.name coname, co.industry coind
      FROM conversations cv JOIN contacts ct ON ct.id=cv.contact_id JOIN companies co ON co.id=cv.company_id
      WHERE cv.hot=1 ORDER BY cv.intent_confidence DESC`).all();
    return { status: 200, body: { data: rows.map((r) => ({ conversation_id: r.id, contact: { id: r.contact_id, name: r.cname, title: r.ctitle, email: r.cemail },
      company: { id: r.company_id, name: r.coname, industry: r.coind },
      intent: r.intent, confidence: r.intent_confidence, action: parseJSON(r.intent_json, {}).action,
      meeting: db.prepare("SELECT id,status,at FROM meetings WHERE contact_id=?").get(r.contact_id) || null })) } };
  });

  R("GET", /^\/v1\/leads$/, (ctx) => {
    const cid = ctx.query.get("campaign_id");
    const rows = cid
      ? db.prepare("SELECT cl.*, ct.name, ct.title, ct.email, ct.email_status FROM campaign_leads cl JOIN contacts ct ON ct.id=cl.contact_id WHERE cl.campaign_id=?").all(cid)
      : db.prepare("SELECT cl.*, ct.name, ct.title, ct.email, ct.email_status FROM campaign_leads cl JOIN contacts ct ON ct.id=cl.contact_id LIMIT 200").all();
    return { status: 200, body: { total: rows.length, data: rows.map((r) => ({ id: r.id, campaign_id: r.campaign_id,
      contact_id: r.contact_id, name: r.name, title: r.title, email: r.email, email_status: r.email_status,
      status: r.status, step: r.step, score: r.score })) } };
  });

  R("GET", /^\/v1\/conversations$/, (ctx) => {
    const status = ctx.query.get("status");
    const rows = status
      ? db.prepare("SELECT * FROM conversations WHERE status=? ORDER BY last_at DESC").all(status)
      : db.prepare("SELECT * FROM conversations ORDER BY last_at DESC").all();
    return { status: 200, body: { total: rows.length, data: rows.map((r) => ({ id: r.id, campaign_id: r.campaign_id,
      contact: getContact(r.contact_id), company: { id: r.company_id, name: (getCompany(r.company_id) || {}).name },
      subject: r.subject, status: r.status, intent: r.intent, confidence: r.intent_confidence,
      intent_meta: parseJSON(r.intent_json, {}), hot: !!r.hot, last_at: r.last_at,
      preview: (db.prepare("SELECT body FROM messages WHERE conversation_id=? ORDER BY at DESC LIMIT 1").get(r.id) || {}).body || "" })) } };
  });

  R("GET", /^\/v1\/conversations\/([\w-]+)$/, (ctx, m) => {
    const r = db.prepare("SELECT * FROM conversations WHERE id=?").get(m[1]);
    if (!r) return { status: 404, body: { error: "conversation_not_found" } };
    return { status: 200, body: { data: { id: r.id, campaign_id: r.campaign_id, subject: r.subject,
      status: r.status, intent: r.intent, confidence: r.intent_confidence, intent_meta: parseJSON(r.intent_json, {}),
      hot: !!r.hot, contact: getContact(r.contact_id), company: getCompany(r.company_id),
      messages: db.prepare("SELECT direction,body,subject,at FROM messages WHERE conversation_id=? ORDER BY at").all(r.id) } } };
  });

  // Inbound reply: classify, route, auto-suppress on compliance intents.
  R("POST", /^\/v1\/conversations\/([\w-]+)\/inbound$/, async (ctx, m) => {
    const r = db.prepare("SELECT * FROM conversations WHERE id=?").get(m[1]);
    if (!r) return { status: 404, body: { error: "conversation_not_found" } };
    if (!ctx.body.body) return { status: 400, body: { error: "missing_body" } };
    const cls = await AI.classifyReply(ctx.body.body);
    const now = Date.now();
    db.prepare("INSERT INTO messages (id,conversation_id,direction,body,subject,at) VALUES (?,?,?,?,?,?)")
      .run(id("ms"), m[1], "in", ctx.body.body, r.subject, now);
    const compliance = cls.intent === "Unsubscribe" || cls.intent === "Negative";
    db.prepare("UPDATE conversations SET intent=?, intent_confidence=?, intent_json=?, hot=?, status=?, last_at=? WHERE id=?")
      .run(cls.intent, cls.confidence, J(cls), cls.hot ? 1 : 0, compliance ? "Closed" : "Need Reply", now, m[1]);
    db.prepare("UPDATE campaigns SET replies=replies+1 WHERE id=?").run(r.campaign_id);
    const contact = getContact(r.contact_id);
    if (compliance) {
      db.prepare("INSERT OR IGNORE INTO suppressions (id,org_id,type,value,reason,scope,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(id("sup"), ctx.org.id, "Person", contact.email,
          cls.intent === "Unsubscribe" ? "Unsubscribe request" : "Explicit negative reply", "Global", now);
      fireWebhook(ctx.org.id, "unsubscribe.received", { contact_id: contact.id, email: contact.email });
      audit(ctx.org.id, ctx.actor, "suppression.auto", contact.email + " (" + cls.intent + ")");
    }
    if (cls.hot) fireWebhook(ctx.org.id, "lead.hot", { conversation_id: m[1], contact_id: contact.id, intent: cls.intent });
    fireWebhook(ctx.org.id, "lead.replied", { conversation_id: m[1], intent: cls.intent });
    return { status: 200, body: { conversation_id: m[1], classification: cls, suppressed: compliance } };
  });

  R("POST", /^\/v1\/conversations\/([\w-]+)\/reply$/, (ctx, m) => {
    const r = db.prepare("SELECT * FROM conversations WHERE id=?").get(m[1]);
    if (!r) return { status: 404, body: { error: "conversation_not_found" } };
    if (!ctx.body.body) return { status: 400, body: { error: "missing_body" } };
    const contact = getContact(r.contact_id);
    if (isSuppressed(ctx.org.id, contact.email))
      return { status: 409, body: { error: "contact_suppressed", message: "This contact is on the suppression list." } };
    db.prepare("INSERT INTO messages (id,conversation_id,direction,body,subject,at) VALUES (?,?,?,?,?,?)")
      .run(id("ms"), m[1], "out", ctx.body.body, r.subject, Date.now());
    db.prepare("UPDATE conversations SET status='Replied', last_at=? WHERE id=?").run(Date.now(), m[1]);
    audit(ctx.org.id, ctx.actor, "conversation.reply", m[1]);
    return { status: 200, body: { conversation_id: m[1], status: "Replied" } };
  });

  // ---- meetings ----------------------------------------------------------
  R("GET", /^\/v1\/meetings$/, () => ({ status: 200, body: {
    data: db.prepare("SELECT * FROM meetings ORDER BY at").all().map((m) => ({ id: m.id, campaign_id: m.campaign_id,
      title: m.title, at: m.at, duration: m.duration, status: m.status,
      contact: getContact(m.contact_id), company: { id: m.company_id, name: (getCompany(m.company_id) || {}).name } })) } }));

  R("POST", /^\/v1\/meetings$/, (ctx) => {
    const contact = getContact(ctx.body.contact_id);
    if (!contact) return { status: 404, body: { error: "contact_not_found" } };
    const existing = db.prepare("SELECT id FROM meetings WHERE contact_id=?").get(contact.id);
    if (existing) return { status: 409, body: { error: "meeting_exists", meeting_id: existing.id } };
    const co = getCompany(contact.companyId);
    const mid = id("mtg");
    db.prepare("INSERT INTO meetings (id,campaign_id,contact_id,company_id,title,at,duration,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(mid, ctx.body.campaign_id || null, contact.id, co.id,
        ctx.body.title || co.name + " — intro", ctx.body.at || Date.now() + 5 * 86400000,
        ctx.body.duration || 30, ctx.body.status || "Confirmed", Date.now());
    fireWebhook(ctx.org.id, "meeting.booked", { meeting_id: mid, contact_id: contact.id });
    audit(ctx.org.id, ctx.actor, "meeting.booked", co.name);
    return { status: 201, body: { data: { id: mid, contact_id: contact.id, company_id: co.id } } };
  });

  // ---- suppression -------------------------------------------------------
  R("GET", /^\/v1\/suppressions$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT * FROM suppressions WHERE org_id=? ORDER BY created_at DESC").all(ctx.org.id) } }));

  R("POST", /^\/v1\/suppressions$/, (ctx) => {
    if (!ctx.body.value) return { status: 400, body: { error: "missing_value" } };
    const sid = id("sup");
    try {
      db.prepare("INSERT INTO suppressions (id,org_id,type,value,reason,scope,created_at) VALUES (?,?,?,?,?,?,?)")
        .run(sid, ctx.org.id, ctx.body.value.includes("@") ? "Person" : "Domain", ctx.body.value,
          ctx.body.reason || "Manual entry", ctx.body.scope || "Global", Date.now());
    } catch (e) { return { status: 409, body: { error: "already_suppressed" } }; }
    audit(ctx.org.id, ctx.actor, "suppression.added", ctx.body.value);
    return { status: 201, body: { id: sid, value: ctx.body.value } };
  });

  R("DELETE", /^\/v1\/suppressions\/([\w-]+)$/, (ctx, m) => {
    const r = db.prepare("SELECT * FROM suppressions WHERE id=? AND org_id=?").get(m[1], ctx.org.id);
    if (!r) return { status: 404, body: { error: "suppression_not_found" } };
    db.prepare("DELETE FROM suppressions WHERE id=?").run(m[1]);
    audit(ctx.org.id, ctx.actor, "suppression.removed", r.value);
    return { status: 200, body: { deleted: m[1] } };
  });

  // ---- usage / analytics / audit ----------------------------------------
  R("GET", /^\/v1\/usage$/, (ctx) => {
    const org = db.prepare("SELECT * FROM organizations WHERE id=?").get(ctx.org.id);
    const byKind = db.prepare("SELECT kind, SUM(credits) credits, SUM(cost) cost FROM usage_events WHERE org_id=? GROUP BY kind").all(ctx.org.id);
    return { status: 200, body: { data: { plan: org.plan, credits_included: org.credits_included,
      credits_used: org.credits_used, credits_remaining: org.credits_included - org.credits_used,
      autopilot: !!org.autopilot, by_kind: byKind } } };
  });

  R("GET", /^\/v1\/analytics$/, (ctx) => {
    const camps = db.prepare("SELECT c.* FROM campaigns c JOIN projects p ON p.id=c.project_id WHERE p.org_id=?").all(ctx.org.id);
    const ws = { campaigns: camps.map((c) => ({ name: c.name, sent: c.sent, replies: c.replies,
      positive: c.positive, spend: c.spend, leadIds: [],
      hot: db.prepare("SELECT COUNT(*) n FROM conversations WHERE campaign_id=? AND hot=1").get(c.id).n,
      meetings: db.prepare("SELECT COUNT(*) n FROM meetings WHERE campaign_id=?").get(c.id).n })) };
    return { status: 200, body: { data: ENGINE.analytics(ws) } };
  });

  R("GET", /^\/v1\/audit$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT * FROM audit_logs WHERE org_id=? ORDER BY at DESC LIMIT 100").all(ctx.org.id) } }));

  R("GET", /^\/v1\/webhooks\/deliveries$/, (ctx) => ({ status: 200, body: {
    data: db.prepare(`SELECT d.* FROM webhook_deliveries d JOIN webhooks w ON w.id=d.webhook_id
      WHERE w.org_id=? ORDER BY d.at DESC LIMIT 100`).all(ctx.org.id) } }));

  R("GET", /^\/v1\/webhooks$/, (ctx) => ({ status: 200, body: {
    data: db.prepare("SELECT * FROM webhooks WHERE org_id=?").all(ctx.org.id).map((w) => ({
      id: w.id, url: w.url, events: parseJSON(w.events_json, []), active: !!w.active, created_at: w.created_at })) } }));

  R("POST", /^\/v1\/webhooks$/, (ctx) => {
    if (!ctx.body.url) return { status: 400, body: { error: "missing_url" } };
    const events = Array.isArray(ctx.body.events) ? ctx.body.events : [];
    if (!events.length) return { status: 400, body: { error: "missing_events", message: "Subscribe to at least one event." } };
    const unknown = events.filter((e) => !EVENTS.includes(e));
    if (unknown.length) return { status: 400, body: { error: "unknown_events", unknown, supported: EVENTS } };
    const wid = id("wh");
    db.prepare("INSERT INTO webhooks (id,org_id,url,events_json,active,created_at) VALUES (?,?,?,?,?,?)")
      .run(wid, ctx.org.id, ctx.body.url, J(events), ctx.body.active === false ? 0 : 1, Date.now());
    audit(ctx.org.id, ctx.actor, "webhook.created", ctx.body.url);
    return { status: 201, body: { id: wid, url: ctx.body.url, events } };
  });

  R("DELETE", /^\/v1\/webhooks\/([\w-]+)$/, (ctx, m) => {
    const w = db.prepare("SELECT * FROM webhooks WHERE id=? AND org_id=?").get(m[1], ctx.org.id);
    if (!w) return { status: 404, body: { error: "webhook_not_found" } };
    db.prepare("DELETE FROM webhooks WHERE id=?").run(m[1]);
    audit(ctx.org.id, ctx.actor, "webhook.deleted", w.url);
    return { status: 200, body: { deleted: m[1] } };
  });

  // ------------------------------------------------------------------ HTTP
  const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
    ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

  function serveStatic(req, res, pathname) {
    const rel = pathname === "/" ? "/index.html" : pathname;
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); return;
    }
    res.writeHead(200, Object.assign(
      { "content-type": MIME[path.extname(file)] || "application/octet-stream" },
      { "x-content-type-options": "nosniff", "referrer-policy": "same-origin" }));
    fs.createReadStream(file).pipe(res);
  }

  const server = http.createServer(async (req, res) => {
    const started = Date.now();
    const u = new URL(req.url, "http://localhost");
    const SEC = {
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "same-origin",
    };
    if (PUBLIC) SEC["strict-transport-security"] = "max-age=31536000; includeSubDomains";

    const send = (status, body, extra) => {
      const payload = J(body);
      res.writeHead(status, Object.assign({
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        "cache-control": "no-store",
      }, SEC, extra || {}));
      res.end(payload);
      log(`${req.method} ${u.pathname} ${status} ${Date.now() - started}ms`);
    };

    if (u.pathname === "/config.js") {
      // The browser authenticates with an httpOnly session cookie. No key is
      // ever shipped to the client; API keys are for server-to-server callers.
      const js = 'window.DRD_API_BASE="";window.DRD_AUTH="cookie";window.DRD_LOGIN_REQUIRED=' +
        (ADMIN_PASSWORD ? "true" : "false") + ";";
      res.writeHead(200, Object.assign({ "content-type": "text/javascript", "cache-control": "no-store" }, SEC));
      return res.end(js);
    }
    if (!u.pathname.startsWith("/v1/")) return serveStatic(req, res, u.pathname);

    const route = routes.find((r) => r.method === req.method && r.pattern.test(u.pathname));
    if (!route) return send(404, { error: "not_found", path: u.pathname });

    // ---- identity: session cookie (browser) or bearer key (server-to-server)
    let org = null, actor = "api", rateKey = null;
    const authHeader = req.headers.authorization || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (bearer) {
      const key = db.prepare("SELECT * FROM api_keys WHERE token_hash=? AND revoked=0").get(hashToken(bearer));
      if (!key) return send(401, { error: "invalid_token" });
      db.prepare("UPDATE api_keys SET last_used_at=? WHERE id=?").run(Date.now(), key.id);
      org = db.prepare("SELECT * FROM organizations WHERE id=?").get(key.org_id);
      actor = key.name; rateKey = key.id;
    } else if (verifySession(readCookie(req, COOKIE))) {
      org = db.prepare("SELECT * FROM organizations ORDER BY created_at LIMIT 1").get();
      actor = "browser"; rateKey = "session";
    } else if (!ADMIN_PASSWORD && !PUBLIC) {
      // Local development with no password set: treat the browser as the owner.
      org = db.prepare("SELECT * FROM organizations ORDER BY created_at LIMIT 1").get();
      actor = "local"; rateKey = "local";
    }

    if (!route.publicRoute && !org) {
      return send(401, { error: "unauthorized",
        message: "Sign in, or send Authorization: Bearer <api key>." });
    }

    if (rateKey) {
      const now = Date.now();
      const b = buckets.get(rateKey) || { start: now, n: 0 };
      if (now - b.start > RATE.windowMs) { b.start = now; b.n = 0; }
      b.n++; buckets.set(rateKey, b);
      if (b.n > RATE.max) return send(429, { error: "rate_limited", retry_after_ms: RATE.windowMs - (now - b.start) });
    }

    // body
    let body = {};
    if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw) { body = parseJSON(raw, null); if (body === null) return send(400, { error: "invalid_json" }); }
    }

    try {
      const m = u.pathname.match(route.pattern);
      const out = await route.handler({ org, actor, body, query: u.searchParams, req }, m);
      send(out.status, out.body, out.headers);
    } catch (e) {
      log("ERROR", u.pathname, e.message);
      send(500, { error: "internal_error", message: e.message });
    }
  });

  server.on("close", () => { try { db.close(); } catch (e) {} });
  return server;
}

if (require.main === module) {
  const port = +(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";

  // First boot on a fresh volume: seed so the deployment is never an empty shell.
  try {
    const { DEFAULT_DB } = require("./db.js");
    const probe = require("./db.js").open();
    const n = probe.prepare("SELECT COUNT(*) n FROM companies").get().n;
    probe.close();
    if (n === 0) {
      console.log("Empty database detected, seeding " + DEFAULT_DB + " ...");
      const out = require("./seed.js").seed();
      console.log("Seeded:", JSON.stringify(out.counts));
      if (!process.env.DRD_ADMIN_PASSWORD) console.log("API token:", out.token);
    }
  } catch (e) {
    console.error("Seed check failed:", e.message);
  }

  const server = create();
  server.listen(port, host, () =>
    console.log(`Dr. D Lead Engineering API on ${host}:${port}  (AI: ${AI.provider()}, public: ${PUBLIC})`));

  // Graceful shutdown so SQLite closes cleanly on redeploy.
  const bye = (sig) => () => { console.log(sig + " received, closing."); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000); };
  process.on("SIGTERM", bye("SIGTERM"));
  process.on("SIGINT", bye("SIGINT"));
}
module.exports = { create };
