/* Dr. D Lead Engineering System — workspace seed.
 * Builds the "running sales department" demo state: campaigns, conversations,
 * replies, hot leads, meetings, suppression, usage and the agent activity feed.
 * Persisted to localStorage; DRD_WORKSPACE.reset() rebuilds from seed.
 */
window.DRD_WORKSPACE = (function () {
  "use strict";
  const D = window.DRD_DATA, E = window.DRD_ENGINE;
  const KEY = "drd_workspace_v1";
  const DAY = 86400000;

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Original reply bodies keyed by the intent they should classify as.
  const REPLY_BANK = [
    { t: "Thanks for reaching out. This is timely — our board asked for an AI plan last month and we have nothing formal. What does the audit actually involve?" },
    { t: "Interested. Can you send pricing for a faculty cohort of about 40 people?" },
    { t: "I'm not the right person for this. Reach out to our Director of Teaching and Learning, she owns this file." },
    { t: "Let's talk. I have Tuesday or Thursday afternoon open next week — what works on your end?" },
    { t: "We already have an internal working group on this. Not a priority for us right now." },
    { t: "Out of the office until the 14th with limited access to email. I'll respond when I'm back." },
    { t: "How does this differ from the generic AI training vendors that have been emailing us all year?" },
    { t: "Please remove me from your list and do not contact me again." },
    { t: "Not interested, thanks." },
    { t: "Circle back next quarter — our budget cycle restarts in April and I'd rather talk with real numbers." },
    { t: "This looks useful. What would a three-week engagement cost for a department of our size?" },
    { t: "Can you clarify whether this covers assessment policy or just tool training? That distinction matters for us." },
    { t: "Happy to book something. Send an invite for any morning that week." },
    { t: "We're mid-procurement on something similar. Worth a conversation anyway — what's your availability?" },
    { t: "Forwarding this to our AVP Innovation, he's leading the initiative." },
  ];

  function build() {
    const rnd = mulberry32(777001);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const now = Date.now();

    // ---- pick target companies per ICP -------------------------------
    const approved = D.icps.filter((i) => i.approved);
    const campaignDefs = [
      { name: "Ontario Colleges — Readiness Audit", icp: "icp_1", goal: "Book a 20-minute readiness call", tone: "consultative", status: "Active", budget: 900, autopilot: true },
      { name: "EdTech Partnerships — Q3", icp: "icp_2", goal: "Book a partnership intro", tone: "direct", status: "Active", budget: 600, autopilot: true },
      { name: "Enterprise L&D — AI Upskilling", icp: "icp_3", goal: "Book a scoping call", tone: "executive", status: "Active", budget: 750, autopilot: false },
      { name: "US Universities — Pilot Expansion", icp: "icp_1", goal: "Book a pilot conversation", tone: "consultative", status: "Paused", budget: 400, autopilot: false },
      { name: "Professional Services — Warm Test", icp: "icp_4", goal: "Gauge interest in partner training", tone: "warm", status: "Draft", budget: 250, autopilot: false },
    ];

    const campaigns = [], conversations = [], meetings = [], activity = [];
    let convId = 1, meetId = 1;

    campaignDefs.forEach((def, ci) => {
      const icp = D.icps.find((i) => i.id === def.icp);
      const pool = D.companies.filter((c) => c.industry === icp.industry && (!icp.country || c.country === icp.country) && (!icp.sizeMin || c.size >= icp.sizeMin));
      const chosen = pool.slice(0, def.status === "Draft" ? 14 : def.status === "Paused" ? 18 : 26);
      const leadIds = [];
      chosen.forEach((co) => { (D.peopleByCompany[co.id] || []).slice(0, 2).forEach((p) => leadIds.push(p.id)); });

      const isLive = def.status !== "Draft";
      const sent = isLive ? Math.floor(leadIds.length * (def.status === "Active" ? 1.75 : 0.9)) : 0;
      const replies = isLive ? Math.max(2, Math.round(sent * (0.07 + rnd() * 0.09))) : 0;
      const positive = Math.max(1, Math.round(replies * (0.32 + rnd() * 0.25)));

      const camp = {
        id: "cmp_" + (ci + 1), name: def.name, icpId: def.icp, goal: def.goal, tone: def.tone,
        status: def.status, autopilot: def.autopilot, budget: def.budget,
        spend: isLive ? +(sent * 0.031).toFixed(2) : 0,
        leadIds, sent, replies, positive, hot: 0, meetings: 0,
        createdAt: now - (30 - ci * 4) * DAY,
        sequence: [
          { step: 1, day: 0, label: "Personalized opener" },
          { step: 2, day: 3, label: "Follow-up — short bump" },
          { step: 3, day: 8, label: "Final note — close the loop" },
        ],
      };

      // ---- conversations for the replies -----------------------------
      const repliers = leadIds.slice(0, replies);
      repliers.forEach((pid, i) => {
        const p = E.personById(pid); if (!p) return;
        const co = E.companyById(p.companyId);
        const bank = REPLY_BANK[(ci * 5 + i) % REPLY_BANK.length];
        const cls = E.classifyReply(bank.t);
        const outbound = E.generateEmail(co, p, { tone: def.tone, goal: def.goal });
        const at = now - int(rnd, 1, 21) * DAY;
        const conv = {
          id: "cnv_" + convId++, personId: pid, companyId: co.id, campaignId: camp.id,
          subject: outbound.subject,
          messages: [
            { dir: "out", text: outbound.body, at: at - 2 * DAY },
            { dir: "in", text: bank.t, at },
          ],
          intent: cls.intent, intentMeta: cls, hot: cls.hot,
          status: cls.hot ? "Need Reply" : (cls.intent === "Unsubscribe" || cls.intent === "Negative" ? "Closed" : "Need Reply"),
          starred: false, at,
        };
        if (cls.hot) camp.hot++;
        conversations.push(conv);

        // ---- meetings from meeting-intent replies --------------------
        if (cls.intent === "Meeting Request" || (cls.intent === "Interested" && rnd() > 0.55)) {
          meetings.push({
            id: "mtg_" + meetId++, personId: pid, companyId: co.id, campaignId: camp.id,
            at: now + int(rnd, -6, 16) * DAY,
            duration: 30,
            status: rnd() > 0.75 ? "Completed" : "Confirmed",
            title: `${co.name} — AI readiness intro`,
          });
          camp.meetings++;
        }
      });
      campaigns.push(camp);
    });

    // Book meetings only where the reply actually justifies one. Roughly a third of
    // hot leads stay unbooked on purpose — that is the work the inbox exists to do.
    conversations.filter((c) => c.hot).forEach((c) => {
      if (meetings.some((m) => m.personId === c.personId)) return;
      if (rnd() > 0.62) return;
      meetings.push({ id: "mtg_" + meetId++, personId: c.personId, companyId: c.companyId, campaignId: c.campaignId,
        at: now + int(rnd, -4, 18) * DAY, duration: 30,
        status: pick(["Confirmed", "Confirmed", "Proposed"]),
        title: `${E.companyById(c.companyId).name} — AI readiness intro` });
      const camp = campaigns.find((x) => x.id === c.campaignId);
      if (camp) camp.meetings++;
    });

    // Historical pipeline: completed meetings from earlier outreach on accounts that
    // are not part of the current live threads, so analytics has real history.
    const contacted = new Set(conversations.map((c) => c.personId));
    for (const camp of campaigns) {
      for (const lid of camp.leadIds) {
        if (meetings.length >= 20) break;
        if (contacted.has(lid) || meetings.some((m) => m.personId === lid)) continue;
        if (rnd() > 0.25) continue;
        const p = E.personById(lid); if (!p) continue;
        meetings.push({ id: "mtg_" + meetId++, personId: lid, companyId: p.companyId, campaignId: camp.id,
          at: now - int(rnd, 3, 45) * DAY, duration: 30, status: "Completed",
          title: `${E.companyById(p.companyId).name} — AI readiness intro` });
        camp.meetings++;
      }
    }

    // ---- suppression -------------------------------------------------
    const suppressions = [];
    conversations.filter((c) => c.intent === "Unsubscribe" || c.intent === "Negative").forEach((c) => {
      const p = E.personById(c.personId);
      suppressions.push({ id: "sup_" + (suppressions.length + 1), type: "Person", value: p.email,
        reason: c.intent === "Unsubscribe" ? "Unsubscribe request" : "Explicit negative reply",
        scope: "Global", at: c.at });
    });
    suppressions.push({ id: "sup_x1", type: "Domain", value: "competitorgroup.com", reason: "Competitor — do not contact", scope: "Global", at: Date.now() - 40 * DAY });

    // ---- agent activity feed ----------------------------------------
    const feed = [
      { state: "OPTIMIZING", text: "Shifted 120 sends from “US Universities” to “Ontario Colleges” — 2.4x better reply rate.", at: now - 40 * 60000 },
      { state: "BOOKING", text: "Proposed three times to a hot lead at a Higher Education account.", at: now - 3 * 3600000 },
      { state: "QUALIFYING", text: "Classified 6 new replies. 2 hot, 1 referral, 1 unsubscribe suppressed.", at: now - 5 * 3600000 },
      { state: "SENDING", text: "Sent 84 personalized openers across 2 active campaigns.", at: now - 9 * 3600000 },
      { state: "WRITING", text: "Generated 84 emails anchored on live company triggers.", at: now - 11 * 3600000 },
      { state: "RESEARCHING", text: "Completed deep research on 31 priority accounts.", at: now - 26 * 3600000 },
      { state: "FINDING LEADS", text: "Added 52 companies and 118 decision-makers matching approved ICPs.", at: now - 30 * 3600000 },
      { state: "ANALYZING", text: "Refreshed ICP fit scores from the last 30 days of reply data.", at: now - 48 * 3600000 },
    ];

    return {
      version: 1,
      profile: D.businessProfile,
      icps: JSON.parse(JSON.stringify(D.icps)),
      campaigns, conversations, meetings, suppressions,
      activity: feed,
      savedSearches: [
        { id: "ss_1", name: "Ontario colleges 200+", query: "colleges in Ontario with more than 200 employees", kind: "companies" },
        { id: "ss_2", name: "EdTech heads of product", query: "heads of product at edtech companies", kind: "people" },
      ],
      lists: [],
      research: {},
      onboarded: true,
      autopilot: true,
      // Usage reflects the seeded activity: one credit per send, four per research report.
      credits: { plan: "Growth", included: 5000,
        used: campaigns.reduce((s, c) => s + c.sent, 0) + 31 * 4,
        emailRate: 0.031, researchRate: 0.12 },
      apiKeys: [{ id: "key_1", name: "Production", prefix: "drd_live_9f2c", created: Date.now() - 60 * DAY, lastUsed: Date.now() - 2 * DAY }],
      webhooks: [{ id: "wh_1", url: "https://edvisingu.app.n8n.cloud/webhook/drd-hot-lead", events: ["lead.hot", "meeting.booked"], active: true }],
      audit: [],
    };
  }
  function int(rnd, lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

  // ---- persistence ---------------------------------------------------
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const w = JSON.parse(raw); if (w && w.version === 1) return w; }
    } catch (e) {}
    const w = build();
    save(w);
    return w;
  }
  function save(w) { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) {} }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} return load(); }

  // ------------------------------------------------------------------
  // Backend mode. When the page is served by the API (config.js supplies a
  // token) the workspace is hydrated from the database instead of localStorage,
  // and mutations are written through to the server.
  // ------------------------------------------------------------------
  const hasApi = () => typeof window !== "undefined" && !!window.DRD_API_TOKEN;

  async function api(method, path, body) {
    const res = await fetch((window.DRD_API_BASE || "") + path, {
      method,
      headers: { "content-type": "application/json", authorization: "Bearer " + window.DRD_API_TOKEN },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error((json && json.error) || ("http_" + res.status));
      err.status = res.status; err.body = json; throw err;
    }
    return json;
  }

  async function hydrate() {
    const [projects, icps, campaigns, convos, meetings, sups, usage, audit, hooks] = await Promise.all([
      api("GET", "/v1/projects"), api("GET", "/v1/icps"), api("GET", "/v1/campaigns"),
      api("GET", "/v1/conversations"), api("GET", "/v1/meetings"), api("GET", "/v1/suppressions"),
      api("GET", "/v1/usage"), api("GET", "/v1/audit"), api("GET", "/v1/webhooks"),
    ]);

    // Lead ids per campaign, so the UI can list and count them.
    const leadSets = await Promise.all(campaigns.data.map((c) =>
      api("GET", "/v1/leads?campaign_id=" + encodeURIComponent(c.id)).then((r) => r.data.map((l) => l.contact_id))));

    const project = projects.data[0] || {};
    const u = usage.data;
    const seedLocal = build(); // reuse the presentational agent feed

    return {
      version: 1, backend: true,
      profile: project.profile || seedLocal.profile,
      icps: icps.data,
      campaigns: campaigns.data.map((c, i) => ({
        id: c.id, name: c.name, icpId: c.icp_id, goal: c.goal, tone: c.tone, status: c.status,
        autopilot: c.autopilot, budget: c.budget, spend: c.spend, sent: c.sent, replies: c.replies,
        positive: c.positive, hot: c.hot, meetings: c.meetings, sequence: c.sequence,
        leadIds: leadSets[i] || [], createdAt: Date.now(),
      })),
      conversations: convos.data.map((c) => ({
        id: c.id, personId: c.contact.id, companyId: c.company.id, campaignId: c.campaign_id,
        subject: c.subject, status: c.status, intent: c.intent || "Neutral",
        intentMeta: Object.assign({ confidence: c.confidence || 0, color: "muted", action: "Review manually", rationale: "" }, c.intent_meta || {}),
        hot: !!c.hot, at: c.last_at, preview: c.preview || "", messages: null, // fetched on open
      })),
      meetings: meetings.data.map((m) => ({
        id: m.id, personId: m.contact.id, companyId: m.company.id, campaignId: m.campaign_id,
        at: m.at, duration: m.duration, status: m.status, title: m.title,
      })),
      suppressions: sups.data.map((s) => ({ id: s.id, type: s.type, value: s.value, reason: s.reason, scope: s.scope, at: s.created_at })),
      activity: seedLocal.activity,
      savedSearches: seedLocal.savedSearches,
      lists: [], research: {},
      onboarded: true,
      autopilot: !!u.autopilot,
      credits: { plan: u.plan, included: u.credits_included, used: u.credits_used, emailRate: 0.031, researchRate: 0.12 },
      apiKeys: seedLocal.apiKeys,
      webhooks: hooks.data,
      audit: audit.data.map((a) => ({ at: a.at, action: a.action, detail: a.detail })),
    };
  }

  // Write-through helpers. Each mirrors a local mutation to the server; the UI
  // already updated optimistically, so a failure surfaces as a toast, not a stall.
  const push = {
    icp: (id, approved) => api("PATCH", "/v1/icps/" + id, { approved }),
    autopilot: (on) => api("PATCH", "/v1/autopilot", { autopilot: on }),
    campaignStatus: (id, status) => api("POST", "/v1/campaigns/" + id + "/" + (status === "Active" ? "start" : "pause")),
    createCampaign: (b) => api("POST", "/v1/campaigns", b),
    addSuppression: (value, reason) => api("POST", "/v1/suppressions", { value, reason }),
    removeSuppression: (id) => api("DELETE", "/v1/suppressions/" + id),
    bookMeeting: (contactId, campaignId) => api("POST", "/v1/meetings", { contact_id: contactId, campaign_id: campaignId }),
    reply: (convId, body) => api("POST", "/v1/conversations/" + convId + "/reply", { body }),
    conversation: (id) => api("GET", "/v1/conversations/" + id),
    research: (companyId) => api("POST", "/v1/research", { company_id: companyId }),
  };

  return { load, save, reset, build, hasApi, hydrate, api, push };
})();
