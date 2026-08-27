/* Explee clone — application logic
 * - Natural-language ICP parsing
 * - Semantic-style scoring / search over the built-in prospect DB
 * - Filters, lead lists (localStorage), CSV export, AI outreach drafting
 */
(function () {
  "use strict";

  const DB = window.EXPLEE_DB;
  const COMPANIES = DB.companies;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ------------------------------------------------------------------ state
  const state = {
    query: "",
    parsed: null,
    results: [],
    filters: { industries: new Set(), size: "any", country: "", verifiedOnly: false, sort: "match" },
    list: loadList(),
    lastCompanyId: null,
  };

  const FAV_COLORS = ["#6c5ce7", "#00b894", "#0984e3", "#e17055", "#e84393", "#fdcb6e", "#00cec9", "#a29bfe"];
  const favColor = (name) => FAV_COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % FAV_COLORS.length];
  const initials = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  // ------------------------------------------------------------------ NL parsing
  const COUNTRY_ALIASES = {
    "uk": "United Kingdom", "united kingdom": "United Kingdom", "britain": "United Kingdom", "england": "United Kingdom",
    "us": "United States", "usa": "United States", "united states": "United States", "america": "United States",
    "germany": "Germany", "france": "France", "canada": "Canada", "netherlands": "Netherlands",
    "australia": "Australia", "india": "India", "ireland": "Ireland", "sweden": "Sweden",
    "spain": "Spain", "singapore": "Singapore", "nigeria": "Nigeria", "africa": "Nigeria",
    "europe": "__EUROPE__",
  };
  const EUROPE = ["United Kingdom", "Germany", "France", "Netherlands", "Ireland", "Sweden", "Spain"];

  const INDUSTRY_KEYWORDS = {
    "Fintech": ["fintech", "finance", "financial", "payments", "payment", "banking", "lending", "payroll", "billing"],
    "SaaS": ["saas", "software", "b2b software", "platform", "devtools", "developer tools", "productivity"],
    "E-commerce": ["ecommerce", "e-commerce", "commerce", "retail", "dtc", "shopify", "online store"],
    "HealthTech": ["health", "healthtech", "healthcare", "medical", "clinical", "telehealth", "medtech"],
    "AI / ML": ["ai", "artificial intelligence", "machine learning", "ml", "llm", "computer vision", "data"],
    "Marketing": ["marketing", "adtech", "ads", "advertising", "social media", "content", "demand gen"],
    "EdTech": ["edtech", "education", "learning", "training", "lms", "e-learning"],
    "Logistics": ["logistics", "supply chain", "delivery", "warehouse", "fulfillment", "shipping"],
    "Cybersecurity": ["cybersecurity", "security", "infosec", "cyber", "fraud", "identity"],
    "CleanTech": ["cleantech", "climate", "green", "solar", "energy", "carbon", "esg", "agtech", "sustainability"],
  };

  function parseQuery(q) {
    const text = " " + q.toLowerCase() + " ";
    const parsed = { raw: q, industries: [], country: null, sizeMin: null, sizeMax: null, keywords: [] };

    // industries
    for (const [ind, kws] of Object.entries(INDUSTRY_KEYWORDS)) {
      if (kws.some((k) => text.includes(" " + k) || text.includes(k + " "))) parsed.industries.push(ind);
    }

    // country
    for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
      if (text.includes(" " + alias + " ") || text.includes(" in " + alias) || text.endsWith(alias + " ")) {
        parsed.country = canonical; break;
      }
    }

    // size — "under 30", "under 30 employees", "less than 50", "over 100", "10-50", "50+"
    let m;
    if ((m = text.match(/under (\d+)/)) || (m = text.match(/less than (\d+)/)) || (m = text.match(/fewer than (\d+)/))) {
      parsed.sizeMax = +m[1];
    }
    if ((m = text.match(/over (\d+)/)) || (m = text.match(/more than (\d+)/)) || (m = text.match(/(\d+)\+/))) {
      parsed.sizeMin = +m[1];
    }
    if ((m = text.match(/(\d+)\s*[-–to]+\s*(\d+)/))) { parsed.sizeMin = +m[1]; parsed.sizeMax = +m[2]; }
    if (/\bstartups?\b|\bearly[- ]stage\b|\bseed\b/.test(text) && parsed.sizeMax == null && parsed.sizeMin == null) {
      parsed.sizeMax = 50; // heuristic: "startups" => small
    }
    if (/\benterprise\b|\blarge\b/.test(text) && parsed.sizeMin == null) parsed.sizeMin = 100;

    // free keywords (for semantic match) — words not consumed by structure
    const stop = new Set(["in","the","a","an","and","or","of","with","for","under","over","less","than","more","fewer",
      "startups","startup","companies","company","employees","people","that","are","is","find","show","me","to","using","who"]);
    parsed.keywords = q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
      .filter((w) => w && w.length > 2 && !stop.has(w) && isNaN(+w));

    return parsed;
  }

  // ------------------------------------------------------------------ scoring
  function scoreCompany(c, p) {
    let score = 0, reasons = 0;

    if (p.industries.length) {
      if (p.industries.includes(c.industry)) { score += 45; reasons++; }
      else return { score: 0 }; // hard filter on explicit industry
    }
    if (p.country) {
      const ok = p.country === "__EUROPE__" ? EUROPE.includes(c.country) : c.country === p.country;
      if (ok) { score += 25; reasons++; } else return { score: 0 };
    }
    if (p.sizeMax != null) { if (c.size <= p.sizeMax) { score += 15; reasons++; } else return { score: 0 }; }
    if (p.sizeMin != null) { if (c.size >= p.sizeMin) { score += 15; reasons++; } else return { score: 0 }; }

    // semantic-ish keyword match on tags + text
    const hay = (c.name + " " + c.desc + " " + c.sub + " " + c.tags.join(" ")).toLowerCase();
    let kwHits = 0;
    p.keywords.forEach((k) => { if (hay.includes(k)) { kwHits++; } });
    if (p.keywords.length) {
      const frac = kwHits / p.keywords.length;
      score += Math.round(frac * 30);
      if (kwHits) reasons++;
    }

    // baseline relevance so broad queries still rank sensibly
    if (reasons === 0) score += 18;
    score += Math.min(8, c.contacts.filter((x) => x.verified).length * 4); // richer data ranks higher

    // Map the raw signal into a realistic 58–99 band with small deterministic jitter,
    // so results differentiate instead of all pinning to the ceiling.
    const jitter = ([...c.name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 5) - 2; // -2..+2
    const final = Math.max(55, Math.min(99, Math.round(58 + score * 0.34 + jitter)));
    return { score: final };
  }

  function runSearch(q) {
    state.query = q;
    state.parsed = parseQuery(q);
    const scored = COMPANIES
      .map((c) => ({ c, s: scoreCompany(c, state.parsed).score }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    state.results = scored.map((x) => ({ ...x.c, _match: x.s }));
  }

  // ------------------------------------------------------------------ lookalike
  function lookalike(company) {
    state.query = "Companies similar to " + company.name;
    state.parsed = { raw: state.query, industries: [company.industry], country: null, sizeMin: null, sizeMax: null, keywords: company.tags.slice(), lookalikeOf: company.name };
    const tags = new Set(company.tags);
    const scored = COMPANIES.filter((c) => c.id !== company.id).map((c) => {
      let s = 0;
      if (c.industry === company.industry) s += 40;
      const overlap = c.tags.filter((t) => tags.has(t)).length;
      s += overlap * 12;
      const sizeCloseness = 1 - Math.min(1, Math.abs(c.size - company.size) / 150);
      s += sizeCloseness * 15;
      return { c, s: Math.min(99, 45 + s) };
    }).filter((x) => x.s >= 55).sort((a, b) => b.s - a.s).slice(0, 12);
    state.results = scored.map((x) => ({ ...x.c, _match: Math.round(x.s) }));
    switchView("search");
    renderResults();
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast(`Found ${state.results.length} lookalikes of ${company.name}`);
  }

  // ------------------------------------------------------------------ filters
  function applyFilters(list) {
    const f = state.filters;
    let out = list.filter((c) => {
      if (f.industries.size && !f.industries.has(c.industry)) return false;
      if (f.country && c.country !== f.country) return false;
      if (f.verifiedOnly && !c.contacts.some((x) => x.verified)) return false;
      if (f.size !== "any") {
        if (f.size === "1-20" && !(c.size <= 20)) return false;
        if (f.size === "21-50" && !(c.size > 20 && c.size <= 50)) return false;
        if (f.size === "51-100" && !(c.size > 50 && c.size <= 100)) return false;
        if (f.size === "100+" && !(c.size > 100)) return false;
      }
      return true;
    });
    if (f.sort === "match") out.sort((a, b) => b._match - a._match);
    if (f.sort === "size-desc") out.sort((a, b) => b.size - a.size);
    if (f.sort === "size-asc") out.sort((a, b) => a.size - b.size);
    if (f.sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }

  // ------------------------------------------------------------------ rendering: results
  function renderParsed() {
    const p = state.parsed;
    if (!p) return "";
    const tokens = [];
    if (p.lookalikeOf) tokens.push(tok("lookalike", p.lookalikeOf));
    p.industries.forEach((i) => tokens.push(tok("industry", i)));
    if (p.country && p.country !== "__EUROPE__") tokens.push(tok("location", p.country));
    if (p.country === "__EUROPE__") tokens.push(tok("location", "Europe"));
    if (p.sizeMax != null && p.sizeMin != null) tokens.push(tok("size", `${p.sizeMin}–${p.sizeMax} employees`));
    else if (p.sizeMax != null) tokens.push(tok("size", `≤ ${p.sizeMax} employees`));
    else if (p.sizeMin != null) tokens.push(tok("size", `≥ ${p.sizeMin} employees`));
    p.keywords.filter((k) => !p.lookalikeOf).slice(0, 4).forEach((k) => tokens.push(tok("keyword", k)));
    if (!tokens.length) return "";
    return `<div class="parsed"><span class="rq" style="align-self:center;margin-right:4px">AI understood:</span>${tokens.join("")}</div>`;
  }
  const tok = (k, v) => `<span class="token"><span class="k">${k}</span>${escapeHtml(v)}</span>`;

  function renderResults() {
    switchView("search");
    $("#hero").style.display = "none";
    const filtered = applyFilters(state.results);
    const wrap = $("#results");
    wrap.innerHTML = `
      <div class="inline-search">
        <span class="si">🔎</span>
        <input id="inlineSearch" type="text" autocomplete="off" value="${escapeAttr(state.query)}" placeholder="Describe your ideal customer…" />
        <button class="btn small" id="inlineSearchBtn">Search ✦</button>
      </div>
      <div class="results-head">
        <div class="rq"><b>${applyFilters(state.results).length}</b> compan${applyFilters(state.results).length === 1 ? "y" : "ies"} match your search</div>
        <div class="actions">
          <button class="btn ghost small" id="exportResultsBtn">⬇ Export CSV</button>
          <button class="btn small" id="saveAllBtn">＋ Save all to list</button>
        </div>
      </div>
      ${renderParsed()}
      <div class="results-layout">
        <aside class="filters">${renderFilters(filtered.length)}</aside>
        <div id="cards"></div>
      </div>`;
    const cards = $("#cards", wrap);
    if (!filtered.length) {
      cards.innerHTML = `<div class="empty"><div class="em">🔍</div><b>No matches</b><p>Try widening your filters or rephrasing the search.</p></div>`;
    } else {
      cards.innerHTML = filtered.map(renderCard).join("");
    }
    wireResultsEvents(filtered);
  }

  function renderFilters(n) {
    const inds = [...new Set(COMPANIES.map((c) => c.industry))].sort();
    const countries = [...new Set(COMPANIES.map((c) => c.country))].sort();
    const f = state.filters;
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">Filters</h3>
        <button class="clear" id="clearFilters">Reset</button>
      </div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px">${n} result${n === 1 ? "" : "s"}</div>
      <div class="fgroup">
        <label>Industry</label>
        ${inds.map((i) => `<label class="fopt"><input type="checkbox" data-ind="${i}" ${f.industries.has(i) ? "checked" : ""}>${i}</label>`).join("")}
      </div>
      <div class="fgroup">
        <label>Company size</label>
        <select class="fselect" id="sizeFilter">
          ${["any","1-20","21-50","51-100","100+"].map((s) => `<option value="${s}" ${f.size === s ? "selected" : ""}>${s === "any" ? "Any size" : s + " employees"}</option>`).join("")}
        </select>
      </div>
      <div class="fgroup">
        <label>Location</label>
        <select class="fselect" id="countryFilter">
          <option value="">Any location</option>
          ${countries.map((c) => `<option value="${c}" ${f.country === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>
      <div class="fgroup">
        <label class="fopt"><input type="checkbox" id="verifiedOnly" ${f.verifiedOnly ? "checked" : ""}> Verified email only</label>
      </div>
      <div class="fgroup">
        <label>Sort by</label>
        <select class="fselect" id="sortFilter">
          <option value="match" ${f.sort === "match" ? "selected" : ""}>Best match</option>
          <option value="size-desc" ${f.sort === "size-desc" ? "selected" : ""}>Largest first</option>
          <option value="size-asc" ${f.sort === "size-asc" ? "selected" : ""}>Smallest first</option>
          <option value="name" ${f.sort === "name" ? "selected" : ""}>Name A–Z</option>
        </select>
      </div>`;
  }

  function renderCard(c) {
    const verified = c.contacts.filter((x) => x.verified).length;
    const inList = state.list.some((x) => x.id === c.id);
    const cls = c._match >= 75 ? "match" : "match mid";
    return `
      <div class="card" data-id="${c.id}">
        <div class="fav" style="background:${favColor(c.name)}">${initials(c.name)}</div>
        <div>
          <div class="cname">
            <h4>${escapeHtml(c.name)}</h4>
            <span class="dom">${escapeHtml(c.domain)}</span>
          </div>
          <div class="cdesc">${escapeHtml(c.desc)}</div>
          <div class="meta">
            <span>🏷 ${c.industry}</span>
            <span>📍 ${c.city}, ${c.country}</span>
            <span>👥 ${c.size} employees</span>
            <span>💰 ${c.revenue}</span>
            <span>📅 Founded ${c.founded}</span>
          </div>
          <div class="tagrow">${c.tags.slice(0, 5).map((t) => `<span class="tag">${t}</span>`).join("")}</div>
        </div>
        <div class="right">
          <span class="${cls}">${c._match}% match</span>
          <span class="contacts-badge">${c.contacts.length} contact${c.contacts.length === 1 ? "" : "s"} · ${verified} verified</span>
          <button class="btn small ${inList ? "ghost" : ""}" data-save="${c.id}">${inList ? "✓ Saved" : "＋ Save"}</button>
          <button class="btn ghost small" data-view="${c.id}">View</button>
        </div>
      </div>`;
  }

  function wireResultsEvents(filtered) {
    const inline = $("#inlineSearch");
    const runInline = () => { const q = inline.value.trim(); if (!q) return; state.filters = { industries: new Set(), size: "any", country: "", verifiedOnly: false, sort: "match" }; $("#results").innerHTML = `<div class="loading"><div class="spinner"></div>Scanning 75M companies for “${escapeHtml(q)}”…</div>`; setTimeout(() => { runSearch(q); renderResults(); }, 500); };
    $("#inlineSearchBtn").onclick = runInline;
    inline.addEventListener("keydown", (e) => { if (e.key === "Enter") runInline(); });
    $("#exportResultsBtn").onclick = () => exportCSV(filtered, "explee-results.csv");
    $("#saveAllBtn").onclick = () => { filtered.forEach(saveToList); renderResults(); toast(`Saved ${filtered.length} companies to your list`); };
    $("#clearFilters").onclick = () => { state.filters = { industries: new Set(), size: "any", country: "", verifiedOnly: false, sort: "match" }; renderResults(); };
    $$("[data-ind]").forEach((el) => el.onchange = () => { el.checked ? state.filters.industries.add(el.dataset.ind) : state.filters.industries.delete(el.dataset.ind); renderResults(); });
    $("#sizeFilter").onchange = (e) => { state.filters.size = e.target.value; renderResults(); };
    $("#countryFilter").onchange = (e) => { state.filters.country = e.target.value; renderResults(); };
    $("#verifiedOnly").onchange = (e) => { state.filters.verifiedOnly = e.target.checked; renderResults(); };
    $("#sortFilter").onchange = (e) => { state.filters.sort = e.target.value; renderResults(); };
    $$("[data-save]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const c = COMPANIES.find((x) => x.id === b.dataset.save); saveToList(c); renderResults(); toast(`${c.name} saved to list`); });
    $$("[data-view]").forEach((b) => b.onclick = () => openCompany(b.dataset.view));
    $$(".card").forEach((card) => card.onclick = (e) => { if (e.target.closest("button")) return; openCompany(card.dataset.id); });
  }

  // ------------------------------------------------------------------ company modal
  function openCompany(id) {
    const base = COMPANIES.find((x) => x.id === id);
    if (!base) return;
    const fromResults = state.results.find((x) => x.id === id);
    const c = fromResults || base; // prefer the scored result so _match is available
    state.lastCompanyId = id;
    const inList = state.list.some((x) => x.id === c.id);
    const body = `
      <div class="modal-head">
        <div class="fav" style="background:${favColor(c.name)}">${initials(c.name)}</div>
        <div>
          <h2>${escapeHtml(c.name)}</h2>
          <div class="sub">${escapeHtml(c.sub)} · <a href="${c.website}" target="_blank" rel="noopener" style="color:var(--brand-2)">${escapeHtml(c.domain)} ↗</a></div>
        </div>
        <button class="x" id="closeModal">×</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:20px">${escapeHtml(c.desc)}</p>
        <div class="kv">
          <div><div class="k">Industry</div><div class="v">${c.industry}</div></div>
          <div><div class="k">Headquarters</div><div class="v">${c.city}, ${c.country}</div></div>
          <div><div class="k">Employees</div><div class="v">${c.size}</div></div>
          <div><div class="k">Est. revenue</div><div class="v">${c.revenue}</div></div>
          <div><div class="k">Founded</div><div class="v">${c.founded}</div></div>
          <div><div class="k">Match score</div><div class="v" style="color:var(--green)">${c._match || "—"}%</div></div>
        </div>
        <div class="sec-title">Decision makers (${c.contacts.length})</div>
        <div id="contactList">
          ${c.contacts.map((p) => `
            <div class="contact">
              <div class="ci">${initials(p.name)}</div>
              <div>
                <div class="cn">${escapeHtml(p.name)}</div>
                <div class="ct">${escapeHtml(p.title)} · ${p.seniority}</div>
                <div class="em">${escapeHtml(p.email)}</div>
              </div>
              <div class="cright">
                <span class="vbadge ${p.verified ? "ok" : "no"}">${p.verified ? "✓ Verified" : "◷ Unverified"}</span>
                <button class="btn ghost small" data-draft="${escapeAttr(p.name)}">✦ Draft email</button>
              </div>
            </div>`).join("")}
        </div>
        <div class="sec-title" style="margin-top:24px">AI outreach draft</div>
        <div class="aibox">
          <textarea id="aiMsg" placeholder="Click ✦ Draft email on a contact, or Generate below, to write a personalized opener…"></textarea>
          <div class="row">
            <button class="btn small" id="genMsg">✦ Generate message</button>
            <button class="btn ghost small" id="copyMsg">⧉ Copy</button>
            <span class="hint">Personalized from company + contact context</span>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn ${inList ? "ghost" : ""}" id="modalSave">${inList ? "✓ Saved to list" : "＋ Save to list"}</button>
        <button class="btn ghost" id="lookalikeBtn">◎ Find lookalikes</button>
        <button class="btn ghost" id="exportOne">⬇ Export this company</button>
      </div>`;
    $("#modalContent").innerHTML = body;
    $("#modalBg").classList.add("open");

    $("#closeModal").onclick = closeModal;
    $("#modalSave").onclick = () => { saveToList(c); openCompany(id); renderResults(); toast(`${c.name} saved to list`); };
    $("#lookalikeBtn").onclick = () => { closeModal(); lookalike(c); };
    $("#exportOne").onclick = () => exportCSV([c], `${c.domain}.csv`);
    $("#genMsg").onclick = () => { $("#aiMsg").value = draftMessage(c, c.contacts[0]); };
    $("#copyMsg").onclick = () => { copyText($("#aiMsg").value); toast("Message copied"); };
    $$("[data-draft]").forEach((b) => b.onclick = () => { const p = c.contacts.find((x) => x.name === b.dataset.draft); $("#aiMsg").value = draftMessage(c, p); $("#aiMsg").scrollIntoView({ behavior: "smooth", block: "center" }); });
  }
  function closeModal() { $("#modalBg").classList.remove("open"); }

  // Template-driven "AI" personalization (deterministic, offline)
  function draftMessage(c, contact) {
    const first = contact.name.split(" ")[0];
    const role = /founder|ceo|chief exec/i.test(contact.title) ? "building" : "leading";
    return `Hi ${first},

I came across ${c.name} — "${c.desc}" Really like what you're ${role} in the ${c.industry.toLowerCase()} space out of ${c.city}.

We help ${c.industry} teams around your size (~${c.size} people) turn a plain-English description of their ideal customer into a verified lead list in seconds — no manual list-building. Given you're scaling ${c.sub.toLowerCase()}, I thought it might be worth a look.

Open to a quick 15-minute call next week?

Best,
{{your name}}`;
  }

  // ------------------------------------------------------------------ lists (localStorage)
  function loadList() { try { return JSON.parse(localStorage.getItem("explee_list") || "[]"); } catch (e) { return []; } }
  function persistList() { try { localStorage.setItem("explee_list", JSON.stringify(state.list)); } catch (e) {} updateListBadge(); }
  function saveToList(c) {
    if (state.list.some((x) => x.id === c.id)) return;
    state.list.push({ id: c.id, name: c.name, domain: c.domain, industry: c.industry, city: c.city, country: c.country,
      size: c.size, revenue: c.revenue, contacts: c.contacts });
    persistList();
  }
  function removeFromList(id) { state.list = state.list.filter((x) => x.id !== id); persistList(); renderLists(); }
  function updateListBadge() { const n = state.list.length; $("#listBadge").textContent = n; $("#listBadge").style.display = n ? "inline-block" : "none"; }

  function renderLists() {
    const rows = [];
    state.list.forEach((c) => {
      const primary = c.contacts[0] || {};
      rows.push(`
        <tr>
          <td class="co">${escapeHtml(c.name)}<div style="font-size:11.5px;color:var(--faint)">${escapeHtml(c.domain)}</div></td>
          <td>${c.industry}</td>
          <td>${c.city}, ${c.country}</td>
          <td>${c.size}</td>
          <td>${escapeHtml(primary.name || "—")}<div style="font-size:11.5px;color:var(--faint)">${escapeHtml(primary.title || "")}</div></td>
          <td class="em">${escapeHtml(primary.email || "—")} ${primary.verified ? '<span class="saved-flag">✓</span>' : ""}</td>
          <td style="text-align:right"><button class="remove" data-rm="${c.id}" title="Remove">✕</button></td>
        </tr>`);
    });
    $("#listView").innerHTML = `
      <div class="list-head">
        <div>
          <h1>My lead list</h1>
          <div style="color:var(--muted);font-size:14px;margin-top:4px">${state.list.length} compan${state.list.length === 1 ? "y" : "ies"} · ${state.list.reduce((a, c) => a + c.contacts.length, 0)} contacts</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn ghost" id="clearListBtn" ${state.list.length ? "" : "disabled"}>Clear list</button>
          <button class="btn" id="exportListBtn" ${state.list.length ? "" : "disabled"}>⬇ Export CSV</button>
        </div>
      </div>
      ${state.list.length ? `
      <table class="table">
        <thead><tr><th>Company</th><th>Industry</th><th>Location</th><th>Size</th><th>Primary contact</th><th>Email</th><th></th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>` : `<div class="empty"><div class="em">📋</div><b>Your list is empty</b><p>Run a search and hit “Save” on companies to build a targeted lead list.</p><button class="btn" id="goSearch" style="margin-top:16px">Start a search</button></div>`}`;

    if (state.list.length) {
      $("#exportListBtn").onclick = () => exportContactsCSV(state.list, "explee-lead-list.csv");
      $("#clearListBtn").onclick = () => { if (confirm("Clear your entire lead list?")) { state.list = []; persistList(); renderLists(); } };
      $$("[data-rm]").forEach((b) => b.onclick = () => removeFromList(b.dataset.rm));
    } else {
      $("#goSearch").onclick = () => { switchView("search"); $("#searchInput").focus(); };
    }
  }

  // ------------------------------------------------------------------ CSV export
  function exportCSV(companies, filename) {
    const header = ["Company", "Domain", "Industry", "City", "Country", "Employees", "Revenue", "Match %", "Contacts", "Verified emails"];
    const rows = companies.map((c) => [c.name, c.domain, c.industry, c.city, c.country, c.size, c.revenue, c._match || "",
      c.contacts.length, c.contacts.filter((x) => x.verified).length]);
    download(filename, toCSV([header, ...rows]));
    toast(`Exported ${companies.length} companies`);
  }
  function exportContactsCSV(companies, filename) {
    const header = ["Company", "Domain", "Industry", "Location", "Employees", "Contact name", "Title", "Seniority", "Email", "Email status", "LinkedIn"];
    const rows = [];
    companies.forEach((c) => c.contacts.forEach((p) => rows.push([c.name, c.domain, c.industry, `${c.city}, ${c.country}`, c.size,
      p.name, p.title, p.seniority, p.email, p.verified ? "Verified" : "Unverified", "linkedin.com/" + p.linkedin])));
    download(filename, toCSV([header, ...rows]));
    toast(`Exported ${rows.length} contacts`);
  }
  function toCSV(rows) { return rows.map((r) => r.map((v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n"); }
  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ------------------------------------------------------------------ misc UI
  function switchView(name) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === name));
    $$(".topnav button").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
    if (name === "lists") renderLists();
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.innerHTML = `<span class="dot"></span>${escapeHtml(msg)}`;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "0.3s"; setTimeout(() => t.remove(), 300); }, 2600);
  }
  function copyText(t) { navigator.clipboard && navigator.clipboard.writeText(t).catch(() => {}); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  function doSearch() {
    const q = $("#searchInput").value.trim();
    if (!q) { $("#searchInput").focus(); return; }
    $("#hero").style.display = "none";
    $("#results").innerHTML = `<div class="loading"><div class="spinner"></div>Scanning 75M companies for “${escapeHtml(q)}”…</div>`;
    switchView("search");
    setTimeout(() => { runSearch(q); renderResults(); }, 650); // simulate query latency
  }

  // ------------------------------------------------------------------ init
  function init() {
    $("#searchBtn").onclick = doSearch;
    $("#searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
    $$(".chip").forEach((ch) => ch.onclick = () => { $("#searchInput").value = ch.dataset.q; doSearch(); });
    $$(".topnav button").forEach((b) => b.onclick = () => {
      switchView(b.dataset.nav);
      if (b.dataset.nav === "search" && !state.results.length) { $("#hero").style.display = ""; }
    });
    $("#modalBg").onclick = (e) => { if (e.target.id === "modalBg") closeModal(); };
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
    $("#brandHome").onclick = () => { switchView("search"); $("#hero").style.display = ""; $("#results").innerHTML = ""; $("#searchInput").value = ""; };
    updateListBadge();
    // expose a couple hooks for testing
    window.__explee = { runSearch, state, doSearch };
  }
  document.addEventListener("DOMContentLoaded", init);
})();
