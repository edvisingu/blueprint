# Smartlead: Reply Handling, Lead Categorisation, CRM/Pipeline, Analytics, A/B Testing, API/Webhooks/Integrations

> **Research date: 2026-10-13.** All statements describe the state found on that date unless a different date is given inline.
>
> **IMPORTANT METHODOLOGY CAVEAT — read before trusting any "verbatim" list below.** Direct page fetching was unavailable in this environment: `WebFetch` failed with DNS errors (`getaddrinfo ENOTFOUND`) for every host, including `api.smartlead.ai`, `helpcenter.smartlead.ai`, `www.smartlead.ai` and `smartleadai.notion.site`; raw `curl` was refused by the agent proxy (`CONNECT tunnel failed, response 403`); the Tavily MCP extractor had no valid API key. Everything below therefore comes from a search tool that *read* those pages and reported their contents, not from me reading the raw HTML/markdown. Strings presented as verbatim are reported-verbatim from the named primary URL. **Before coding against any name in this document, the taxonomy and event lists must be re-verified by (a) a live `GET /leads/fetch-categories` call and (b) a live test webhook.** I flag each item as CONFIRMED-BY-PRIMARY-DOC-VIA-SEARCH, CONFLICTING, or UNCONFIRMED.

## Reply classification: the exact lead category / intent taxonomy

### Takeaway
Smartlead does not expose one single canonical published taxonomy — its API reference, its help centre and its marketing blog each give **different lists**, and the API docs themselves contradict each other on category IDs. The most authoritative, developer-grade list is the five global categories documented on the Update Lead Category endpoint (`1 Interested`, `2 Meeting Request`, `3 Not Interested`, `4 Do Not Contact`, `5 Information Request`), with `Out of Office` additionally existing as an AI-categorisation target, and users able to add custom categories. **Treat the full taxonomy as account-specific and resolvable only at runtime via `GET /leads/fetch-categories`.**

### Cited Findings

