/* Dr. D Lead Engineering System — seed data layer.
 * Deterministic generator: same seed => same dataset every load, so demos are stable.
 * This stands in for the licensed B2B graph (companies/people). Swap DRD.db for a
 * real provider response of the same shape and every module keeps working.
 */
window.DRD_DATA = (function () {
  "use strict";

  // --- deterministic RNG -------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20260828);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pickN = (a, n) => { const c = a.slice(); const o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return o; };
  const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

  // --- vocabulary --------------------------------------------------------
  const VERTICALS = [
    { industry: "Higher Education", subs: ["University", "College", "Polytechnic", "Continuing Studies"],
      tech: ["Canvas LMS", "Banner", "Slate CRM", "Zoom", "Qualtrics"],
      titles: ["VP Academic", "Dean of Students", "Director of Teaching & Learning", "Registrar", "AVP Innovation", "Director of Continuing Education"],
      pains: ["enrolment decline", "AI academic-integrity policy gaps", "faculty upskilling backlog", "program approval timelines"],
      desc: (n) => `${n} delivers accredited programs and is modernizing curriculum, assessment and learner supports.` },
    { industry: "EdTech", subs: ["LMS", "Assessment", "Credentialing", "Student Success", "Tutoring"],
      tech: ["AWS", "React", "HubSpot", "Segment", "Stripe"],
      titles: ["CEO", "Head of Product", "VP Sales", "Director of Partnerships", "Chief Learning Officer"],
      pains: ["long institutional sales cycles", "procurement friction", "seat expansion stalls", "differentiating against incumbents"],
      desc: (n) => `${n} builds learning software sold into schools, colleges and corporate training teams.` },
    { industry: "Professional Services", subs: ["Management Consulting", "Accounting", "Law", "Engineering"],
      tech: ["Salesforce", "Microsoft 365", "Power BI", "DocuSign"],
      titles: ["Managing Partner", "Practice Lead", "Director of Business Development", "Chief Operating Officer"],
      pains: ["partner time spent on origination", "undifferentiated positioning", "referral dependence"],
      desc: (n) => `${n} is an advisory firm serving mid-market and public-sector clients.` },
    { industry: "Corporate Training", subs: ["L&D", "Compliance Training", "Leadership Development"],
      tech: ["Docebo", "Workday", "Articulate", "LinkedIn Learning"],
      titles: ["Head of L&D", "Director of Talent Development", "CHRO", "VP People"],
      pains: ["proving training ROI", "low course completion", "AI-skills gap across staff"],
      desc: (n) => `${n} designs and delivers workforce learning programs for enterprise clients.` },
    { industry: "Agency", subs: ["Marketing Agency", "Creative Studio", "Digital Consultancy"],
      tech: ["HubSpot", "Webflow", "Figma", "Google Ads", "Slack"],
      titles: ["Founder", "Managing Director", "Head of Growth", "New Business Director"],
      pains: ["feast-or-famine pipeline", "retainer churn", "founder-led sales bottleneck"],
      desc: (n) => `${n} is a client-services agency delivering brand, growth and digital work.` },
    { industry: "SaaS", subs: ["Developer Tools", "Analytics", "Productivity", "HR Tech", "Vertical SaaS"],
      tech: ["AWS", "HubSpot", "Snowflake", "Segment", "Stripe", "React"],
      titles: ["CEO", "VP Sales", "Head of Growth", "CTO", "Director of Demand Gen"],
      pains: ["CAC creeping up", "flat pipeline coverage", "outbound not converting"],
      desc: (n) => `${n} sells a B2B software platform to mid-market operations teams.` },
    { industry: "Fintech", subs: ["Payments", "Lending", "Treasury", "Payroll", "Billing"],
      tech: ["AWS", "Stripe", "Plaid", "Snowflake", "Salesforce"],
      titles: ["CEO", "CFO", "VP Revenue", "Head of Partnerships", "Chief Compliance Officer"],
      pains: ["compliance overhead", "long enterprise cycles", "trust barrier with regulated buyers"],
      desc: (n) => `${n} builds regulated financial infrastructure for business customers.` },
    { industry: "HealthTech", subs: ["Clinical AI", "Telehealth", "Remote Monitoring", "Practice Software"],
      tech: ["AWS", "Epic", "Salesforce", "Twilio"],
      titles: ["CEO", "Chief Medical Officer", "VP Sales", "Director of Clinical Ops"],
      pains: ["procurement and privacy review", "clinician adoption", "reimbursement clarity"],
      desc: (n) => `${n} delivers clinical software to providers and care networks.` },
    { industry: "Nonprofit", subs: ["Foundation", "Association", "Workforce Development"],
      tech: ["Salesforce NPSP", "Mailchimp", "Raiser's Edge"],
      titles: ["Executive Director", "Director of Programs", "Development Director"],
      pains: ["grant-cycle dependence", "capacity constraints", "measuring program outcomes"],
      desc: (n) => `${n} runs mission programs funded by grants, members and public partners.` },
    { industry: "Cybersecurity", subs: ["Cloud Security", "Identity", "Email Security"],
      tech: ["AWS", "Okta", "CrowdStrike", "Snowflake"],
      titles: ["CISO", "VP Sales", "Head of Security Engineering"],
      pains: ["buyer alert fatigue", "crowded category", "proving risk reduction"],
      desc: (n) => `${n} sells security tooling to engineering and risk teams.` },
  ];

  const GEO = [
    { country: "Canada", region: "Ontario", cities: ["Toronto", "Ottawa", "Waterloo", "Hamilton", "Oshawa", "Pickering", "London"] },
    { country: "Canada", region: "British Columbia", cities: ["Vancouver", "Victoria", "Burnaby"] },
    { country: "Canada", region: "Quebec", cities: ["Montreal", "Quebec City"] },
    { country: "Canada", region: "Alberta", cities: ["Calgary", "Edmonton"] },
    { country: "United States", region: "Northeast", cities: ["Boston", "New York", "Philadelphia"] },
    { country: "United States", region: "West", cities: ["San Francisco", "Seattle", "Portland", "Los Angeles"] },
    { country: "United States", region: "Midwest", cities: ["Chicago", "Detroit", "Minneapolis"] },
    { country: "United States", region: "South", cities: ["Austin", "Atlanta", "Miami", "Nashville"] },
    { country: "United Kingdom", region: "England", cities: ["London", "Manchester", "Bristol", "Leeds"] },
    { country: "United Kingdom", region: "Scotland", cities: ["Edinburgh", "Glasgow"] },
    { country: "Ireland", region: "Leinster", cities: ["Dublin"] },
    { country: "Australia", region: "NSW", cities: ["Sydney", "Melbourne"] },
    { country: "Germany", region: "Bavaria", cities: ["Berlin", "Munich"] },
    { country: "Netherlands", region: "Randstad", cities: ["Amsterdam", "Rotterdam"] },
  ];

  const EDU_A = ["Northgate", "Lakeridge", "Fairmount", "Brookvale", "Sterling", "Crestwood", "Ashford", "Kingsmere",
    "Rowanhill", "Templeton", "Westbourne", "Highfield", "Claremont", "Stonebridge", "Elmwood", "Redcliff",
    "Thornbury", "Grantham", "Whitfield", "Ravenscourt", "Oakmere", "Bellhaven", "Coldwater", "Fernbrook",
    "Marchmont", "Silverdale", "Kingsway", "Ashcombe", "Draycott", "Eastvale"];
  const NAME_A = ["North", "Meridian", "Cedar", "Harbour", "Summit", "Beacon", "Lumen", "Arbor", "Vantage", "Kestrel", "Ridge", "Anchor", "Bright", "Cardinal", "Compass", "Drift", "Ember", "Fern", "Granite", "Haven", "Iron", "Juniper", "Larch", "Maple", "Nimbus", "Onyx", "Pinnacle", "Quarry", "River", "Sable", "Tamarack", "Umbra", "Verdant", "Willow", "Yarrow", "Alder", "Basin", "Crest", "Dune", "Elm"];
  const NAME_B = ["works", "field", "line", "path", "labs", "point", "bridge", "stack", "gate", "grove", "forge", "scope", "wave", "loop", "core", "shift", "mark", "span", "rise", "peak"];
  const FIRST = ["Andre", "Priya", "Marcus", "Aisha", "Tom", "Lena", "Devon", "Maya", "Raj", "Grace", "Carlos", "Emily", "Nina", "Ben", "Olivia", "Ivan", "Hannah", "Camille", "Jordan", "Nia", "Liam", "Rachel", "Sam", "David", "Ananya", "Kevin", "Laura", "Sean", "Alex", "Freja", "Erik", "Yusuf", "Tanya", "Sofia", "Klaus", "Petra", "Marc", "Lucia", "Chris", "Hollie", "Bianca", "Noah", "Ella", "Omar", "Wei", "Gabriel", "Chinwe", "Tunde", "Ruby", "Jeroen", "Mia", "Simone", "Darius", "Farah", "Colin", "Renee", "Malik", "Ingrid", "Theo", "Salma", "Nadia", "Victor", "Leah", "Amir", "Josephine", "Patrick", "Rosa", "Dmitri", "Keiko", "Ahmed"];
  const LAST = ["Nolan", "Shah", "Errington", "Vogt", "Bauer", "Price", "Chen", "Patel", "Rahman", "Miller", "Mendes", "Ford", "Okafor", "Stein", "Grant", "Petrov", "Cole", "Laurent", "Blake", "Roberts", "Fraser", "Kim", "Turner", "Osei", "Iyer", "Zhao", "Diaz", "Murphy", "Rivera", "Lindqvist", "Holm", "Ali", "Brooks", "Moreno", "Berger", "Wolf", "Tremblay", "Fernandez", "Walker", "Ward", "Reyes", "Wilson", "Brown", "Haddad", "Lim", "Santos", "Obi", "Bello", "Hall", "Visser", "Nguyen", "Clarke", "Whitfield", "Bergeron", "Okonkwo", "Devlin", "Marchetti", "Halvorsen", "Sorensen", "Aziz", "Kowalski", "Duarte", "Mbeki", "Novak", "Rossi", "Dubois", "Andersson", "Tanaka", "Farouk"];
  const SIGNALS = ["Hiring sales leaders", "Recently funded", "New executive hire", "Expanding to new region", "Launched new program", "Job posts for AI roles", "Website relaunch", "Conference exhibitor", "Published AI policy", "Board expansion", "New campus/office", "Partnership announced"];
  const REV_BANDS = ["<$1M", "$1M–$3M", "$3M–$5M", "$5M–$10M", "$10M–$25M", "$25M–$50M", "$50M–$100M", "$100M+"];
  const SENIORITY_BY_TITLE = (t) => /chief|^c[eiotf]o$|ceo|cfo|cto|ciso|chro|president|managing partner|managing director|founder|executive director/i.test(t) ? "C-Suite"
    : /^vp|vice president|avp/i.test(t) ? "VP"
    : /head of/i.test(t) ? "Head"
    : /director|dean|registrar/i.test(t) ? "Director"
    : "Manager";

  // --- weighting ---------------------------------------------------------
  // The graph is deliberately skewed toward the markets this business actually
  // sells into, so ICP slices return usable volume instead of one-off rows.
  const V_WEIGHT = { "Higher Education": 32, "EdTech": 26, "Corporate Training": 20, "Professional Services": 17,
    "SaaS": 15, "Agency": 13, "Nonprofit": 9, "Fintech": 8, "HealthTech": 8, "Cybersecurity": 6 };
  const G_WEIGHT = { "Ontario": 38, "England": 12, "Northeast": 10, "British Columbia": 8, "West": 8, "South": 7,
    "Quebec": 6, "Midwest": 6, "Alberta": 5, "Scotland": 4, "Leinster": 3, "NSW": 3, "Bavaria": 3, "Randstad": 2 };
  const weighted = (arr, keyFn, table) => {
    const bag = [];
    arr.forEach((x) => { const w = table[keyFn(x)] || 1; for (let i = 0; i < w; i++) bag.push(x); });
    return bag;
  };
  const V_BAG = weighted(VERTICALS, (v) => v.industry, V_WEIGHT);
  const G_BAG = weighted(GEO, (g) => g.region, G_WEIGHT);

  // Headcount profiles differ sharply by sector; institutions are not startups.
  const SIZE_FOR = {
    "Higher Education": () => pick([int(180, 600), int(601, 1600), int(1601, 4200)]),
    "Corporate Training": () => pick([int(40, 120), int(121, 400), int(401, 1200)]),
    "Nonprofit": () => pick([int(12, 60), int(61, 240)]),
    "Professional Services": () => pick([int(15, 70), int(71, 260), int(261, 900)]),
  };
  const defaultSize = () => pick([int(8, 25), int(26, 60), int(61, 140), int(141, 400), int(401, 1400)]);

  // --- generate companies ------------------------------------------------
  const usedNames = new Set();
  const companies = [];
  const TARGET_COMPANIES = 186;
  let guard = 0;
  while (companies.length < TARGET_COMPANIES && guard++ < 20000) {
    const v = pick(V_BAG);
    const g = pick(G_BAG);
    let name;
    if (v.industry === "Higher Education") {
      name = pick(EDU_A) + " " + pick(["University", "College", "Polytechnic", "Institute", "College of Applied Arts"]);
    } else {
      name = pick(NAME_A) + pick(NAME_B);
    }
    if (usedNames.has(name)) continue;
    usedNames.add(name);

    const size = (SIZE_FOR[v.industry] || defaultSize)();
    const sub = pick(v.subs);
    const city = pick(g.cities);
    const id = "co_" + (companies.length + 1);
    const funded = rnd() > 0.62;
    companies.push({
      id, name,
      domain: name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 18) + pick([".com", ".io", ".ca", ".co", ".org", ".edu"]),
      industry: v.industry, sub,
      country: g.country, region: g.region, city,
      size,
      revenue: REV_BANDS[Math.min(REV_BANDS.length - 1, Math.floor(Math.log2(Math.max(2, size)) - 1))],
      founded: int(1968, 2024),
      traffic: int(2, 900) * 1000,
      tech: pickN(v.tech, int(2, Math.min(4, v.tech.length))),
      signals: rnd() > 0.45 ? pickN(SIGNALS, int(1, 3)) : [],
      funding: funded ? { round: pick(["Seed", "Series A", "Series B", "Series C", "Grant"]), amount: pick(["$1.2M", "$3.5M", "$8M", "$15M", "$40M", "$250K"]), date: int(2022, 2026) + "" } : null,
      desc: v.desc(name),
      pains: v.pains,
      tags: [v.industry.toLowerCase().replace(/\s+/g, "-"), sub.toLowerCase().replace(/\s+/g, "-")],
      _titles: v.titles,
    });
  }

  // --- generate people ---------------------------------------------------
  const people = [];
  companies.forEach((c) => {
    const n = c.size > 300 ? int(3, 4) : c.size > 60 ? int(2, 3) : int(1, 3);
    const titles = pickN(c._titles, Math.min(n, c._titles.length));
    titles.forEach((title) => {
      const first = pick(FIRST), last = pick(LAST);
      const id = "pe_" + (people.length + 1);
      const verified = rnd() > 0.18;
      people.push({
        id, companyId: c.id,
        name: first + " " + last,
        title,
        seniority: SENIORITY_BY_TITLE(title),
        department: /sales|growth|revenue|business development|partnership|demand/i.test(title) ? "Sales"
          : /market/i.test(title) ? "Marketing"
          : /product|cto|engineer/i.test(title) ? "Product & Eng"
          : /people|hr|talent|l&d|learning/i.test(title) ? "People & L&D"
          : /academic|dean|registrar|teaching|education|program/i.test(title) ? "Academic"
          : "Executive",
        email: first.toLowerCase() + "." + last.toLowerCase() + "@" + c.domain,
        emailStatus: verified ? "Verified" : (rnd() > 0.5 ? "Catch-all" : "Unverified"),
        verified,
        phone: verified && rnd() > 0.55 ? "+1 " + int(200, 989) + " " + int(200, 999) + " " + int(1000, 9999) : null,
        linkedin: "in/" + first.toLowerCase() + "-" + last.toLowerCase(),
        city: c.city, country: c.country,
      });
    });
    delete c._titles;
  });

  const peopleByCompany = {};
  people.forEach((p) => { (peopleByCompany[p.companyId] = peopleByCompany[p.companyId] || []).push(p); });
  companies.forEach((c) => { c.contactCount = (peopleByCompany[c.id] || []).length; });

  // --- the account's own business profile (what onboarding produces) -----
  const businessProfile = {
    website: "edvisingu.ca",
    company: "EdVisingU",
    analyzed: true,
    industry: "Education Consulting & AI Literacy",
    product: "AI literacy readiness audits, institutional alignment briefs, and workforce AI training",
    targetCustomer: "Post-secondary institutions, EdTech companies, and professional-services firms",
    likelyBuyer: "VP Academic, Director of Teaching & Learning, Head of L&D, Managing Partner",
    geography: "Canada (Ontario focus), United States, United Kingdom",
    differentiators: ["Practitioner-led, not vendor-led", "Institution-ready governance frameworks", "Faculty adoption playbooks"],
    painPoints: ["No institutional AI policy", "Faculty AI-skills gap", "Academic integrity pressure", "Board asking for an AI plan"],
    useCases: ["AI readiness audit", "Faculty AI training cohort", "Institutional AI policy design", "Program modernization"],
    keywords: ["AI literacy", "academic integrity", "faculty development", "institutional readiness"],
    pricingSignal: "$25K–$500K engagements",
  };

  // --- ICPs (what the ICP agent generates) -------------------------------
  const icps = [
    { id: "icp_1", name: "Ontario colleges & polytechnics", fit: 94, industry: "Higher Education", country: "Canada", sizeMin: 200, approved: true,
      why: "Direct match to the AI Literacy Readiness Audit. Provincial AI-policy pressure and an active faculty-development mandate make timing strong.",
      buyers: ["VP Academic", "Director of Teaching & Learning", "AVP Innovation"] },
    { id: "icp_2", name: "EdTech companies selling into institutions", fit: 88, industry: "EdTech", country: null, sizeMin: 20, approved: true,
      why: "They need institutional credibility and governance language to shorten procurement. Your frameworks are the missing artifact in their sales motion.",
      buyers: ["CEO", "Head of Product", "Director of Partnerships"] },
    { id: "icp_3", name: "Enterprise L&D teams", fit: 81, industry: "Corporate Training", country: null, sizeMin: 100, approved: true,
      why: "Boards are demanding a workforce AI plan. L&D owns the mandate but lacks a credible curriculum and measurement model.",
      buyers: ["Head of L&D", "VP People", "CHRO"] },
    { id: "icp_4", name: "Professional-services firms", fit: 74, industry: "Professional Services", country: null, sizeMin: 25, approved: false,
      why: "Partners need AI fluency to defend billable models, but budget ownership is fragmented across practice leads.",
      buyers: ["Managing Partner", "Practice Lead", "COO"] },
    { id: "icp_5", name: "Marketing & creative agencies", fit: 63, industry: "Agency", country: null, sizeMin: 10, approved: false,
      why: "High interest in AI upskilling but smaller budgets and faster, less formal buying cycles than the core institutional motion.",
      buyers: ["Founder", "Managing Director", "Head of Growth"] },
  ];

  return {
    companies, people, peopleByCompany, businessProfile, icps,
    vocab: { SIGNALS, REV_BANDS, VERTICALS, GEO },
    rnd,
  };
})();
