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
    { industry: "Sports Club", subs: ["Soccer Club", "Hockey Association", "Basketball Program", "Multi-Sport Academy", "Travel Team"],
      tech: ["TeamSnap", "SportsEngine", "Hudl", "Stack Sports", "Squarespace"],
      titles: ["Club Director", "President", "Director of Player Development", "Head Coach", "Technical Director"],
      pains: ["no college exposure for players", "roster and stats tracked in spreadsheets", "parents asking about NIL", "outdated club website"],
      desc: (n) => `${n} runs competitive youth and amateur programs with multiple teams and age groups.` },
    { industry: "School Athletics", subs: ["High School Athletics", "Prep School Program", "College Athletics", "District Athletics"],
      tech: ["Hudl", "rSchoolToday", "Final Forms", "Arbiter", "MaxPreps"],
      titles: ["Athletic Director", "Assistant Athletic Director", "Head Coach", "Compliance Officer", "Director of Athletics"],
      pains: ["NIL rules are unclear to staff and families", "no central player record", "recruiting support is ad hoc", "athlete stats scattered across platforms"],
      desc: (n) => `${n} oversees interscholastic athletic programs, rosters, eligibility and recruiting support.` },
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

  const SPORT_WORD = ["Soccer Club", "Hockey Association", "Basketball Academy", "Athletic Club",
    "Sports Academy", "Football Program", "Volleyball Club", "Lacrosse Club", "Baseball Academy", "Athletics"];
  const SCHOOL_WORD = ["High School Athletics", "Secondary Athletics", "Prep Athletics",
    "Collegiate Athletics", "District Athletics"];
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
  const V_WEIGHT = { "Higher Education": 32, "EdTech": 26, "Sports Club": 26, "School Athletics": 20,
    "Corporate Training": 20, "Professional Services": 17, "SaaS": 15, "Agency": 13,
    "Nonprofit": 9, "Fintech": 8, "HealthTech": 8, "Cybersecurity": 6 };
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
    // Sports organisations are small staffs running large rosters.
    "Sports Club": () => pick([int(4, 14), int(15, 40), int(41, 110)]),
    "School Athletics": () => pick([int(6, 20), int(21, 60), int(61, 180)]),
  };
  const defaultSize = () => pick([int(8, 25), int(26, 60), int(61, 140), int(141, 400), int(401, 1400)]);

  // --- generate companies ------------------------------------------------
  const usedNames = new Set();
  const companies = [];
  const TARGET_COMPANIES = 268;
  let guard = 0;
  while (companies.length < TARGET_COMPANIES && guard++ < 20000) {
    const v = pick(V_BAG);
    const g = pick(G_BAG);
    let name;
    if (v.industry === "Sports Club") {
      name = pick(EDU_A) + " " + pick(SPORT_WORD);
    } else if (v.industry === "School Athletics") {
      name = pick(EDU_A) + " " + pick(SCHOOL_WORD);
    } else if (v.industry === "Higher Education") {
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

  // --- brands -----------------------------------------------------------
  // One portfolio brand that rolls up, plus one pipeline per revenue motion.
  // "fit" is honest about whether company-based outbound suits that brand at all.
  const brands = [
    {
      id: "drdverse", name: "DRDverse", domain: "drdverse.com", role: "portfolio", fit: "Roll-up",
      tagline: "The official Dr. D brand and front door",
      note: "Not a pipeline. DRDverse speaks to CrediVersity, EdVisingU and DRD Sports, so it shows the combined picture across every brand rather than carrying leads of its own.",
      industries: [], icps: [],
      profile: {
        website: "drdverse.com", company: "DRDverse",
        industry: "Portfolio brand",
        product: "The umbrella brand and landing experience routing visitors to CrediVersity, EdVisingU and DRD Sports",
        targetCustomer: "Anyone arriving at the Dr. D brand before they know which offer fits",
        likelyBuyer: "Not applicable, this is the front door",
        geography: "Canada, United States, United Kingdom",
        painPoints: ["Visitors cannot tell which brand serves them", "Authority is split across separate sites"],
        useCases: ["Brand front door", "Routing to the right offer", "Credibility and proof"],
        differentiators: ["One recognised practitioner behind every brand"],
        pricingSignal: "No direct sale",
      },
    },
    {
      id: "edvisingu", name: "EdVisingU", domain: "edvisingu.com", role: "pipeline", fit: "Strong",
      tagline: "Institutional AI literacy and readiness consulting",
      note: "The best fit for outbound. Named institutional buyers, long cycles, high contract value.",
      industries: ["Higher Education", "EdTech", "Corporate Training", "Professional Services", "Agency", "Nonprofit"],
      profile: businessProfile,
      icps: icps,
    },
    {
      id: "drdsports", name: "DRD Sports", domain: "drdsports.com", role: "pipeline", fit: "Strong",
      tagline: "Team databases, websites, player repositories, stats and NIL education",
      note: "Two product lines with different buyers. Owners and coaches buy the website and database build, which is the outbound motion. Parents buy 1:1 coaching with Dr. D in AI education and NIL, which is a funnel motion reached through the club, never cold outreach to families. The platform is the distribution channel for the coaching: land the organisation, and its parent base becomes the warm audience for sessions. NIL is a United States framework, so NIL-led targeting weights to the US while the website and database offer travels anywhere.",
      productLines: [
        { id: "platform", name: "Website and database build",
          what: "Club or team website, player repository, roster and season stats",
          buyers: "Organisation owners, directors and coaches", motion: "outbound" },
        { id: "coaching", name: "1:1 coaching with Dr. D",
          what: "One-to-one sessions in AI education and NIL for the athlete",
          buyers: "Parents and families", motion: "funnel" },
      ],
      buyerTypes: [
        { who: "Organisation owners and directors", product: "Website and database build",
          buys: "The platform across the whole club: site, player repository, rosters, stats",
          reach: "Outbound. They are findable, they hold the budget, and they decide for every team.", motion: "outbound" },
        { who: "Coaches", product: "Website and database build",
          buys: "Their own team's site, roster and stats, often before the club commits centrally",
          reach: "Outbound. A much smaller decision, far faster, and the cheapest route into the wider club.", motion: "outbound" },
        { who: "Parents", product: "1:1 coaching with Dr. D",
          buys: "One-to-one sessions for their athlete in AI education and NIL",
          reach: "Through the club or coach that already has their trust, plus content. Never cold outreach to families or minors.", motion: "funnel" },
      ],
      industries: ["Sports Club", "School Athletics"],
      profile: {
        website: "drdsports.com", company: "DRD Sports",
        industry: "Sports technology and athlete development",
        product: "Two lines: website and database builds for clubs and teams, and 1:1 coaching with Dr. D in AI education and NIL for athletes",
        targetCustomer: "Competitive youth clubs, multi-sport academies and athletic departments, plus the coaches inside them and the players and families they serve",
        likelyBuyer: "Owner or director for a club-wide build, head coach for a single team, parent for 1:1 coaching sessions",
        geography: "Canada and United States, NIL programming weighted to the United States",
        painPoints: [
          "Players get no college exposure because there is no central record",
          "Rosters and stats live in spreadsheets",
          "Families ask about NIL and staff have no credible answer",
          "The club website is dated and parents do not trust it",
        ],
        useCases: ["Club or team website build", "Player repository and recruiting profiles",
          "Season stats and roster database", "1:1 AI education sessions for an athlete",
          "1:1 NIL coaching for an athlete and their family"],
        differentiators: ["Built by an education leader, not a web shop",
          "NIL taught as curriculum rather than marketing", "One system for site, roster and stats"],
        pricingSignal: "Build: per-program setup plus annual platform fee. Coaching: per session or package, bought by the parent",
      },
      icps: [
        { id: "sp_1", name: "Competitive youth clubs", fit: 91, industry: "Sports Club", country: null, sizeMin: null, approved: true,
          why: "Directly matches the core offer. These clubs carry many teams and age groups, run on spreadsheets, and are under constant parent pressure to show college pathways.",
          buyers: ["Club Director", "Technical Director", "President"] },
        { id: "sp_2", name: "Multi-sport academies and prep programs", fit: 86, industry: "Sports Club", country: null, sizeMin: 15, approved: true,
          why: "College placement is the product they sell to families, so a player repository is the artifact they are missing. Larger staffs mean real budget.",
          buyers: ["Director of Player Development", "Club Director", "Head Coach"] },
        { id: "sp_3", name: "US high school athletic departments", fit: 84, industry: "School Athletics", country: "United States", sizeMin: null, approved: true,
          why: "NIL rules now reach high school athletes in most states and athletic directors have no curriculum to hand families. This is the clearest why-now in the portfolio.",
          buyers: ["Athletic Director", "Assistant Athletic Director", "Compliance Officer"] },
        { id: "sp_4", name: "College athletic programs, NIL compliance", fit: 78, industry: "School Athletics", country: "United States", sizeMin: 40, approved: false,
          why: "Real mandate and real budget, but procurement is slow and compliance offices are crowded with vendors. Credible, not fast.",
          buyers: ["Compliance Officer", "Director of Athletics"] },
        { id: "sp_6", name: "Head coaches buying for one team", fit: 82, industry: "Sports Club", country: null, sizeMin: null, approved: true,
          why: "The fastest decision in the portfolio. A coach can buy for their own team without club approval, and a team that works becomes the reference that sells the whole organisation. Land small, expand upward.",
          buyers: ["Head Coach", "Technical Director", "Director of Player Development"] },
        { id: "sp_5", name: "Canadian clubs and associations", fit: 74, industry: "Sports Club", country: "Canada", sizeMin: null, approved: true,
          why: "Strong fit for the website, roster and stats offer and an easy local reference base. Lead with exposure and administration, not NIL, which does not apply the same way here.",
          buyers: ["Club Director", "President", "Technical Director"] },
      ],
    },
    {
      id: "crediversity", name: "CrediVersity", domain: "crediversity.com", role: "pipeline", fit: "Partial",
      tagline: "Micro-credentials, courses and digital products",
      note: "The main motion is funnel and content, not outbound, because the catalogue sells to individuals at $29 to $97. The outbound wedge is organisations that buy seats in bulk or white-label the catalogue.",
      industries: ["Corporate Training", "Professional Services", "Nonprofit", "Agency"],
      profile: {
        website: "crediversity.com", company: "CrediVersity",
        industry: "Digital learning products",
        product: "Micro-credentials, courses, prompt packs and toolkits",
        targetCustomer: "Individual learners, plus organisations buying seats or licensing the catalogue",
        likelyBuyer: "Head of L&D, Training Manager, Program Director, Association Executive",
        geography: "Global, English language",
        painPoints: ["Staff need practical AI skills now", "No budget for enterprise training platforms",
          "Members expect professional development that is current"],
        useCases: ["Bulk seats for a team", "White-label catalogue for a training provider",
          "Member professional development for an association"],
        differentiators: ["Practitioner-built", "Priced for real budgets", "Deployable immediately"],
        pricingSignal: "$29 to $97 per product, bulk and licensing negotiable",
      },
      icps: [
        { id: "cv_1", name: "SMB L&D teams buying seats", fit: 72, industry: "Corporate Training", country: null, sizeMin: 60, approved: true,
          why: "Has a training mandate and no platform budget, which is exactly the gap a per-seat micro-credential fills.",
          buyers: ["Head of L&D", "Training Manager", "VP People"] },
        { id: "cv_2", name: "Training providers to white-label", fit: 68, industry: "Professional Services", country: null, sizeMin: 10, approved: false,
          why: "They need current AI content they cannot build themselves. Higher value per deal but a longer conversation about rights.",
          buyers: ["Managing Partner", "Practice Lead", "Director of Business Development"] },
        { id: "cv_3", name: "Associations offering member PD", fit: 64, industry: "Nonprofit", country: null, sizeMin: null, approved: false,
          why: "Member professional development is a renewal driver for them. Slower cycles, governed by boards and committees.",
          buyers: ["Executive Director", "Director of Programs"] },
      ],
    },
    {
      id: "hireed", name: "HireEd Nexus", domain: "hireednexus.com", role: "pipeline", fit: "Strong",
      tagline: "Work-integrated learning and student project placement",
      note: "Two-sided. Outbound works best on the employer side, because institutions are easier to reach through the EdVisingU relationship.",
      industries: ["SaaS", "Agency", "Professional Services", "Higher Education", "Fintech", "HealthTech"],
      profile: {
        website: "hireednexus.com", company: "HireEd Nexus",
        industry: "Work-integrated learning platform",
        product: "Connects enrolled students to paid real-world projects with employers",
        targetCustomer: "Employers needing project talent, and co-op or career services offices",
        likelyBuyer: "Head of Talent, Hiring Manager, Director of Co-op and Career Services",
        geography: "Canada, with Ontario first",
        painPoints: ["Junior hiring is expensive and slow", "Projects sit undone for lack of capacity",
          "Co-op offices struggle to source enough quality placements"],
        useCases: ["Scoped student project", "Talent pipeline without a hiring commitment",
          "Placement supply for a co-op office"],
        differentiators: ["Academically supervised", "Scoped and outcome-based", "Built inside a higher-ed practice"],
        pricingSignal: "Per project or per placement",
      },
      icps: [
        { id: "hn_1", name: "Growth companies needing project talent", fit: 83, industry: "SaaS", country: "Canada", sizeMin: 25, approved: true,
          why: "Has a backlog and no budget for a full hire, which is precisely the gap a scoped student project fills.",
          buyers: ["Head of Growth", "Hiring Manager", "CEO"] },
        { id: "hn_2", name: "Agencies with overflow work", fit: 76, industry: "Agency", country: "Canada", sizeMin: 10, approved: true,
          why: "Project-shaped work and thin margins make supervised student capacity attractive, and they decide fast.",
          buyers: ["Managing Director", "Founder", "Head of Growth"] },
        { id: "hn_3", name: "Co-op and career services offices", fit: 80, industry: "Higher Education", country: "Canada", sizeMin: 200, approved: false,
          why: "They need placement supply, and the EdVisingU relationship is a warmer route in than cold outbound.",
          buyers: ["Director of Continuing Education", "AVP Innovation", "Dean of Students"] },
      ],
    },
    {
      id: "drdlearn", name: "Dr. D Learn", domain: "drdlearn.com", role: "audience", fit: "Low",
      tagline: "The personal brand and content face",
      note: "Outbound is the wrong tool here. This brand grows through content, speaking and inbound. Kept visible so the portfolio is complete, but expect little from prospecting it.",
      industries: ["Agency", "Corporate Training", "Nonprofit"],
      profile: {
        website: "drdlearn.com", company: "Dr. D Learn",
        industry: "Personal brand, content and education",
        product: "Content, commentary, speaking and freelance engagements",
        targetCustomer: "Audience first. Buyers arrive through content rather than outreach",
        likelyBuyer: "Event programmer, podcast producer, small business owner",
        geography: "Global, English language",
        painPoints: ["Audiences want a credible practitioner voice on AI in education"],
        useCases: ["Speaking", "Content partnership", "Freelance engagement"],
        differentiators: ["Named practitioner with institutional credibility"],
        pricingSignal: "Varies by engagement",
      },
      icps: [
        { id: "dl_1", name: "Conference and event programmers", fit: 58, industry: "Nonprofit", country: "Canada", sizeMin: null, approved: false,
          why: "Speaking builds authority that feeds every other brand, but these are relationship and referral driven, not cold-email driven.",
          buyers: ["Executive Director", "Director of Programs"] },
      ],
    },
  ];

  return {
    companies, people, peopleByCompany, businessProfile, icps, brands,
    vocab: { SIGNALS, REV_BANDS, VERTICALS, GEO },
    rnd,
  };
})();
