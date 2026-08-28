/* Dr. D Lead Engineering System — application layer.
 * Router, all module views, drawers, and persistence wiring.
 */
(function () {
  "use strict";
  const D = window.DRD_DATA, E = window.DRD_ENGINE, WS = window.DRD_WORKSPACE;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  let ws = WS.load();
  const state = {
    view: "overview",
    company: { query: "", results: null, criteria: null, sel: new Set(), sort: "score" },
    person: { query: "", results: null, criteria: null, sel: new Set() },
    inbox: { filter: "Need Reply", active: null },
    campaign: null,
    agentBusy: false,
  };

  // ---------------------------------------------------------------- utils
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n) => Number(n || 0).toLocaleString();
  const initials = (n) => String(n).split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  function ago(ts) {
    const d = Date.now() - ts, m = Math.round(d / 60000);
    if (m < 60) return m + "m ago";
    const h = Math.round(m / 60); if (h < 24) return h + "h ago";
    const dd = Math.round(h / 24); return dd + "d ago";
  }
  function dateStr(ts) { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  function timeStr(ts) { return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }
  function save() { if (!ws.backend) WS.save(ws); }

  // Mirror a local mutation to the server. The UI already updated optimistically,
  // so a failure surfaces as a toast rather than blocking the interaction.
  function wt(fn) {
    if (!ws.backend || !fn) return;
    try {
      const p = fn();
      if (p && p.catch) p.catch(function (e) { toast("Server rejected: " + (e.message || "error")); });
    } catch (e) { toast("Server error: " + e.message); }
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.innerHTML = '<span class="d"></span>' + esc(msg);
    $("#toasts").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "0.3s"; setTimeout(() => t.remove(), 320); }, 2800);
  }
  function audit(action, detail) {
    ws.audit.unshift({ at: Date.now(), action, detail });
    ws.audit = ws.audit.slice(0, 200); save();
  }
  function scoreCls(n) { return n >= 82 ? "hi" : n >= 62 ? "mid" : "lo"; }

  // CSV export — uses the hosted downloads capability, falls back to a blob.
  async function exportCSV(filename, rows) {
    const csv = rows.map((r) => r.map((v) => {
      const s = String(v == null ? "" : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\n");
    const dl = window.claude && window.claude.use ? await window.claude.use("downloads").catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename, data: csv }); toast("Exported " + (rows.length - 1) + " rows"); }
      catch (e) {
        if (e && e.code === "extension_not_enabled") {
          try { await dl.save({ filename: filename.replace(/\.csv$/, ".txt"), data: csv }); toast("Exported"); }
          catch (e2) { if (!e2 || e2.code !== "declined") toast("Export unavailable in this view"); }
        } else if (!e || e.code !== "declined") toast("Export unavailable in this view");
      }
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
    toast("Exported " + (rows.length - 1) + " rows");
  }

  // ---------------------------------------------------------------- nav
  const NAV = [
    { g: "Command" },
    { id: "overview", ic: "◆", t: "Overview" },
    { id: "agent", ic: "✦", t: "AI Agent" },
    { g: "Prospecting" },
    { id: "companies", ic: "▣", t: "Companies" },
    { id: "people", ic: "◉", t: "People" },
    { id: "segments", ic: "◈", t: "Segments" },
    { g: "Engagement" },
    { id: "campaigns", ic: "▶", t: "Campaigns" },
    { id: "inbox", ic: "✉", t: "Inbox", badge: () => ws.conversations.filter((c) => c.status === "Need Reply").length },
    { id: "hot", ic: "★", t: "Hot Leads", badge: () => ws.conversations.filter((c) => c.hot).length },
    { id: "meetings", ic: "◷", t: "Meetings" },
    { g: "Operations" },
    { id: "analytics", ic: "▤", t: "Analytics" },
    { id: "data", ic: "⛉", t: "Data & Compliance" },
    { id: "billing", ic: "◐", t: "Billing" },
    { id: "api", ic: "⟨⟩", t: "API" },
    { id: "settings", ic: "⚙", t: "Settings" },
  ];

  function renderNav() {
    $("#nav").innerHTML = NAV.map((n) => {
      if (n.g) return '<div class="group">' + esc(n.g) + "</div>";
      const b = n.badge ? n.badge() : 0;
      return '<button data-nav="' + n.id + '" class="' + (state.view === n.id ? "on" : "") + '">' +
        '<span class="ic">' + n.ic + "</span>" + esc(n.t) +
        (b ? '<span class="badge' + (n.id === "inbox" ? "" : "") + '">' + b + "</span>" : "") + "</button>";
    }).join("");
    $$("#nav button").forEach((b) => (b.onclick = () => go(b.dataset.nav)));

    const c = ws.credits;
    const pct = Math.min(100, Math.round((c.used / c.included) * 100));
    $("#sidefoot").innerHTML =
      '<div class="plan"><div class="row"><span>' + esc(c.plan) + " plan</span><b>" + pct + '%</b></div>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="row"><span class="num">' + num(c.used) + " / " + num(c.included) + "</span><span>credits</span></div></div>";
  }

  function go(view) {
    state.view = view;
    renderNav();
    const t = NAV.find((n) => n.id === view);
    $("#ptitle").textContent = t ? t.t : view;
    const fn = VIEWS[view];
    $("#page").innerHTML = fn ? fn() : '<div class="empty">Not found</div>';
    if (WIRE[view]) WIRE[view]();
    window.scrollTo(0, 0);
  }

  // ================================================================ VIEWS
  const VIEWS = {};
  const WIRE = {};

  // ---------------------------------------------------------- OVERVIEW
  VIEWS.overview = function () {
    const a = E.analytics(ws);
    const hot = ws.conversations.filter((c) => c.hot).slice(0, 5);
    const upcoming = ws.meetings.filter((m) => m.at > Date.now()).sort((x, y) => x.at - y.at).slice(0, 4);
    const companiesFound = ws.campaigns.reduce((s, c) => s + new Set(c.leadIds.map((id) => (E.personById(id) || {}).companyId)).size, 0);

    return '<div class="page-head"><div>' +
      "<h2>Your AI sales department, at a glance</h2>" +
      "<p>What the agent did, who replied, who is hot, and what it is learning.</p>" +
      '</div><div class="head-actions">' +
      '<button class="btn ghost" data-act="run-agent">✦ Run agent cycle</button>' +
      '<button class="btn" data-nav2="campaigns">View campaigns</button></div></div>' +

      '<div class="stats">' +
      tile("Companies found", num(companiesFound), "across active ICPs") +
      tile("People contacted", num(a.sent), "personalized sends") +
      tile("Replies", num(a.replies), a.replyRate + "% reply rate") +
      tile("Hot leads", num(ws.conversations.filter((c) => c.hot).length), "meaningful interest", true) +
      tile("Meetings booked", num(ws.meetings.length), "confirmed + completed") +
      tile("Spend", money(a.spend), a.costPerMeeting ? money(a.costPerMeeting) + " / meeting" : "—") +
      "</div>" +

      '<div class="split">' +
        '<div class="stack">' +
          '<div class="card"><div class="card-h"><h3>What the agent is doing</h3>' +
            '<span class="grow"></span><span class="pill ' + (ws.autopilot ? "good" : "muted") + '">Autopilot ' + (ws.autopilot ? "ON" : "OFF") + "</span></div>" +
            '<div class="card-b"><div class="feed">' +
              ws.activity.slice(0, 7).map((f) =>
                '<div class="it"><div class="st">' + esc(f.state) + "</div>" +
                '<div><div class="tx">' + esc(f.text) + '</div><div class="tm">' + ago(f.at) + "</div></div></div>").join("") +
            "</div></div></div>" +

          '<div class="card"><div class="card-h"><h3>Campaign performance</h3></div><div class="card-b"><div class="bars">' +
            a.byCampaign.filter((c) => c.sent).map((c) => {
              const max = Math.max.apply(null, a.byCampaign.map((x) => x.replyRate).concat([1]));
              return '<div class="b"><div><div class="lbl">' + esc(c.name) + " · " + num(c.sent) + " sent</div>" +
                '<div class="track"><i style="width:' + Math.round((c.replyRate / max) * 100) + '%"></i></div></div>' +
                '<div class="val">' + c.replyRate + "%</div></div>";
            }).join("") +
          "</div></div></div>" +
        "</div>" +

        '<div class="stack">' +
          '<div class="card"><div class="card-h"><h3>What it is learning</h3></div><div class="card-b stack">' +
            a.insights.map((i) => '<div style="font-size:12.5px;color:var(--muted);display:flex;gap:9px"><span style="color:var(--gold)">▸</span><span>' + esc(i) + "</span></div>").join("") +
          "</div></div>" +

          '<div class="card"><div class="card-h"><h3>Hot leads</h3><span class="grow"></span>' +
            '<button class="btn ghost sm" data-nav2="hot">All</button></div><div class="card-b stack">' +
            (hot.length ? hot.map((c) => {
              const p = E.personById(c.personId), co = E.companyById(c.companyId);
              return '<div class="rowflex" style="justify-content:space-between;gap:8px">' +
                "<div><div style=\"font-size:13px;font-weight:600\">" + esc(p.name) + "</div>" +
                '<div style="font-size:11.5px;color:var(--faint)">' + esc(co.name) + "</div></div>" +
                '<span class="pill good">' + esc(c.intent) + "</span></div>";
            }).join("") : '<div style="color:var(--faint);font-size:12.5px">No hot leads yet.</div>') +
          "</div></div>" +

          '<div class="card"><div class="card-h"><h3>Upcoming meetings</h3></div><div class="card-b stack">' +
            (upcoming.length ? upcoming.map((m) => {
              const co = E.companyById(m.companyId), p = E.personById(m.personId);
              return '<div><div style="font-size:12.5px;font-weight:600">' + esc(co.name) + "</div>" +
                '<div style="font-size:11.5px;color:var(--faint)">' + esc(p.name) + " · " + timeStr(m.at) + "</div></div>";
            }).join("") : '<div style="color:var(--faint);font-size:12.5px">Nothing scheduled.</div>') +
          "</div></div>" +
        "</div>" +
      "</div>";
  };
  function tile(k, v, d, accent) {
    return '<div class="stat' + (accent ? " accent" : "") + '"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div><div class="d">' + esc(d) + "</div></div>";
  }
  WIRE.overview = function () {
    $$("[data-nav2]").forEach((b) => (b.onclick = () => go(b.dataset.nav2)));
    const r = $("[data-act='run-agent']"); if (r) r.onclick = runAgentCycle;
  };

  // Simulate one autonomous agent cycle: find → research → write → send.
  function runAgentCycle() {
    if (state.agentBusy) return;
    state.agentBusy = true;
    const steps = [
      ["ANALYZING", "Re-scored approved ICPs against the last 30 days of reply data."],
      ["FINDING LEADS", "Added " + (8 + Math.floor(Math.random() * 20)) + " companies matching your top ICP."],
      ["RESEARCHING", "Completed deep research on " + (4 + Math.floor(Math.random() * 9)) + " priority accounts."],
      ["WRITING", "Generated personalized openers anchored on live triggers."],
      ["SENDING", "Queued sends within your daily limit."],
    ];
    let i = 0;
    toast("Agent cycle started");
    const tick = () => {
      if (i >= steps.length) {
        state.agentBusy = false;
        audit("agent.cycle", "Completed one autonomous cycle");
        toast("Agent cycle complete");
        if (state.view === "overview" || state.view === "agent") go(state.view);
        return;
      }
      const s = steps[i++];
      ws.activity.unshift({ state: s[0], text: s[1], at: Date.now() });
      ws.activity = ws.activity.slice(0, 40);
      const cnt = ws.campaigns.filter((c) => c.status === "Active").length;
      if (s[0] === "SENDING" && cnt) {
        ws.campaigns.filter((c) => c.status === "Active").forEach((c) => { c.sent += 6; c.spend = +(c.spend + 6 * ws.credits.emailRate).toFixed(2); });
        ws.credits.used += 6 * cnt;
      }
      save();
      if (state.view === "overview" || state.view === "agent") { go(state.view); }
      setTimeout(tick, 620);
    };
    setTimeout(tick, 300);
  }

  // ------------------------------------------------------------- AGENT
  VIEWS.agent = function () {
    const p = ws.profile;
    return '<div class="page-head"><div><h2>AI Agent</h2>' +
      "<p>What the agent understands about your business, the markets it selected, and how much control it has.</p></div>" +
      '<div class="head-actions"><button class="btn ghost" data-act="reanalyze">↻ Re-analyze website</button>' +
      '<button class="btn" data-act="run-agent">✦ Run agent cycle</button></div></div>' +

      '<div class="card pad" style="margin-bottom:16px">' +
        '<div class="rowflex" style="justify-content:space-between">' +
          "<div><div class=\"label\">Autonomy</div>" +
          '<div style="font-size:14px;margin-top:4px">Autopilot lets the agent prioritize campaigns, allocate volume and adjust budgets on its own.</div></div>' +
          '<label class="toggle"><input type="checkbox" id="autopilot" ' + (ws.autopilot ? "checked" : "") + '><span class="tr"></span>' +
          "<span>" + (ws.autopilot ? "On" : "Off") + "</span></label>" +
        "</div>" +
      "</div>" +

      '<div class="split">' +
        '<div class="card"><div class="card-h"><h3>AI understanding of your business</h3>' +
          '<span class="grow"></span><span class="pill gold">Editable</span></div><div class="card-b">' +
          '<div class="kv" style="margin-bottom:18px">' +
            kv("Website", p.website) + kv("Company", p.company) +
            kv("Industry", p.industry) + kv("Geography", p.geography) +
            kv("Product", p.product) + kv("Likely buyer", p.likelyBuyer) +
          "</div>" +
          '<div class="sec"><span class="label">Target customer</span><div style="font-size:13px;color:var(--muted)">' + esc(p.targetCustomer) + "</div></div>" +
          '<div class="sec"><span class="label">Pain points it will write about</span><div class="chips">' + p.painPoints.map((x) => '<span class="chip">' + esc(x) + "</span>").join("") + "</div></div>" +
          '<div class="sec"><span class="label">Use cases</span><div class="chips">' + p.useCases.map((x) => '<span class="chip">' + esc(x) + "</span>").join("") + "</div></div>" +
          '<div class="sec"><span class="label">Differentiators</span><div class="chips">' + p.differentiators.map((x) => '<span class="chip">' + esc(x) + "</span>").join("") + "</div></div>" +
        "</div></div>" +

        '<div class="card"><div class="card-h"><h3>Agent state</h3></div><div class="card-b">' +
          '<div class="feed">' + ws.activity.slice(0, 9).map((f) =>
            '<div class="it"><div class="st">' + esc(f.state) + '</div><div><div class="tx">' + esc(f.text) + '</div><div class="tm">' + ago(f.at) + "</div></div></div>").join("") +
          "</div></div></div>" +
      "</div>" +

      '<div class="card" style="margin-top:16px"><div class="card-h"><h3>ICP hypotheses</h3>' +
        '<span class="grow"></span><span style="font-size:12px;color:var(--faint)">' + ws.icps.filter((i) => i.approved).length + " of " + ws.icps.length + " approved</span></div>" +
        '<div class="card-b stack">' +
          ws.icps.map((i) =>
            '<div class="icp-card ' + (i.approved ? "on" : "") + '"><div>' +
              '<div class="rowflex"><h4>' + esc(i.name) + '</h4><span class="pill ' + (i.fit >= 85 ? "gold" : "muted") + '">Fit ' + i.fit + "</span></div>" +
              '<div class="why">' + esc(i.why) + "</div>" +
              '<div class="chips" style="margin-top:9px">' + i.buyers.map((b) => '<span class="chip">' + esc(b) + "</span>").join("") + "</div>" +
            "</div>" +
            '<div style="display:flex;flex-direction:column;gap:6px">' +
              '<button class="btn sm ' + (i.approved ? "ghost" : "") + '" data-icp="' + i.id + '">' + (i.approved ? "✓ Approved" : "Approve") + "</button>" +
              '<button class="btn ghost sm" data-icpsearch="' + i.id + '">Find companies</button>' +
            "</div></div>").join("") +
        "</div></div>";
  };
  function kv(k, v) { return '<div><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + "</div></div>"; }
  WIRE.agent = function () {
    $("#autopilot").onchange = (e) => { ws.autopilot = e.target.checked; save(); wt(function () { return WS.push.autopilot(ws.autopilot); }); audit("autopilot", ws.autopilot ? "enabled" : "disabled"); toast("Autopilot " + (ws.autopilot ? "on" : "off")); go("agent"); };
    const r = $("[data-act='run-agent']"); if (r) r.onclick = runAgentCycle;
    const ra = $("[data-act='reanalyze']"); if (ra) ra.onclick = () => {
      ws.activity.unshift({ state: "ANALYZING", text: "Re-analyzed " + ws.profile.website + " and refreshed the business profile.", at: Date.now() });
      save(); toast("Website re-analyzed"); go("agent");
    };
    $$("[data-icp]").forEach((b) => (b.onclick = () => {
      const i = ws.icps.find((x) => x.id === b.dataset.icp);
      i.approved = !i.approved; save(); wt(function () { return WS.push.icp(i.id, i.approved); }); audit("icp." + (i.approved ? "approved" : "rejected"), i.name);
      toast(i.name + (i.approved ? " approved" : " rejected")); go("agent");
    }));
    $$("[data-icpsearch]").forEach((b) => (b.onclick = () => {
      const i = ws.icps.find((x) => x.id === b.dataset.icpsearch);
      const q = [i.industry, i.country ? "in " + i.country : "", i.sizeMin ? "over " + i.sizeMin + " employees" : ""].filter(Boolean).join(" ");
      state.company.query = q; state.company.results = null;
      go("companies"); setTimeout(() => runCompanySearch(q, i), 30);
    }));
  };

  // --------------------------------------------------------- COMPANIES
  VIEWS.companies = function () {
    const r = state.company.results;
    return '<div class="page-head"><div><h2>Company search</h2>' +
      "<p>Describe the accounts you want in plain language. The agent converts it into structured criteria.</p></div>" +
      (r ? '<div class="head-actions">' +
        '<button class="btn ghost" data-act="exp-co">⬇ Export CSV</button>' +
        '<button class="btn" data-act="add-camp">＋ Add selected to campaign</button></div>' : "") +
      "</div>" +
      '<div class="searchbar"><span class="ic">⌕</span>' +
      '<input id="coq" value="' + esc(state.company.query) + '" placeholder="e.g. Canadian colleges with more than 200 employees that use Canvas LMS" />' +
      '<button class="btn" id="cogo">Search ✦</button></div>' +
      (r ? "" : '<div class="examples">' + [
        "Ontario colleges with more than 200 employees",
        "EdTech companies in Canada that use HubSpot",
        "Corporate training teams over 500 employees hiring AI roles",
        "Recently funded EdTech companies",
        "Professional services firms in the UK under 100 employees",
      ].map((q) => '<button data-ex="' + esc(q) + '">' + esc(q) + "</button>").join("") + "</div>") +
      '<div id="cores">' + (r ? companyResults() : emptySearch("companies")) + "</div>";
  };
  function emptySearch(kind) {
    return '<div class="empty"><div class="big">⌕</div><b>Describe your ideal ' + kind.slice(0, -1) + " profile</b>" +
      "<div>The agent parses geography, size, industry, technology and buying signals from plain language.</div></div>";
  }
  function companyResults() {
    const { results, criteria } = state.company;
    const sel = state.company.sel;
    return critBar(criteria, results.length, "companies") +
      (results.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        '<th style="width:34px"></th><th>Company</th><th>Industry</th><th>Location</th><th class="right">Size</th>' +
        "<th>Signals</th><th class=\"right\">Contacts</th><th class='right'>Fit</th></tr></thead><tbody>" +
        results.slice(0, 60).map((c) =>
          '<tr data-co="' + c.id + '">' +
          '<td><input type="checkbox" class="checkbox" data-selco="' + c.id + '" ' + (sel.has(c.id) ? "checked" : "") + "></td>" +
          '<td><div class="prime">' + esc(c.name) + '</div><div class="sub">' + esc(c.domain) + "</div></td>" +
          "<td>" + esc(c.industry) + '<div class="sub">' + esc(c.sub) + "</div></td>" +
          "<td>" + esc(c.city) + '<div class="sub">' + esc(c.country) + "</div></td>" +
          '<td class="right num">' + num(c.size) + "</td>" +
          '<td>' + (c.signals.length ? '<span class="pill warn">' + esc(c.signals[0]) + "</span>" + (c.signals.length > 1 ? ' <span class="chip">+' + (c.signals.length - 1) + "</span>" : "") : '<span style="color:var(--faint)">—</span>') + "</td>" +
          '<td class="right num">' + c.contactCount + "</td>" +
          '<td class="right"><span class="score ' + scoreCls(c._score) + '"><b>' + c._score + "</b><span>/100</span></span></td>" +
          "</tr>").join("") +
        "</tbody></table></div>" : '<div class="empty"><div class="big">∅</div><b>No companies match</b><div>Loosen a constraint — size and geography are the usual culprits.</div></div>');
  }
  function critBar(c, n, kind) {
    const t = [];
    c.industries.forEach((i) => t.push(crit("industry", i)));
    if (c.country) t.push(crit("country", c.country));
    if (c.region) t.push(crit("region", c.region));
    if (c.city) t.push(crit("city", c.city));
    if (c.sizeMin != null && c.sizeMax != null) t.push(crit("size", c.sizeMin + "–" + c.sizeMax));
    else if (c.sizeMin != null) t.push(crit("size", "≥ " + c.sizeMin));
    else if (c.sizeMax != null) t.push(crit("size", "≤ " + c.sizeMax));
    c.tech.forEach((x) => t.push(crit("tech", x)));
    c.signals.forEach((x) => t.push(crit("signal", x)));
    c.seniority.forEach((x) => t.push(crit("seniority", x)));
    c.departments.forEach((x) => t.push(crit("dept", x)));
    if (c.funded) t.push(crit("funding", "raised"));
    return '<div class="criteria"><span class="label" style="margin-right:2px">AI parsed</span>' + (t.join("") || '<span class="chip">broad match</span>') +
      '<span class="grow"></span><span style="font-size:12.5px;color:var(--muted)"><b style="color:var(--white)">' + num(n) + "</b> " + kind + "</span></div>";
  }
  function crit(k, v) { return '<span class="crit"><i>' + esc(k) + "</i>" + esc(v) + "</span>"; }

  function runCompanySearch(q, icp) {
    state.company.query = q;
    $("#cores").innerHTML = '<div class="loading"><div class="spin"></div>Scanning the company graph…</div>';
    setTimeout(() => {
      const out = E.searchCompanies(q, { icp: icp || null });
      state.company.results = out.results; state.company.criteria = out.criteria; state.company.sel = new Set();
      go("companies");
    }, 480);
  }
  WIRE.companies = function () {
    const inp = $("#coq");
    const run = () => { const q = inp.value.trim(); if (q) runCompanySearch(q); };
    $("#cogo").onclick = run;
    inp.onkeydown = (e) => { if (e.key === "Enter") run(); };
    $$("[data-ex]").forEach((b) => (b.onclick = () => { inp.value = b.dataset.ex; run(); }));
    $$("[data-co]").forEach((tr) => (tr.onclick = (e) => { if (e.target.closest("input")) return; openCompany(tr.dataset.co); }));
    $$("[data-selco]").forEach((cb) => (cb.onclick = (e) => {
      e.stopPropagation();
      cb.checked ? state.company.sel.add(cb.dataset.selco) : state.company.sel.delete(cb.dataset.selco);
    }));
    const ex = $("[data-act='exp-co']");
    if (ex) ex.onclick = () => {
      const rows = [["Company", "Domain", "Industry", "Sub-industry", "City", "Country", "Employees", "Revenue", "Founded", "Technologies", "Signals", "Contacts", "Fit score", "Why"]];
      state.company.results.forEach((c) => rows.push([c.name, c.domain, c.industry, c.sub, c.city, c.country, c.size, c.revenue, c.founded, c.tech.join(" | "), c.signals.join(" | "), c.contactCount, c._score, c._reason]));
      exportCSV("drd-companies.csv", rows);
    };
    const ac = $("[data-act='add-camp']");
    if (ac) ac.onclick = () => addSelectedToCampaign();
  };

  function addSelectedToCampaign() {
    const ids = Array.from(state.company.sel);
    if (!ids.length) { toast("Select companies first"); return; }
    const target = ws.campaigns.find((c) => c.status === "Draft") || ws.campaigns[0];
    let added = 0;
    ids.forEach((cid) => (D.peopleByCompany[cid] || []).slice(0, 2).forEach((p) => {
      if (!target.leadIds.includes(p.id)) { target.leadIds.push(p.id); added++; }
    }));
    save(); audit("campaign.leads_added", added + " leads → " + target.name);
    toast("Added " + added + " leads to " + target.name);
  }

  // ------------------------------------------------------------ PEOPLE
  VIEWS.people = function () {
    const r = state.person.results;
    return '<div class="page-head"><div><h2>People search</h2>' +
      "<p>Find the decision-makers inside those accounts by role, seniority, function and geography.</p></div>" +
      (r ? '<div class="head-actions"><button class="btn ghost" data-act="exp-pe">⬇ Export CSV</button></div>' : "") + "</div>" +
      '<div class="searchbar"><span class="ic">⌕</span>' +
      '<input id="peq" value="' + esc(state.person.query) + '" placeholder="e.g. VP Academic at Canadian colleges over 200 employees" />' +
      '<button class="btn" id="pego">Search ✦</button></div>' +
      (r ? "" : '<div class="examples">' + [
        "Directors of teaching and learning at Ontario colleges",
        "Heads of L&D at companies over 500 employees",
        "CEOs at EdTech companies in Canada",
        "Managing partners at professional services firms",
      ].map((q) => '<button data-ex2="' + esc(q) + '">' + esc(q) + "</button>").join("") + "</div>") +
      '<div id="peres">' + (r ? peopleResults() : emptySearch("people")) + "</div>";
  };
  function peopleResults() {
    const { results, criteria } = state.person;
    return critBar(criteria, results.length, "people") +
      (results.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
        "<th>Person</th><th>Title</th><th>Company</th><th>Location</th><th>Email</th><th class='right'>Fit</th></tr></thead><tbody>" +
        results.slice(0, 60).map((p) =>
          '<tr data-pe="' + p.id + '">' +
          '<td><div class="prime">' + esc(p.name) + '</div><div class="sub">' + esc(p.seniority) + " · " + esc(p.department) + "</div></td>" +
          "<td>" + esc(p.title) + "</td>" +
          '<td><div class="prime">' + esc(p.company.name) + '</div><div class="sub">' + num(p.company.size) + " emp · " + esc(p.company.industry) + "</div></td>" +
          "<td>" + esc(p.city) + '<div class="sub">' + esc(p.country) + "</div></td>" +
          '<td><div style="font-size:12px">' + esc(p.email) + "</div>" +
          '<span class="pill ' + (p.emailStatus === "Verified" ? "good" : p.emailStatus === "Catch-all" ? "warn" : "muted") + '">' + esc(p.emailStatus) + "</span></td>" +
          '<td class="right"><span class="score ' + scoreCls(p._score) + '"><b>' + p._score + "</b><span>/100</span></span></td>" +
          "</tr>").join("") + "</tbody></table></div>"
        : '<div class="empty"><div class="big">∅</div><b>No people match</b><div>Try a broader title or drop the seniority filter.</div></div>');
  }
  WIRE.people = function () {
    const inp = $("#peq");
    const run = () => {
      const q = inp.value.trim(); if (!q) return;
      state.person.query = q;
      $("#peres").innerHTML = '<div class="loading"><div class="spin"></div>Searching contact graph…</div>';
      setTimeout(() => {
        const out = E.searchPeople(q);
        state.person.results = out.results; state.person.criteria = out.criteria;
        go("people");
      }, 460);
    };
    $("#pego").onclick = run;
    inp.onkeydown = (e) => { if (e.key === "Enter") run(); };
    $$("[data-ex2]").forEach((b) => (b.onclick = () => { inp.value = b.dataset.ex2; run(); }));
    $$("[data-pe]").forEach((tr) => (tr.onclick = () => openPerson(tr.dataset.pe)));
    const ex = $("[data-act='exp-pe']");
    if (ex) ex.onclick = () => {
      const rows = [["Name", "Title", "Seniority", "Department", "Company", "Domain", "Industry", "Employees", "City", "Country", "Email", "Email status", "Phone", "LinkedIn", "Fit score"]];
      state.person.results.forEach((p) => rows.push([p.name, p.title, p.seniority, p.department, p.company.name, p.company.domain, p.company.industry, p.company.size, p.city, p.country, p.email, p.emailStatus, p.phone || "", "linkedin.com/" + p.linkedin, p._score]));
      exportCSV("drd-people.csv", rows);
    };
  };

  // ---------------------------------------------------------- SEGMENTS
  VIEWS.segments = function () {
    const segs = E.segments();
    const max = Math.max.apply(null, segs.map((s) => s.companies));
    return '<div class="page-head"><div><h2>Segments explorer</h2>' +
      "<p>Market clusters in your reachable graph, sized and scored so you can see where the addressable volume actually is.</p></div></div>" +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Segment</th><th>Volume</th>' +
      "<th class='right'>Companies</th><th class='right'>People</th><th class='right'>Avg size</th><th>Top market</th>" +
      "<th class='right'>Email coverage</th><th class='right'>Signal rate</th><th class='right'>Fit</th></tr></thead><tbody>" +
      segs.map((s) =>
        '<tr data-seg="' + esc(s.name) + '">' +
        '<td><div class="prime">' + esc(s.name) + "</div>" + (s.icp ? '<div class="sub">ICP: ' + esc(s.icp.name) + "</div>" : "") + "</td>" +
        '<td style="min-width:120px"><div class="track" style="height:7px;background:var(--navy-600);border-radius:5px;overflow:hidden">' +
          '<i style="display:block;height:100%;width:' + Math.round((s.companies / max) * 100) + '%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));border-radius:5px"></i></div></td>' +
        '<td class="right num">' + num(s.companies) + "</td>" +
        '<td class="right num">' + num(s.people) + "</td>" +
        '<td class="right num">' + num(s.avgSize) + "</td>" +
        "<td>" + esc(s.topCountry) + "</td>" +
        '<td class="right num">' + s.coverage + "%</td>" +
        '<td class="right num">' + s.signalRate + "%</td>" +
        '<td class="right"><span class="score ' + scoreCls(s.fit) + '"><b>' + Math.round(s.fit) + "</b><span>/100</span></span></td>" +
        "</tr>").join("") + "</tbody></table></div>" +
      '<div style="font-size:12px;color:var(--faint);margin-top:12px">Email coverage = share of contacts with a verified address. Signal rate = share of companies showing a public buying trigger.</div>';
  };
  WIRE.segments = function () {
    $$("[data-seg]").forEach((tr) => (tr.onclick = () => {
      state.company.query = tr.dataset.seg + " companies";
      go("companies"); setTimeout(() => runCompanySearch(tr.dataset.seg + " companies"), 30);
    }));
  };

  // --------------------------------------------------------- CAMPAIGNS
  VIEWS.campaigns = function () {
    return '<div class="page-head"><div><h2>Campaigns</h2>' +
      "<p>Each campaign runs one ICP through a personalized sequence. Autopilot can allocate volume and budget between them.</p></div>" +
      '<div class="head-actions"><button class="btn" data-act="new-camp">＋ New campaign</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campaign</th><th>Status</th><th class="right">Leads</th>' +
      '<th class="right">Sent</th><th class="right">Replies</th><th class="right">Hot</th><th class="right">Meetings</th>' +
      '<th class="right">Spend</th><th>Autopilot</th></tr></thead><tbody>' +
      ws.campaigns.map((c) =>
        '<tr data-camp="' + c.id + '">' +
        '<td><div class="prime">' + esc(c.name) + '</div><div class="sub">' + esc(c.goal) + "</div></td>" +
        '<td><span class="pill ' + (c.status === "Active" ? "good" : c.status === "Paused" ? "warn" : "muted") + '">' + esc(c.status) + "</span></td>" +
        '<td class="right num">' + num(c.leadIds.length) + "</td>" +
        '<td class="right num">' + num(c.sent) + "</td>" +
        '<td class="right num">' + num(c.replies) + (c.sent ? '<div class="sub">' + (c.replies / c.sent * 100).toFixed(1) + "%</div>" : "") + "</td>" +
        '<td class="right num">' + num(c.hot) + "</td>" +
        '<td class="right num">' + num(c.meetings) + "</td>" +
        '<td class="right num">' + money(c.spend) + '<div class="sub">of ' + money(c.budget) + "</div></td>" +
        "<td>" + (c.autopilot ? '<span class="pill gold">Auto</span>' : '<span class="pill muted">Manual</span>') + "</td>" +
        "</tr>").join("") + "</tbody></table></div>";
  };
  WIRE.campaigns = function () {
    $$("[data-camp]").forEach((tr) => (tr.onclick = () => openCampaign(tr.dataset.camp)));
    $("[data-act='new-camp']").onclick = () => {
      const approved = ws.icps.filter((i) => i.approved);
      const icp = approved[0] || ws.icps[0];
      const c = { id: "cmp_" + (ws.campaigns.length + 1) + "_" + Date.now().toString(36),
        name: icp.name + " — new campaign", icpId: icp.id, goal: "Book a short call", tone: "consultative",
        status: "Draft", autopilot: false, budget: 300, spend: 0, leadIds: [], sent: 0, replies: 0, positive: 0, hot: 0, meetings: 0,
        createdAt: Date.now(), sequence: [{ step: 1, day: 0, label: "Personalized opener" }, { step: 2, day: 3, label: "Follow-up" }, { step: 3, day: 8, label: "Close the loop" }] };
      ws.campaigns.push(c); save(); audit("campaign.created", c.name);
      toast("Campaign created"); go("campaigns"); openCampaign(c.id);
    };
  };

  // ------------------------------------------------------------- INBOX
  VIEWS.inbox = function () {
    const filters = ["Need Reply", "Replied", "All"];
    const list = inboxList();
    if (!state.inbox.active && list.length) state.inbox.active = list[0].id;
    const act = ws.conversations.find((c) => c.id === state.inbox.active) || list[0];
    return '<div class="page-head"><div><h2>Inbox</h2>' +
      "<p>Every reply is classified by intent, given a recommended action, and routed. Compliance intents suppress automatically.</p></div>" +
      '<div class="head-actions">' + filters.map((f) =>
        '<button class="btn ' + (state.inbox.filter === f ? "" : "ghost") + ' sm" data-fil="' + f + '">' + f + "</button>").join("") + "</div></div>" +
      '<div class="inbox"><div class="thread-list">' +
        (list.length ? list.map((c) => {
          const p = E.personById(c.personId), co = E.companyById(c.companyId);
          const last = c.messages && c.messages.length ? c.messages[c.messages.length - 1] : { text: c.preview || "" };
          return '<div class="thread ' + (act && c.id === act.id ? "on" : "") + '" data-th="' + c.id + '">' +
            '<div class="t1"><span class="nm">' + esc(p.name) + '</span><span class="grow"></span>' +
            '<span class="pill ' + c.intentMeta.color + '">' + esc(c.intent) + "</span></div>" +
            '<div class="co">' + esc(co.name) + " · " + ago(c.at) + "</div>" +
            '<div class="pv">' + esc(last.text.slice(0, 120)) + "</div></div>";
        }).join("") : '<div class="empty" style="padding:40px 16px"><b>Nothing here</b><div>No conversations match this filter.</div></div>') +
      "</div>" +
      '<div class="thread-view">' + (act ? threadView(act) : '<div class="empty"><b>Select a conversation</b></div>') + "</div></div>";
  };
  // A conversation's messages load lazily in backend mode, so anything that
  // needs the latest text falls back to the preview the list endpoint returns.
  function lastText(c) {
    if (c.messages && c.messages.length) return c.messages[c.messages.length - 1].text;
    return c.preview || "";
  }

  function inboxList() {
    let l = ws.conversations.slice().sort((a, b) => b.at - a.at);
    if (state.inbox.filter === "Need Reply") l = l.filter((c) => c.status === "Need Reply");
    if (state.inbox.filter === "Replied") l = l.filter((c) => c.status === "Replied");
    return l;
  }
  function threadView(c) {
    if (c.messages === null) return '<div class="loading"><div class="spin"></div>Loading conversation\u2026</div>';
    const p = E.personById(c.personId), co = E.companyById(c.companyId);
    const m = c.intentMeta;
    const camp = ws.campaigns.find((x) => x.id === c.campaignId);
    const booked = ws.meetings.find((x) => x.personId === c.personId);
    return '<div class="rowflex" style="justify-content:space-between;margin-bottom:14px">' +
      "<div><div style=\"font-size:16px;font-weight:700\">" + esc(p.name) + "</div>" +
      '<div style="font-size:12.5px;color:var(--muted)">' + esc(p.title) + " · " + esc(co.name) + "</div>" +
      '<div style="font-size:11.5px;color:var(--faint)">' + esc(p.email) + (camp ? " · " + esc(camp.name) : "") + "</div></div>" +
      '<button class="btn ghost sm" data-open-co="' + co.id + '">View account</button></div>' +

      '<div class="card pad" style="margin-bottom:14px">' +
        '<div class="rowflex" style="justify-content:space-between;margin-bottom:10px">' +
          '<span class="label">Reply intelligence</span>' +
          '<span class="pill ' + m.color + '">' + esc(c.intent) + " · " + m.confidence + "% confidence</span></div>" +
        '<div style="font-size:12.5px;color:var(--muted);margin-bottom:10px">' + esc(m.rationale) + "</div>" +
        '<div class="label" style="margin-bottom:5px">Recommended action</div>' +
        '<div style="font-size:13px;color:var(--white)">' + esc(m.action) + "</div>" +
        (booked ? '<div style="margin-top:10px"><span class="pill good">Meeting ' + esc(booked.status.toLowerCase()) + " · " + timeStr(booked.at) + "</span></div>" : "") +
      "</div>" +

      c.messages.map((msg) =>
        '<div class="msg ' + (msg.dir === "in" ? "in" : "") + '"><div class="mh">' +
        '<span class="who2">' + (msg.dir === "in" ? esc(p.name) : "You (AI-generated)") + "</span>" +
        '<span class="when">' + timeStr(msg.at) + "</span></div><pre>" + esc(msg.text) + "</pre></div>").join("") +

      '<div class="card pad" style="margin-top:6px">' +
        '<div class="label" style="margin-bottom:8px">AI reply draft</div>' +
        '<textarea class="ta" id="replybox">' + esc(draftReply(c, p, co)) + "</textarea>" +
        '<div class="rowflex" style="margin-top:10px">' +
          '<button class="btn" data-send="' + c.id + '">Send reply</button>' +
          '<button class="btn ghost" data-book="' + c.id + '">◷ Book meeting</button>' +
          '<button class="btn ghost" data-regen="' + c.id + '">✦ Regenerate</button>' +
          '<span class="grow"></span>' +
          '<button class="btn danger sm" data-supp="' + c.id + '">Suppress</button>' +
        "</div>" +
        (m.autoReplySafe ? '<div style="font-size:11.5px;color:var(--good);margin-top:9px">✓ Safe for autopilot to send without review.</div>'
          : '<div style="font-size:11.5px;color:var(--warn);margin-top:9px">⚠ Held for human review — autopilot will not send this one.</div>') +
      "</div>";
  }
  function draftReply(c, p, co) {
    const first = p.name.split(" ")[0];
    switch (c.intent) {
      case "Meeting Request": return "Hi " + first + ",\n\nGreat — I'll send an invite. Two options:\n\n• Tuesday 10:00–10:30\n• Thursday 14:00–14:30\n\nReply with whichever suits and I'll confirm. I'll come with a one-page outline of how the readiness audit runs at an institution your size.\n\n— Andre";
      case "Pricing": return "Hi " + first + ",\n\nHappy to give you real numbers rather than a range.\n\nFor a group of your size the readiness audit typically runs three weeks and produces a board-ready findings document plus a faculty adoption plan. Training cohorts are priced per participant with a floor.\n\nQuickest path is 15 minutes to scope it properly — do you have time this week?\n\n— Andre";
      case "Interested": return "Hi " + first + ",\n\nGlad it landed. The usual starting point is a short readiness audit: I look at your current policy position, where staff actually are, and what the gaps mean for assessment.\n\nOutput is a document you can take to a board, not a slide deck.\n\nWorth 15 minutes to see whether it fits?\n\n— Andre";
      case "Question": return "Hi " + first + ",\n\nFair question, and it's the right one to ask.\n\nThe work covers both: the policy position and the practical adoption path behind it. Most institutions have the first and not the second, which is where the inconsistency shows up.\n\nHappy to walk through how that's structured — 15 minutes?\n\n— Andre";
      case "Referral": return "Hi " + first + ",\n\nThank you — that's helpful. I'll reach out directly.\n\nIf it's easier, feel free to forward this thread along with any context you think matters.\n\nAppreciate the pointer.\n\n— Andre";
      case "Not Now": return "Hi " + first + ",\n\nCompletely understood, and thanks for the straight answer.\n\nI'll follow up when your budget cycle reopens. If anything shifts before then, my line is open.\n\n— Andre";
      case "Objection": return "Hi " + first + ",\n\nThat's reasonable — an internal working group is the right first move.\n\nWhere I usually add value is after that: turning the group's position into something faculty actually apply consistently. If the group stalls on adoption, that's the moment to talk.\n\nI'll leave it with you.\n\n— Andre";
      case "Out of Office": return "(Auto-snoozed — the agent will resume this thread after the return date. No reply sent.)";
      case "Wrong Person": return "Hi " + first + ",\n\nApologies for the misdirect, and thanks for flagging it.\n\nCould you point me to whoever owns this file? I'll take you off this thread either way.\n\n— Andre";
      case "Unsubscribe": case "Negative": return "(No reply will be sent. This contact is suppressed permanently.)";
      default: return "Hi " + first + ",\n\nThanks for coming back to me. Just so I use your time well — is this something you're actively looking at, or better parked for later?\n\n— Andre";
    }
  }
  WIRE.inbox = function () {
    $$("[data-fil]").forEach((b) => (b.onclick = () => { state.inbox.filter = b.dataset.fil; state.inbox.active = null; go("inbox"); }));
    $$("[data-th]").forEach(function (d) {
      d.onclick = async function () {
        state.inbox.active = d.dataset.th;
        go("inbox");
        const conv = ws.conversations.find(function (x) { return x.id === d.dataset.th; });
        if (conv && conv.messages === null) {
          try {
            const full = await WS.push.conversation(conv.id);
            conv.messages = full.data.messages.map(function (m) { return { dir: m.direction, text: m.body, at: m.at }; });
            conv.intentMeta = Object.assign({}, conv.intentMeta, full.data.intent_meta || {});
          } catch (e) { conv.messages = []; toast("Could not load conversation"); }
          if (state.view === "inbox" && state.inbox.active === conv.id) go("inbox");
        }
      };
    });
    const oc = $("[data-open-co]"); if (oc) oc.onclick = () => openCompany(oc.dataset.openCo);
    const send = $("[data-send]");
    if (send) send.onclick = async () => {
      const c = ws.conversations.find((x) => x.id === send.dataset.send);
      const text = $("#replybox").value;
      if (ws.backend) {
        try { await WS.push.reply(c.id, text); }
        catch (e) {
          toast(e.status === 409 ? "Blocked: this contact is suppressed" : "Server rejected the reply");
          return;
        }
      }
      if (!c.messages) c.messages = [];
      c.messages.push({ dir: "out", text: text, at: Date.now() });
      c.status = "Replied"; save(); audit("inbox.reply", c.id);
      toast("Reply sent"); go("inbox");
    };
    const bk = $("[data-book]");
    if (bk) bk.onclick = async () => {
      const c = ws.conversations.find((x) => x.id === bk.dataset.book);
      if (ws.meetings.some((m) => m.personId === c.personId)) { toast("Meeting already booked"); return; }
      const co = E.companyById(c.companyId);
      let mid = "mtg_" + Date.now().toString(36);
      if (ws.backend) {
        try { const r = await WS.push.bookMeeting(c.personId, c.campaignId); mid = r.data.id; }
        catch (e) { toast(e.status === 409 ? "Meeting already booked" : "Server rejected the booking"); return; }
      }
      ws.meetings.push({ id: mid, personId: c.personId, companyId: c.companyId,
        campaignId: c.campaignId, at: Date.now() + 5 * 86400000, duration: 30, status: "Confirmed",
        title: co.name + " — AI readiness intro" });
      const camp = ws.campaigns.find((x) => x.id === c.campaignId); if (camp) camp.meetings++;
      c.status = "Replied"; save(); audit("meeting.booked", co.name);
      toast("Meeting booked"); go("inbox");
    };
    const rg = $("[data-regen]");
    if (rg) rg.onclick = () => { toast("Draft regenerated"); $("#replybox").value = draftReply(
      ws.conversations.find((x) => x.id === rg.dataset.regen),
      E.personById(ws.conversations.find((x) => x.id === rg.dataset.regen).personId),
      E.companyById(ws.conversations.find((x) => x.id === rg.dataset.regen).companyId)); };
    const sp = $("[data-supp]");
    if (sp) sp.onclick = async () => {
      const c = ws.conversations.find((x) => x.id === sp.dataset.supp);
      const p = E.personById(c.personId);
      if (!ws.suppressions.some((s) => s.value === p.email)) {
        let sid = "sup_" + Date.now().toString(36);
        if (ws.backend) {
          try { const r = await WS.push.addSuppression(p.email, "Manually suppressed from inbox"); sid = r.id; }
          catch (e) { if (e.status !== 409) { toast("Server rejected the suppression"); return; } }
        }
        ws.suppressions.push({ id: sid, type: "Person", value: p.email,
          reason: "Manually suppressed from inbox", scope: "Global", at: Date.now() });
      }
      c.status = "Closed"; c.hot = false; save(); audit("suppression.added", p.email);
      toast(p.email + " suppressed"); go("inbox");
    };
  };

  // --------------------------------------------------------- HOT LEADS
  VIEWS.hot = function () {
    const hot = ws.conversations.filter((c) => c.hot).sort((a, b) => b.intentMeta.confidence - a.intentMeta.confidence);
    return '<div class="page-head"><div><h2>Hot leads</h2>' +
      "<p>Prospects who replied with meaningful interest, ranked by classifier confidence, with the next action for each.</p></div>" +
      '<div class="head-actions"><button class="btn ghost" data-act="exp-hot">⬇ Export CSV</button></div></div>' +
      (hot.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Company</th>' +
        "<th>Intent</th><th>Why it is hot</th><th>Recommended action</th><th>Meeting</th></tr></thead><tbody>" +
        hot.map((c) => {
          const p = E.personById(c.personId), co = E.companyById(c.companyId);
          const m = ws.meetings.find((x) => x.personId === c.personId);
          return '<tr data-hot="' + c.id + '">' +
            '<td><div class="prime">' + esc(p.name) + '</div><div class="sub">' + esc(p.title) + "</div></td>" +
            '<td><div class="prime">' + esc(co.name) + '</div><div class="sub">' + esc(co.industry) + " · " + num(co.size) + " emp</div></td>" +
            '<td><span class="pill good">' + esc(c.intent) + '</span><div class="sub">' + c.intentMeta.confidence + "% conf.</div></td>" +
            '<td style="max-width:280px">' + esc(lastText(c).slice(0, 110)) + "…</td>" +
            "<td>" + esc(c.intentMeta.action) + "</td>" +
            "<td>" + (m ? '<span class="pill good">' + esc(m.status) + "</span>" : '<span class="pill warn">Not booked</span>') + "</td>" +
            "</tr>";
        }).join("") + "</tbody></table></div>"
        : '<div class="empty"><div class="big">★</div><b>No hot leads yet</b><div>They appear here as soon as a reply classifies as interested, pricing or a meeting request.</div></div>');
  };
  WIRE.hot = function () {
    $$("[data-hot]").forEach((tr) => (tr.onclick = () => { state.inbox.active = tr.dataset.hot; state.inbox.filter = "All"; go("inbox"); }));
    const e = $("[data-act='exp-hot']");
    if (e) e.onclick = () => {
      const rows = [["Person", "Title", "Email", "Company", "Industry", "Employees", "Intent", "Confidence", "Recommended action", "Meeting status"]];
      ws.conversations.filter((c) => c.hot).forEach((c) => {
        const p = E.personById(c.personId), co = E.companyById(c.companyId);
        const m = ws.meetings.find((x) => x.personId === c.personId);
        rows.push([p.name, p.title, p.email, co.name, co.industry, co.size, c.intent, c.intentMeta.confidence + "%", c.intentMeta.action, m ? m.status : "Not booked"]);
      });
      exportCSV("drd-hot-leads.csv", rows);
    };
  };

  // ---------------------------------------------------------- MEETINGS
  VIEWS.meetings = function () {
    const up = ws.meetings.filter((m) => m.at >= Date.now()).sort((a, b) => a.at - b.at);
    const past = ws.meetings.filter((m) => m.at < Date.now()).sort((a, b) => b.at - a.at);
    const row = (m) => {
      const co = E.companyById(m.companyId), p = E.personById(m.personId);
      const camp = ws.campaigns.find((c) => c.id === m.campaignId);
      return '<tr><td><div class="prime">' + esc(co.name) + '</div><div class="sub">' + esc(m.title) + "</div></td>" +
        '<td><div class="prime">' + esc(p.name) + '</div><div class="sub">' + esc(p.title) + "</div></td>" +
        "<td>" + timeStr(m.at) + '<div class="sub">' + m.duration + " min</div></td>" +
        "<td>" + (camp ? esc(camp.name) : "—") + "</td>" +
        '<td><span class="pill ' + (m.status === "Completed" ? "muted" : m.status === "Confirmed" ? "good" : "warn") + '">' + esc(m.status) + "</span></td></tr>";
    };
    return '<div class="page-head"><div><h2>Meetings</h2>' +
      "<p>Everything the agent booked out of a reply, plus what it has already run.</p></div></div>" +
      '<div class="stats">' + tile("Upcoming", num(up.length), "confirmed + proposed", true) +
        tile("Completed", num(past.filter((m) => m.status === "Completed").length), "already run") +
        tile("Total booked", num(ws.meetings.length), "all time") + "</div>" +
      '<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>Upcoming</h3></div>' +
        (up.length ? '<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl"><thead><tr><th>Account</th><th>Contact</th><th>When</th><th>Campaign</th><th>Status</th></tr></thead><tbody>' + up.map(row).join("") + "</tbody></table></div>"
          : '<div class="card-b" style="color:var(--faint);font-size:13px">Nothing scheduled.</div>') + "</div>" +
      '<div class="card"><div class="card-h"><h3>Past</h3></div>' +
        (past.length ? '<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl"><thead><tr><th>Account</th><th>Contact</th><th>When</th><th>Campaign</th><th>Status</th></tr></thead><tbody>' + past.map(row).join("") + "</tbody></table></div>"
          : '<div class="card-b" style="color:var(--faint);font-size:13px">No past meetings.</div>') + "</div>";
  };

  // --------------------------------------------------------- ANALYTICS
  VIEWS.analytics = function () {
    const a = E.analytics(ws);
    const maxR = Math.max.apply(null, a.byCampaign.map((c) => c.replyRate).concat([1]));
    return '<div class="page-head"><div><h2>Analytics</h2>' +
      "<p>Outcome metrics, not vanity metrics: what it costs to produce a reply, a hot lead and a meeting.</p></div>" +
      '<div class="head-actions"><button class="btn ghost" data-act="exp-an">⬇ Export CSV</button></div></div>' +
      '<div class="stats">' +
        tile("Emails sent", num(a.sent), "across all campaigns") +
        tile("Replies", num(a.replies), a.replyRate + "% reply rate") +
        tile("Positive replies", num(a.positive), a.positiveRate + "% of replies") +
        tile("Hot leads", num(ws.conversations.filter((c) => c.hot).length), "meaningful interest", true) +
        tile("Meetings", num(ws.meetings.length), "booked") +
        tile("Spend", money(a.spend), "total") +
        tile("Cost / reply", money(a.costPerLead), "blended") +
        tile("Cost / meeting", money(a.costPerMeeting), "blended", true) +
      "</div>" +
      '<div class="split">' +
        '<div class="card"><div class="card-h"><h3>Reply rate by campaign</h3></div><div class="card-b"><div class="bars">' +
          a.byCampaign.filter((c) => c.sent).map((c) =>
            '<div class="b"><div><div class="lbl">' + esc(c.name) + " · " + num(c.sent) + " sent · " + num(c.meetings) + " meetings</div>" +
            '<div class="track"><i style="width:' + Math.round((c.replyRate / maxR) * 100) + '%"></i></div></div>' +
            '<div class="val">' + c.replyRate + "%</div></div>").join("") +
        "</div></div></div>" +
        '<div class="card"><div class="card-h"><h3>AI recommendations</h3></div><div class="card-b stack">' +
          a.insights.map((i) => '<div style="font-size:12.5px;color:var(--muted);display:flex;gap:9px"><span style="color:var(--gold)">▸</span><span>' + esc(i) + "</span></div>").join("") +
        "</div></div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px"><div class="card-h"><h3>Segment fit</h3></div><div class="card-b"><div class="bars">' +
        a.segments.map((s) => '<div class="b"><div><div class="lbl">' + esc(s.name) + " · " + num(s.companies) + " companies · " + num(s.people) + " people</div>" +
          '<div class="track"><i style="width:' + Math.round(s.fit) + '%"></i></div></div><div class="val">' + Math.round(s.fit) + "</div></div>").join("") +
      "</div></div></div>";
  };
  WIRE.analytics = function () {
    const e = $("[data-act='exp-an']");
    if (e) e.onclick = () => {
      const a = E.analytics(ws);
      const rows = [["Campaign", "Leads", "Sent", "Replies", "Reply rate %", "Hot", "Meetings", "Spend"]];
      a.byCampaign.forEach((c) => rows.push([c.name, c.leads, c.sent, c.replies, c.replyRate, c.hot, c.meetings, c.spend]));
      exportCSV("drd-analytics.csv", rows);
    };
  };

  // ----------------------------------------------- DATA & COMPLIANCE
  VIEWS.data = function () {
    return '<div class="page-head"><div><h2>Data &amp; compliance</h2>' +
      "<p>Suppression is a first-class control. Nothing sends to a suppressed person or domain, in any campaign.</p></div>" +
      '<div class="head-actions"><button class="btn ghost" data-act="exp-sup">⬇ Export list</button></div></div>' +
      '<div class="stats">' +
        tile("Suppressed", num(ws.suppressions.length), "people + domains", true) +
        tile("Unsubscribes", num(ws.suppressions.filter((s) => /unsub/i.test(s.reason)).length), "honoured permanently") +
        tile("Reachable contacts", num(D.people.filter((p) => !ws.suppressions.some((s) => s.value === p.email)).length), "after suppression") +
        tile("Verified share", Math.round(D.people.filter((p) => p.verified).length / D.people.length * 100) + "%", "of all contacts") +
      "</div>" +
      '<div class="split">' +
        '<div class="card"><div class="card-h"><h3>Suppression list</h3></div>' +
          '<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl"><thead><tr><th>Value</th><th>Type</th><th>Reason</th><th>Scope</th><th>Added</th><th></th></tr></thead><tbody>' +
          ws.suppressions.map((s) => '<tr><td class="prime">' + esc(s.value) + "</td><td>" + esc(s.type) + "</td><td>" + esc(s.reason) + "</td>" +
            '<td><span class="pill muted">' + esc(s.scope) + "</span></td><td>" + dateStr(s.at) + "</td>" +
            '<td class="right"><button class="btn ghost sm" data-unsup="' + s.id + '">Remove</button></td></tr>').join("") +
          "</tbody></table></div></div>" +
        '<div class="stack">' +
          '<div class="card pad"><div class="label" style="margin-bottom:10px">Add suppression</div>' +
            '<label class="field"><span>Email or domain</span><input class="input" id="supval" placeholder="name@example.com or example.com"></label>' +
            '<label class="field"><span>Reason</span><input class="input" id="supreason" placeholder="Why this is suppressed"></label>' +
            '<button class="btn" id="addsup">Add to list</button></div>' +
          '<div class="card pad"><div class="label" style="margin-bottom:12px">Sending safeguards</div>' +
            ["Unsubscribe detection and permanent suppression", "Duplicate prevention across campaigns", "Daily sending limits per mailbox", "Bounce monitoring and auto-pause", "Human handoff for ambiguous replies"]
              .map((x) => '<div style="display:flex;gap:9px;font-size:12.5px;color:var(--muted);padding:5px 0"><span style="color:var(--good)">✓</span>' + esc(x) + "</div>").join("") +
          "</div>" +
          '<div class="card"><div class="card-h"><h3>Audit log</h3></div><div class="card-b">' +
            (ws.audit.length ? ws.audit.slice(0, 12).map((a) =>
              '<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--border-soft);font-size:12px">' +
              '<code class="k">' + esc(a.action) + "</code>" +
              '<span style="color:var(--muted);flex:1">' + esc(a.detail) + "</span>" +
              '<span style="color:var(--faint)">' + ago(a.at) + "</span></div>").join("")
              : '<div style="color:var(--faint);font-size:12.5px">No actions recorded yet. Every AI and outbound action lands here.</div>') +
          "</div></div>" +
        "</div>" +
      "</div>";
  };
  WIRE.data = function () {
    $("#addsup").onclick = async () => {
      const v = $("#supval").value.trim(); if (!v) { toast("Enter an email or domain"); return; }
      const reason = $("#supreason").value.trim() || "Manual entry";
      let sid = "sup_" + Date.now().toString(36);
      if (ws.backend) {
        try { const r = await WS.push.addSuppression(v, reason); sid = r.id; }
        catch (e) { toast(e.status === 409 ? "Already on the suppression list" : "Server rejected it"); return; }
      }
      ws.suppressions.unshift({ id: sid, type: v.includes("@") ? "Person" : "Domain",
        value: v, reason: reason, scope: "Global", at: Date.now() });
      save(); audit("suppression.added", v); toast("Added to suppression list"); go("data");
    };
    $$("[data-unsup]").forEach((b) => (b.onclick = async () => {
      if (ws.backend) {
        try { await WS.push.removeSuppression(b.dataset.unsup); }
        catch (e) { toast("Server rejected the removal"); return; }
      }
      ws.suppressions = ws.suppressions.filter((s) => s.id !== b.dataset.unsup);
      save(); audit("suppression.removed", b.dataset.unsup); toast("Removed"); go("data");
    }));
    const e = $("[data-act='exp-sup']");
    if (e) e.onclick = () => {
      const rows = [["Value", "Type", "Reason", "Scope", "Added"]];
      ws.suppressions.forEach((s) => rows.push([s.value, s.type, s.reason, s.scope, dateStr(s.at)]));
      exportCSV("drd-suppression.csv", rows);
    };
  };

  // ----------------------------------------------------------- BILLING
  VIEWS.billing = function () {
    const c = ws.credits, a = E.analytics(ws);
    const pct = Math.min(100, Math.round((c.used / c.included) * 100));
    const plans = [
      { n: "Starter", p: "$49", inc: "1,000 credits", f: ["Company + people search", "CSV export", "1 campaign"] },
      { n: "Growth", p: "$199", inc: "5,000 credits", f: ["Everything in Starter", "Deep research", "Autopilot", "5 campaigns"] },
      { n: "Scale", p: "$599", inc: "20,000 credits", f: ["Everything in Growth", "API access", "Webhooks", "Unlimited campaigns"] },
      { n: "Enterprise", p: "Custom", inc: "Custom", f: ["SSO + roles", "Dedicated infrastructure", "Custom data sources", "SLA"] },
    ];
    return '<div class="page-head"><div><h2>Billing &amp; usage</h2>' +
      "<p>Usage-based credits for sending and research, on top of a subscription for search and data.</p></div></div>" +
      '<div class="stats">' +
        tile("Plan", c.plan, "current subscription", true) +
        tile("Credits used", num(c.used), "of " + num(c.included)) +
        tile("Email rate", "$" + c.emailRate.toFixed(3), "per send") +
        tile("Research rate", "$" + c.researchRate.toFixed(2), "per deep report") +
        tile("Spend this period", money(a.spend), "outbound") +
      "</div>" +
      '<div class="card pad" style="margin-bottom:16px">' +
        '<div class="rowflex" style="justify-content:space-between;margin-bottom:8px"><span class="label">Credit usage</span>' +
        '<span style="font-size:12.5px;color:var(--muted)" class="num">' + num(c.used) + " / " + num(c.included) + " (" + pct + "%)</span></div>" +
        '<div class="plan"><div class="bar" style="height:8px"><i style="width:' + pct + '%"></i></div></div></div>' +
      '<div class="grid2">' + plans.map((p) =>
        '<div class="card pad" ' + (p.n === c.plan ? 'style="border-color:var(--gold-line)"' : "") + ">" +
        '<div class="rowflex" style="justify-content:space-between"><h3 style="font-size:15px;font-weight:700">' + esc(p.n) + "</h3>" +
        (p.n === c.plan ? '<span class="pill gold">Current</span>' : "") + "</div>" +
        '<div style="font-size:26px;font-weight:800;margin:8px 0 2px">' + esc(p.p) + '<span style="font-size:12px;color:var(--faint);font-weight:500">/mo</span></div>' +
        '<div style="font-size:12px;color:var(--muted);margin-bottom:12px">' + esc(p.inc) + " included</div>" +
        p.f.map((f) => '<div style="display:flex;gap:8px;font-size:12.5px;color:var(--muted);padding:3px 0"><span style="color:var(--gold)">✓</span>' + esc(f) + "</div>").join("") +
        "</div>").join("") + "</div>";
  };

  // --------------------------------------------------------------- API
  VIEWS.api = function () {
    const eps = [
      ["GET", "/v1/projects", "List projects and settings"],
      ["POST", "/v1/campaigns", "Create a campaign"],
      ["POST", "/v1/campaigns/:id/start", "Start or resume a campaign"],
      ["POST", "/v1/campaigns/:id/pause", "Pause a campaign"],
      ["POST", "/v1/campaigns/:id/import", "Bulk import leads"],
      ["GET", "/v1/campaigns/:id/analytics", "Campaign performance"],
      ["GET", "/v1/leads", "List leads with filters"],
      ["GET", "/v1/leads/hot", "Hot leads only"],
      ["GET", "/v1/conversations", "Inbox threads"],
      ["POST", "/v1/conversations/:id/reply", "Send a reply"],
      ["GET", "/v1/search/companies", "Natural-language company search"],
      ["GET", "/v1/search/people", "Natural-language people search"],
      ["POST", "/v1/research", "Queue a deep research report"],
      ["GET", "/v1/suppressions", "Suppression list"],
      ["POST", "/v1/suppressions", "Add a suppression"],
      ["GET", "/v1/usage", "Credit usage and spend"],
      ["PATCH", "/v1/autopilot", "Autopilot and budget controls"],
    ];
    return '<div class="page-head"><div><h2>API</h2>' +
      "<p>Everything the interface does is available over HTTP, so the platform can sit inside your own workflows.</p></div></div>" +
      '<div class="split"><div class="stack">' +
        '<div class="card"><div class="card-h"><h3>Endpoints</h3></div>' +
          '<div class="tbl-wrap" style="border:none;border-radius:0"><table class="tbl" style="min-width:520px"><tbody>' +
          eps.map((e) => '<tr><td style="width:70px"><span class="pill ' + (e[0] === "GET" ? "muted" : "gold") + '">' + e[0] + "</span></td>" +
            '<td><code class="k">' + esc(e[1]) + "</code></td>" +
            '<td style="color:var(--muted)">' + esc(e[2]) + "</td></tr>").join("") +
          "</tbody></table></div></div>" +
        '<div class="card"><div class="card-h"><h3>Example — search and enroll</h3></div><div class="card-b">' +
          '<pre class="code">curl -X GET https://api.drdlead.dev/v1/search/companies \\\n' +
          '  -H "Authorization: Bearer $DRD_API_KEY" \\\n' +
          '  -G --data-urlencode \'q=Ontario colleges over 200 employees\'\n\n' +
          "# → { results: [ { id, name, domain, fit_score, breakdown, contacts } ] }\n\n" +
          "curl -X POST https://api.drdlead.dev/v1/campaigns/cmp_1/import \\\n" +
          '  -H "Authorization: Bearer $DRD_API_KEY" \\\n' +
          '  -d \'{ "leads": [ { "email": "...", "first_name": "...", "last_name": "...", "company_domain": "...", "job_title": "..." } ] }\'</pre>' +
        "</div></div>" +
      "</div>" +
      '<div class="stack">' +
        '<div class="card"><div class="card-h"><h3>API keys</h3></div><div class="card-b stack">' +
          ws.apiKeys.map((k) => '<div class="rowflex" style="justify-content:space-between">' +
            "<div><div style=\"font-size:13px;font-weight:600\">" + esc(k.name) + "</div>" +
            '<code class="k">' + esc(k.prefix) + "…</code></div>" +
            '<span style="font-size:11.5px;color:var(--faint)">used ' + ago(k.lastUsed) + "</span></div>").join("") +
          '<button class="btn ghost sm" id="newkey">＋ Create key</button></div></div>' +
        '<div class="card"><div class="card-h"><h3>Webhooks</h3></div><div class="card-b stack">' +
          ws.webhooks.map((w) => '<div><div style="font-size:12px;word-break:break-all;color:var(--muted)">' + esc(w.url) + "</div>" +
            '<div class="chips" style="margin-top:6px">' + w.events.map((e) => '<span class="chip">' + esc(e) + "</span>").join("") + "</div></div>").join("") +
          '<div class="label" style="margin-top:6px">Available events</div>' +
          '<div class="chips">' + ["lead.hot", "lead.replied", "meeting.booked", "campaign.started", "campaign.paused", "campaign.completed", "unsubscribe.received"]
            .map((e) => '<span class="chip">' + e + "</span>").join("") + "</div>" +
        "</div></div>" +
      "</div></div>";
  };
  WIRE.api = function () {
    const b = $("#newkey");
    if (b) b.onclick = () => {
      ws.apiKeys.push({ id: "key_" + Date.now().toString(36), name: "Key " + (ws.apiKeys.length + 1),
        prefix: "drd_live_" + Math.random().toString(36).slice(2, 6), created: Date.now(), lastUsed: Date.now() });
      save(); toast("API key created"); go("api");
    };
  };

  // ---------------------------------------------------------- SETTINGS
  VIEWS.settings = function () {
    return '<div class="page-head"><div><h2>Settings</h2><p>Sending posture, defaults and workspace controls.</p></div></div>' +
      '<div class="split"><div class="stack">' +
        '<div class="card pad"><div class="label" style="margin-bottom:12px">Business profile</div>' +
          '<label class="field"><span>Website</span><input class="input" id="s_site" value="' + esc(ws.profile.website) + '"></label>' +
          '<label class="field"><span>Company</span><input class="input" id="s_co" value="' + esc(ws.profile.company) + '"></label>' +
          '<label class="field"><span>What you sell</span><textarea class="ta" id="s_prod" style="min-height:80px">' + esc(ws.profile.product) + "</textarea></label>" +
          '<button class="btn" id="s_save">Save profile</button></div>' +
        '<div class="card pad"><div class="label" style="margin-bottom:12px">Sending limits</div>' +
          '<label class="field"><span>Daily sends per mailbox</span><input class="input" id="s_limit" type="number" value="50"></label>' +
          '<label class="field"><span>Default tone</span><select class="select" id="s_tone">' +
            Object.keys(E.TONES).map((t) => '<option value="' + t + '">' + t[0].toUpperCase() + t.slice(1) + "</option>").join("") + "</select></label>" +
          '<label class="toggle" style="margin-top:6px"><input type="checkbox" checked><span class="tr"></span><span>Pause campaign automatically on bounce spike</span></label>' +
        "</div>" +
      "</div>" +
      '<div class="stack">' +
        '<div class="card pad"><div class="label" style="margin-bottom:10px">Workspace</div>' +
          '<div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Reset restores the seeded demo workspace: campaigns, conversations, meetings and suppression return to their original state. Your searches are unaffected.</div>' +
          '<button class="btn danger" id="s_reset">Reset demo workspace</button></div>' +
        '<div class="card pad"><div class="label" style="margin-bottom:10px">Data sources</div>' +
          '<div style="font-size:12.5px;color:var(--muted);line-height:1.6">This build ships a seeded graph of <b style="color:var(--white)">' + num(D.companies.length) + " companies</b> and <b style=\"color:var(--white)\">" + num(D.people.length) + " contacts</b> so every module is demonstrable end to end. " +
          "The search, scoring, research and classification layers are real and provider-agnostic: point them at a licensed B2B data API and nothing above them changes.</div></div>" +
      "</div></div>";
  };
  WIRE.settings = function () {
    $("#s_save").onclick = () => {
      ws.profile.website = $("#s_site").value; ws.profile.company = $("#s_co").value; ws.profile.product = $("#s_prod").value;
      save(); audit("profile.updated", ws.profile.company); toast("Profile saved");
    };
    $("#s_reset").onclick = () => {
      if (!confirm("Reset the demo workspace to its seeded state?")) return;
      ws = WS.reset(); toast("Workspace reset"); go("overview");
    };
  };

  // ============================================================ DRAWERS
  function openDrawer(html, footer) {
    $("#drawer").innerHTML = html + (footer ? '<div class="drawer-f">' + footer + "</div>" : "");
    $("#drawer").classList.add("on"); $("#veil").classList.add("on");
    const x = $("#drawer .x"); if (x) x.onclick = closeDrawer;
  }
  function closeDrawer() { $("#drawer").classList.remove("on"); $("#veil").classList.remove("on"); }

  function openCompany(id) {
    const co = E.companyById(id); if (!co) return;
    const scored = (state.company.results || []).find((c) => c.id === id);
    const sc = scored ? scored._breakdown : E.scoreCompany(co, E.parseQuery(""), null);
    const staff = D.peopleByCompany[co.id] || [];
    openDrawer(
      '<div class="drawer-h"><div><h3>' + esc(co.name) + "</h3>" +
        '<div class="sub">' + esc(co.sub) + " · " + esc(co.domain) + "</div></div>" +
        '<button class="x">×</button></div>' +
      '<div class="drawer-b">' +
        '<div class="rowflex" style="justify-content:space-between;margin-bottom:18px">' +
          '<span class="score ' + scoreCls(sc.total) + '"><b style="font-size:28px">' + sc.total + '</b><span>/100</span></span>' +
          '<span class="pill ' + (sc.total >= 82 ? "gold" : "muted") + '">' + esc(sc.band) + "</span></div>" +
        '<div class="sec"><span class="label">Score breakdown</span><div class="bd">' +
          bdRow("Company fit", sc.companyFit, 30) + bdRow("Buyer fit", sc.buyerFit, 20) +
          bdRow("Intent signal", sc.intent, 20) + bdRow("Timing", sc.timing, 10) +
          bdRow("Data confidence", sc.dataConfidence, 10) + bdRow("Personalization", sc.personalization, 10) +
        "</div></div>" +
        '<div class="sec"><span class="label">Firmographics</span><div class="kv">' +
          kv("Industry", co.industry) + kv("Headquarters", co.city + ", " + co.country) +
          kv("Employees", num(co.size)) + kv("Est. revenue", co.revenue) +
          kv("Founded", co.founded) + kv("Monthly traffic", num(co.traffic)) +
          (co.funding ? kv("Funding", co.funding.round + " " + co.funding.amount + " (" + co.funding.date + ")") : "") +
        "</div></div>" +
        (co.tech.length ? '<div class="sec"><span class="label">Technologies</span><div class="chips">' + co.tech.map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + "</div></div>" : "") +
        (co.signals.length ? '<div class="sec"><span class="label">Buying signals</span><div class="chips">' + co.signals.map((s) => '<span class="pill warn">' + esc(s) + "</span>").join("") + "</div></div>" : "") +
        '<div class="sec"><span class="label">Decision makers (' + staff.length + ")</span>" +
          staff.map((p) => '<div class="rowflex" style="justify-content:space-between;padding:9px 0;border-top:1px solid var(--border-soft)">' +
            "<div><div style=\"font-size:13px;font-weight:600\">" + esc(p.name) + "</div>" +
            '<div style="font-size:12px;color:var(--muted)">' + esc(p.title) + "</div>" +
            '<div style="font-size:12px;color:var(--gold-bright)">' + esc(p.email) + "</div></div>" +
            '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">' +
            '<span class="pill ' + (p.verified ? "good" : "warn") + '">' + esc(p.emailStatus) + "</span>" +
            '<button class="btn ghost sm" data-draft="' + p.id + '">✦ Draft email</button></div></div>').join("") +
        "</div>" +
        '<div id="draftzone"></div>' +
      "</div>",
      '<button class="btn" data-research="' + co.id + '">✦ Deep research</button>' +
      '<button class="btn ghost" data-look="' + co.id + '">◎ Find lookalikes</button>' +
      '<button class="btn ghost" data-addco="' + co.id + '">＋ Add to campaign</button>'
    );
    $$("[data-draft]").forEach((b) => (b.onclick = () => {
      const p = E.personById(b.dataset.draft);
      const em = E.generateEmail(co, p, { tone: "consultative" });
      $("#draftzone").innerHTML = '<div class="card pad" style="margin-top:6px">' +
        '<div class="label" style="margin-bottom:8px">AI draft — ' + esc(p.name) + "</div>" +
        '<div style="font-size:12px;color:var(--faint);margin-bottom:4px">Subject</div>' +
        '<div style="font-size:13.5px;font-weight:600;margin-bottom:10px">' + esc(em.subject) + "</div>" +
        '<textarea class="ta">' + esc(em.body) + "</textarea>" +
        '<div style="font-size:11.5px;color:var(--muted);margin-top:8px">Personalization: ' + esc(em.strength) + "</div></div>";
      $("#draftzone").scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
    $("[data-research]").onclick = () => openResearch(co.id);
    $("[data-look]").onclick = () => { closeDrawer(); state.company.query = "Companies like " + co.name;
      const r = E.lookalikes(co); state.company.results = r; state.company.criteria = E.parseQuery(co.industry);
      state.company.sel = new Set(); go("companies"); toast("Found " + r.length + " lookalikes of " + co.name); };
    $("[data-addco]").onclick = () => { state.company.sel = new Set([co.id]); addSelectedToCampaign(); };
  }
  function bdRow(n, v, max) {
    return '<div class="r"><span class="n">' + esc(n) + '</span><span class="t"><i style="width:' + Math.round((v / max) * 100) + '%"></i></span>' +
      '<span class="v">' + v + "/" + max + "</span></div>";
  }

  function openResearch(coId) {
    const co = E.companyById(coId);
    const r = E.deepResearch(co);
    ws.research[coId] = { at: Date.now() };
    ws.credits.used += 4; save(); audit("research.generated", co.name);
    openDrawer(
      '<div class="drawer-h"><div><h3>Deep research — ' + esc(co.name) + "</h3>" +
        '<div class="sub">Generated ' + timeStr(r.generatedAt) + " · 4 credits</div></div><button class=\"x\">×</button></div>" +
      '<div class="drawer-b">' +
        sec("Company overview", '<div style="font-size:13px;color:var(--muted);line-height:1.65">' + esc(r.overview) + "</div>") +
        sec("Buying signals", r.buyingSignals.map((b) => '<div class="rowflex" style="justify-content:space-between;padding:6px 0">' +
          '<span style="font-size:13px">' + esc(b.signal) + '</span><span class="pill ' + (b.weight === "Strong" ? "good" : b.weight === "Moderate" ? "warn" : "muted") + '">' + esc(b.weight) + "</span></div>").join("")) +
        sec("Likely pain points", '<div class="chips">' + r.painPoints.map((p) => '<span class="chip">' + esc(p) + "</span>").join("") + "</div>") +
        sec("Product fit", '<div style="font-size:13px;color:var(--muted);line-height:1.65">' + esc(r.productFit) + "</div>") +
        sec("Why now", '<div style="font-size:13px;color:var(--muted);line-height:1.65">' + esc(r.whyNow) + "</div>") +
        (r.competitors.length ? sec("Competitive context", '<div class="chips">' + r.competitors.map((c) => '<span class="chip">' + esc(c) + "</span>").join("") + "</div>") : "") +
        (r.technologies.length ? sec("Relevant technologies", '<div class="chips">' + r.technologies.map((c) => '<span class="chip">' + esc(c) + "</span>").join("") + "</div>") : "") +
        (r.decisionMaker ? sec("Primary decision maker", '<div style="font-size:13px">' + esc(r.decisionMaker.name) + " — " + esc(r.decisionMaker.title) +
          '<div style="color:var(--gold-bright);font-size:12.5px">' + esc(r.decisionMaker.email) + "</div></div>") : "") +
        sec("Personalization angles", r.angles.map((a) => '<div style="display:flex;gap:9px;font-size:12.5px;color:var(--muted);padding:4px 0"><span style="color:var(--gold)">▸</span><span>' + esc(a) + "</span></div>").join("")) +
        sec("Outreach recommendation", '<div style="font-size:13px;color:var(--white)">' + esc(r.recommendation) + "</div>") +
        sec("Sources", '<div class="chips">' + r.sources.map((s) => '<span class="chip">' + esc(s) + "</span>").join("") + "</div>") +
      "</div>",
      '<button class="btn ghost" data-back="' + co.id + '">← Back to account</button>'
    );
    $("[data-back]").onclick = () => openCompany(co.id);
    toast("Research complete");
  }
  function sec(t, body) { return '<div class="sec"><span class="label">' + esc(t) + "</span>" + body + "</div>"; }

  function openPerson(id) {
    const p = E.personById(id); if (!p) return;
    const co = E.companyById(p.companyId);
    const em = E.generateEmail(co, p, { tone: "consultative" });
    openDrawer(
      '<div class="drawer-h"><div><h3>' + esc(p.name) + "</h3>" +
        '<div class="sub">' + esc(p.title) + " · " + esc(co.name) + "</div></div><button class=\"x\">×</button></div>" +
      '<div class="drawer-b">' +
        '<div class="sec"><div class="kv">' +
          kv("Seniority", p.seniority) + kv("Department", p.department) +
          kv("Email", p.email) + kv("Email status", p.emailStatus) +
          kv("Phone", p.phone || "Not available") + kv("Location", p.city + ", " + p.country) +
          kv("LinkedIn", "linkedin.com/" + p.linkedin) + kv("Company size", num(co.size)) +
        "</div></div>" +
        sec("Account", '<div style="font-size:13px;color:var(--muted);line-height:1.6">' + esc(co.desc) + "</div>" +
          '<div class="chips" style="margin-top:8px">' + co.signals.map((s) => '<span class="pill warn">' + esc(s) + "</span>").join("") + "</div>") +
        sec("AI outreach draft", '<div style="font-size:12px;color:var(--faint);margin-bottom:4px">Subject</div>' +
          '<div style="font-size:13.5px;font-weight:600;margin-bottom:10px">' + esc(em.subject) + "</div>" +
          '<textarea class="ta" id="pdraft">' + esc(em.body) + "</textarea>" +
          '<div style="font-size:11.5px;color:var(--muted);margin-top:8px">Strength: ' + esc(em.strength) + "</div>") +
      "</div>",
      '<button class="btn" data-openco2="' + co.id + '">View account</button>' +
      '<button class="btn ghost" data-copy="1">⧉ Copy email</button>'
    );
    $("[data-openco2]").onclick = () => openCompany(co.id);
    $("[data-copy]").onclick = () => { const t = $("#pdraft").value; if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {}); toast("Copied"); };
  }

  function openCampaign(id) {
    const c = ws.campaigns.find((x) => x.id === id); if (!c) return;
    const icp = ws.icps.find((i) => i.id === c.icpId);
    const leads = c.leadIds.map((lid) => E.personById(lid)).filter(Boolean).slice(0, 12);
    openDrawer(
      '<div class="drawer-h"><div><h3>' + esc(c.name) + "</h3>" +
        '<div class="sub">' + esc(c.goal) + " · " + (icp ? esc(icp.name) : "—") + "</div></div><button class=\"x\">×</button></div>" +
      '<div class="drawer-b">' +
        '<div class="stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">' +
          tile("Sent", num(c.sent), "") + tile("Replies", num(c.replies), c.sent ? (c.replies / c.sent * 100).toFixed(1) + "%" : "—") +
          tile("Meetings", num(c.meetings), "booked") + "</div>" +
        '<div class="sec"><span class="label">Controls</span>' +
          '<div class="rowflex" style="margin-bottom:10px">' +
            '<button class="btn ' + (c.status === "Active" ? "ghost" : "") + ' sm" data-toggle="' + c.id + '">' + (c.status === "Active" ? "❚❚ Pause" : "▶ Start") + "</button>" +
            '<span class="pill ' + (c.status === "Active" ? "good" : c.status === "Paused" ? "warn" : "muted") + '">' + esc(c.status) + "</span></div>" +
          '<label class="toggle"><input type="checkbox" id="campauto" ' + (c.autopilot ? "checked" : "") + '><span class="tr"></span>' +
          "<span>Autopilot controls this campaign</span></label></div>" +
        '<div class="sec"><span class="label">Budget</span>' +
          '<div class="plan"><div class="row"><span>' + money(c.spend) + " spent</span><span>" + money(c.budget) + " cap</span></div>" +
          '<div class="bar"><i style="width:' + Math.min(100, Math.round((c.spend / c.budget) * 100)) + '%"></i></div></div></div>' +
        '<div class="sec"><span class="label">Sequence</span>' +
          c.sequence.map((s) => '<div class="rowflex" style="justify-content:space-between;padding:8px 0;border-top:1px solid var(--border-soft)">' +
            '<div><div style="font-size:13px;font-weight:600">Step ' + s.step + " · " + esc(s.label) + "</div>" +
            '<div style="font-size:11.5px;color:var(--faint)">' + (s.day === 0 ? "Sent immediately" : "Day " + s.day) + "</div></div>" +
            '<span class="pill muted">' + (c.status === "Active" ? "Running" : "Idle") + "</span></div>").join("") + "</div>" +
        '<div class="sec"><span class="label">Leads (' + c.leadIds.length + ")</span>" +
          leads.map((p) => { const co = E.companyById(p.companyId);
            return '<div class="rowflex" style="justify-content:space-between;padding:7px 0;border-top:1px solid var(--border-soft)">' +
              "<div><div style=\"font-size:12.5px;font-weight:600\">" + esc(p.name) + "</div>" +
              '<div style="font-size:11.5px;color:var(--faint)">' + esc(p.title) + " · " + esc(co.name) + "</div></div>" +
              '<span class="pill ' + (p.verified ? "good" : "muted") + '">' + esc(p.emailStatus) + "</span></div>"; }).join("") +
          (c.leadIds.length > 12 ? '<div style="font-size:12px;color:var(--faint);padding-top:8px">+ ' + (c.leadIds.length - 12) + " more</div>" : "") +
        "</div>" +
      "</div>",
      '<button class="btn ghost" data-expcamp="' + c.id + '">⬇ Export leads</button>'
    );
    $("[data-toggle]").onclick = () => {
      c.status = c.status === "Active" ? "Paused" : "Active";
      save(); wt(function () { return WS.push.campaignStatus(c.id, c.status); });
      audit("campaign." + c.status.toLowerCase(), c.name);
      toast(c.name + " " + c.status.toLowerCase()); go("campaigns"); openCampaign(c.id);
    };
    $("#campauto").onchange = (e) => { c.autopilot = e.target.checked; save(); toast("Autopilot " + (c.autopilot ? "on" : "off") + " for this campaign"); };
    $("[data-expcamp]").onclick = () => {
      const rows = [["Name", "Title", "Email", "Email status", "Company", "Domain", "Industry", "Employees", "City", "Country"]];
      c.leadIds.forEach((lid) => { const p = E.personById(lid); if (!p) return; const co = E.companyById(p.companyId);
        rows.push([p.name, p.title, p.email, p.emailStatus, co.name, co.domain, co.industry, co.size, co.city, co.country]); });
      exportCSV("drd-campaign-leads.csv", rows);
    };
  }

  // ============================================================== INIT
  function paintStatus() {
    const ap = $("#agentstatus");
    ap.className = "agent-pill" + (ws.autopilot ? "" : " off");
    ap.innerHTML = '<span class="dot"></span>' + (ws.autopilot ? "Agent active \u00b7 Autopilot on" : "Agent idle \u00b7 Autopilot off");
    const mode = $("#modepill");
    if (mode) {
      mode.textContent = ws.backend ? "Live backend" : "Local demo";
      mode.className = "pill " + (ws.backend ? "good" : "muted");
      mode.title = ws.backend
        ? "Reading and writing the API and database."
        : "Running on seeded data in this browser. Start the server for live mode.";
    }
  }

  function renderLogin(message) {
    document.querySelector(".app").style.display = "none";
    let el = $("#loginscreen");
    if (!el) {
      el = document.createElement("div");
      el.id = "loginscreen";
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="login-wrap"><form class="login-card" id="loginform">' +
        '<div class="login-brand"><span class="mono">DD</span></div>' +
        "<h1>Dr.&nbsp;D Lead Engineering System</h1>" +
        "<p>Sign in to reach the engine.</p>" +
        '<label class="field"><span>Password</span>' +
        '<input class="input" type="password" id="loginpw" autocomplete="current-password" autofocus></label>' +
        (message ? '<div class="login-err">' + esc(message) + "</div>" : "") +
        '<button class="btn" type="submit" style="width:100%;justify-content:center">Sign in</button>' +
      "</form></div>";
    $("#loginform").onsubmit = async (e) => {
      e.preventDefault();
      const pw = $("#loginpw").value;
      try {
        await WS.auth.login(pw);
        el.remove();
        document.querySelector(".app").style.display = "";
        await boot();
      } catch (err) {
        renderLogin(err.status === 401 ? "That password is not right." : "Sign-in failed. Try again.");
      }
    };
  }

  async function boot() {
    try {
      $("#page").innerHTML = '<div class="loading"><div class="spin"></div>Connecting to the engine\u2026</div>';
      ws = await WS.hydrate();
    } catch (e) {
      toast("Backend unreachable, using local demo data");
    }
    renderNav();
    paintStatus();
    go("overview");
    window.__drd = { ws, state, go, E, D, WS };
  }

  async function init() {
    $("#veil").onclick = closeDrawer;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });

    // Served by the API? Check the session, then hydrate from the database.
    // Opened straight off disk it falls back to the seeded local workspace.
    if (WS.hasApi()) {
      let me = null;
      try { me = await WS.auth.me(); } catch (e) {}
      if (me && me.login_required && !me.authenticated) return renderLogin("");
      return boot();
    }

    renderNav();
    paintStatus();
    go("overview");
    window.__drd = { ws, state, go, E, D, WS };
  }
  document.addEventListener("DOMContentLoaded", init);
})();
