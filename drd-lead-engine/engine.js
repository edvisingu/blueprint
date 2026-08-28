/* Dr. D Lead Engineering System — intelligence engine.
 * Pure functions: NL query parsing, lead scoring, research synthesis,
 * reply-intent classification, email generation, segments, analytics.
 * No DOM access here so every piece is independently testable.
 */
window.DRD_ENGINE = (function () {
  "use strict";
  const D = window.DRD_DATA;

  // ===================================================== NL QUERY PARSING
  const COUNTRY_ALIASES = {
    "canada": "Canada", "canadian": "Canada", "ontario": "Canada", "toronto": "Canada",
    "us": "United States", "usa": "United States", "united states": "United States", "american": "United States",
    "uk": "United Kingdom", "united kingdom": "United Kingdom", "britain": "United Kingdom", "british": "United Kingdom",
    "ireland": "Ireland", "australia": "Australia", "germany": "Germany", "netherlands": "Netherlands",
  };
  const REGION_WORDS = { "ontario": "Ontario", "british columbia": "British Columbia", "quebec": "Quebec", "alberta": "Alberta", "england": "England", "scotland": "Scotland" };
  const INDUSTRY_WORDS = {
    "Higher Education": ["higher education", "university", "universities", "college", "colleges", "polytechnic", "post-secondary", "postsecondary", "institution", "institutions", "campus"],
    "EdTech": ["edtech", "ed tech", "education technology", "learning software", "lms"],
    "Professional Services": ["professional services", "consulting", "consultancy", "consultancies", "law firm", "accounting", "advisory"],
    "Corporate Training": ["corporate training", "l&d", "learning and development", "training", "workforce development"],
    "Agency": ["agency", "agencies", "creative studio", "marketing agency"],
    "SaaS": ["saas", "software", "b2b software", "platform", "developer tools"],
    "Fintech": ["fintech", "payments", "lending", "financial", "banking", "payroll"],
    "HealthTech": ["healthtech", "health tech", "healthcare", "clinical", "telehealth", "medical"],
    "Nonprofit": ["nonprofit", "non-profit", "charity", "foundation", "association"],
    "Cybersecurity": ["cybersecurity", "security", "infosec"],
  };
  const TECH_WORDS = ["hubspot", "salesforce", "canvas lms", "canvas", "banner", "slate crm", "slate", "aws", "stripe", "snowflake", "segment", "react", "workday", "docebo", "okta", "zoom", "webflow", "figma", "plaid", "epic", "twilio", "qualtrics", "articulate"];
  const SIGNAL_PATTERNS = [
    { re: /hir(?:ing|ed) (?:sales|revenue|gtm)/i, signal: "Hiring sales leaders" },
    { re: /recently funded|raised|funding/i, signal: "Recently funded" },
    { re: /new (?:executive|exec|leader|hire)/i, signal: "New executive hire" },
    { re: /expand(?:ing|ed)?/i, signal: "Expanding to new region" },
    { re: /ai roles?|ai hiring|hiring ai/i, signal: "Job posts for AI roles" },
    { re: /ai policy/i, signal: "Published AI policy" },
    { re: /new program|launched/i, signal: "Launched new program" },
  ];
  const SENIORITY_WORDS = { "c-suite": "C-Suite", "ceo": "C-Suite", "cto": "C-Suite", "cfo": "C-Suite", "chief": "C-Suite", "founder": "C-Suite", "executive": "C-Suite", "vp": "VP", "vice president": "VP", "head of": "Head", "director": "Director", "dean": "Director", "manager": "Manager" };
  const DEPT_WORDS = { "sales": "Sales", "marketing": "Marketing", "product": "Product & Eng", "engineering": "Product & Eng", "l&d": "People & L&D", "hr": "People & L&D", "people": "People & L&D", "academic": "Academic", "teaching": "Academic" };

  const STOP = new Set(["find","show","me","get","all","the","a","an","and","or","of","with","that","who","are","is","in","at","to","for","from","under","over","between","less","than","more","fewer","companies","company","people","person","organizations","employees","staff","using","use","uses","have","has","recently","their","its"]);

  function parseQuery(q) {
    const t = " " + String(q).toLowerCase().replace(/[^a-z0-9&+\-\s.]/g, " ").replace(/\s+/g, " ") + " ";
    const c = { raw: q, industries: [], country: null, region: null, city: null, sizeMin: null, sizeMax: null,
      tech: [], signals: [], titles: [], seniority: [], departments: [], keywords: [], funded: false };

    for (const [ind, words] of Object.entries(INDUSTRY_WORDS))
      if (words.some((w) => t.includes(" " + w + " ") || t.includes(" " + w + "s "))) c.industries.push(ind);

    for (const [w, r] of Object.entries(REGION_WORDS)) if (t.includes(" " + w + " ")) c.region = r;
    for (const [w, cn] of Object.entries(COUNTRY_ALIASES)) if (t.includes(" " + w + " ")) { c.country = cn; break; }
    D.vocab.GEO.forEach((g) => g.cities.forEach((city) => { if (t.includes(" " + city.toLowerCase() + " ")) { c.city = city; c.country = g.country; } }));

    TECH_WORDS.forEach((w) => { if (t.includes(" " + w)) c.tech.push(w); });
    SIGNAL_PATTERNS.forEach((s) => { if (s.re.test(q)) c.signals.push(s.signal); });
    if (/\bfunded\b|\braised\b|\bfunding\b/.test(t)) c.funded = true;

    // size: "25-200", "under 50", "over 100", "50+", "between 10 and 90"
    let m;
    if ((m = t.match(/(\d+)\s*(?:-|–|to|and)\s*(\d+)/))) { c.sizeMin = +m[1]; c.sizeMax = +m[2]; }
    if ((m = t.match(/(?:under|below|less than|fewer than|up to)\s*(\d+)/))) c.sizeMax = +m[1];
    if ((m = t.match(/(?:over|above|more than|at least)\s*(\d+)/))) c.sizeMin = +m[1];
    if ((m = t.match(/(\d+)\s*\+/))) c.sizeMin = +m[1];
    if (/\bstartups?\b|\bearly[- ]stage\b|\bsmall\b/.test(t) && c.sizeMax == null && c.sizeMin == null) c.sizeMax = 60;
    if (/\benterprise\b|\blarge\b/.test(t) && c.sizeMin == null) c.sizeMin = 400;

    for (const [w, s] of Object.entries(SENIORITY_WORDS)) if (t.includes(" " + w)) if (!c.seniority.includes(s)) c.seniority.push(s);
    for (const [w, d] of Object.entries(DEPT_WORDS)) if (t.includes(" " + w)) if (!c.departments.includes(d)) c.departments.push(d);
    ["ceo","cto","cfo","ciso","chro","dean","registrar","principal","provost","partner","founder","director of teaching & learning","head of l&d","vp academic"]
      .forEach((w) => { if (t.includes(" " + w)) c.titles.push(w); });

    c.keywords = t.split(" ").filter((w) => w.length > 2 && !STOP.has(w) && isNaN(+w));
    return c;
  }

  // ===================================================== MATCHING
  function companyMatches(co, c) {
    if (c.industries.length && !c.industries.includes(co.industry)) return false;
    if (c.country && co.country !== c.country) return false;
    if (c.region && co.region !== c.region) return false;
    if (c.city && co.city !== c.city) return false;
    if (c.sizeMin != null && co.size < c.sizeMin) return false;
    if (c.sizeMax != null && co.size > c.sizeMax) return false;
    if (c.funded && !co.funding) return false;
    if (c.tech.length && !c.tech.some((tw) => co.tech.some((ct) => ct.toLowerCase().includes(tw)))) return false;
    if (c.signals.length && !c.signals.some((s) => co.signals.includes(s))) return false;
    return true;
  }

  function searchCompanies(query, opts) {
    opts = opts || {};
    const c = typeof query === "string" ? parseQuery(query) : query;
    const icp = opts.icp || null;
    const out = [];
    D.companies.forEach((co) => {
      if (!companyMatches(co, c)) return;
      const sc = scoreCompany(co, c, icp);
      out.push(Object.assign({}, co, { _score: sc.total, _breakdown: sc, _reason: fitReason(co, c, icp) }));
    });
    out.sort((a, b) => b._score - a._score);
    return { criteria: c, results: out };
  }

  function searchPeople(query, opts) {
    opts = opts || {};
    const c = typeof query === "string" ? parseQuery(query) : query;
    const out = [];
    D.people.forEach((p) => {
      const co = companyById(p.companyId);
      if (!companyMatches(co, c)) return;
      if (c.seniority.length && !c.seniority.includes(p.seniority)) return;
      if (c.departments.length && !c.departments.includes(p.department)) return;
      if (c.titles.length && !c.titles.some((tw) => p.title.toLowerCase().includes(tw))) return;
      const sc = scoreCompany(co, c, opts.icp || null);
      const bonus = (p.seniority === "C-Suite" ? 8 : p.seniority === "VP" ? 5 : p.seniority === "Head" ? 3 : 0) + (p.verified ? 5 : 0);
      out.push(Object.assign({}, p, { company: co, _score: Math.min(99, sc.total + bonus), _breakdown: sc,
        _reason: `${p.title} at a ${co.size}-person ${co.industry.toLowerCase()} organization in ${co.city}. ${p.verified ? "Email verified." : "Email needs verification."}` }));
    });
    out.sort((a, b) => b._score - a._score);
    return { criteria: c, results: out };
  }

  // ===================================================== LEAD SCORING (spec §U)
  // Deterministic sub-scores that add to an explainable 0-100 overall score.
  function scoreCompany(co, c, icp) {
    // 1. Company fit (0-30)
    let companyFit = 12;
    if (c && c.industries.length && c.industries.includes(co.industry)) companyFit += 10;
    if (icp) {
      if (icp.industry === co.industry) companyFit += 12;
      if (icp.country && icp.country === co.country) companyFit += 4;
      if (icp.sizeMin && co.size >= icp.sizeMin) companyFit += 4;
    }
    companyFit = Math.min(30, companyFit);

    // 2. Buyer fit (0-20) — do the right roles exist here?
    const staff = D.peopleByCompany[co.id] || [];
    const senior = staff.filter((p) => p.seniority === "C-Suite" || p.seniority === "VP" || p.seniority === "Head").length;
    const buyerFit = Math.min(20, 6 + senior * 5);

    // 3. Intent signal (0-20)
    const intent = Math.min(20, co.signals.length * 7 + (co.funding ? 4 : 0));

    // 4. Timing (0-10)
    let timing = 3;
    if (co.funding && +co.funding.date >= 2025) timing += 4;
    if (co.signals.some((s) => /Hiring|New executive|Expanding/.test(s))) timing += 4;
    timing = Math.min(10, timing);

    // 5. Data confidence (0-10)
    const verified = staff.filter((p) => p.verified).length;
    const dataConfidence = Math.min(10, 2 + verified * 3);

    // 6. Personalization strength (0-10) — how much do we have to write about?
    const personalization = Math.min(10, 2 + co.signals.length * 2 + co.tech.length + (co.funding ? 2 : 0));

    const total = Math.max(38, Math.min(99, companyFit + buyerFit + intent + timing + dataConfidence + personalization));
    return { companyFit, buyerFit, intent, timing, dataConfidence, personalization, total,
      band: total >= 85 ? "HIGH PRIORITY" : total >= 70 ? "STRONG" : total >= 55 ? "MODERATE" : "LOW" };
  }

  function fitReason(co, c, icp) {
    const bits = [];
    if (icp && icp.industry === co.industry) bits.push(`matches your "${icp.name}" ICP`);
    else if (c && c.industries.includes(co.industry)) bits.push(`${co.industry} match`);
    if (co.signals.length) bits.push(co.signals[0].toLowerCase());
    if (co.funding) bits.push(`${co.funding.round} ${co.funding.amount} (${co.funding.date})`);
    const staff = D.peopleByCompany[co.id] || [];
    if (staff.length) bits.push(`${staff.length} reachable decision-maker${staff.length === 1 ? "" : "s"}`);
    return bits.length ? bits.join(" · ") : `${co.size}-person ${co.industry.toLowerCase()} organization in ${co.city}`;
  }

  // ===================================================== DEEP RESEARCH (spec §D)
  function deepResearch(co, person) {
    const staff = D.peopleByCompany[co.id] || [];
    const dm = person || staff[0];
    const pains = co.pains || [];
    return {
      companyId: co.id, generatedAt: Date.now(),
      overview: `${co.name} is a ${co.size}-person ${co.sub.toLowerCase()} organization in the ${co.industry.toLowerCase()} sector, headquartered in ${co.city}, ${co.country}. ${co.desc} Founded ${co.founded}; estimated revenue ${co.revenue}.`,
      buyingSignals: co.signals.length ? co.signals.map((s) => ({ signal: s, weight: /Hiring|funded|executive/i.test(s) ? "Strong" : "Moderate" }))
        : [{ signal: "No public trigger detected in the last 90 days", weight: "Weak" }],
      painPoints: pains.slice(0, 3),
      productFit: `Their ${co.industry.toLowerCase()} profile maps to the ${co.size > 200 ? "institution-wide readiness audit" : "focused training cohort"} offer. ${co.tech.length ? "Existing stack (" + co.tech.join(", ") + ") means integration friction is low." : ""}`,
      whyNow: co.funding && +co.funding.date >= 2025 ? `Fresh ${co.funding.round} capital (${co.funding.amount}, ${co.funding.date}) usually unlocks discretionary program budget within two quarters.`
        : co.signals.some((s) => /Hiring/.test(s)) ? "Active hiring signals a growth mandate with budget attached; new leaders buy in their first 90 days."
        : co.signals.some((s) => /AI policy/.test(s)) ? "They have published an AI position publicly, which means the mandate exists and implementation is the open gap."
        : "No urgent trigger. Treat as a nurture-tier account rather than a priority send.",
      competitors: pickCompetitors(co),
      initiatives: co.signals.length ? co.signals.map((s) => `Public signal: ${s}`) : ["No public initiatives detected"],
      technologies: co.tech,
      decisionMaker: dm ? { name: dm.name, title: dm.title, seniority: dm.seniority, email: dm.email, status: dm.emailStatus } : null,
      angles: buildAngles(co, dm),
      recommendation: co.signals.length >= 2 ? "Send now. Lead with the strongest trigger in the first line."
        : co.signals.length === 1 ? "Send this week. Anchor on the single trigger and keep the ask small."
        : "Hold for nurture. Not enough context for a credible personalized opener.",
      sources: [`${co.domain} (site analysis)`, "Public job postings", "Funding & press records", "Technology fingerprint"],
    };
  }
  function pickCompetitors(co) {
    return D.companies.filter((x) => x.id !== co.id && x.industry === co.industry && Math.abs(x.size - co.size) < co.size * 0.9)
      .slice(0, 3).map((x) => x.name);
  }
  function buildAngles(co, dm) {
    const a = [];
    if (co.signals.includes("Hiring sales leaders")) a.push("They are hiring revenue leaders — new leaders need their team ramped fast.");
    if (co.signals.includes("Published AI policy")) a.push("They published an AI policy — implementation support is the obvious next gap.");
    if (co.funding) a.push(`Recent ${co.funding.round} means budget cycles are open.`);
    if (co.tech.length) a.push(`They run ${co.tech[0]} — reference an integration-friendly rollout.`);
    if (dm && dm.seniority === "C-Suite") a.push("Executive contact: lead with business outcome, not curriculum detail.");
    if (!a.length) a.push(`Anchor on the sector-wide pressure: ${(co.pains || ["AI readiness"])[0]}.`);
    return a;
  }

  // ===================================================== LOOKALIKES (spec §E)
  function lookalikes(co, limit) {
    const fp = { industry: co.industry, sub: co.sub, size: co.size, country: co.country, tech: new Set(co.tech.map((t) => t.toLowerCase())) };
    return D.companies.filter((x) => x.id !== co.id).map((x) => {
      let s = 0; const why = [];
      if (x.industry === fp.industry) { s += 34; why.push("same industry"); }
      if (x.sub === fp.sub) { s += 14; why.push("same segment"); }
      if (x.country === fp.country) { s += 10; why.push("same market"); }
      const techOverlap = x.tech.filter((t) => fp.tech.has(t.toLowerCase())).length;
      if (techOverlap) { s += techOverlap * 7; why.push(`${techOverlap} shared technolog${techOverlap === 1 ? "y" : "ies"}`); }
      const sizeCloseness = 1 - Math.min(1, Math.abs(x.size - fp.size) / Math.max(120, fp.size * 2));
      s += sizeCloseness * 16;
      if (sizeCloseness > 0.75) why.push("similar headcount");
      if (x.signals.length) s += 4;
      return Object.assign({}, x, { _score: Math.min(99, Math.round(40 + s)), _reason: why.join(" · ") || "loose profile similarity" });
    }).filter((x) => x._score >= 58).sort((a, b) => b._score - a._score).slice(0, limit || 25);
  }

  // ===================================================== SEGMENTS (spec §F)
  function segments(criteriaFilter) {
    const map = {};
    D.companies.forEach((co) => {
      const key = co.industry;
      const m = map[key] || (map[key] = { name: key, companies: 0, people: 0, verified: 0, signalRich: 0, sizes: [], countries: {} });
      m.companies++;
      const staff = D.peopleByCompany[co.id] || [];
      m.people += staff.length;
      m.verified += staff.filter((p) => p.verified).length;
      if (co.signals.length) m.signalRich++;
      m.sizes.push(co.size);
      m.countries[co.country] = (m.countries[co.country] || 0) + 1;
    });
    return Object.values(map).map((m) => {
      const icp = D.icps.find((i) => i.industry === m.name);
      m.avgSize = Math.round(m.sizes.reduce((a, b) => a + b, 0) / m.sizes.length);
      m.topCountry = Object.entries(m.countries).sort((a, b) => b[1] - a[1])[0][0];
      m.coverage = Math.round((m.verified / Math.max(1, m.people)) * 100);
      m.signalRate = Math.round((m.signalRich / m.companies) * 100);
      m.fit = icp ? icp.fit : Math.max(35, Math.min(80, 40 + m.signalRate / 2 + m.coverage / 4));
      m.icp = icp || null;
      return m;
    }).sort((a, b) => b.fit - a.fit);
  }

  // ===================================================== EMAIL GENERATION (spec §H)
  const TONES = {
    direct: { greet: (f) => `Hi ${f},`, close: "Worth a 15-minute call?", sign: "— Andre" },
    consultative: { greet: (f) => `Hi ${f},`, close: "If it's useful I can share how two comparable institutions approached it.", sign: "— Andre" },
    warm: { greet: (f) => `Hi ${f},`, close: "Happy to send over a short outline if that's helpful.", sign: "— Andre" },
    executive: { greet: (f) => `${f},`, close: "Open to a brief call to see whether it maps to your plan?", sign: "— Andre" },
  };

  function generateEmail(co, person, opts) {
    opts = opts || {};
    const tone = TONES[opts.tone || "consultative"];
    const first = person.name.split(" ")[0];
    const research = deepResearch(co, person);
    const trigger = co.signals[0];
    const pain = (co.pains || ["AI readiness"])[0];
    const goal = opts.goal || "book a short call";

    const opener = trigger
      ? `Saw ${co.name} ${trigger.toLowerCase()} — that usually means the AI question moves from "should we" to "how, and who owns it."`
      : `I work with ${co.industry.toLowerCase()} teams around your size on ${pain}.`;

    const middle = co.industry === "Higher Education"
      ? `Most institutions I work with have a policy statement but no faculty adoption path behind it. The gap shows up as inconsistent assessment rules and staff who quietly avoid the tools.`
      : co.industry === "EdTech"
      ? `The teams selling into institutions right now are losing cycles to procurement, not to competitors. Governance language in the deck is usually what unlocks it.`
      : `The pattern I keep seeing: leadership has an AI mandate, and the team underneath it has no shared standard for what "good" looks like.`;

    const proof = `I run readiness audits and faculty/staff training cohorts that produce something defensible to a board, not a slide deck.`;

    const subject = trigger
      ? `${co.name} + ${trigger.toLowerCase()}`
      : `${pain} at ${co.name}`;

    const body = [tone.greet(first), "", opener, "", middle, "", proof, "", tone.close, tone.sign].join("\n");

    return { subject, body, tone: opts.tone || "consultative", goal,
      personalization: research.angles.slice(0, 2),
      strength: trigger ? "High — anchored on a live trigger" : "Medium — sector-level personalization only" };
  }

  function followUp(co, person, step) {
    const first = person.name.split(" ")[0];
    const bodies = [
      `Hi ${first},\n\nBumping this once in case it slipped. The short version: I help ${co.industry.toLowerCase()} teams turn an AI mandate into something staff actually use.\n\nWorth 15 minutes?\n\n— Andre`,
      `Hi ${first},\n\nLast note from me. If the timing is wrong I'll close the loop.\n\nIf it's useful later, the readiness audit is the usual starting point — it produces a board-ready picture in about three weeks.\n\n— Andre`,
    ];
    return { subject: `Re: ${co.name}`, body: bodies[Math.min(step - 1, bodies.length - 1)] };
  }

  // ===================================================== REPLY INTENT (spec §8)
  const INTENTS = [
    { key: "Meeting Request", hot: true, color: "good", re: /\b(calendar|book|schedule|available|what times?|let'?s (?:talk|meet|chat)|send an invite|next week works)\b/i },
    { key: "Interested", hot: true, color: "good", re: /\b(interested|tell me more|sounds good|keen|would like to (?:hear|learn)|send (?:more|over))\b/i },
    { key: "Pricing", hot: true, color: "good", re: /\b(pricing|price|cost|how much|budget|rates?|quote|proposal)\b/i },
    { key: "Question", hot: false, color: "warn", re: /\b(how does|what does|can you|do you|question|clarify|curious (?:about|how))\b/i },
    { key: "Referral", hot: false, color: "warn", re: /\b(right person|colleague|introduce|forward(?:ed|ing)? (?:this|you)|reach out to|speak (?:with|to) [A-Z])\b/i },
    { key: "Not Now", hot: false, color: "warn", re: /\b(next (?:quarter|year|semester)|revisit|circle back|not (?:right )?now|later this year|after (?:the )?budget)\b/i },
    { key: "Objection", hot: false, color: "warn", re: /\b(already (?:have|working)|we use|in-house|not a (?:fit|priority)|too expensive|no budget)\b/i },
    { key: "Out of Office", hot: false, color: "muted", re: /\b(out of (?:the )?office|on leave|annual leave|vacation|away until|parental leave)\b/i },
    { key: "Wrong Person", hot: false, color: "muted", re: /\b(not (?:the right|who|my)|wrong person|don'?t handle|no longer with|left the (?:company|organization))\b/i },
    { key: "Unsubscribe", hot: false, color: "bad", re: /\b(unsubscribe|remove me|stop (?:emailing|contacting)|take me off|opt out|do not contact)\b/i },
    { key: "Negative", hot: false, color: "bad", re: /\b(not interested|no thanks|no thank you|pass\b|spam|stop)\b/i },
  ];

  function classifyReply(text) {
    const t = String(text || "");
    // Order matters: hard negatives and compliance intents win over soft positives.
    const compliance = INTENTS.filter((i) => i.color === "bad");
    for (const i of compliance) if (i.re.test(t)) return verdict(i, t);
    for (const i of INTENTS) if (i.re.test(t)) return verdict(i, t);
    return { intent: "Neutral", hot: false, color: "muted", confidence: 42,
      rationale: "No clear intent language detected. Routed for human review.", action: "Review manually" };
  }
  function verdict(i, t) {
    const hits = (t.match(i.re) || []).length;
    return {
      intent: i.key, hot: i.hot, color: i.color,
      confidence: Math.min(97, 68 + hits * 12 + Math.min(12, Math.floor(t.length / 40))),
      rationale: `Matched ${i.key.toLowerCase()} language in the reply body.`,
      action: i.key === "Meeting Request" ? "Propose times and create the meeting"
        : i.key === "Pricing" ? "Send scoped pricing, then propose a call"
        : i.key === "Interested" ? "Reply with a concrete next step"
        : i.key === "Referral" ? "Thank them and open a thread with the named person"
        : i.key === "Unsubscribe" ? "Suppress permanently — no further contact"
        : i.key === "Negative" ? "Suppress this contact and stop the sequence"
        : i.key === "Out of Office" ? "Snooze until the return date"
        : i.key === "Wrong Person" ? "Ask for the correct owner, suppress this contact"
        : i.key === "Not Now" ? "Schedule a nurture follow-up"
        : i.key === "Objection" ? "Human reply — address the objection directly"
        : "Answer the question, then propose a call",
      autoReplySafe: i.key === "Meeting Request" || i.key === "Interested" || i.key === "Out of Office",
    };
  }

  // ===================================================== ANALYTICS (spec §14)
  function analytics(ws) {
    const camps = ws.campaigns || [];
    const sum = (f) => camps.reduce((a, c) => a + (c[f] || 0), 0);
    const sent = sum("sent"), replies = sum("replies"), positive = sum("positive"),
      hot = sum("hot"), meetings = sum("meetings"), spend = sum("spend");
    const byCampaign = camps.map((c) => ({ name: c.name, leads: (c.leadIds || []).length, sent: c.sent, replies: c.replies, hot: c.hot, meetings: c.meetings, spend: c.spend,
      replyRate: c.sent ? +(c.replies / c.sent * 100).toFixed(1) : 0 }));
    const segs = segments();
    const best = byCampaign.slice().sort((a, b) => b.replyRate - a.replyRate)[0];
    const worst = byCampaign.filter((c) => c.sent > 0).sort((a, b) => a.replyRate - b.replyRate)[0];
    const insights = [];
    if (best && worst && best !== worst && worst.replyRate > 0) {
      const mult = (best.replyRate / Math.max(0.1, worst.replyRate)).toFixed(1);
      insights.push(`"${best.name}" is converting ${mult}x better than "${worst.name}". Shift volume toward it.`);
    }
    if (best) insights.push(`Best-performing ICP: ${best.name} at a ${best.replyRate}% reply rate.`);
    const verifiedShare = Math.round(D.people.filter((p) => p.verified).length / D.people.length * 100);
    insights.push(`${verifiedShare}% of contacts in your reachable set have verified email. Unverified sends are the largest bounce risk.`);
    if (meetings) insights.push(`Cost per meeting is $${(spend / meetings).toFixed(2)} across ${meetings} booked.`);
    return {
      sent, replies, positive, hot, meetings, spend,
      replyRate: sent ? +(replies / sent * 100).toFixed(1) : 0,
      positiveRate: replies ? +(positive / replies * 100).toFixed(1) : 0,
      costPerLead: replies ? +(spend / replies).toFixed(2) : 0,
      costPerMeeting: meetings ? +(spend / meetings).toFixed(2) : 0,
      byCampaign, segments: segs.slice(0, 6), insights,
    };
  }

  // ===================================================== HELPERS
  const _coIdx = {}; D.companies.forEach((c) => (_coIdx[c.id] = c));
  const _peIdx = {}; D.people.forEach((p) => (_peIdx[p.id] = p));
  function companyById(id) { return _coIdx[id]; }
  function personById(id) { return _peIdx[id]; }

  return { parseQuery, searchCompanies, searchPeople, scoreCompany, deepResearch, lookalikes,
    segments, generateEmail, followUp, classifyReply, analytics, companyById, personById, TONES, INTENTS };
})();
