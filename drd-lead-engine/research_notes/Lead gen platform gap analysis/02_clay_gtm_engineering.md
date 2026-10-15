# Clay.com and the GTM-Engineering / Orchestration-and-AI-Research Category (as of 13 Oct 2026)

## Methodology and retrieval limitations (read first)

**Direct page fetching FAILED for every primary source.** Two independent blockers:

1. `WebFetch` returned `getaddrinfo ENOTFOUND` for every domain attempted (`www.clay.com`, `clay.com`, `docs.clay.com`, `parlel.com`, `www.docket.io`) — DNS resolution is unavailable to that tool in this environment, i.e. it failed on *all* hosts, not just Clay's.
2. `curl` through the agent proxy returned `CONNECT tunnel failed, response 403` / `connect_rejected (organization policy)` for `www.clay.com:443` and `docs.clay.com:443`. Clay's domains are **blocked at the egress-proxy policy layer**.
3. `mcp__Tavily__tavily_extract` failed with an invalid API key, so the server-side extraction fallback was unavailable.

**Everything below therefore comes from a search index** (`WebSearch`, including runs restricted with `allowed_domains` to `clay.com` / `university.clay.com` / `community.clay.com`). The domain-restricted runs returned what read as **verbatim quoted text from Clay's own pricing page, Clay Docs (university.clay.com), Clay's internal pricing memo blog post, and Clay's community announcements** — so pricing and feature-gating claims below are sourced to Clay primary pages *as surfaced by the index*, not to pages I personally rendered. I have labelled these CONFIRMED (primary, index-mediated) and flagged the one internal inconsistency the index itself surfaced.

Labels used: **CONFIRMED** = stated by Clay's own page/docs, or by ≥2 independent non-affiliated sources. **CONFLICTING** = sources disagree. **UNCONFIRMED** = single third-party/vendor-adjacent source, or inference.

---

## Q1. Clay's architecture: tables, waterfalls, providers, credit model, plan tiers

### Takeaway
Clay is a spreadsheet-like orchestration workbench (Tables → Audiences → Workflows) sitting on a marketplace of 150+ data providers, now billed on a **two-meter model (Actions + Data Credits)** introduced in a pricing overhaul dated **11 March 2026**. Self-serve tiers as of Oct 2026 are **Free / Launch ($185/mo) / Growth ($495/mo)** plus custom Enterprise, and the gates that matter most are at Growth: HTTP API, CRM auto-sync, webhook automation, web-intent signals, Ads.

### Cited Findings