**The developer-documented taxonomy (highest confidence available):**
- The Master Inbox "Update Lead Category" API reference page lists category IDs as: **`1 - Interested`, `2 - Meeting Request`, `3 - Not Interested`, `4 - Do Not Contact`, `5 - Information Request`** — [Smartlead API, Update Lead Category (inbox)](https://api.smartlead.ai/api-reference/inbox/update-category). Status: CONFIRMED-BY-PRIMARY-DOC-VIA-SEARCH.
- A second Smartlead API page, "Get Lead Categories", shows a **conflicting** sample response in which `id 2` is `Not Interested` and `id 3` is `Meeting Booked` — [Smartlead API, Get Lead Categories](https://api.smartlead.ai/api-reference/leads/categories). The docs note this response is illustrative. Status: CONFLICTING with the above; do not hardcode either mapping.
- Categories are retrieved at `GET https://server.smartlead.ai/api/v1/leads/fetch-categories?api_key=YOUR_KEY`. Each category object carries **`id`, `name`, `sentiment_type` (values: `positive`, `negative`, `neutral`), `created_at`**. Global/built-in categories have lower IDs; user-created categories have higher IDs — [Smartlead API, Get Lead Categories](https://api.smartlead.ai/api-reference/leads/categories). Status: CONFIRMED-BY-PRIMARY-DOC-VIA-SEARCH. **This is the key structural fact: there is a `sentiment_type` dimension separate from the category name.**
- A separate API-docs summary of lead categories gives: **Interested, Meeting Request, Not Interested, Do Not Contact, Information Request, plus custom categories** — and explicitly contains **no `Out of Office` and no `Wrong Person`** entries — [Smartlead API, Understanding Leads](https://api.smartlead.ai/core/leads) / [Lead Management Guide](https://api.smartlead.ai/guides/lead-management).
- Setting a category to `null` via the update endpoints **removes** the category assignment — [Smartlead API, Update Lead Category (inbox)](https://api.smartlead.ai/api-reference/inbox/update-category).
- There are two distinct update paths: `api-reference/inbox/update-category` (Master Inbox) and `api-reference/campaigns/update-lead-category` (campaign-scoped) — [Smartlead API, Update Lead Category in Campaign](https://api.smartlead.ai/api-reference/campaigns/update-lead-category).

**The help-centre / UI taxonomy (conflicts with the API list):**
- The help-centre article dedicated to this is [Help Centre, Lead Categories (article 51)](https://helpcenter.smartlead.ai/en/articles/51-lead-categories). The "Default Available Categories" list on that page (and on the mirrored [Smartlead Notion, Lead Categories](https://smartleadai.notion.site/Lead-Categories-da81969e563444c28b9e1c100a561ab8)) **is published as a screenshot/image, not as text**, so it is not machine-readable and could not be extracted. Named examples that do appear as text on the page include **`Requested info`** and **`Out of Office`** — [Help Centre, Lead Categories](https://helpcenter.smartlead.ai/en/articles/51-lead-categories). Status: PARTIAL — this is the single biggest confirmed gap.
- A category dropdown sits in the **top-right corner of each conversation** in the Master Inbox for manual assignment — [Help Centre, Lead Categories](https://helpcenter.smartlead.ai/en/articles/51-lead-categories).
- Other help-style guidance mentions default categories including **Interested, Not Now, Objection, Unsubscribe** — reported in [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features). Status: CONFLICTING with both lists above.

**The marketing-blog taxonomies (three mutually inconsistent six-item lists):**
- List A — **Interested, Not Interested, Out of Office, Referral, Do Not Contact, Neutral/Needs Review** ("reads every incoming reply and sorts it into one of these six categories") — [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features).
- List B — **interested, not interested, out of office, wrong person, unsubscribe, do not contact** — [Smartlead blog, Inbox management when sending bulk emails](https://www.smartlead.ai/blog/inbox-management-with-smartlead-when-sending-bulk-emails).
- `Wrong Person` appears only in List B; the nearest documented analogue elsewhere is **`Referral`** (prospect redirects you to someone else) — [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer).
- `Do Not Contact` is described as covering unsubscribe requests, legal threats and explicit demands to stop, and such replies are **automatically added to the global block list** — [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer).

**Assignment mechanism — AI, rule or manual:**
- Assignment is **AI-based (LLM/intent classification) with manual override**. AI categorisation is switched on per campaign under **Campaign Settings → General**, where you choose default categories or create custom ones — [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer); [Help Centre, Auto-restart OOO based on email copy (article 209)](https://helpcenter.smartlead.ai/en/articles/209-auto-restart-ooo-based-on-email-copy).
- The model is described as reading **tone, sentiment and keywords** to pick the category — [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer).
- Users can **correct a miscategorised reply, and the correction feeds back into the model**; the AI is said to need **~50 replies to calibrate** to an account's response patterns — [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features).
- **Custom categories: yes**, created from the Settings section — [Help Centre, Lead Categories](https://helpcenter.smartlead.ai/en/articles/51-lead-categories).
- Self-reported accuracy claims are inconsistent across Smartlead's own posts: **94% overall (97% Interested, 99% Do Not Contact)**; **94.7% across all customer accounts in Q1 2026**; **"near 100%" when trained with custom prompts** — [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features); [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer); [Smartlead blog, Auto-generated emails](https://www.smartlead.ai/blog/auto-generated-email). Status: vendor self-reported, mutually inconsistent, not independently verified.

**Categories as automation triggers:**
- A category can **auto-enrol a lead into another sequence**: the documented example is a lead tagged **`Requested info`** being auto-added to a **"Send more info"** drip sequence — [Help Centre, Lead Categories](https://helpcenter.smartlead.ai/en/articles/51-lead-categories).
- Category change emits the **`LEAD_CATEGORY_UPDATED`** webhook, which fires "whether set manually or by auto-categorization" and is explicitly intended for **CRM sync, sales routing and workflow automation** — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).
- `Do Not Contact`-type replies auto-add the contact to the **global block list** — [Smartlead blog, AI Email Organizer](https://www.smartlead.ai/blog/ai-email-organizer).
- Categories are filterable in **Saved Views** alongside email status, client name, team member and reply date range; Saved Views are also API-addressable (`api-reference/inbox/create-saved-view`) — [Help Centre, Mastering your Master Inbox with views (article 167)](https://helpcenter.smartlead.ai/en/articles/167-mastering-your-master-inbox-with-views); [Smartlead API, Create Saved View](https://api.smartlead.ai/api-reference/inbox/create-saved-view).

### Inferences
- The practical, build-safe model is: **category = a row in a per-account `lead_categories` table (id, name, sentiment_type)**, seeded with ~5 global rows and extensible by the user — not a fixed enum. A comparison against a 12-intent classifier should therefore be framed as "Smartlead ships ~5–6 coarse global intents + a `sentiment_type` tri-state + unlimited custom labels", versus a fixed 12-intent scheme.
- The five API-documented globals (`Interested`, `Meeting Request`, `Not Interested`, `Do Not Contact`, `Information Request`) plus `Out of Office` give **six** intents with reasonable confidence. `Referral`, `Wrong Person`, `Neutral/Needs Review`, `Not Now`, `Objection`, `Unsubscribe`, `Meeting Booked` are each attested by at least one Smartlead-owned source but **none is corroborated across sources**, so each is individually UNCONFIRMED.
- The divergence between blog lists and API lists most likely reflects marketing copy written against a newer/renamed UI while the API reference lags, but that is inference, not documented.

### Gaps
- **The verbatim "Default Available Categories" list is not obtainable from public text** — it is an image on help-centre article 51 and its Notion mirror, and image OCR was not possible here. This is the one deliverable I cannot fully close without a logged-in account or an API key.
- No documented mapping between category name and `sentiment_type` value (i.e. which globals are `positive`/`negative`/`neutral`).
- No documentation found on whether a rule-based (keyword/regex) assignment path exists alongside the AI path.
- No documented per-category automation matrix (which categories can auto-stop a sequence vs auto-move vs auto-push); only the sequence-enrolment example and the block-list behaviour are documented.

## Out-of-office and auto-reply detection

### Takeaway
Yes — Smartlead has a documented, campaign-level feature that AI-detects OOO replies, infers the lead's return date from the email copy, and reschedules the follow-up to that date. It was documented as **beta**.

### Cited Findings
- The help centre documents a **beta** setting that uses AI to read OOO replies, **estimate when the lead returns, and reschedule follow-ups for that date**. Enabled under the campaign's **General tab** by selecting **Out-of-Office** under the AI-categorization option and turning on **automatic restart for AI-categorised OOO replies** — [Help Centre, Auto-restart OOO Based on Email Copy (article 209)](https://helpcenter.smartlead.ai/en/articles/209-auto-restart-ooo-based-on-email-copy). (Beta status as documented; date of beta status not stated on page.)
- Once OOO is detected, **the sequence pauses for that lead** and follow-ups are rescheduled for the expected return — [Smartlead, Email auto-responder tools comparison](https://www.smartlead.ai/blog/email-auto-responder-tools).
- The AI distinguishes **temporary OOO (vacation) from permanent OOO (left the company)** — [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features).
- Separately, standard **auto-pause on reply** stops the sequence as soon as a prospect replies — [Smartlead review (third-party)](https://galadon.com/smartlead). Status: third-party.

### Inferences
- OOO handling is implemented as "AI category + category-triggered restart", i.e. it is a special case of the category-automation machinery rather than a separate parser. This is consistent with it being configured under the AI-categorization option.

### Gaps
- No documentation found on generic auto-reply/bot/vacation-responder detection distinct from OOO, nor on whether an OOO reply counts toward the reported reply rate.
- Whether the beta flag was removed by Oct 2026 is unconfirmed.

## AI-drafted and auto-sent replies

### Takeaway
Smartlead markets an AI agent that handles replies (including booking meetings and sending "tell me more" pitches), and there are help-centre artefacts for a product called **SmartAssistant**, but I found **no documentation confirming whether replies send autonomously or require human approval**, nor the controls around it.

### Cited Findings
- Smartlead marketing describes an AI agent that **books a meeting instantly** for a reply like "let's schedule a call" and **sends a short pitch** for "tell me more" replies — [Smartlead blog, AI email response generator](https://www.smartlead.ai/blog/ai-email-response-generator). Status: marketing copy, mechanism and approval model NOT documented.
- A help-centre article exists titled **"Diagnosing problems with SmartAssistant"** (article 451), indicating a shipped AI assistant product — [Help Centre, Diagnosing problems with SmartAssistant](https://helpcenter.smartlead.ai/en/articles/451-diagnosing-problems-with-smartassistant). Status: existence CONFIRMED; behaviour not read.
- Smartlead refers to **"SmartAgents"** that can optimise A/B test allocations in real time — [Smartlead blog, AI Funnel A/B Testing](https://www.smartlead.ai/blog/ai-funnel-a-b-testing).

### Gaps
- Whether AI replies are draft-only, approval-gated, or auto-send; per-campaign toggles; tone/prompt configuration; guardrails. **Unconfirmed — do not assume auto-send.**
- No API endpoint found for generating or sending an AI-drafted reply.

## Native CRM / pipeline features

### Takeaway
Smartlead has a real but shallow native CRM layer — **"Smart Funnel"** (a kanban pipeline of lead cards with stages) and a **CRM "Deals"** concept with deal stages and ownership, taught in Smartlead's own course material. Independent reviewers describe it as little more than a kanban view. Deal value / forecasting is **not** confirmed.

### Cited Findings
- **Smart Funnel**: a kanban board where each lead becomes a card moving through pipeline stages, with replies and conversation history attached to the card — [Smartlead blog, Best CRM for cold email](https://www.smartlead.ai/blog/how-to-choose-the-best-crm-for-cold-emailing).
- Smartlead's own training module is titled **"Module 9: How to Use CRM Deals & SmartFunnel"** and covers **deal stages, ownership, and a pipeline view** — [Smartlead University, Module 9](https://www.smartlead.ai/smartlead-101/crm-deals-smartfunnel). Status: feature names CONFIRMED (Smartlead-owned source).
- Independent review: the feature is "just a sales pipeline/kanban view where you can see in the tag that they've been attributed in the unified inbox, nothing more" — [Breakcold, Smartlead review](https://www.breakcold.com/blog/smartlead-ai-review).
- A second independent review says there are **no pipeline or deal-tracking features at all** — [Salesdorado, Smartlead review](https://salesdorado.com/en/sdr-tools/smartlead-review/). This CONTRADICTS Smartlead's own course material; the Salesdorado review may predate the Smart Funnel/Deals release.
- **Deal value**: the only mention of deal values, stages and probabilities is a directory listing, whose wording reads as generic CRM boilerplate — [GetApp, Smartlead](https://www.getapp.com/marketing-software/a/smartlead/). Status: UNCONFIRMED for Smartlead specifically.
- Reviews consistently advise pairing Smartlead with a dedicated CRM for positive replies — [Smartlead blog, Best CRM for cold email](https://www.smartlead.ai/blog/how-to-choose-the-best-crm-for-cold-emailing); [Growthhacksuite, Connect Smartlead to CRM](https://growthhacksuite.com/connect-smartlead-to-crm).

### Inferences
- Positioning: Smartlead is a sending-and-inbox tool with a thin pipeline overlay for triage, not a CRM of record. Revenue/forecasting almost certainly lives in the external CRM.

### Gaps
- No primary documentation read on Smart Funnel stage configuration, whether deal value/currency/close-date fields exist, whether forecasting or weighted pipeline exists, or whether Deals/Smart Funnel are API-addressable (no `deals`/`funnel` endpoints were surfaced in any API-reference search result).
- Plan gating for Smart Funnel / CRM Deals: unknown.

## Meeting booking

### Takeaway
No native calendar/booking product was found. Meeting booking appears to be handled by integration (calendar links in copy, and a "Meeting booked" trigger that writes an activity into an external CRM).

### Cited Findings
- None of the searched sources mention a native calendar booking tool or scheduler; the only booking-adjacent artefact is a **"Meeting booked" trigger that creates a meeting activity in the CRM**, which is an integration workflow — [Smartlead blog, Best CRM for cold email](https://www.smartlead.ai/blog/how-to-choose-the-best-crm-for-cold-emailing).
- Marketing claims the AI agent "books a meeting instantly" on a scheduling-intent reply, without documenting the mechanism — [Smartlead blog, AI email response generator](https://www.smartlead.ai/blog/ai-email-response-generator).
- `Meeting Request` exists as a lead category (id 2) and `Meeting Booked` appears in one API sample — [Smartlead API, Update Lead Category (inbox)](https://api.smartlead.ai/api-reference/inbox/update-category); [Smartlead API, Get Lead Categories](https://api.smartlead.ai/api-reference/leads/categories).

### Gaps
- Whether a native Calendly-equivalent, a calendar connection, or a round-robin booking page exists: **not found, and absence of evidence here is weak evidence** given I could not browse the product site directly.

## Analytics and reporting

### Takeaway
Campaign-level analytics are solid (dashboard + API), per-mailbox/domain health including bounce rate is exposed via the analytics API, and per-sequence-step and per-lead data can be filtered and exported as CSV. A single native report crossing **step × mailbox** was not found, and revenue/opportunity attribution and scheduled report delivery are unconfirmed.

### Cited Findings
- Main dashboard analytics are documented in [Help Centre, Main Dashboard Analytics Explanation (article 100)](https://helpcenter.smartlead.ai/en/articles/100-main-dashboard-analytics-explanation).
- Data export: open a campaign and use export options to download detailed reports; the API is offered for custom reporting — [Help Centre, Data export options in Smartlead (article 57)](https://helpcenter.smartlead.ai/en/articles/57-data-export-options-in-smartlead).
- **Per-step grain exists via Campaign → Inbox**, filterable by **sequence step** and **engagement status**, downloadable as **CSV**; a third-party guide notes exported columns vary by view and found **no mailbox column** — [Help Centre, Data export options](https://helpcenter.smartlead.ai/en/articles/57-data-export-options-in-smartlead); [Outreachmagic, Export Smartlead leads to CSV](https://outreachmagic.io/blog/export-smartlead-leads-to-csv).
- **Reporting API exists**: an analytics overview endpoint reportedly includes **email health by domain and by individual account, with bounce rate**; a separate campaign statistics endpoint returns campaign stats at **per-lead and per-sequence** grain — [Help Centre, Full API Documentation (article 125)](https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation). Status: capability CONFIRMED-VIA-SEARCH; exact endpoint paths NOT captured, so **do not write endpoint names from this section**.
- **Client rollup**: agency analytics roll up by client — [Growthhacksuite, Smartlead for agencies](https://growthhacksuite.com/smartlead-for-agencies). Status: third-party.
- Smartlead's 2026 Master Inbox post describes an **agency dashboard** — [Smartlead blog, Master Inbox in 2026](https://www.smartlead.ai/blog/master-inbox-new-features).
- Third-party ecosystem fills the reporting gap: an n8n template pipes Smartlead engagement metrics into Google Sheets, and at least one vendor sells a white-label Smartlead dashboard — [n8n, Tracking cold email engagement metrics using Smartlead and Google Sheets](https://n8n.io/workflows/7710-tracking-cold-email-engagement-metrics-using-smartlead-and-google-sheets/); [Automate It Please, Smartlead dashboard](https://www.automateitplease.com/resources/smartlead-dashboard).

### Inferences
- A per-step × per-mailbox view is achievable only by joining the analytics-overview (mailbox grain) and campaign-statistics (lead/step grain) endpoints in your own code. This is an inference, not a documented feature.
- The existence of third-party white-label Smartlead dashboards is itself evidence that native agency/client reporting is considered insufficient by the market.

### Gaps
- **Inbox placement reporting**: not found. No evidence of a native seed-list/placement report in these results.
- **Reply rate by A/B variant as a report**: variant performance drives AI winner selection (see next section), but a reportable per-variant breakdown was not documented.
- **Revenue / opportunity attribution**: no evidence found. Likely absent natively, consistent with the thin CRM layer.
- **Scheduled/emailed reports**: no evidence found either way.
- Exact analytics endpoint paths and response schemas: not captured.

## A/B testing

### Takeaway
Well documented and comparatively strong: variants are configured per sequence step with three distribution modes — manual-equal (default), manual-percentage (**up to 10 variants**, 10% minimum pool, works cleanly only in multiples of 10), and **AI percentage distribution**, where you choose a winning metric (**reply rate, positive reply rate, click rate, or open rate**), test on 10–80% of the audience, and Smartlead auto-promotes the winner to the remainder.

### Cited Findings
- **Manual equal distribution** — default; Smartlead splits variants evenly across all leads with no further configuration — [Help Centre, How to do A/B testing with Smartlead (article 146)](https://helpcenter.smartlead.ai/en/articles/146-how-to-do-ab-testing-with-smartlead).
- **Manual percentage allocation** — you set each variant's share; **limit of up to 10 variants at a time**; a **10% minimum pool** is needed for an effective decision; one article notes it "works perfectly only with multiples of 10" — [Help Centre, article 146](https://helpcenter.smartlead.ai/en/articles/146-how-to-do-ab-testing-with-smartlead).
- **AI percentage distribution / AI Auto-Adjust A/B Testing** — you pick a **winning metric (reply rate, positive reply rate, click rate, or open rate)**; Smartlead determines the winner and sends it to the remaining percentage of recipients; **test share configurable from 10% to 80%** — [Help Centre, AI Auto-Adjust A/B Testing (article 135)](https://helpcenter.smartlead.ai/en/articles/135-ai-auto-adjust-ab-testing); [Help Centre, article 146](https://helpcenter.smartlead.ai/en/articles/146-how-to-do-ab-testing-with-smartlead).
- API field: sequences expose **`"variant_distribution_type": "MANUALLY_EQUAL"`**; a different API example instead uses a per-variant **`distribution`** value — [Smartlead API, Email Sequences](https://api.smartlead.ai/core/sequences); [Smartlead API, Get Campaign Sequences](https://api.smartlead.ai/api-reference/campaigns/get-sequences). Status: the literal `MANUALLY_EQUAL` enum value is CONFIRMED-VIA-SEARCH; the full enum set (presumably also a manual-percentage and an AI value) was NOT captured — **do not invent the other enum members**.
- "SmartAgents" are claimed to optimise A/B allocations in real time — [Smartlead blog, AI Funnel A/B Testing](https://www.smartlead.ai/blog/ai-funnel-a-b-testing).
- Third-party variant-count claims **conflict**: one says up to 10 variants with percentage allocation; another claims A/Z framing allows **26** variants per step; another says **5** per step — [Genesysgrowth, Smartlead vs Instantly](https://genesysgrowth.com/blog/smartlead-vs-instantly-complete-guide-for-email-marketing); [Growthhacksuite, AB testing in cold email](https://growthhacksuite.com/what-is-ab-testing-cold-email); [AIemaily, Best A/B testing tools for subject lines](https://aiemaily.com/blog/best-ab-testing-tools-for-email-subject-lines). The Smartlead help centre's own figure is **10**, which should be preferred.
- **No statistical significance test**: a third-party analysis warns that most such auto-winner implementations pick a winner as soon as one variant leads, with **no significance test and no minimum sample size**, and recommends setting a high threshold manually — [Growthhacksuite, AB testing in cold email](https://growthhacksuite.com/what-is-ab-testing-cold-email). Status: third-party critique, NOT confirmed against Smartlead docs; the help centre documents only the 10% minimum pool, not a significance test.

### Inferences
- What is tested is **a whole step variant** (subject + body together), because variants are objects on a sequence step. Subject-only testing is achieved by holding the body constant. **Testing the sending mailbox as an A/B dimension is not supported** — mailbox rotation is a separate deliverability mechanism, not a variant axis. Both are inferences from the sequence data model, not documented statements.
- Winner determination is **threshold-free auto-promotion on a chosen metric**, not statistical significance. Treat as a likely differentiator versus a significance-aware classifier/testing build.

### Gaps
- Whether subject line and body can be varied independently within one test.
- The complete `variant_distribution_type` enum.
- Whether a significance test or minimum-sample guard exists in AI mode (only the 10% pool guidance was found).

## REST API

### Takeaway
Base URL `https://server.smartlead.ai/api/v1`, auth by **`api_key` query parameter** (not a header). Documented coverage spans campaigns, sequences, leads, lead categories, email accounts, warmup, Master Inbox / saved views, analytics and webhooks. Official rate limits are documented as **Standard 60 req/min + 1,000/hr; Pro 120 req/min + 3,000/hr**, per API key, with `429`, `X-RateLimit-*` and `Retry-After`. Several sources indicate API access is plan-gated (Pro).

### Cited Findings
- **Auth**: API key passed as a **URL query parameter**, e.g. `https://server.smartlead.ai/api/v1/campaigns/?api_key=YOUR_KEY`. Missing/invalid key returns **401 with error code `UNAUTHORIZED`**. Docs recommend env vars and periodic key rotation — [Smartlead API, Authentication](https://api.smartlead.ai/authentication).
- **Client-level API keys**: teams can issue a separate key per client, and **each client-level key has its own rate limit** — [Help Centre, How client-level API keys work in Smartlead (article 430)](https://helpcenter.smartlead.ai/en/articles/430-how-client-level-api-keys-work-in-smartlead).
- **Rate limits (official)**: Standard **60/min, 1,000/hr**; Pro **120/min, 3,000/hr**; limits are **per API key** and campaign + lead + analytics calls all count toward the same limit; over-limit returns **429** with `X-RateLimit-*` and `Retry-After` headers — [Smartlead API, Rate Limits](https://api.smartlead.ai/guides/rate-limits).
- **Conflicting third-party rate-limit figures**: ~100 req/min across most endpoints with campaign-creation and lead-upload nearer **30 req/min** — [Octave, Smartlead API guide](https://www.octavehq.com/post/smartlead-api-guide-build-custom-workflows). A separate review claims Smartlead publishes no rate-limit numbers at all — [Reply.io, Smartlead API review](https://reply.io/blog/smartlead-api/). The official guide contradicts the latter and should be preferred.
- **Object coverage**: campaigns, leads, email accounts, warmup, webhooks — [Smartlead API, Authentication](https://api.smartlead.ai/authentication); sequences and analytics additionally — [ZoomInfo Pipeline, Smartlead API review 2026](https://pipeline.zoominfo.com/sales/smartlead-api-review).
- **Endpoint paths captured with confidence** (reported from the API reference URLs themselves): `GET /leads/fetch-categories`; `api-reference/inbox/update-category`; `api-reference/inbox/create-saved-view`; `api-reference/campaigns/update-lead-category`; `api-reference/campaigns/get-lead-by-id`; `api-reference/campaigns/get-leads`; `api-reference/campaigns/update-lead`; `api-reference/campaigns/get-sequences`; `api-reference/campaigns/save-webhooks`; `api-reference/webhooks/create`; `api-reference/webhooks/events`; plus a **Retrigger Webhooks** endpoint — [Smartlead API reference index](https://api.smartlead.ai/api-reference/webhooks/events); [Help Centre, Full API Documentation (article 125)](https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation); [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration). (Doc-page slugs, which mirror but are not guaranteed identical to HTTP paths — verify before use.)
- **Plan gating**: a third-party guide titles its walkthrough "Smartlead API Guide: Build Custom Workflows (**Pro Plan**)" and the official rate-limit tiers are named Standard and Pro, implying API tiering rather than a flat offer — [Octave, Smartlead API guide](https://www.octavehq.com/post/smartlead-api-guide-build-custom-workflows); [Smartlead API, Rate Limits](https://api.smartlead.ai/guides/rate-limits). Status: gating strongly implied, exact plan boundary UNCONFIRMED.
- There is a public **Smartlead MCP server** whose source is browsable, confirming an open client surface — [glama.ai, LeadMagic/smartlead-mcp-server base client](https://glama.ai/mcp/servers/@LeadMagic/smartlead-mcp-server/blob/5ba8d8b8634fea992e764385cf44f71d48588e9d/src/client/base.ts).

### Gaps
- No complete endpoint inventory obtained (the full API reference index could not be fetched).
- Whether replies/conversations are readable as first-class objects via REST (a Master Inbox read endpoint) — the only inbox endpoints surfaced were `update-category` and `create-saved-view`.
- Pagination conventions, API versioning policy, and whether writes are idempotent.

## Webhooks

### Takeaway
Webhooks are real, scoped at **user / client / campaign** levels (user-level takes priority), configured by an **`event_type_map`** object, HMAC-signed, retried on 5xx but not 4xx, and manually re-triggerable. **The event name list is internally inconsistent across Smartlead's own doc pages** — two different naming conventions exist, plus a third set on the campaign-level endpoint. This must be settled with a live test webhook before building.

### Cited Findings — event names (verbatim, grouped by source; names CONFLICT across sources)
- **`api-reference/webhooks/events` — documented "Available Events" section:** **`EMAIL_SENT`** ("Triggered when an email is successfully sent to a lead"), **`FIRST_EMAIL_SENT`** (first sequence step only), **`LINKEDIN_DISCONNECTED`** (uses a separate per-user config) — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).
- **Same page's sample `event_type_map` config additionally contains:** **`EMAIL_OPEN`**, **`EMAIL_LINK_CLICK`**, **`EMAIL_REPLY`**, **`EMAIL_BOUNCE`**, **`LEAD_UNSUBSCRIBED`**, **`LEAD_CATEGORY_UPDATED`**, **`CAMPAIGN_STATUS_CHANGED`**, **`UNTRACKED_REPLIES`**, **`MANUAL_STEP_REACHED`** — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).
- **`core/webhooks` page uses a DIFFERENT past-tense convention:** **`EMAIL_OPENED`**, **`EMAIL_CLICKED`**, **`EMAIL_REPLIED`** ("Lead replied to email, when reply is received"), **`EMAIL_BOUNCED`**, **`EMAIL_UNSUBSCRIBED`** — [Smartlead API, Webhooks](https://api.smartlead.ai/core/webhooks).
- **Campaign-level endpoint uses a third set, in an `event_types` ARRAY (not `event_type_map`):** **`LEAD_REPLIED`**, **`LEAD_OPENED`**, **`LEAD_CLICKED`** — [Smartlead API, Save Campaign Webhooks](https://api.smartlead.ai/api-reference/campaigns/save-webhooks).
- Third-party integration docs additionally mention a **Manual Reply Sent** event — [OutboundSync, Smartlead webhook guide](https://outboundsync.com/docs/integrations/engagement/smartlead/webhooks/smartlead-webhook-guide/). Status: NOT an official Smartlead source; UNCONFIRMED.
- **Confirmed status of the list: PARTIAL.** The union of names above (14 email/lead/campaign events + LinkedIn) is the best available inventory, but **no single Smartlead page enumerates them all**, and the two naming conventions cannot both be correct for the same API. Build plans must resolve this empirically.

### Cited Findings — payload shape
- `LEAD_CATEGORY_UPDATED` example payload top-level fields: **`event_type`** (value `LEAD_CATEGORY_UPDATED`), **`lead_id`**, **`lead_email`**, **`lead_name`**, **`category`** (a name such as `"Interested"`), **`lead_category_id`**, **`campaign_name`**, **`campaign_id`**, **`from`**, **`to`** — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).
- Nested: a **`lead_data`** object (name, company, phone, website, location, LinkedIn, custom fields) containing a nested **`category`** object with **`name`** and **`sentiment_type`**; plus a **`history`** array of sent and reply entries and a **`lastReply`** object — the docs state the event carries the full conversation history between sending account and lead — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).
- **Inconsistency**: the Webhook Integration Guide says payloads are a **flat JSON object with an `event_type` field**, which contradicts the nested `lead_data`/`history` example above — [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration) vs [Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events).

### Cited Findings — scoping, filtering, retries, security
- **Scoping/filtering**: webhooks can be scoped to **user, client, or campaign**; **if a user-level webhook exists it takes priority over client- and campaign-level webhooks for the same event type** — [Smartlead API, Webhook Events Reference](https://api.smartlead.ai/api-reference/webhooks/events); [Smartlead API, Create Webhook](https://api.smartlead.ai/api-reference/webhooks/create).
- **Per-hook event filtering: yes** — events are selected by passing `event_type_map` with e.g. `LEAD_CATEGORY_UPDATED: true` — [Smartlead API, Create Webhook](https://api.smartlead.ai/api-reference/webhooks/create).
- **`association_type` representation CONFLICTS**: the create endpoint documents string values **`user`, `client`, `campaign`**; the `core/webhooks` page lists **numeric** values (user level = **1**), and the integration guide uses numerics in an example — [Smartlead API, Create Webhook](https://api.smartlead.ai/api-reference/webhooks/create) vs [Smartlead API, Webhooks](https://api.smartlead.ai/core/webhooks) vs [Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration).
- **Retry behaviour CONFLICTS**: one API page says the webhook is **disabled after 5 failed attempts, with retries at 1, 5, 15, 60 minutes and 6 hours**; the Webhook Integration Guide says **3 retries (1, 5, 30 minutes), after which the event is marked failed** — [Smartlead API, Webhooks](https://api.smartlead.ai/core/webhooks) vs [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration).
- **5xx responses are retried; 4xx are treated as permanent failures and are NOT retried** — consistent across sources — [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration); [Help Centre, How to resolve webhook failures (article 417)](https://helpcenter.smartlead.ai/en/articles/417-how-to-resolve-webhook-failures).
- **Signature**: header **`X-Smartlead-Signature: sha256=…`**, an HMAC of the raw body using your signing secret; one API page's example compares a **bare hex digest without the `sha256=` prefix**, so prefix handling differs between pages — [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration); [Help Centre, Quick tips for testing with sample webhook payloads (article 403)](https://helpcenter.smartlead.ai/en/articles/403-quick-tips-for-testing-with-sample-webhook-payloads).
- **Idempotency**: deduplicate retries using the **`X-Request-Id`** header — [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration).
- **Manual retry**: a **Retrigger Webhooks** endpoint exists for manually retrying failed deliveries, and failed deliveries can be resent from the webhook logs in the UI — [Smartlead API, Webhook Integration Guide](https://api.smartlead.ai/guides/webhook-integration); [Help Centre, How to retry or resend webhooks (article 402)](https://helpcenter.smartlead.ai/en/articles/402-how-to-retry-or-resent-webhooks).
- Sample payloads are published for testing — [Help Centre, article 403](https://helpcenter.smartlead.ai/en/articles/403-quick-tips-for-testing-with-sample-webhook-payloads).

### Inferences
- The two naming conventions most plausibly reflect **two generations of the webhook API** (campaign-scoped `event_types` array with `LEAD_*` names being older; user/client-scoped `event_type_map` with `EMAIL_*`/`LEAD_*` names being current). Inference only.
- `LEAD_CATEGORY_UPDATED` carrying `category.sentiment_type`, `history` and `lastReply` makes it the single most useful event for an external intent classifier: it delivers the full thread plus Smartlead's own label, enabling direct label-vs-label comparison without a separate fetch.
- `UNTRACKED_REPLIES` is almost certainly replies arriving outside Smartlead's tracked thread matching; `MANUAL_STEP_REACHED` is a sequence reaching a manual/human task step. Both inferred from the names; no description found.

### Gaps
- No single authoritative, complete event list — **confirmed partial**. The `core/webhooks` past-tense names vs the `events` page names must be resolved live.
- Payload shapes for all events other than `LEAD_CATEGORY_UPDATED`.
- Retry schedule and `association_type` encoding: both CONFLICTING in official docs.
- No documented LinkedIn event set beyond `LINKEDIN_DISCONNECTED`.

## Integrations and MCP

### Takeaway
Native integrations centre on HubSpot, Salesforce, Pipedrive, Clay and Slack, with broad no-code coverage via Zapier, Make and n8n, and notably a **Smartlead MCP server reported at 116+ tools as of March 2026** plus help-centre MCP diagnostics docs — meaning Smartlead has a first-class AI-agent surface.

### Cited Findings
- **Native integrations named by Smartlead**: HubSpot, Salesforce, Pipedrive, Clay, Listkit; the integrations page also lists Slack, Zapier, Sendspark, LeadMagic, Expandi and OutboundSync — [Smartlead, Integrations](https://www.smartlead.ai/integrations).
- **Pipedrive**: syncs cold email leads, replies and campaign activity, cited as "49 native tools" (number unverified) — [Smartlead, Integrations](https://www.smartlead.ai/integrations).
- **Clay**: partnership for list building and enrichment; Clay also has a dedicated Smartlead action — [Clay, Update Lead Category with Smartlead.ai](https://www.clay.com/integrations/action/update-lead-category-smartlead-ai).
- **MCP**: Smartlead's own round-up lists a **Smartlead MCP with 116+ tools as of March 2026**, alongside Instantly (31+), Salesforce and HubSpot, and states no MCP existed then for Clay, Apollo or Hunter — [Smartlead blog, Best MCP servers for sales](https://www.smartlead.ai/blog/best-mcp-servers-for-sales). Date-stamped March 2026.
- Smartlead's help centre carries **"Smartlead MCP Diagnostics - Command Swipe File"** (article 387), confirming MCP is a supported, documented surface rather than a blog mention — [Help Centre, Smartlead MCP Diagnostics](https://helpcenter.smartlead.ai/en/articles/387-smartlead-mcp-diagnostics-command-swipe-file).
- An open-source Smartlead MCP server exists under the LeadMagic org — [glama.ai, LeadMagic/smartlead-mcp-server](https://glama.ai/mcp/servers/@LeadMagic/smartlead-mcp-server/blob/5ba8d8b8634fea992e764385cf44f71d48588e9d/src/client/base.ts). Whether the "116+ tools" server is this one or a Smartlead-operated one is UNCONFIRMED.
- **No-code reach CONFLICTS within Smartlead's own pages**: one page claims **1,000+ apps via Zapier**, another **6,000+ apps via Zapier, Make or n8n** — [Smartlead, FAQ](https://www.smartlead.ai/faq) vs [Smartlead, Powerful APIs and automation](https://www.smartlead.ai/powerful-apis-and-automation).
- **n8n**: community templates exist for Smartlead (e.g. engagement metrics to Google Sheets) — [n8n template 7710](https://n8n.io/workflows/7710-tracking-cold-email-engagement-metrics-using-smartlead-and-google-sheets/).
- **HubSpot/Salesforce depth comes partly from a third party**: OutboundSync (not built by Smartlead but listed in Smartlead's integrations tab) provides HubSpot and Salesforce sync including **bi-directional blocklist sync** — [OutboundSync, Smartlead features OutboundSync's HubSpot and Salesforce integration](https://outboundsync.com/blog/smartlead-features-outboundsyncs-hubspot-and-salesforce-integration).
- Other third-party connector docs exist (e.g. RevyOps, Deepline) indicating a healthy middleware ecosystem — [docs.revyops.com, Smartlead](https://docs.revyops.com/integrations/smartlead); [Deepline, Smartlead update-lead-by-campaign](https://deepline.com/docs/providers/smartlead/update-lead-by-campaign.md).

### Inferences
- The fact that Smartlead's flagship CRM integrations are substantially delivered by a partner (OutboundSync) supports the reading that **native CRM sync is shallow** and that deep bi-directional CRM behaviour is an ecosystem add-on, not a Smartlead core capability.
- An MCP server with 116+ tools implies near-complete REST coverage is exposed to agents, which is a meaningful competitive datapoint for an AI-agent-centric build.

### Gaps
- No verified, dated, complete native-integration directory listing (the integrations page could not be fetched directly).
- Whether the 116+-tool MCP server is officially operated by Smartlead or community-built; and its tool list.
- The "49 native tools" Pipedrive figure and both Zapier app counts are unverified vendor claims.