**Pricing — the priority item. CONFIRMED (Clay primary pages, index-mediated):**
- Launch: "from $185/mo with 2,500 Data Credits and 15,000 Actions." Growth: "from $495/mo with 6,000 Data Credits, 40,000 Actions, and CRM auto-sync." — [Clay pricing / Clay FAQ "What features are included in the new plans?"](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan); [Clay pricing page](https://www.clay.com/pricing)
- Free tier: $0, 500 Actions + 100 Data Credits per month — [search-index synthesis of clay.com/pricing and third-party trackers](https://www.docket.io/resources/research/clay-pricing) (CONFIRMED by multiple third parties; not independently verified on Clay's page)
- Annual-billing rates appear as $167/mo (Launch) and $446/mo (Growth) — [Clay pricing page](https://www.clay.com/pricing) as surfaced by index; the index itself flagged that it "couldn't confirm" these are annual rates. **CONFLICTING on labelling, consistent on the numbers** (multiple third parties also report $167/$446 as annual).
- Enterprise is custom-quoted; third-party trackers report "starts around $30,000/year and scales to $154,000+/year" — [Warmly](https://www.warmly.ai/p/blog/clay-pricing), [Docket](https://www.docket.io/resources/research/clay-pricing). **UNCONFIRMED** (vendor-adjacent blogs, competitor-owned in Warmly's case).
- Pricing change date 11 March 2026; prior plans Starter / Explorer / Pro are retired and legacy customers were grandfathered — [Cleanlist, dated 2026-03-12](https://www.cleanlist.ai/blog/2026-03-12-clay-pricing-changes-2026), [Supered](https://www.supered.io/blog/clay-pricing/). **CONFIRMED** in substance by Clay's own memo: "Clay's most powerful features – HTTP APIs, CRM integrations, Web Intent, and our new Ads product – are now available on the new Growth plan at $495/mo, $305 less than the old Pro plan" — [Clay pricing memo: INTERNAL](https://www.clay.com/blog/clay-pricing-memo-internal). (Old Pro was therefore $800/mo.)
- **CONFLICTING:** one third-party source claims Growth has unlimited credits/actions; the preponderance (and Clay's own FAQ text) give 40K Actions / 6K Data Credits. Treat "unlimited" as wrong.

**The two meters. CONFIRMED (Clay Docs):**
- "Actions measure the orchestration you do in Clay: enriching data, running AI research, and sending data to other tools. Each Action costs a few tenths of a penny." — [Clay Docs: Actions & Data Credits](https://university.clay.com/docs/actions-data-credits)
- "Data Credits are used to buy data or AI from 3rd party vendors in Clay's data marketplace—costs vary by data type." — [same](https://university.clay.com/docs/actions-data-credits)
- Data Credits roll over on Launch/Growth up to 2x the monthly allowance; **Actions do not roll over** — "Actions reset each billing cycle and don't roll over, since they reflect the platform capacity your plan includes. Each plan includes enough Actions to cover 90% of customer usage." — [Clay Docs: Plans & billing](https://university.clay.com/docs/plans-and-billing)
- One-off Data Credit top-ups carry a **30% premium** — [same](https://university.clay.com/docs/plans-and-billing)
- Headline unit economics: Data Credits from ~$0.05 each, Actions under ~$0.01 each — [Supered](https://www.supered.io/blog/clay-pricing/). **UNCONFIRMED** on exact floor, directionally consistent with Clay's "few tenths of a penny" for Actions.
- Failed lookups do not consume Data Credits; "a waterfall that returns nothing costs nothing," and each *successful* step costs Data Credits + 1 Action, with each validation step costing again — [Cleanlist reading Clay's billing FAQ](https://www.cleanlist.ai/blog/2026-09-22-clay-waterfall-enrichment-actions). **UNCONFIRMED** (single competitor-owned source interpreting Clay docs).

**Feature gating. CONFIRMED (Clay FAQ, verbatim as indexed):**
- Launch = "everything in Free, plus phone number enrichment, **job change and signal tracking**, email campaign integrations, and up to 50,000 rows per table."
- Growth = "everything in Launch, plus **CRM auto-sync and enrichment, HTTP API integrations, webhook automation, web intent signal tracking, audience pushes to ad platforms**, and priority support." — [Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan)

**Architecture:**
- ~150+ data providers in the marketplace; Clay MCP "exposes 150+ data providers" — [Clay guide: Clay MCP](https://www.clay.com/guides/clay-mcp). Third parties variously say "100+" or "150+" — **CONFLICTING on count**, settle on "150+ per Clay's own current copy."
- **Custom waterfalls**: Clay's changelog says they "let a user chain enrichments conditionally, such as trying one provider and falling back to another if it finds nothing"; before this, conditional runs required setting conditional formulas per column — [Clay changelog: Custom waterfalls](https://www.clay.com/changelog/custom-waterfalls)
- Hand-rolled waterfall pattern still common: fallback column with run-condition "prior provider output is empty," then a formula column coalescing, e.g. `{LeadMagic Email} || {Apollo Email} || {Hunter Email}` — [LeadMagic guide](https://leadmagic.io/guides/clay-waterfall-enrichment-guide). **UNCONFIRMED** (provider-owned guide) but mechanically plausible and widely repeated.
- **Audiences** is now the persistent data layer: "the living data layer behind your GTM plays, keeping millions of records current through syncs, recurring enrichments, and signals" — Clay announcement 1 Oct 2026, [Clay community announcement](https://community.clay.com/x/announcements/msg_LWjShz42cx5h/introducing-new-clay-features-agent-plugin-skills). Record-details view redesigned week of 28 Sep 2026; Enterprise can filter Salesforce imports with SOQL; a Reporting section in Audiences shows "pipeline and revenue from Clay-sourced data" (announced in the 27 Jul 2026 roundup, which the index noted contains placeholder text — treat as **UNCONFIRMED**).

### Inferences
- The Actions/Data-Credits split is a deliberate separation of *our compute* from *their COGS*. For us this is directly instructive: a real-data version of our system will have exactly the same two cost classes (orchestration steps we run vs. per-record provider charges we pay), and metering them separately is the honest design.
- "Each plan includes enough Actions to cover 90% of customer usage" tells you Clay sized Actions to be a non-binding meter for most and a monetisation lever for heavy orchestrators. Workflow Budgets (below) exist because agentic loops can run away.

### Gaps
- Could not render clay.com/pricing directly, so the precise annual-vs-monthly labelling of $167/$446 and the exact Free-tier allowances remain index-mediated.
- No documented per-Action cost for an HTTP API call; Cleanlist *assumes* 1 Action.
- Enterprise tier contents and seat/row limits unretrieved.

---

## Q2. Claygent — what it is, models, per-run pricing, failure controls

### Takeaway
Claygent is Clay's AI web-research agent run as a table column (or, newer, as a stateful **Account Agent** over Audiences). Models are a tiered menu: Clay-native fixed-price models (Helium, Argon) plus pass-through frontier models billed at token cost, plus bring-your-own-key. Hallucination control is **almost entirely prompt-and-schema discipline pushed onto the user** — JSON output schemas, required source URLs, explicit "Not found" fallbacks. There is no evidence of built-in factuality verification.

### Cited Findings
- Model menu: Clay-native **Helium** = 1 Data Credit per web-research row; **Argon** = 3 — [Cleanlist, 2026-03-12](https://www.cleanlist.ai/blog/2026-03-12-clay-pricing-changes-2026). Other fixed-price web-research options named: GPT-5 Nano, GPT-5 Mini, Gemini 2.5 Flash — [Jaymount Consulting](https://jaymountconsulting.com/blog/claygent-ai-research). **UNCONFIRMED** (third-party; model names are plausible but I could not verify against Clay docs).
- Variable-priced frontier models (named by the same sources: GPT-5.1, Claude 4.6 Sonnet, GPT-4o, GPT-4.1, Claude 4.5 Haiku) billed at actual token cost with no markup; Clay shows a tilde-marked estimate pre-run and settles after — [Cleanlist](https://www.cleanlist.ai/blog/2026-03-12-clay-pricing-changes-2026), [Jaymount](https://jaymountconsulting.com/blog/claygent-ai-research). **UNCONFIRMED** on the specific model list.
- **Bring-your-own-key**: running Claygent on your own OpenAI/Anthropic key costs 1 Action and **zero Data Credits** — [Jaymount](https://jaymountconsulting.com/blog/claygent-ai-research). **UNCONFIRMED** (single source) but strategically important if true.
- Dollar estimate per run: ~$0.05–0.06 for a Helium run including the Action, ~$0.15 for Argon — [imisofts](https://imisofts.com/blog/clay-account-agents-cost/). **UNCONFIRMED**, single source.
- **Hallucination controls (user-side):** Clay's own guide recommends three habits — "a structured schema, a required source URL, and explicit permission to return 'Not found'" — i.e. ask the agent to attach the URL it read each answer from, and give it a "Not found" fallback "so the agent doesn't invent answers" — [Clay guide: How to Use Claygent for AI Prospect Research](https://www.clay.com/guides/how-to-use-claygent-for-prospect-research). **CONFIRMED (Clay primary).**
- Clay Support's answer to format drift at scale: choose **JSON schema** output rather than text, because "JSON schemas create hard constraints on AI outputs rather than relying on prompt instructions alone." The reporting user had a Valid/Invalid Claygent drifting from format across hundreds of rows — [Clay community support thread](https://community.clay.com/x/support/il2vxpljbqwv/claygent-output-structure-issues-with-large-data-s). **CONFIRMED (Clay community/primary).**
- **Account Agents** (newer, differentiated): agents that "run over Audiences and keep their conclusions on the account, so later runs build on earlier ones," whereas "Claygents in tables start fresh every run." The page highlights "visibility into agent reasoning" — [Clay: Account Agents](https://www.clay.com/account-agents), [Clay Docs: Account Research Agents](https://university.clay.com/docs/account-research-agents). **CONFIRMED (Clay primary).**
- Clay ships a documented **lead-scoring agent** that "scores a lead against our ICP and outputs a score from 1 to 100 with a short rationale" — [Clay Docs: Claygent Builder](https://university.clay.com/docs/claygent-builder). **CONFIRMED.**
- There is a **Sources** concept in Clay Docs (`university.clay.com/docs/sources`) and an HTTP API source supports "configuring retry attempts and conditions" — retries are documented for HTTP API sources, **not** for Claygent — [Clay Docs: HTTP API](https://university.clay.com/docs/http-api-integration-overview).

### Honest comparison to our deep-research feature
- **Where we are comparable or ahead:** our deep research produces a fixed 11-section account dossier; Claygent out of the box is a *single-question-per-column* primitive, and the 11-section dossier is closer to Clay's newer *Account Agents* + a prompt library than to vanilla Claygent. Our fixed section schema is effectively the "structured schema" discipline Clay tells users to impose by hand — we have it built in.
- **Where we are behind, materially:**
  1. **Statefulness.** Account Agents accumulate conclusions per account across runs. Our deep research almost certainly regenerates. Persistence of prior research per account is a genuine architectural feature, not a prompt.
  2. **Source URLs / citations.** Clay's own guidance makes a required source URL per answer the baseline hygiene standard in this category. If our 11 sections are unsourced generated prose, we fail the category's minimum credibility bar the moment data is real.
  3. **Model choice and cost transparency per run.** Clay exposes a model menu with pre-run cost estimates and BYOK. We have one Anthropic adapter and a deterministic fallback.
  4. **Reasoning visibility.** Clay surfaces agent reasoning for review.
- **Where Clay is also weak (so not a real gap):** no automated factuality verification, no entailment checking, no independent accuracy benchmark surfaced. The whole category relies on schema constraints plus human spot-checks. We are not behind on *validation rigour*; nobody has it.

### Gaps
- No Clay-official doc retrieved confirming the exact Claygent model list, per-model credit costs, or BYOK behaviour — all from third-party blogs.
- No independent accuracy/hallucination-rate evaluation of Claygent exists in anything I found. This appears to be a genuine absence in the public record, not a retrieval failure.
- Claygent retry/failure semantics undocumented in what I could reach.

---

## Q3. Signals and triggers

### Takeaway
Signals are a first-class Clay object with built-in monitors (job change, new hire, news/fundraising, job postings, promotions, brand mentions), plus **Custom Signals** that watch any digitally accessible source on a schedule. They are **polled, not pushed** — scheduled daily/weekly/monthly with no time-of-day control — and the recommended way to start a play is *segment membership change*, not the signal itself. Signal tracking is gated at Launch; **web-intent** signals at Growth. **We have none of this, and it is the single largest gap in the whole comparison.**

### Cited Findings
- Default signals monitor "job changes, new hires, news and fundraising, promotions, and brand mentions"; Clay University lists built-in monitors for career movement, news and fundraising, and job postings — [Clay University: Types of Signals in Clay](https://university.clay.com/lessons/types-of-signals-in-clay-signals-abm), [Clay Docs: Signals](https://university.clay.com/docs/signals). **CONFIRMED (Clay primary).**
- **Custom Signals** "let you watch any digitally accessible source on a set schedule" — [Clay: Custom Signals](https://www.clay.com/signals), [Clay Docs: Custom Signals](https://university.clay.com/docs/custom-signals). **CONFIRMED.**
- **Polling cadence, not push:** cadence is grouped daily / weekly / monthly — daily for job changes and critical accounts, weekly for market research, monthly for long-term analysis. "A scheduled run is not set to a specific time; instead, it runs every 24 hours from when you first schedule it." — [Clay University: Setting Up Signals in Clay](https://university.clay.com/lessons/setting-up-signals-in-clay). **CONFIRMED.**
- Signal results can be routed to a new table, an existing table, Slack, or a **webhook** ("send data to other systems in real-time") — [Clay Docs: Signals](https://university.clay.com/docs/signals). **CONFIRMED.**
- **How signals start plays — important nuance:** Clay recommends *against* the "On a signal" Workflow trigger, because it "doesn't carry account context." The recommended pattern is to build a segment where the signal is true and trigger on **"New member in segment."** There is also "Segment on a schedule" to re-run across a whole segment — [Clay Docs: Workflows](https://university.clay.com/docs/workflows). **CONFIRMED (Clay primary).** This is a strong architectural hint for us.
- Interpretation layer: aggressive sales/marketing hiring = budget allocation and growth ambition; technical role postings = technology adoption and infrastructure investment — [Clay University](https://university.clay.com/lessons/types-of-signals-in-clay-signals-abm). Clay's own guides suggest recency weighting (a funding round from this week scores higher than one three months old) — [Clay: How to Identify Buying Signals](https://www.clay.com/guides/how-to-identify-buying-signals).
- Practitioner counterpoint: job-change triggers "connect message to person," hiring triggers "connect to the company, which dilutes precision" — [Jolly Marketer](https://www.jollymarketer.com/en/job-change-hiring-signal-clay-outbound-b2b-trigger/). **UNCONFIRMED** opinion, but a useful design distinction.
- Website-visit / web-intent signals exist but are a **Growth-plan** gate ("web intent signal tracking") — [Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan). **CONFIRMED.**
- Podcast mentions: not found as a named signal type. The nearest named primitive is "brand mentions" plus Custom Signals over arbitrary sources. Clay also has a **Gong integration** (conversation data) — [Clay Docs: Gong integration](https://university.clay.com/docs/gong-integration-overview).

### Inferences
- Signals are mostly **scheduled polling plus diffing against stored prior state**. That is architecturally cheap for us — a cron-ish scheduler, a per-entity snapshot table, a diff, and an event row. The hard part is not the mechanism; it is the *data sources* to poll. Every meaningful signal has an external dependency (job boards, LinkedIn-derived job-change data, funding feeds, news, tech-install detection, first-party web pixel).
- Clay's "trigger on segment membership change, not on the raw signal" pattern is the right model for us too, and it maps almost perfectly onto what we already have: we already have **segments**. Adding an *event* table + "new member in segment" trigger turns our existing segments into a trigger engine without inventing a new concept.
- The one signal we could build with **zero external dependency** is first-party web intent — but that requires a pixel and real site traffic, which is a product decision, not a data purchase.

### Gaps
- No pricing retrieved for how many Data Credits a signal check consumes per record.
- No confirmation of whether any Clay signal is genuinely push/webhook-inbound from a provider rather than polled.
- Tech-install ("technographic") signals: not confirmed as a native Clay signal type in anything I retrieved; likely delivered via marketplace providers (BuiltWith-class) as enrichments rather than as a Signal object. **UNCONFIRMED.**

---

## Q4. Scoring — Clay vs. our fixed 6-factor model

### Takeaway
Clay does ICP fit scoring, but **not as a fixed-factor model**. It is (a) LLM-judged scoring with a free-text rationale, (b) multi-score tiering rather than one number, and (c) explicitly calibrated against closed-won data. Our 6-factor fixed-weight score is more auditable but less expressive and, critically, has no calibration loop.

### Cited Findings
- Clay's own scoring agent: "scores a lead against our ICP and outputs a score from 1 to 100 with a short rationale" — [Clay Docs: Claygent Builder](https://university.clay.com/docs/claygent-builder). **CONFIRMED.**
- Clay runs a **three-score system** internally to identify Tier 1 accounts — [Clay blog: How Clay Identifies Tier 1 Accounts: A Three-Score System](https://www.clay.com/blog/how-clay-identifies-tier-1-accounts). **CONFIRMED that it exists**; I could not retrieve the three component scores (page not renderable). This is a notable gap — it's the single most relevant document to our scoring design.
- Calibration method: Clay's ICP guidance is to "start with your closed-won customers and then score accounts against the patterns found there" — [Clay for Startups](https://www.clay.com/clay-for-startups). **CONFIRMED (Clay primary).**
- Practitioner feedback loop: "compare scores at the time of routing against their actual conversion outcomes, and adjust weights where the model under-predicted or over-predicted" — [Understory Agency](https://www.understoryagency.com/blog/clay-account-scoring). **UNCONFIRMED** (agency blog, has an incentive to sell implementation — but the method is standard and uncontroversial).
- Plain-English ICP scoring is also available as third-party marketplace tooling: an Apify actor "Score Company Fit With Plain English ICP / fit scorer 0-100 for Clay" — [Apify](https://apify.com/mambalabs/icp-account-lead-scoring-fit-scorer-0-100-for-clay/examples/score-company-fit-plain-english-icp). Evidence that **natural-language ICP → score** is the category norm.
- Caveat from a third party: Clay buyer scoring "works for B2B teams that already have a tight ICP and clean CRM data. It does not rescue a broken targeting model." — [growleads](https://growleads.io/blog/11-proven-ai-tools-for-lead-generation-workflows-in-clay-with-templates/). **UNCONFIRMED.**

### Inferences
- The real differences vs. our 6-factor model are three: **rationale text attached to every score**, **multiple scores instead of one composite**, and **outcome calibration**. The first two are cheap for us. The third requires real outcome data we do not yet have.
- A fixed-factor model is actually an *advantage* for explainability and determinism — it is reproducible, and it does not burn tokens per row. The right move is not to replace it with an LLM judge but to **add an LLM rationale layer on top of the deterministic factors**, and to split the single score into fit / intent / reachability.

### Gaps
- Clay's three-score composition unretrieved (page blocked).
- No evidence either way on whether Clay offers learned/fitted weights from closed-won data automatically, versus telling users to tune manually. The guidance language ("start with your closed-won customers") reads manual.

---

## Q5. Orchestration — conditional logic, loops, HTTP, webhooks, CRM write-back, non-engineer usability

### Takeaway
Clay moved in 2026 from column-level conditional formulas inside tables to a dedicated **Workflows** visual canvas with branching, loops, code steps and agent steps — and simultaneously shipped a **CLI + Agent Plugin** so coding agents can build Workflows. The non-engineer story is templates plus a Skills Marketplace; the honest practitioner read is a 2–4 week learning curve.

### Cited Findings
- **Workflows**: "a visual canvas for complex plays where steps can branch, loop, run code, or call an agent," in beta for all users with full launch planned for fall 2026 — [Clay: Introducing Workflows](https://www.clay.com/blog/introducing-workflows), [Clay Docs: Workflows](https://university.clay.com/docs/workflows). **CONFIRMED (Clay primary).**
- Triggers available: **"On webhook call"** (Clay generates a URL; each POST becomes a run), **"New member in segment"**, **"Segment on a schedule"**, and an "On a signal" trigger that Clay itself advises against for lack of account context — [Clay Docs: Workflows](https://university.clay.com/docs/workflows). **CONFIRMED.**
- **Workflow Budgets**: "Assign credit budgets to workflows to keep automated spend under control," plus bulk re-run of workflow runs from the runs dashboard — Clay changelog, week of 28 Sep 2026 — [Clay changelog](https://www.clay.com/changelog/product-roundup-week-of-september-28-2026). **CONFIRMED.** This is a cost-safety primitive we lack and will need the moment real API calls cost money.
- **Agent Plugin and CLI**: "Agent Plugin and CLI let your coding agent find prospects, run enrichments, and build Workflows (beta)"; also a **Skills Marketplace** and **Dynamic Audiences** — Clay announcement 1 Oct 2026 — [Clay community announcement](https://community.clay.com/x/announcements/msg_LWjShz42cx5h/introducing-new-clay-features-agent-plugin-skills). **CONFIRMED.**
- **HTTP API** integration for providers outside the marketplace, with configurable retry attempts and conditions; gated to Growth/Enterprise — [Clay Docs: HTTP API](https://university.clay.com/docs/http-api-integration-overview), gate per [Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan). **CONFIRMED.**
- **CRM write-back pattern (Clay's own recommended shape):** run a **Lookup** against the CRM first, then gate **Create** and **Update** actions with conditional run formulas — create only if the lookup returns nothing, update only when specific conditions are met — [Clay University: CRM Enrichment](https://university.clay.com/lessons/crm-enrichment). **CONFIRMED.** Supplementary practitioner advice: write back by preserved Salesforce ID with a timestamp field tracking last enrichment — [Octave HQ](https://www.octavehq.com/post/salesforce-clay-integration-waterfall-enrichment-at-scale). **UNCONFIRMED** (vendor blog).
- Outbound to generic automation: Zapier via catch-hook URL pasted into a Clay HTTP API enrichment — [Clay University: Send Clay data to Zapier](https://www.clay.com/university/guide/clay-to-zapier). **CONFIRMED.**
- Non-engineer reality check: "most teams should expect a learning period of two to four weeks before they can build reliable workflows" in Clay — [Modern Inbound](https://moderninbound.com/blog/unify-vs-clay), echoed across the Unify-vs-Clay comparison set. **UNCONFIRMED** (competitor-adjacent), but consistently repeated by multiple independent writeups.

### Inferences
- Clay's orchestration surface is now a general-purpose workflow engine with GTM-shaped triggers. We should not try to clone the canvas. The *valuable* parts for us, in order, are: (1) trigger types, (2) conditional run-gating per step, (3) HTTP step, (4) per-workflow credit budget, (5) run history with re-run.
- Clay ships an **Agent Plugin + CLI + Skills Marketplace** specifically so AI coding agents can author plays. Combined with the MCP server (Q8), this is the clearest signal in the whole research that **agent-authorability is becoming a product requirement, not a nice-to-have**.

### Gaps
- Whether Workflows' loop construct supports bounded iteration/fan-out limits, and how concurrency is handled, is undocumented in what I retrieved.
- Workflows' GA date ("fall 2026") not confirmed as having happened.

---

## Q6. The AI-native / agentic competitors in this lane

### Takeaway
The lane has split into three roles: **workbench** (Clay), **packaged signal-to-action system** (Unify, Amplemarket, Common Room), and **generic agent/workflow substrate** (Relevance AI, Gumloop, n8n). What the packaged players add over Clay is *out-of-the-box plays and lower setup cost*; what they lose is Clay's provider breadth and programmability. Octave is a messaging/context layer explicitly positioned as a Clay complement.

### Cited Findings

**Unify (UnifyGTM)**
- Framed as "a packaged warm-outbound system" / "a warm-outbound system of action that packages signals, enrichment, and automated plays into a running motion," against Clay as "an open enrichment workbench you program yourself" — [Modern Inbound](https://moderninbound.com/blog/unify-vs-clay), [Swan](https://www.getswan.com/blog/unify-vs-clay). **UNCONFIRMED** framing (competitor-written), but consistent across several independent writeups.
- Agents are "the center of the product after its 2025–2026 relaunch" (Unify 2.0) — [MarketBetter: Unify GTM Review 2026](https://marketbetter.ai/blog/unify-gtm-review-2026/). **UNCONFIRMED.**
- Pricing: **CONFLICTING.** One source says "$500+/month with intent signals"; another says "$1,460–$1,740/mo with a 1+ week onboarding ramp." Do not rely on either.
- Funding/valuation context: Unify raised a **$40M Series B in July 2025**; Clay **valued at $3.1B in August 2025** — [Artisan](https://www.artisan.co/blog/clay-vs-unify-which-should-you-choose-in-2026). **UNCONFIRMED** (competitor blog), though both figures match widely reported events.
- Coexistence pattern: "some teams run both — Clay for cold enrichment, Unify for warm inbound routing" — [Modern Inbound](https://moderninbound.com/blog/unify-vs-clay).

**Octave (OctaveHQ)**
- Self-described as "the world's first GTM Context Engine," "an agentic AI platform designed specifically for GTM teams and Growth Engineers" — [Octave](https://www.octavehq.com/post/best-platforms-for-unified-gtm-data-in-2026). **Self-promotional.**
- Explicitly positions as Clay-complementary: "Clay is brilliant at gathering data, but it needs a brain to write the perfect message. Octave acts as that brain." — [Octave](https://www.octavehq.com/post/salesforce-clay-integration-waterfall-enrichment-at-scale). **Self-promotional.**
- What it adds over Clay: a persistent product/positioning/persona context store that messaging agents draw on, rather than per-column prompts. **Inference**, not sourced.

**Common Room**
- Buyer-signal aggregator; "aggregates buying signals from 50+ sources," strongest for product-led/community-led GTM — [MarketBetter: Common Room Review 2026](https://www.marketbetter.ai/blog/common-room-review-2026/). **UNCONFIRMED.**
- **Acquired by Zoom, reported 2 July 2026** — [SuperFrameworks roundup](https://superframeworks.com/articles/best-ai-gtm-tools). **UNCONFIRMED, single source, and materially important if true** — it would mean the leading independent signal aggregator is now inside Zoom. Flag for verification.
- What it adds over Clay: breadth and *recency* of person-level community/social signal (GitHub, Slack, social, community) that Clay's scheduled polling does not natively cover.

**Amplemarket**
- Self-described "AI-native execution platform" covering the top of funnel in one system — [Amplemarket](https://www.amplemarket.com/blog/10-best-gtm-tools) (self-promotional). An independent-ish roundup lists it as "Best AI-Native Outbound Execution" — [SuperFrameworks](https://superframeworks.com/articles/best-ai-gtm-tools). **UNCONFIRMED.**
- Notably, Amplemarket publishes its own Clay cost breakdown — [Amplemarket on Clay cost](https://www.amplemarket.com/blog/how-much-does-clay-really-cost) — i.e. a competitor positioning on Clay's credit complexity. What it adds over Clay: it *sends* (Clay largely does not — see Q7).

**HeyReach + Clay stacks**
- HeyReach covers LinkedIn multichannel; has native two-way integrations with Instantly and Smartlead such that "responses on either channel automatically pause outreach on both platforms." Clay is not part of that sync — [HeyReach](https://www.heyreach.io/multichannel-outreach). **UNCONFIRMED** on the bidirectional-pause detail (vendor page).
- Agency pattern: webhook fires from HeyReach to Smartlead with the enriched email when a LinkedIn connection goes unanswered for 14 days. **UNCONFIRMED** (agency writeup). There is a Clay-community "Clay x HeyReach" resource — [Clay community](https://community.clay.com/x/share-resources/msg_PK3YCmFxUrp4/clay-x-heyreach).

**Relevance AI**
- Agent platform shipping role-based agent templates including "BDR" and "Researcher"; positioned as assembling a roster of role-based agents that work as a team — [Vellum roundup](https://www.vellum.ai/blog/gumloop-alternatives). **UNCONFIRMED.** Adds over Clay: agent-as-teammate abstraction and multi-agent delegation, not data breadth.

**Gumloop**
- Visual multi-agent workflow builder, "best for teams building custom multi-agent workflows visually, without writing code" — [Vellum](https://www.vellum.ai/blog/gumloop-alternatives). Also **hosts a Clay MCP endpoint** with managed auth, no code — [Gumloop](https://www.gumloop.com/mcp/clay). Adds over Clay: general-purpose (non-GTM) agent composition; subtracts: no data marketplace.

**n8n-based GTM stacks**
- "Node-based editing with the power of raw JavaScript," a strong alternative "for developers who find Gumloop too restrictive regarding custom code execution," self-hostable with the cost borne by you — [Gumloop's own n8n-alternatives post](https://www.gumloop.com/blog/n8n-alternatives) (competitor-written, so the framing favours Gumloop). A documented practitioner stack is **Clay + Smartlead + n8n** — [The Automations Guide, 7 May 2026](https://theautomationsguide.com/blog/2026-05-07-clay-smartlead-n8n-cold-email-automation-stack/). **UNCONFIRMED.**
- Adds over Clay: unlimited custom code, self-hosting, no per-action metering. Subtracts: no data, no GTM primitives, you build the lot.

**Category framing**
- A 2026 layered model puts automation substrates (Gumloop, n8n) at the base, signal tools (Common Room) in the middle surfacing "who is in market right now," and execution tools above — arguing "seven tools chosen for fit and wired together will outperform twenty tools connected manually" — [RevenueFlow](https://www.revenueflow.com/blog/7-layer-gtm-ai-stack). **UNCONFIRMED** (vendor-adjacent).
- "The GTM Platform Is Emerging" as a named category — [Segment8](https://blog.segment8.com/posts/go-to-market-platform-category-2026/). **UNCONFIRMED.**

### Inferences
- Our system's shape — research + scoring + orchestration + generation + reply classification + campaigns + inbox + suppression, all in one — is actually closer to **Unify/Amplemarket (packaged system of action)** than to Clay (workbench). That is a defensible position: we should not try to become a workbench with 150 providers; we should be the packaged system and buy data through a small number of waterfalled providers.
- Nobody in this lane has solved factual verification of AI research. That is open ground.

### Gaps
- No independent (non-vendor) comparison of any of these tools was found. Every comparison retrieved is written by a competitor, an affiliate, or an implementation agency. Confidence in all competitive framing is low.
- Common Room/Zoom acquisition: single source, needs verification.
- No pricing I would trust for Unify, Octave, Amplemarket or Relevance AI.

---

## Q7. Where Clay deliberately does NOT compete

### Takeaway
Clay's stated position is that it is not your email sequencer — but this is **no longer clean**: Clay ships a **table-based campaign sequencer powered by Smartlead**, billed on Clay credits and requiring no Smartlead account. So Clay does send, in a limited, white-labelled way, while still pushing most volume to partner senders. Clay does not do deliverability infrastructure (mailbox warmup, domain/inbox management) or a unified reply inbox.

### Cited Findings
- Clay's own FAQ: Clay "doesn't replace your email sequencer"; it integrates so you can "push finalized outreach from Clay to your sequencer and live campaigns," naming native integrations with **Smartlead, Instantly, Salesloft, Outreach, HubSpot** and others — [Clay FAQ: How do I send emails with Clay?](https://www.clay.com/faq/how-do-i-send-emails-with-clay). **CONFIRMED (Clay primary).**
- **But:** Clay's docs on table-based campaigns say the sequencer "is powered by Smartlead, but everything runs on Clay credits, and you don't need your own Smartlead account to use it" — [Clay Docs: Table-based campaigns / Email sequencer](https://university.clay.com/docs/email-sequencer). **CONFIRMED (Clay primary).** This directly qualifies the "Clay doesn't send" conventional wisdom.
- Email campaign integrations are a **Launch**-plan gate — [Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan). **CONFIRMED.**
- Push mechanics: either the native Smartlead action or Clay's HTTP API action with POST; a blank cell for a variable "will not populate in the email," so row-gating before push matters — [LeadHaste](https://leadhaste.com/blog/clay-smartlead-integration-guide). **UNCONFIRMED** (agency blog) but a real operational hazard worth noting.
- Reply handling / cross-channel pause lives with the senders, not Clay: HeyReach↔Instantly/Smartlead two-way sync pauses outreach on both channels on reply; "Clay isn't part of that sync" — [HeyReach](https://www.heyreach.io/multichannel-outreach). **UNCONFIRMED** (vendor).
- Clay has moved *outward* into paid media instead: **Clay Ads 2.0** (changelog 5 Oct 2026) with "unlimited, always-on ad audiences" syncing to six ad platforms, plus Clay Ads commands in the stable Clay CLI with a bundled skill for coding agents — [Clay changelog](https://www.clay.com/changelog). **CONFIRMED.**

### Inferences
- Clay's chosen frontier is **data + orchestration + audience distribution (incl. ads)**, not deliverability. Deliverability (warmup, domain rotation, inbox placement, bounce/spam-trap handling) is the genuinely hard, unsexy, infrastructure-heavy part — and it is where the sending partners' moat is.
- For us this is the clearest strategic read in the whole report: **do not build deliverability.** Our campaigns/inbox/suppression surface should sit *on top of* a sending provider (Smartlead/Instantly-class, or a raw ESP) exactly as Clay's sequencer sits on Smartlead. Our org-wide suppression and 12-intent reply classification are genuinely differentiated against Clay, which has neither.

### Gaps
- Whether Clay's table-based sequencer offers reply detection/classification at all is unretrieved. I would assume minimal.

---

## Q8. MCP and agent-accessibility

### Takeaway
Yes — Clay runs an **official hosted remote MCP server** at `https://api.clay.com/v3/mcp` (Streamable HTTP, OAuth with Dynamic Client Registration), plus a local `clay mcp` CLI server bundled with its coding-agent plugin, and at least five third-party MCP wrappers. Agent-accessibility is now table stakes in this category, and Clay has gone further than parity by making its *authoring* surface agent-drivable.

### Cited Findings
- Official remote server: `https://api.clay.com/v3/mcp`, Streamable HTTP transport, OAuth — [mcpservers.org: Official Clay MCP Server](https://mcpservers.org/servers/clay-remote-mcp). **CONFIRMED** (registry listing; consistent with Clay's own guide).
- Clay's own guide says MCP exposes "150+ data providers, AI research agents, and a team's prebuilt workflows" inside **ChatGPT, Claude, and Codex** — [Clay guide: What Is Clay MCP?](https://www.clay.com/guides/clay-mcp). **CONFIRMED (Clay primary).**
- Additional hosts reported: Microsoft Copilot and Glean; auth is OAuth with **Dynamic Client Registration**; a local `clay mcp` CLI server ships with Clay's coding-agent plugin — [Scalekit: Clay MCP vs Clay API](https://www.scalekit.com/blog/clay-mcp-vs-api). **UNCONFIRMED** (vendor blog).
- **Important governance detail:** per the same Scalekit post, "credit budgets and function-level permissions apply only to MCP users, not to agents that call the Public API with a key." **UNCONFIRMED, single source** — but if true it is a real design lesson: put the budget/permission enforcement in the data layer, not in one protocol adapter.
- Third-party MCP wrappers: Gumloop (hosted, no-code auth) — [Gumloop](https://www.gumloop.com/mcp/clay); Merge Agent Handler (managed credentials + audit log of every Clay tool call) — [Merge](https://www.merge.dev/connectors/clay); Scalekit AgentKit (OAuth + token refresh, **17 tools**) — [Scalekit](https://docs.scalekit.com/agentkit/connectors/claymcp/); Activepieces (**4 tools**: company search, people search, send rows to a Clay table) — [Activepieces](https://www.activepieces.com/mcp/clay); viaSocket — [viaSocket](https://viasocket.com/mcp/clay). **CONFIRMED** that an ecosystem exists; tool counts **UNCONFIRMED.**
- Clay's **Agent Plugin + CLI** lets a coding agent "find prospects, run enrichments, and build Workflows," and a **Skills Marketplace** exists — Clay announcement 1 Oct 2026 — [Clay community](https://community.clay.com/x/announcements/msg_LWjShz42cx5h/introducing-new-clay-features-agent-plugin-skills). **CONFIRMED.**

### Inferences
- The existence of five+ third-party wrappers around Clay's MCP server, and Clay's own CLI/plugin/skills push in Sep–Oct 2026, together make agent-accessibility an **expected capability** in this category as of now, not an experiment.
- For our zero-dependency Node backend this is unusually cheap: MCP over Streamable HTTP is JSON-RPC over HTTP POST/SSE, which `node:http` can serve directly with no dependencies. Our existing operations (query parse, search, score, deep research, lookalikes, segments, generate email, classify reply, export) are already a near-perfect tool list.

### Gaps
- Clay's MCP tool list and names unretrieved (clay.com blocked).
- No pricing retrieved for MCP-initiated Actions/Data Credits.

---

## Q9. Build-vs-buy verdict for our stack — opinionated

### Takeaway
Three things are table stakes we must match and can build cheaply because they are *mechanism, not data*: source citations on research, signal events wired to existing segments, and conditional step-gating with per-run budgets. Everything that is really a *data purchase* (providers, waterfalls, job-change feeds, technographics, web intent) is buy-not-build and blocked on commercial agreements. Deliverability is neither — it is rent.

### (a) Table stakes we MUST match
1. **Source URLs / citations on every AI-research field.** Clay's own guidance makes this the category hygiene minimum ([Clay guide](https://www.clay.com/guides/how-to-use-claygent-for-prospect-research)). The moment our 11-section research is real rather than fiction, unsourced prose is a credibility failure. Cheap in our stack: add a `sources` array per section, require it in the schema, render as footnotes.
2. **Structured output schemas with an explicit "Not found" value.** Clay Support's own answer to format drift at scale ([community thread](https://community.clay.com/x/support/il2vxpljbqwv/claygent-output-structure-issues-with-large-data-s)). We already have deterministic fallback; what we need is a hard per-field schema with a distinguishable null, so "no data" never renders as confident prose.
3. **Waterfall enrichment with run-gating and coalescing.** The canonical shape: try provider A, run B only if A is empty, coalesce first non-empty, charge nothing on total miss ([Clay changelog](https://www.clay.com/changelog/custom-waterfalls)). With `node:sqlite` this is a provider table, an ordered attempt log per (entity, field), and a resolved-value view. Build the *engine* now even with one provider behind it.
4. **Event/trigger layer on top of our existing segments.** Clay's own recommended pattern is "New member in segment," explicitly in preference to raw signal triggers ([Clay Docs: Workflows](https://university.clay.com/docs/workflows)). We already have segments; we need an events table, a diff-on-recompute, and a trigger registry.
5. **A real MCP server.** Now expected in the category (Q8). Near-free on `node:http`.
6. **Per-run / per-workflow cost budgets and a run history with re-run.** Clay shipped Workflow Budgets in Sep 2026 ([changelog](https://www.clay.com/changelog/product-roundup-week-of-september-28-2026)). Non-negotiable before anything touches a paid API.

### (b) Worth building
7. **Stateful per-account research memory** (Clay's Account Agents differentiator — conclusions persist, later runs build on earlier; table Claygents "start fresh every run" — [Clay](https://www.clay.com/account-agents)). Our SQLite store makes this a schema change plus a merge strategy, and it directly cuts token cost on re-research. High value per unit of effort.
8. **Scoring upgrade: split the composite, add rationale, add calibration hooks.** Clay runs a three-score system ([Clay blog](https://www.clay.com/blog/how-clay-identifies-tier-1-accounts)) and its agent emits a score 1–100 *with rationale* ([Clay Docs](https://university.clay.com/docs/claygent-builder)). Keep our deterministic 6 factors (they are an explainability asset); add (i) a rationale string generated from the factor contributions, (ii) separate fit / intent / reachability scores, (iii) an outcomes table so weights can later be tuned against closed-won, as both Clay and practitioners prescribe.
9. **Generic HTTP step with retries.** Clay gates this at $495/mo Growth; for us it is ~a day of work with `node:http` and unlocks every provider we can't natively integrate. Disproportionate leverage.
10. **First-party web-intent signal.** The *only* signal class with no external data dependency — a pixel endpoint plus identity resolution against our account table. Also the one Clay charges Growth-tier for.

### (c) NOT worth it
11. **A visual workflow canvas.** Clay has a full one in beta with branch/loop/code/agent steps. Reimplementing a node canvas in vanilla JS is months and competes on exactly the axis where a $3.1B-valued company ([per Artisan](https://www.artisan.co/blog/clay-vs-unify-which-should-you-choose-in-2026), unconfirmed) is strongest. Ship declarative JSON-configured plays plus an MCP/CLI authoring path instead — notably the direction Clay itself is also pushing.
12. **A 150-provider marketplace.** This is commercial BD, not engineering. 2–4 waterfalled providers per field covers the vast majority of the value.
13. **Deliverability infrastructure** (mailbox warmup, domain rotation, inbox placement). Clay deliberately doesn't ([Clay FAQ](https://www.clay.com/faq/how-do-i-send-emails-with-clay)) and even its own sequencer rents Smartlead's ([Clay Docs](https://university.clay.com/docs/email-sequencer)). Rent it; this is the single clearest buy decision in the research.
14. **Ads audience sync** (Clay Ads 2.0, six platforms). Entirely orthogonal to our product and gated behind six platform integrations.
15. **Our own credit marketplace/billing meter.** Premature. Log usage per operation in the two classes (orchestration steps vs. provider spend) so a meter is *possible* later; don't build billing.

### Reasoning tied to our stack
Our constraints (vanilla JS, `node:http`, `node:sqlite`, no dependencies) are a liability for canvas UIs and a non-issue for everything else in this list. SQLite is well suited to the attempt-log/provider-waterfall and event-diff patterns. The absence of a queue/scheduler is the one real architectural hole: signals, scheduled re-enrichment and segment-on-a-schedule all need a durable job runner with retries and budget enforcement. **Build that first** — items 4, 6, 7 and 10 all depend on it, and nothing else in the list is hard once it exists.

---

## RANKED: features from this category that would most improve our system

Cost estimates are my own engineering judgement for our stack, not sourced.

| # | Feature | Why (sourced) | Cost in our stack | Hard external dependency |
|---|---|---|---|---|
| 1 | **Durable job runner + scheduler** (retries, concurrency caps, per-run budget, run history, bulk re-run) | Prerequisite for signals, recurring enrichment, scheduled segments; Clay shipped Workflow Budgets and bulk re-run Sep 2026 ([changelog](https://www.clay.com/changelog/product-roundup-week-of-september-28-2026)) | Medium (1–2 wks). SQLite job table + in-process worker; no deps needed | None |
| 2 | **Source citations + hard field schemas with explicit "Not found"** on all research/AI output | Clay's own stated three habits for trustworthy agent output ([Clay guide](https://www.clay.com/guides/how-to-use-claygent-for-prospect-research)); Clay Support prescribes JSON schema over prompt instructions ([community](https://community.clay.com/x/support/il2vxpljbqwv/claygent-output-structure-issues-with-large-data-s)) | Low (3–5 days) — schema + renderer + validator | Real research requires real web access/search API; schema work itself has none |
| 3 | **Signal/event layer + "new member in segment" triggers** | We have zero signal ingestion; Clay's signals are polled daily/weekly/monthly and its own docs recommend triggering on segment entry, not raw signals ([Clay Docs: Signals](https://university.clay.com/docs/signals), [Workflows](https://university.clay.com/docs/workflows)) | Medium for the *mechanism* (1 wk: snapshot + diff + event table + trigger registry, reusing existing segments). High for *coverage* | **Yes, severe** — every signal type needs a data source: job-change/job-posting feed, funding feed, news, technographics. This is the biggest blocked item in the project |
| 4 | **Waterfall enrichment engine** (ordered providers, run-gating on empty, coalesce, no-charge on miss, attempt log) | Clay's core primitive; custom waterfalls run enrichments conditionally with fallback ([Clay changelog](https://www.clay.com/changelog/custom-waterfalls)) | Medium (1 wk) — provider registry + attempt log + resolved view | **Yes** — needs ≥2 real providers to be meaningful; commercial, not technical |
| 5 | **Generic HTTP step with configurable retries** | Clay gates this at Growth $495/mo; it unlocks every non-native provider ([Clay Docs: HTTP API](https://university.clay.com/docs/http-api-integration-overview), [Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan)) | Low (2–3 days) with `node:http` | None |
| 6 | **Per-account persistent research memory** (conclusions accumulate across runs) | Clay's Account Agents explicitly differentiate on this vs. table Claygents which "start fresh every run" ([Clay](https://www.clay.com/account-agents)) | Low–Medium (4–6 days) — SQLite schema + merge/supersede strategy | None |
| 7 | **Scoring v2: fit/intent/reachability split, generated rationale, outcomes table for calibration** | Clay runs a three-score system ([Clay blog](https://www.clay.com/blog/how-clay-identifies-tier-1-accounts)); scoring agent emits score + rationale ([Clay Docs](https://university.clay.com/docs/claygent-builder)); calibrate against closed-won ([Clay for Startups](https://www.clay.com/clay-for-startups)) | Low (3–5 days) — keep deterministic factors, add rationale + split + outcomes log | Calibration needs real conversion outcomes we don't have yet |
| 8 | **MCP server exposing our operations as tools** | Clay runs an official remote MCP server and a local CLI one, with 5+ third-party wrappers; agent-accessibility is now expected ([Clay guide](https://www.clay.com/guides/clay-mcp), [mcpservers.org](https://mcpservers.org/servers/clay-remote-mcp)) | Low (3–5 days) — JSON-RPC over `node:http`; existing ops map directly to tools | None (OAuth adds work if we want parity with Clay's DCR auth) |
| 9 | **CRM write-back with lookup-then-gated-create/update** | Clay's own recommended pattern: lookup first, create only if absent, update only on conditions ([Clay University: CRM Enrichment](https://university.clay.com/lessons/crm-enrichment)) | Medium (1–2 wks per CRM) — OAuth + field mapping + idempotency by external ID + last-enriched timestamp | **Yes** — HubSpot/Salesforce OAuth apps and API quotas |
| 10 | **Model menu + pre-run cost estimate + BYOK for AI research** | Clay offers fixed-price native models and pass-through frontier models with a pre-run tilde estimate, and BYOK costs no Data Credits ([Cleanlist](https://www.cleanlist.ai/blog/2026-03-12-clay-pricing-changes-2026), [Jaymount](https://jaymountconsulting.com/blog/claygent-ai-research) — both UNCONFIRMED) | Low (3–4 days) — our Anthropic adapter generalises; token-count estimate pre-run | Only if we offer non-Anthropic models |
| 11 | **Sending via a provider integration rather than our own infrastructure** | Clay doesn't send natively and even its own sequencer is "powered by Smartlead" on Clay credits ([Clay FAQ](https://www.clay.com/faq/how-do-i-send-emails-with-clay), [Clay Docs](https://university.clay.com/docs/email-sequencer)); also guard blank merge variables before push ([LeadHaste](https://leadhaste.com/blog/clay-smartlead-integration-guide)) | Medium (1–2 wks) — push adapter + merge-variable completeness gate + webhook ingest for replies | **Yes** — a sending provider account; this is the gate on our "nothing sends" status |
| 12 | **First-party web-intent pixel + identity resolution** | Clay gates web-intent signals at Growth ([Clay FAQ](https://www.clay.com/faq/what-features-are-included-in-the-new-plans-how-do-i-pick-the-right-plan)) | Medium (1–2 wks) | Needs real site traffic; reverse-IP/identity resolution needs a provider for anything beyond known-visitor matching |

**Not recommended (explicit non-goals):** visual workflow canvas, 150-provider marketplace, deliverability infrastructure, ads audience sync, our own credit billing meter. Reasoning in Q9(c).

---

## Cross-cutting gaps in this research
- **Every clay.com and docs.clay.com page was unrenderable** (egress-proxy org policy 403 + WebFetch DNS failure + Tavily key failure). All Clay primary claims above are index-mediated quotations. The highest-value unrendered pages were `clay.com/pricing`, `clay.com/blog/how-clay-identifies-tier-1-accounts` (the three-score system), and the Claygent model/pricing docs.
- **No independent, non-vendor comparison** of Clay against Unify/Octave/Amplemarket/Common Room exists in anything retrieved. Confidence in all competitive positioning is low.
- **Claygent's exact model list, per-model credit costs, BYOK behaviour, and retry semantics** rest on two third-party blogs.
- **Common Room's reported acquisition by Zoom (2 Jul 2026)** is single-sourced and should be verified before it appears in a report.
- **No independent accuracy or hallucination-rate evaluation of any AI research agent in this category** was found. I believe this is a real absence in the public record rather than a retrieval failure, and it is the clearest open ground for differentiation.
