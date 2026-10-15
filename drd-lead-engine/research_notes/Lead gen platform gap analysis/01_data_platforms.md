# Data-First Lead Generation Platforms — Feature Gap Inventory (observation date: 2026-10-13)

## METHOD NOTE — READ FIRST (affects confidence of everything below)

**Direct page fetching failed for every vendor domain.** The sandbox's outbound HTTPS agent proxy returned `403` on `CONNECT` for `www.apollo.io`, `hunter.io`, `www.cognism.com` (verified by both `WebFetch` → `ENOTFOUND` and `curl` → `CONNECT tunnel failed, response 403`). The proxy status endpoint shows a pattern of `connect_rejected` policy denials for arbitrary third-party hosts. Consequently:

- **I could not read a single vendor terms/pricing page directly.** Every finding below comes from the search index, which itself fetched and quoted those pages.
- Where the search index returned a **verbatim quote attributed to a primary page**, I label it `CONFIRMED (via index quote, not directly fetched)`. This is the strongest evidence available in this environment. It is good enough to scope a build decision; **it is not good enough for a legal sign-off.** Before contracting, counsel must read the actual pages.
- Where only secondary blogs are available, I label `UNCONFIRMED` or `CONFLICTING`.
- **No licence clause, price, or coverage number below is invented.** Where I could not find one, it is in Gaps.

A second structural caveat: an unusually large share of the "comparison" and "pricing" literature for this category is published by direct competitors (ZoomInfo's `pipeline.zoominfo.com`, Cognism's blog, Apollo's own `/insights`, Amplemarket, UpLead, FullEnrich, Lusha's blog) or is affiliate content. I flag vendor-adjacent sourcing inline.

---

## Q1. Coverage, freshness, sourcing, and independent accuracy testing

### Takeaway
Coverage claims are all vendor self-reported and vary wildly between sources (Cognism alone is cited at both 440M and 70M contacts). The only quasi-independent 2026 bounce test I found puts raw Apollo email exports at ~20% bounce and ZoomInfo at ~15% — and the same body of evidence shows that **pre-send verification compresses bounce from ~13% to ~1.8%, i.e. the verification layer matters more than the vendor choice.** That is the single most decision-relevant finding in this section for our system.

### Cited Findings

**Claimed database size — all vendor self-reported, CONFLICTING**
- Apollo self-reports ~275M+ contacts; ZoomInfo ~321M+ professional profiles; a ZoomInfo-published page cites 500M contacts; Cognism 440M+. `CONFLICTING / UNCONFIRMED` — figures vary by source and date, and all sources here are competitor or affiliate blogs — [Apollo vs ZoomInfo vs Cognism (totalremoto)](https://totalremoto.com/blog/apollo-vs-zoominfo-vs-cognism); [ZoomInfo Database Size 2026 (cleanlist)](https://www.cleanlist.ai/blog/2026-03-05-zoominfo-database-size-2026); [600M Contacts Compared (growwithghost)](https://www.growwithghost.io/blog/600m-contacts-compared-apollo-vs-zoominfo-vs-cognism-vs-ghost-database-analysis/)
- Cognism is cited at **440M+** by one source and **70M+** by another in the same search set. `CONFLICTING` — these cannot both be the same metric; likely one counts total profiles and the other counts phone-verified or EMEA-only records. Do not use either number — [600M Contacts Compared](https://www.growwithghost.io/blog/600m-contacts-compared-apollo-vs-zoominfo-vs-cognism-vs-ghost-database-analysis/)

**Sourcing mechanics**
- ZoomInfo operates a **contributory network** branded *Community Edition*, drawing contributions from users of its free tools. `UNCONFIRMED (secondary)` — [ZoomInfo data enrichment (cognism.com — competitor)](https://www.cognism.com/blog/zoominfo-data-enrichment)
- Apollo says its data draws on **contributions from over 2 million users** (contributory/community model). `UNCONFIRMED (vendor self-report, relayed by secondary)` — [ZoomInfo vs Apollo (aisdr)](https://aisdr.com/blog/zoominfo-vs-apollo/)
- **Dropcontact is structurally different: it claims to hold no contact database at all**, generating/verifying emails in real time from first name + last name + company, with "no personal data stored or reused after processing." `UNCONFIRMED (vendor claim)` — [Dropcontact — Why](https://www.dropcontact.com/why); [Dropcontact Review (syncgtm)](https://syncgtm.com/blog/dropcontact-review)
- Because Dropcontact has no pre-built database, third-party review notes its **match rates are lower than database-first tools**. `UNCONFIRMED` — [Dropcontact Review (syncgtm)](https://syncgtm.com/blog/dropcontact-review)
- People Data Labs explicitly positions as a **data-supply API/licence for other platforms** ("B2B Data Provider for Industry Leading Platforms"), with bulk delivery via AWS, GCP, or Snowflake. `CONFIRMED (via index quote of PDL site)` — [PDL homepage](https://www.peopledatalabs.com/); [PDL Person Data Pricing](https://www.peopledatalabs.com/pricing/person)

**Refresh cadence — weak evidence throughout**
- One third-party review says Apollo re-checks data on each request and **refreshes its entire database monthly**; Apollo's own messaging says "real-time." `CONFLICTING / UNCONFIRMED` — [ZoomInfo vs Apollo (aisdr)](https://aisdr.com/blog/zoominfo-vs-apollo/)
- ZoomInfo described as "continuous refresh" by one source, with another in the same set arguing no provider keeps pace with decay. `UNCONFIRMED` — [ZoomInfo Database Size 2026](https://www.cleanlist.ai/blog/2026-03-05-zoominfo-database-size-2026)

**Accuracy testing — the closest thing to independent evidence**
- **Cleanlist, 1,000-lead test, March 2026:** Apollo email match rate **78%**, ZoomInfo **84%**. Apollo email exports *without* pre-send verification bounced at **20%**; ZoomInfo at **15%**. ZoomInfo led mobile match **67% vs 41%** and direct dials **71% vs 52%**. `CONFIRMED as published; methodology not independently audited` — [Apollo vs ZoomInfo, 1,000 leads tested (cleanlist)](https://www.cleanlist.ai/blog/2026-03-07-apollo-vs-zoominfo)
- **UpLead, 450-lead test:** Apollo verifier-measured bounce **13.3%** before sending; campaign bounce **1.8%** once pre-send verification was applied. `CONFIRMED as published; UpLead is a competing vendor` — relayed via [B2B Contact Data Quality Tested (amplemarket)](https://www.amplemarket.com/blog/best-b2b-contact-databases)
- Apollo's own accuracy claim is reported as **91%** in one place and **98%** in another; independent-ish testing puts email accuracy at **65–85%**. `CONFLICTING — vendor self-reported vs third-party` — [Apollo vs ZoomInfo (cleanlist)](https://www.cleanlist.ai/blog/2026-03-07-apollo-vs-zoominfo); [Apollo vs ZoomInfo (apollo.io — vendor)](https://www.apollo.io/insights/apollo-vs-zoominfo)
- **Cognism "Diamond Data" claimed 98% accurate on mobile numbers. This is vendor self-reported. I found no independent 2026 bounce or connect-rate benchmark for Cognism at all.** `UNCONFIRMED (vendor self-report)` — [Cognism Review (thecroreport)](https://thecroreport.com/tools/cognism/)
- FullEnrich hit rate reported as **70–85%** on US enterprise contacts in one review and **~91% email find rate** in another. `CONFLICTING` — [FullEnrich Review (syncgtm)](https://syncgtm.com/blog/fullenrich-review)
- Clay waterfall claimed at **~90% email coverage**. `UNCONFIRMED (agency/vendor content)` — [Clay Waterfall Enrichment (demandlabagency)](https://demandlabagency.com/blog/clay-waterfall-enrichment)

### Inferences
- **Our system's gap here is not "a database" — it is a verification-and-provenance layer.** Published evidence shows the delta between a 13–20% bounce and a 1.8% bounce is pre-send verification, not vendor identity. A system that buys contacts from any provider and sends without an independent verify step inherits that provider's decay.
- Vendor coverage numbers are unusable for procurement. The only defensible way to compare is a paid pilot: same 200–500 target accounts, same ICP, measure match rate / bounce / connect on *our* segment. Budget for this explicitly.
- Dropcontact's no-database architecture is the most CASL-friendly shape (nothing is held about a person until we ask about a person we already identified), but it cannot do discovery — it enriches a list we already have. It is a complement to, not a substitute for, a database vendor.

### Gaps
- No vendor's own trust centre or data-sheet page could be read directly (proxy 403), so every coverage/freshness figure is second-hand.
- No independent accuracy benchmark for Cognism, Lusha, Seamless.ai, Hunter, or Dropcontact was found for 2026. The only two quantified tests cover Apollo and ZoomInfo and were both published by competing vendors.
- Refresh cadence is effectively undocumented publicly for all six primary vendors. Must be asked in an RFP.
- Canadian-specific coverage depth (Ontario SMB, education sector) is not addressed by any source found.

---

## Q2. Pricing and credit models — what 10,000 verified contacts actually costs

### Takeaway
Only Apollo, Lusha, HubSpot Breeze, PDL, and FullEnrich publish usable list prices. Cognism, ZoomInfo, Seamless.ai, Bombora, and G2 Buyer Intent are all quote-only with five-figure annual minimums, which puts them out of reach for a small Canadian sender. **At published rates, 10,000 verified emails costs roughly $100 (HubSpot Breeze credits) to ~$550 (FullEnrich) to ~$2,000+ (Lusha Starter at list) — while ZoomInfo and Cognism cost $22k–$40k/yr before you enrich a single record.** Phone numbers are 5–10x the cost of emails everywhere.

### Cited Findings

**Apollo — published, per-seat + unified credit pool (observed 2026-10)**
- Seats on annual billing: **Basic $49, Professional $79, Organization $119 per seat/month**; monthly billing **$65 / $99 / $149**. Organization has a **3-seat minimum and is annual-only**. `CONFIRMED (via index, multiple concurring secondary sources; Apollo's own page not directly readable)` — [Apollo.io Pricing 2026 (fullenrich)](https://fullenrich.com/content/apollo-pricing); [Apollo Pricing and Credits Explained 2026 (joinvalley)](https://www.joinvalley.co/blog/apollo-pricing-and-credits-explained-2026); [Apollo.io Pricing (leadocean)](https://leadocean.io/blog/apollo-io-pricing)
- Annual credit grants per seat, granted upfront: **Basic 30,000/yr, Professional 48,000/yr, Organization 72,000/yr**. Monthly billing gives smaller batches (2,500/mo Basic, 4,000/mo Professional). **Credits expire, they do not roll over.** `CONFIRMED (via index, concurring)` — [fullenrich](https://fullenrich.com/content/apollo-pricing); [Apollo.io Review (usecarly)](https://www.usecarly.com/blog/apollo-io-review/)
- Credit cost per action: **verified email = 1 credit, phone number = 8 credits**. `UNCONFIRMED (single secondary source)` — [Apollo Pricing 2026 (supered)](https://www.supered.io/blog/apollo-pricing/)
- Apollo reportedly moved from separate general/mobile/export credit pools (2025) to a **single unified pool in 2026 covering emails, phones, exports and AI actions**. `CONFLICTING` — another source still describes export credits as a distinct allowance — [Apollo.io Pricing (saleshandy)](https://www.saleshandy.com/blog/apolloio-pricing/) vs [Apollo.io Pricing (layer3labs)](https://www.layer3labs.io/guides/apollo-io-pricing)
- **10,000 verified emails at Apollo:** covered inside one Professional seat's annual 48,000-credit grant → effectively **$79/mo × 12 = $948/yr for one seat, with ~38k credits left over**. `Inference from the above figures, not a quoted price.`

**Lusha — published entry prices, per-data-point credits (observed 2026-10)**
- Free plan: **40 credits/month, 1 seat**. Starter listed at **$49.90/mo list**, ~25% less annually, with **4,800 credits/yr**. Other sources cite **$37.45/mo billed yearly** and **$449.10/yr**. `CONFLICTING on the annual figure` — [Cognism Pricing (emelia)](https://emelia.io/hub/cognism-pricing); [Cognism Pricing (overloop)](https://overloop.com/blog/cognism-pricing); [Cognism Pricing (scalelist)](https://scalelist.com/cognism-pricing/); [Lusha vs Cognism (supered)](https://www.supered.io/blog/lusha-vs-cognism/)
- Credits charged **per data point: ~1 credit per email, ~5 credits per phone number**; ~**$0.47 per phone number** on annual Starter. `UNCONFIRMED (secondary, concurring on ratio)` — [overloop](https://overloop.com/blog/cognism-pricing); [supered](https://www.supered.io/blog/lusha-vs-cognism/)
- **No platform fee and no annual minimum** on Lusha monthly or annual plans. `UNCONFIRMED (single secondary)` — [scalelist](https://scalelist.com/cognism-pricing/)
- **10,000 verified emails at Lusha:** 4,800 credits/yr on Starter covers under half. Needs ~2.1x Starter capacity or a higher tier → **order of ~$1,000–$2,400/yr at list**, depending on which annual figure is correct. `Inference; the underlying annual price is CONFLICTING so treat as a range.`

**Cognism — quote-only, five-figure minimum**
- Typical contract estimated at **$22,000–$40,000/yr, median ~$36,000**; a Vendr median of **$32,750** is also cited. `UNCONFIRMED (third-party estimates, not vendor-quoted)` — [emelia](https://emelia.io/hub/cognism-pricing); [supered](https://www.supered.io/blog/lusha-vs-cognism/)
- Reconstructed structure: **platform fee ~$15,000 (Standard) or ~$25,000 (Pro), plus ~$1,500–$2,500 per licence/yr, 5 licences included**. `UNCONFIRMED (one source's reconstruction)` — [emelia](https://emelia.io/hub/cognism-pricing)
- **12-month minimum, no free tier or trial, renewal increases of 10–15%/yr unless capped in contract.** `UNCONFIRMED (single secondary)` — [scalelist](https://scalelist.com/cognism-pricing/)
- Credits are per contact: **1 credit reveals 1 contact record; re-viewing an already-revealed contact is free**. Standard seats reported at **10,000 credits/yr**. `UNCONFIRMED` — [overloop](https://overloop.com/blog/cognism-pricing); [supered](https://www.supered.io/blog/lusha-vs-cognism/)
- **10,000 verified contacts at Cognism:** approximately one Standard seat's annual allowance, i.e. **~$22,000–$36,000/yr all-in**. `Inference from unconfirmed estimates.`

**ZoomInfo — quote-only**
- Vendr median contract **$33,500/yr**, range **$7,220–$155,730** (February 2026 data). Entry package estimated ~**$15K for 3 seats**. `UNCONFIRMED (Vendr data relayed by secondary/competitor blogs)` — [Top Sales Intelligence Tools (pipeline.zoominfo — vendor's own blog)](https://pipeline.zoominfo.com/sales/top-sales-intelligence-tools); [Best Intent Data Providers (autobound)](https://www.autobound.ai/blog/top-15-intent-data-providers-compared-2026)
- Secondary sources report ZoomInfo contracts include a **data destruction clause requiring deletion of all ZoomInfo data from your systems at subscription end**, and that the agreement is **non-cancellable** until expiry. `UNCONFIRMED but high-impact if true — see Q3` — [ZoomInfo Pricing (uplead)](https://www.uplead.com/zoominfo-pricing/); [ZoomInfo Pricing (pin)](https://www.pin.com/blog/zoominfo-pricing/)

**HubSpot Breeze Intelligence (ex-Clearbit) — cheapest per-record, bundled into CRM**
- **HubSpot Credits are $0.01 each** — 1,000 credits for $10 as a capacity pack, or pay-as-you-go overage billed in 10-credit increments. Annual commitment reported to drop this to ~$9/1,000. `CONFIRMED (via index quote of credit rate, concurring across sources); the ~$9 annual rate is UNCONFIRMED` — [HubSpot Breeze Intelligence pricing (eesel)](https://www.eesel.ai/blog/hubspot-breeze-intelligence-pricing); [Breeze Intelligence Pricing, Credits and Limits (datamagnet)](https://www.datamagnet.co/post/hubspot-breeze-intelligence-pricing-credits-limits/)
- **Unused credits do not roll over** month to month. `UNCONFIRMED (quoted from HubSpot catalog via a secondary source)` — [datamagnet](https://www.datamagnet.co/post/hubspot-breeze-intelligence-pricing-credits-limits/)
- Included allowances by plan: one source lists **Starter 500 / Professional 3,000 / Enterprise 5,000**, with Data Hub/Customer Platform at 5,000 and 10,000; a second source gives 3,000 / 5,000 for Pro/Enterprise. `CONFLICTING` — [eesel](https://www.eesel.ai/blog/hubspot-breeze-intelligence-pricing) vs [HubSpot Breeze AI (supered)](https://www.supered.io/blog/hubspot-breeze-ai/)
- **Basic data enrichment does not consume credits — Buyer Intent (visitor identification) does.** Tracking one company with buying-intent signals = **10 credits ($0.10)/month**; a custom signal (beta) = **50 credits/month**. `UNCONFIRMED (single secondary)` — [datamagnet](https://www.datamagnet.co/post/hubspot-breeze-intelligence-pricing-credits-limits/)
- A third-party guide citing **legacy Intelligence credit packs at ~$45 per 100 credits** is wildly off the $0.01/credit rate and is almost certainly stale. `CONFLICTING — discard` — flagged as least reliable by [eesel](https://www.eesel.ai/blog/hubspot-breeze-intelligence-pricing)
- **10,000 enrichments at Breeze:** ~**$100 in credits** at $0.01 — but only meaningful if you are already paying for a HubSpot hub, and the cheap rate applies to enrichment of records you already have, not to discovery.

**Seamless.ai — quote-only, annual lock-in**
- Third-party pricing guides say the terms make subscriptions **annual, all sales final, auto-renewing for 12 months unless cancelled 60 days before renewal**. `UNCONFIRMED (secondary summaries of the contract, not the contract text)` — [Seamless AI Pricing 2026 (overloop)](https://overloop.com/blog/seamless-ai-pricing); [Seamless AI Pricing (supered)](https://www.supered.io/blog/seamless-ai-pricing/); [How much does Seamless.AI cost (amplemarket)](https://www.amplemarket.com/blog/how-much-does-seamless-ai-really-cost)
- Seamless.ai's own terms state that **limits are placed on "the number of leads generated and the number of email addresses or other business contact information you may export, download or view."** `CONFIRMED (via index quote of seamless.ai terms)` — [Seamless.AI Terms of Use](https://www.seamless.ai/termsofservice)

**People Data Labs — published self-serve tier**
- Self-serve **Pro plans start at $98/mo** and include API access plus data-licence feeds; Enterprise covers **on-premise and flat-file bulk delivery**. `CONFIRMED (via index quote of PDL pricing page)` — [PDL Person Data Pricing](https://www.peopledatalabs.com/pricing/person)
- On the **Free plan, contact data fields (work email, personal emails, phone numbers, granular location) are obfuscated — returned as True/False flags rather than values.** `UNCONFIRMED (relayed by a ZoomInfo-published review)` — [People Data Labs API Review (pipeline.zoominfo)](https://pipeline.zoominfo.com/sales/people-data-labs-api-review)

**FullEnrich (waterfall) — published**
- Free trial 50 credits; **Pro from $55/mo for 1,000 credits/month. Email = 1 credit, mobile = 10 credits.** `CONFIRMED (via index, vendor page)` — [FullEnrich Review (syncgtm)](https://syncgtm.com/blog/fullenrich-review); [Best Waterfall Enrichment Tools (fullenrich)](https://fullenrich.com/content/best-waterfall-enrichment-tools)
- **10,000 verified emails at FullEnrich:** 10,000 credits ≈ **10 months of the $55 Pro plan, ~$550**, charged only on successful finds (see Q6).

### Inferences
- **The cost spread for "10,000 verified emails" is roughly 200x between the cheapest viable route (~$100–$550 of enrichment credits on records we already identified) and the enterprise database route ($22k–$36k/yr).** For a small Canadian sender the enterprise tier is not a close call — it is unaffordable.
- Credit expiry (Apollo, HubSpot) and annual upfront grants mean effective cost per usable record is higher than headline rates for low-volume senders. Our usage metering should model credit expiry, not just consumption.
- Phone numbers cost 5–10x emails across every vendor (Apollo 8 credits, Lusha 5, FullEnrich 10). If our product ever surfaces phone data, that is a separate and much more expensive line item — and a separate compliance problem (DNC/DNCL).

### Gaps
- **No vendor pricing page was readable directly.** Every price above is relayed. Treat all as "to be confirmed on a quote."
- Apollo's per-seat export cap is unresolved; sources disagree on whether export credits are a separate pool in 2026. No authoritative number found.
- Hunter.io and Dropcontact pricing: **not found in this research pass.** Must be gathered.
- Cognism and ZoomInfo have no published pricing at all; their figures are third-party estimates of negotiated contracts.
- No source gives per-credit cost for Cognism or ZoomInfo in a form that survives scrutiny.

---

## Q3. API licence terms — THE DECISIVE QUESTION

### Takeaway
**This section is where the build decision gets made, and the answer is uniformly hostile to what we are building.** Every vendor whose terms I could reach restricts use to the customer's own internal business purposes and expressly bars sublicensing, redistributing, or exposing the data to third parties or embedding it in a product — Apollo, Lusha, and Seamless.ai all say so in near-identical language. **If our system exposes purchased contact data to end users across 5 brand portfolios, or to any client, standard terms do not permit it at any of these vendors.** The remedies are: (a) negotiate a redistribution/OEM agreement, (b) use a vendor that licenses data *for* embedding (People Data Labs is the only one positioned that way), or (c) have each end user supply their own API key so the data never passes through our licence.

### Cited Findings

**Apollo.io — internal use only, no sublicensing. CONFIRMED (via index quote of apollo.io/terms/api, last updated 2024-08-13)**
- Licence grant: a **"non-exclusive, non-transferable, non-assignable revocable license to access and use the APIs solely for your internal business purposes,"** unless a separate Apollo Agreement says otherwise. — [Apollo Terms of Service — API](https://www.apollo.io/terms/api)
- Restriction: **"you may not sublicense, sell, or distribute (including but not limited to sharing) the APIs."** — [Apollo API Terms](https://www.apollo.io/terms/api)
- The API terms **bar using a third party's API credentials, and bar integrating the APIs into your product or services without Apollo's authorization.** — [Apollo API Terms](https://www.apollo.io/terms/api)
- Apollo's pricing page states plans are **for internal business use only**, and that **using Apollo data to power external products, share with customers, or resell is not permitted under standard terms** — those uses require a separate agreement. — [Apollo Pricing](https://www.apollo.io/pricing)
- **AI restriction:** the API terms prohibit using any API in a manner that allows any third party to use Apollo data to **train, fine-tune, or improve any AI or ML model.** `Relevant to us: our Anthropic adapter passes contact context to a third-party model.` — [Apollo Privacy Policy](https://www.apollo.io/privacy-policy)
- A signed Apollo Agreement **controls over these public terms** where they conflict. — [Apollo API Terms](https://www.apollo.io/terms/api)

**Lusha — bars resale, redistribution, sublicensing, embedding, and AI training. CONFIRMED (via index quotes)**
- API licence terms bar customers from **reselling or passing on business profiles and other data obtained through the API**, bar sharing with third parties without written authorization, and bar use for **cookie tracking, ad networks, data brokerage, or spam**. Verbatim: customers **"agree not to disclose, distribute, sublicense, lease, rent, loan, resell or otherwise transfer this data."** `CONFIRMED as quoted, but the page is reported as ~1,744 days old — may be superseded` — [Lusha API License Terms](https://www.lusha.com/api-terms/)
- Standard terms: customers **may not use the data outside its stated purpose** and **may not publish, share, sell, or transfer it to any third party**. **Use for B2C activities such as marketing or direct solicitation is excluded.** — [Lusha Terms and Conditions](https://www.lusha.com/legal/terms_and_conditions-2/)
- Lusha's own FAQ: data obtained through its **API or MCP cannot be resold or embedded in a third-party product without Lusha's written consent**, and **data cannot be used to train AI or ML systems**. `CONFIRMED (via index quote of Lusha FAQ) — this is the clearest statement of the OEM problem in the whole set` — [Lusha FAQ](https://www.lusha.com/faq/)

**Seamless.ai — B2B-prospecting-only, no onward distribution. CONFIRMED (via index quote)**
- Use is **limited to business-to-business prospecting purposes**; use for any other purpose is barred unless required by law. — [Seamless.AI Terms of Use](https://www.seamless.ai/termsofservice)
- Prohibited uses include that buyers may not **"sell, rent, license, release, disclose, distribute, disseminate, sublicense, transfer, or otherwise make available"** its data or services. The same section bars use for **FCRA-regulated purposes**. — [Seamless.AI Terms of Use](https://www.seamless.ai/termsofservice)
- **Competitors are barred** from accessing or using the services without written consent. `Relevant: if our system is characterised as a competing lead-gen platform, access may be prohibited outright.` — [Seamless.AI Terms of Use](https://www.seamless.ai/termsofservice)
- `CONFLICTING:` two copies of the terms page surfaced with different ages (~823 days vs ~2,601 days). Which is current is unresolved — [Seamless.ai policies/terms-of-use](https://seamless.ai/policies/terms-of-use) vs [seamless.ai/termsofservice](https://www.seamless.ai/termsofservice)

**Hunter.io — PARTIAL. The resale clause could not be retrieved.**
- Confirmed fragment: **"Any use of the Hunter application programming interface, including use through a third-party product that accesses the Services, must comply with this Agreement,"** and the restrictions list includes that users may not **build a similar or competitive service** — but **the snippet cuts off mid-clause and the full restrictions list was not retrieved.** `UNCONFIRMED / INCOMPLETE — do not assume Hunter permits redistribution` — [Hunter.io Terms of Service](https://www.hunter.io/terms-of-service)
- Hunter's privacy policy says it **does not sell personal data to third parties for monetary consideration** nor exchange it for other valuable consideration. — [Hunter.io Privacy Policy](https://hunter.io/privacy-policy)
- `CONFLICTING:` Hunter's California privacy notice states that **"within the last 12 months, we have disclosed the following categories of personal information in a manner that may be considered a 'sale'"** — naming identifiers, geolocation data, and professional information. This directly contradicts the privacy policy's no-sale statement. The notice is reported as ~1,379 days old, so it may be stale — [Hunter.io Privacy Notice for California Residents](https://hunter.io/privacy-policy/california) vs [Hunter.io Privacy Policy](https://hunter.io/privacy-policy)
- Hunter's DPA states it **shall not sell any personal information** a customer provides — but this covers customer-provided data under processing, **not the contact data Hunter itself collects.** — [Hunter.io Data Processing Agreement](https://hunter.io/data-processing-agreement)

**Dropcontact — NOT FOUND. This is a real gap.**
- **No copy of Dropcontact's CGU/terms was retrieved, and no API-use or redistribution clause could be confirmed.** `UNCONFIRMED — must be checked before any build commitment` — searches returned only vendor marketing and third-party reviews, e.g. [Dropcontact Review (syncgtm)](https://syncgtm.com/blog/dropcontact-review)
- Dropcontact's architectural claim (no database, nothing retained) is the only licence-adjacent signal found, and it is a vendor claim — [Dropcontact — Why](https://www.dropcontact.com/why)

**People Data Labs — the only vendor positioned for embedding, but the standard terms text was not retrieved.**
- PDL's documentation says it **licenses data only for legitimate use cases under its Acceptable Data Use Policy**, and that customers **must speak with a Data Consultant first**: *"We only license our data for legitimate use cases that follow our Acceptable Data Use Policy."* `CONFIRMED (via index quote of PDL docs)` — [PDL Data License Overview](https://docs.peopledatalabs.com/docs/data-license)
- Bulk datasets are **typically annual licences**, and during the term *"the customer has the right to use the data in any way as long as it is compliant with our Acceptable Data Use Policy."* `CONFIRMED (via index quote) — this is materially more permissive wording than Apollo/Lusha/Seamless, but "in any way" is bounded by the AUP, whose full text I could not read.` — [PDL Getting Started with a Data License](https://docs.peopledatalabs.com/docs/getting-started-dl)
- Prohibited uses under the AUP: **employment, credit, insurance, or housing eligibility decisions; profiling or targeting on sensitive characteristics; anything that could result in unlawful discrimination.** `CONFIRMED (via index quote)` — [PDL Data Sources & Compliance](https://docs.peopledatalabs.com/docs/data-sources)
- PDL markets itself as a **"B2B Data Provider for Industry Leading Platforms"** — i.e. its commercial model is supplying data into other companies' products. `CONFIRMED (via index quote of PDL homepage) — strong signal that OEM/embedding is a supported deal shape, though the specific clause was not read` — [PDL homepage](https://www.peopledatalabs.com/)
- **The standard data-licence and API terms are a separate linked document whose text I could not retrieve.** PDL's docs say *"You can view the standard terms for both our data license and the API here."* `GAP — the decisive clause for us is in that unread document.` — [PDL Data License Overview](https://docs.peopledatalabs.com/docs/data-license)
- `MATERIAL RISK FLAG:` PDL reportedly settled a Colorado phone-number privacy class action for **$6.3M+**. `UNCONFIRMED (single secondary source, not a court record)` — [People Data Labs Settlement (classaction.org)](https://www.classaction.org/news/6.3m+-people-data-labs-settlement-ends-colorado-phone-number-privacy-lawsuit)

**Cognism — NOT FOUND. This is a real gap.**
- **No Cognism API licence or terms text was retrieved.** Searches returned the compliance page and competitor comparisons only. `UNCONFIRMED — must be checked` — see [Cognism Compliance](https://www.cognism.com/compliance)

**ZoomInfo — NOT FOUND for its own MSA.**
- **ZoomInfo's own Master Subscription Agreement was not retrieved.** `UNCONFIRMED`
- ZoomInfo *hosts* RingLead's MSA, which limits use to *"the Services for Your own internal business purposes only"* and bars distribution — **but this governs RingLead, not ZoomInfo's own data or API, and must not be treated as ZoomInfo's terms.** `Explicitly NOT applicable` — [RingLead Customer Agreement (hosted by ZoomInfo)](https://www.zoominfo.com/legal/ringlead-customer-agreement)
- A secondary source reports ZoomInfo's developer platform says **standard apps are "for your own internal or single-tenant use."** `UNCONFIRMED (third-party blog quoting ZoomInfo docs)` — [ZoomInfo MCP vs ZoomInfo API (scalekit)](https://www.scalekit.com/blog/zoominfo-mcp-vs-api)
- Reported **data destruction clause** requiring deletion of all ZoomInfo data at subscription end. `UNCONFIRMED but, if true, incompatible with a product that persists contacts in its own SQLite store past contract end.` — [ZoomInfo Pricing (uplead)](https://www.uplead.com/zoominfo-pricing/)

### Inferences
- **The uniform pattern — "internal business purposes," "no sublicense/distribute/make available," "no embedding in your product without written consent" — means our architecture is the licence problem, not an edge case.** A single-tenant internal tool for our own 5 brands may be defensible as "internal business purposes" if all 5 brands are the same legal entity. The moment a client or external user sees a purchased contact record, we are outside standard terms at Apollo, Lusha, and Seamless.ai.
- Apollo's AI-training clause is a second, separate exposure: we pass contact context to the Anthropic API. The clause as quoted bars *allowing a third party to use Apollo data to train/fine-tune/improve* a model. Anthropic's commercial API terms do not train on API inputs by default, which is likely the saving argument — but this needs to be written down and reviewed, not assumed.
- **People Data Labs is the only vendor in the set whose commercial positioning and quoted licence language ("use the data in any way," "data provider for platforms") suggest embedding is a supported deal shape.** That makes it the natural candidate for the layer under our product — subject to reading the actual standard terms and the AUP, and subject to the Colorado settlement raising questions about its consent provenance.
- Dropcontact's no-retention architecture may sidestep the redistribution question differently: if it returns a verified email for a person we already identified and holds nothing, the "redistribution" framing weakens. But without the CGU text this is speculation.
- Practical mitigation worth designing for now: **bring-your-own-key.** If each brand/client supplies their own Apollo or Lusha credentials, the licence runs between them and the vendor, and our system is a client, not a redistributor. This is an architectural decision with licence consequences and should be made before we build the ingestion layer.

### Gaps
- **Dropcontact, Cognism, and ZoomInfo licence terms: not retrieved at all.** The assignment specifically flagged these as unchecked, and they remain unchecked. This is the largest open item.
- **Hunter.io's restrictions list is truncated mid-clause.** The resale/redistribution position is genuinely unknown.
- **PDL's standard data-licence and API terms document was not retrieved**, nor was the full Acceptable Data Use Policy text. The decisive clause for an embedding deal is in there.
- No vendor's OEM/redistribution pricing is public. Whether a redistribution licence is even purchasable at small-company scale is unknown.
- Whether our 5-brand portfolio counts as one "internal business" under any of these agreements is a question for counsel on the specific corporate structure, not something research can resolve.

---

## Q4. Compliance posture, consent provenance, and CASL (MOST IMPORTANT SECTION)

### Takeaway
**Cognism is the only vendor in the set that does notification-at-scale and systematic DNC/TPS screening, and it is the only one with a coherent story for a notification-based lawful basis — but its basis is GDPR Article 6(1)(f) legitimate interest, which does not exist under CASL.** No vendor found provides per-record consent provenance or lawful-basis metadata in a form a Canadian sender could rely on. Under CASL the burden of proving consent stays with the sender, and the practitioner consensus is explicit: **buying a list transfers data, not permission.** This means **our system must build the consent-provenance layer itself** — per-contact source URL, collection date, basis, channel scope, expiry — regardless of which vendor we buy from. That is a genuine, unavoidable build item and arguably the most important gap this research surfaces.

### Cited Findings

**Cognism — the strongest compliance posture in the set**
- Cognism states it **notifies business contacts of their inclusion within GDPR timeframes** and **regularly scrubs its data against Do Not Call / TPS lists**. The stated rationale: under legitimate interest, GDPR requires data subjects to be told a company holds their data so they can exercise rights including opt-out. `CONFIRMED as a vendor claim (via index quote of Cognism's compliance page)` — [Cognism Compliance](https://www.cognism.com/compliance)
- **Number of DNC registries screened: CONFLICTING.** Cognism's compliance hub says **15** major DNC/TPS lists; one review says its data page says **16**; another cites **13–15 international DNC lists**; a fourth says Diamond Data numbers are checked against **13 European** do-not-call lists specifically. Named lists include the UK's **TPS and CTPS**. `CONFLICTING across sources — the count is unreliable, the practice is confirmed` — [Cognism Compliance](https://www.cognism.com/compliance); [Cognism Review (thecroreport)](https://thecroreport.com/tools/cognism/); [Cognism Review (getstealery)](https://www.getstealery.com/blog/tool-reviews/cognism-review)
- Cognism processes under **GDPR Article 6(1)(f), legitimate interest**. `UNCONFIRMED (stated in reviews, consistent with Cognism's own notification rationale)` — [Cognism Review (syncgtm)](https://syncgtm.com/blog/cognism-review)
- **No source confirms Cognism screens against Canada's CRTC National DNCL, or that its notification programme covers Canadian contacts.** `GAP`

**Lusha — active regulatory risk**
- A secondary site reports **Italy's Garante fined Lusha €2 million for collecting and reselling contact data without a legal basis, decision dated July 2026.** `UNCONFIRMED — I could not corroborate this against the regulator's own record, and it comes from a single non-authoritative site. If true it is highly material; it must be verified before Lusha is shortlisted.` — [Garante vs Lusha (luxgap)](https://luxgap.com/articles/garante-vs-lusha-amende-2m-data-enrichment-rgpd/?lang=en)
- Lusha's own terms **exclude use for business-to-consumer marketing or direct solicitation**. `CONFIRMED (via index quote)` — [Lusha Terms and Conditions](https://www.lusha.com/legal/terms_and_conditions-2/)
- Lusha's privacy notice says customers may use the information for sales, marketing, recruiting and fraud prevention under licences prohibiting unauthorized use or transfer. `CONFIRMED (via index quote)` — [Lusha Privacy Notice](https://www.lusha.com/legal/privacy-notice/)

**Apollo**
- Apollo maintains a published privacy policy and the API terms carry the AI-training restriction noted in Q3. `CONFIRMED` — [Apollo Privacy Policy](https://www.apollo.io/privacy-policy)
- **No evidence found that Apollo does notification-at-scale, DNC screening, or supplies per-record lawful-basis metadata.** `GAP — absence of evidence, not evidence of absence, but notable given Cognism markets exactly this.`

**People Data Labs**
- PDL publishes a privacy/security overview describing how it obtains and generates information, a security page, and an Acceptable Data Use Policy. `CONFIRMED these documents exist` — [PDL Privacy & Security Overview (PDF)](https://www.peopledatalabs.com/pdf/privacy-security-overview.pdf); [PDL Security](https://www.peopledatalabs.com/security); [PDL Data Sources & Compliance](https://docs.peopledatalabs.com/docs/data-sources)
- AUP prohibits use for **employment, credit, insurance, or housing eligibility decisions**, sensitive-characteristic profiling, and anything producing unlawful discrimination. `CONFIRMED (via index quote)` — [PDL Data Sources & Compliance](https://docs.peopledatalabs.com/docs/data-sources)
- A third-party guide notes **a fulfilled PDL opt-out "cannot automatically erase copies already held independently"** by downstream recipients, who keep separate systems on their own refresh schedules. `UNCONFIRMED (secondary) — but structurally important: it means if we persist PDL records in our SQLite store, suppression does not propagate to us automatically. We must pull opt-out deltas.` — [People Data Labs Opt Out guide (crabclear)](https://crabclear.com/blog/people-data-labs-opt-out-guide)
- Colorado phone-number privacy class action settled for $6.3M+. `UNCONFIRMED (single secondary)` — [classaction.org](https://www.classaction.org/news/6.3m+-people-data-labs-settlement-ends-colorado-phone-number-privacy-lawsuit)

**Hunter.io**
- Publishes a DPA, a privacy policy, and a California privacy notice. The California notice's "may be considered a 'sale'" disclosure contradicts the privacy policy's no-sale claim (see Q3). `CONFLICTING` — [Hunter DPA](https://hunter.io/data-processing-agreement); [Hunter California Notice](https://hunter.io/privacy-policy/california)

**Dropcontact**
- Dropcontact's GDPR posture is its main marketing claim: real-time generation, **no personal data stored or reused after processing**. It also claims the **CNIL conducted a full audit in 2019 covering servers, stored data and source code**. `UNCONFIRMED — vendor claim; no CNIL record confirming the audit or its scope was found` — [Dropcontact — Why](https://www.dropcontact.com/why); [Dropcontact Review (typpout)](https://www.typpout.com/blog/dropcontact-review/)
- Dropcontact publishes guidance on GDPR and prospecting email. `CONFIRMED exists` — [Does GDPR Allow B2B Prospecting Emails? (Dropcontact support)](https://support.dropcontact.com/article/240-does-the-gdpr-still-allow-me-to-send-prospecting-emails)

**CASL specifically — the Canadian constraint**
- **CASL is a consent regime, not a lawful-basis regime.** Express or narrowly-defined implied consent is required **before the first commercial electronic message** to a Canadian recipient. **GDPR-style legitimate interest does not appear in CASL.** `CONFIRMED in substance across multiple sources, though all are law-firm or vendor blogs rather than the statute` — [Doing Business in Canada: CASL (Gowling WLG)](https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl); [CASL Compliance for B2B Cold Email (smarte)](https://www.smarte.pro/blog/casl-compliance)
- The main B2B route is **implied consent via conspicuous publication**: the message must relate to the recipient's business, role or duties, and **this cannot simply be deduced from job title**. A published address accompanied by a statement refusing commercial messages does not qualify. `CONFIRMED in substance (Gowling, a law firm, is the best source in the set)` — [Gowling WLG CASL guide](https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl)
- **Third-party data providers are the weak point:** providers "sell lists compiled from public sources, web crawls, or bundled data sets" and "those sources rarely capture actual opt-ins." The published-address basis must be shown **for each contact**, so a provider's list does not carry consent by itself. `CONFIRMED in substance (vendor blog, but consistent with the statutory structure)` — [CASL Compliance (smarte)](https://www.smarte.pro/blog/casl-compliance)
- **Under CASL the burden of proving consent stays with whoever sends the message.** Buying a list transfers data, not permission. `CONFIRMED in substance` — [B2B Consent Management (smarte)](https://www.smarte.pro/blog/b2b-consent-management)
- **Implied-consent expiry periods: CONFLICTING.** Some sources give two years after a purchase/contract and six months after an inquiry; others describe a six-month window for published B2B addresses. These do not reconcile. `CONFLICTING — must be resolved against the statute and CRTC guidance` — [CASL Rules for Cold B2B Email (mailtester)](https://mailtester.com/blog/casl-rules-for-cold-b2b-email-to-canadian-prospects/); [Cold Email Laws in Canada (imisofts)](https://imisofts.com/blog/cold-email-laws-canada/)
- Penalties cited at **up to CAD $10 million for corporations**. `UNCONFIRMED (vendor sources)` — [CASL Cold Email Canada Guide 2026 (litemail)](https://litemail.ai/blog/casl-cold-email-canada-guide-2026)
- **The recommended per-record schema** from practitioner guidance: **source** (form name, event, vendor, or URL — "proves the origin of the record"), **legal basis**, **timestamp**, **channel scope**, and **expiry**; plus date and method of consent, the form/source it was collected through, and the campaign or list the contact belongs to. One source: *"A practical B2B data compliance stack includes a source field on every record, populated automatically at import. This single field answers most audit questions."* `CONFIRMED in substance across multiple practitioner sources` — [B2B Data Compliance (zenbee)](https://zenbee.io/blog/b2b-data-compliance/); [B2B Consent Management (smarte)](https://www.smarte.pro/blog/b2b-consent-management); [B2B Email List Privacy (instantly)](https://instantly.ai/blog/b2b-email-list-privacy-consent-legitimate-interest/)
- Vendor diligence checklist: ask providers to **document where each data category originates and whether the source can be evidenced per record**. `CONFIRMED in substance` — [zenbee](https://zenbee.io/blog/b2b-data-compliance/)
- **Canada's screening list is the CRTC National DNCL**, under the CASL/PIPEDA framework. However, the DNCL is described as a registry for **residential and wireless consumer numbers**, suggesting it is primarily a consumer registry; **B2B telemarketing "operates under a separate set of considerations involving CASL and implied consent between organizations."** `UNCONFIRMED how DNCL applies to business numbers — no CRTC source found` — [Canadian Telemarketing Regulations: DNCL and UT Rules (blacklistalliance)](https://www.blacklistalliance.com/blog/calling-the-great-white-north-a-quick-primer-on-canadian-telemarketing-regulations); [Canada's National DNC List in 2026 (prospectsinfluential)](https://www.prospectsinfluential.com/canadas-national-dnc-list-in-2026-what-consumer-telemarketers-need-to-know/)

### Inferences
- **No vendor in this set solves CASL for us.** Cognism's notification programme is the closest thing to a transferable basis, but it is built for GDPR legitimate interest, a basis CASL does not recognise. Even a Cognism record needs an independent CASL basis.
- **Therefore the consent-provenance layer is a mandatory build, not a buy.** Our 20-table schema needs per-contact fields for: source (vendor name + the specific public URL where the address was conspicuously published), collection date, basis (express / implied-publication / implied-relationship), channel scope (email vs phone), expiry date, and evidence snapshot. This is a schema change and an ingestion-pipeline requirement, and it should gate sending: no CASL basis recorded → the contact cannot enter a campaign.
- **Conspicuous publication must be evidenced per contact, which means our pipeline needs to capture and store the source URL at enrichment time.** A vendor that returns a bare email with no provenance (which is most of them) leaves us unable to establish the basis at all. This makes **provenance-returning vendors strictly more valuable to us than higher-coverage ones** — and is a question to put in writing to every vendor in an RFP: *"does your API return, per record, the public source from which the contact detail was obtained, and the date?"*
- Our existing org-wide suppression is necessary but insufficient. The PDL opt-out finding implies we also need a **scheduled opt-out/suppression delta pull from each vendor**, because an upstream opt-out does not reach data we have already persisted. Combined with ZoomInfo's reported data-destruction-on-termination clause, our SQLite persistence model has contractual and compliance obligations attached to it that it currently does not implement.
- Lusha's reported €2M Garante fine and PDL's reported $6.3M Colorado settlement both concern **collecting and reselling contact data without a legal basis** — the exact exposure we would be taking on. Neither is confirmed, but both must be verified before contracting; they bear directly on indemnity negotiation.

### Gaps
- **No authoritative CRTC or Government of Canada source was readable** (proxy blocked direct fetching; searches returned only vendor and law-firm blogs). Every CASL statement above needs verification against the statute and CRTC guidance, plus Canadian counsel.
- **No vendor was found to offer per-record consent provenance or lawful-basis metadata.** I want to be precise: I found *no evidence that any of them do*, and no evidence that they don't — the question is simply not addressed on any readable page. It must be asked directly in an RFP.
- Whether Cognism's notification programme and DNC screening extend to **Canada / the CRTC DNCL** is unknown.
- Whether any vendor offers **CASL-specific contractual warranties or indemnities** for Canadian sending: not found.
- The Lusha Garante fine and the PDL Colorado settlement are both single-source and uncorroborated.
- Apollo, Seamless.ai, and Hunter compliance postures beyond generic privacy policies: not established.

---

## Q5. Intent and signal data

### Takeaway
Intent data is where the pricing gets punitive: Bombora, G2 Buyer Intent, and ZoomInfo intent are all quote-only at $15k–$50k/yr list, with Vendr medians around $25k–$33.5k. **Apollo is the outlier — it bundles Bombora-sourced intent into its $49–$119/seat plans**, which makes it the only intent source priced for a small sender. Actionability evidence is thin to nonexistent across all of them.

### Cited Findings
- **Bombora:** no public list price. Vendr median contract cited at **~$25,000/yr**; one roundup gives **$12K–40K** and another **$25K–75K+**. Coverage claim: **21,600+ intent topics** sourced through its **B2B Data Co-op**; annual contracts. `CONFLICTING on price; coverage is vendor self-reported` — [Top 15 Intent Data Providers (autobound)](https://www.autobound.ai/blog/top-15-intent-data-providers-compared-2026)
- **G2 Buyer Intent:** G2 Starter **$299/mo in year one**; Buyer Intent remains a **quote-only add-on** estimated at **$15K–$30K/yr** by one source and **$40K–$50K at list** by another. Vendr data cited showing **50% of companies negotiate 38%+ discounts, bringing effective cost to ~$8,000–$10,000/yr**. `CONFLICTING` — [autobound](https://www.autobound.ai/blog/top-15-intent-data-providers-compared-2026)
- **ZoomInfo:** intent is **not in the entry Professional package** — it comes with higher Copilot tiers or as an add-on. Vendr median contract **$33,500/yr** (range $7,220–$155,730, February 2026). `UNCONFIRMED (Vendr data relayed)` — [autobound](https://www.autobound.ai/blog/top-15-intent-data-providers-compared-2026); [Top Sales Intelligence Tools (pipeline.zoominfo)](https://pipeline.zoominfo.com/sales/top-sales-intelligence-tools)
- **Apollo:** intent data **included in its plans**, sourced from **Bombora**, with Apollo citing **15K+ buying intent topics**. Pricing from **$49/user/month annual**, free tier available. `CONFIRMED that Apollo bundles intent (via index quote of Apollo's own comparison page — vendor source, so the framing is self-serving, but the bundling claim is checkable)` — [Apollo vs Bombora (apollo.io)](https://www.apollo.io/insights/apollo-vs-bombora)
- **HubSpot Breeze:** buyer intent / visitor identification is the **credit-consuming** part of Breeze Intelligence — **10 credits ($0.10) per company tracked per month**, custom signals (beta) **50 credits/month**. `UNCONFIRMED (single secondary)` — [datamagnet](https://www.datamagnet.co/post/hubspot-breeze-intelligence-pricing-credits-limits/)

### Inferences
- **Apollo bundling Bombora-sourced intent at $49–$119/seat is the single best price-performance item in this entire research pass.** For a small Canadian sender, it is the only realistic route to third-party intent.
- HubSpot's **$0.10/company/month** buying-intent tracking is a genuinely interesting unit economic: tracking 1,000 target accounts costs ~$100/month. That is a feature our system does not have in any form and could acquire cheaply if we are already in HubSpot.
- Topic-based co-op intent (Bombora) is a coarse signal — "someone at this company read about this topic." Our existing 6-factor fit scoring and 11-section deep research produce account-level reasoning that is arguably more specific; what we lack is the **temporal trigger** ("why now"). Intent data's real value to us is recency, not richness.
- Technographics, hiring signals and funding signals were **not priced separately by any source found** — they appear to be bundled into platform tiers rather than sold as line items.

### Gaps
- **Actionability:** no source found measures whether intent data actually lifts reply or meeting rates. Every claim is promotional. I found no study.
- **Technographics, hiring signals, funding signals:** not covered by any retrieved source with pricing or coverage detail. This is an unaddressed area.
- Whether Apollo's bundled Bombora feed is the full co-op or a restricted subset (Apollo cites 15K topics vs Bombora's own 21,600) is unresolved — the discrepancy suggests a subset, but no source confirms.
- All Vendr medians are relayed through competitor blogs; the underlying Vendr data was not read.

---

## Q6. Enrichment and waterfall

### Takeaway
Waterfall enrichment with **no charge on a miss is now table stakes** — both Clay and FullEnrich confirm it, with different trade-offs (FullEnrich manages the provider order, Clay makes you build it). The important caveat, and it is a real one, is that **a wrong-but-deliverable-looking email still bills**: credits are refunded on "nothing found," not on "found and wrong."

### Cited Findings
- **FullEnrich:** managed waterfall, provider order not user-configurable. **"The failed search is not charged"** when verified data isn't found. Free trial 50 credits; **Pro from $55/mo for 1,000 credits/month; email = 1 credit, mobile = 10 credits.** `CONFIRMED (via index; the credits-only-on-success claim originates in FullEnrich's own guide, so it is a vendor claim)` — [FullEnrich Review (syncgtm)](https://syncgtm.com/blog/fullenrich-review); [Best Waterfall Enrichment Tools (fullenrich)](https://fullenrich.com/content/best-waterfall-enrichment-tools)
- **Clay:** user-built waterfall. If no email is found, **credits are refunded and Clay moves to the next provider**. Clay's documentation states **neither Data Credits nor Actions are charged when an enrichment returns nothing**. `CONFIRMED (via index quote of Clay University docs)` — [Enrich People (Waterfalls) — Clay University](https://university.clay.com/lessons/enrich-people-waterfalls-clay-101); [Enriching People Data — Clay University](https://www.clay.com/university/lesson/enrich-people-waterfalls-clay-101)
- **The catch, stated plainly:** a provider that **returns a wrong email bills before validation rejects it**. `CONFIRMED (via index)` — [Clay Data Enrichment Review (cleanlist)](https://www.cleanlist.ai/blog/clay-data-enrichment-review)
- Clay's free plan is limited; **phone enrichment requires a paid tier ("Phone enrichment needs Launch")**. `CONFIRMED (via index quote)` — [Clay University](https://www.clay.com/university/lesson/enrich-people-waterfalls-clay-101)
- **Apollo has its own waterfall enrichment feature**, documented in its knowledge base. `CONFIRMED exists; mechanics and charging behaviour not read` — [Use Waterfall Enrichment (Apollo knowledge base)](https://knowledge.apollo.io/hc/en-us/articles/34071121664781-Use-Waterfall-Enrichment)
- Dropcontact is positioned as **find-and-verify** rather than database lookup: real-time generation plus cleaning, from first name + last name + company. `UNCONFIRMED (vendor claim)` — [Dropcontact — Why](https://www.dropcontact.com/why)
- Hunter.io is the canonical **email-finder + verifier**. `Its charging-on-miss behaviour was not established.` — [Hunter.io](https://www.hunter.io/terms-of-service)

### Inferences
- **Waterfall orchestration is a feature our system entirely lacks and is the most directly buildable gap in this whole inventory.** We have the adapter pattern already (Anthropic API adapter); a provider-chain abstraction with per-provider cost accounting, success/failure accounting, and a stop-on-first-verified-hit rule is a natural extension of our existing usage-metering table.
- The "wrong email still bills" problem argues for **our own verification step after the waterfall**, not reliance on provider-claimed verification. Combined with the Q1 finding (verification drops bounce from ~13% to ~1.8%), independent verification is the highest-leverage single component we could add.
- Clay vs FullEnrich is a build-vs-buy question in miniature: Clay is the orchestration layer we would otherwise build. If we build it, we capture the margin and control provider order per brand; if we buy FullEnrich we get hit rate without the engineering. Given our zero-dependency architecture and the fact that **we would need per-contact provenance capture inside the waterfall anyway** (Q4), building the orchestration ourselves and calling providers directly is likely correct — the provenance requirement is not something Clay or FullEnrich will record for us.

### Gaps
- Hunter.io and Dropcontact charge-on-miss policies: not established.
- Apollo's waterfall charging mechanics: article exists but was not readable.
- No independent head-to-head hit-rate test of waterfall vs single-provider on a Canadian dataset.

---

## Q7. Scoring and AI — how their quality compares to what we built

### Takeaway
ZoomInfo and Apollo both ship ICP fit scoring, lookalike/similar-company expansion, and AI research — so these are **table stakes at the platform level, not differentiators we hold**. But there is a meaningful crack in the floor: **the evidence suggests Apollo's scoring and lookalike features exist in the UI and are not exposed as API endpoints**, while ZoomInfo exposes a "Find Similar Companies" endpoint. Our system's scoring is at feature parity on paper; what we lack is the real data underneath it, not the logic on top.

### Cited Findings
- **Apollo:** lists AI research and lead scoring; **"AI Scoring" ranks leads by fit and intent**; AI Assistant reachable through **Apollo MCP**. A third-party comparison says Apollo's **persona fit scoring scores how well a contact matches your saved ICP before you include them in a sequence**. Reported **September 2026** addition of **scheduled outbound agents** for lead discovery, sequence creation and sequence optimization. `UNCONFIRMED (Apollo's own pages plus competitor comparisons)` — [Apollo vs ZoomInfo (apollo.io)](https://www.apollo.io/insights/apollo-vs-zoominfo); [How Apollo's AI works (apollo.io)](https://www.apollo.io/insights/considering-switching-from-zoominfo-back-to-apollo-wants-to-understand-how-apollo-leverages-ai-to-empower-sales-teams)
- **ZoomInfo ICP Builder:** analyzes your **closed-won data across 300+ company attributes**, layers in **live intent signals**, and outputs a **scored account universe**. `CONFIRMED as a vendor product description (ZoomInfo's own page)` — [ICP Builder (ZoomInfo)](https://pipeline.zoominfo.com/marketing/icp-builder)
- ZoomInfo exposes **lookalike expansion via a "Find Similar Companies" API endpoint**, plus AI-ranked contact recommendations. `UNCONFIRMED (ZoomInfo-published review)` — [Apollo API Review (pipeline.zoominfo)](https://pipeline.zoominfo.com/sales/apollo-api-review)
- ZoomInfo's **MCP server** lets a user ask Claude for accounts matching an ICP and get ZoomInfo records back — **"provided somebody has already paid for the credits those queries consume."** `UNCONFIRMED (secondary)` — [ZoomInfo MCP Review (reply.io)](https://reply.io/blog/zoominfo-mcp/)
- **Claimed Apollo API gap:** a ZoomInfo-published API review says **Apollo's API does not expose AI-powered account research, lookalike expansion, buying-committee recommendations, or contact recommendations**; a separate October 2026 comparison found Apollo's lookalike capability "not stated on the pages checked." `UNCONFIRMED and from a direct competitor — but two independent-ish sources point the same way, so the hypothesis that Apollo's AI features are UI-only deserves testing` — [Apollo API Review (pipeline.zoominfo)](https://pipeline.zoominfo.com/sales/apollo-api-review); [Best API for ICP targeting (lusha.com)](https://www.lusha.com/blog/best-api-for-icp-targeting-and-segmentation/)
- **Lusha** publishes guidance positioning its API for ICP targeting and segmentation — search, score, expand. `CONFIRMED the positioning exists; capability not verified` — [Best API for ICP targeting and segmentation (Lusha)](https://www.lusha.com/blog/best-api-for-icp-targeting-and-segmentation/)

### Inferences
- **Our scoring/research/lookalike layer is at rough feature parity with the category leaders on paper.** 6-factor company fit scoring vs ZoomInfo's 300+ attribute model is a difference of input breadth, not of concept — and ZoomInfo's breadth comes from owning the data, which is exactly our missing piece. The honest read: **we did not build a thin version of their product; we built the half of their product that doesn't require owning a database, and we built it with a better research output (11 sections/account) than either appears to ship.**
- **The one genuine differentiator available to us is that ZoomInfo's ICP Builder trains on your closed-won data.** Ours defines ICP declaratively. Closed-won-trained scoring is a real capability gap and is buildable from our own CRM/outcome data (we already have campaigns, replies, meetings — the label data exists in our 20 tables).
- If the Apollo-API-lacks-lookalikes finding holds, then **buying Apollo data and running our own scoring/lookalike/research layer on top is the architecturally correct combination**: we take what Apollo's API does give (records, bundled intent) and supply what it doesn't (programmable fit scoring, lookalikes, deep research). This is a coherent product story — but it collides head-on with Apollo's "internal business purposes / no embedding in your product" licence (Q3). **The technical fit and the licence fit point in opposite directions, and that tension is the core finding of this research.**
- Accuracy claims in this area are unusable: Apollo claims 98% email accuracy on one page and 91% on another, against third-party estimates of 65–85%.

### Gaps
- No independent quality evaluation of any vendor's ICP scoring, lookalike relevance, or AI research output quality exists in the sources found. The comparison to our own layer is therefore structural (what features exist) and not qualitative (how good they are).
- Whether Apollo's scoring/lookalike features are genuinely absent from its API is unresolved and only asserted by competitors. **This must be tested directly against Apollo's API docs — it materially changes the build plan.**
- Cognism, Seamless.ai, Hunter, Dropcontact, and PDL AI/scoring capabilities: not covered by retrieved sources.

---

## Q8. Table stakes vs differentiated

### Takeaway
Table stakes across the category: a contact/company database with search, credit-metered reveals, CSV export, an enrichment API, waterfall-with-no-charge-on-miss, bundled technographics, ICP fit scoring, lookalike expansion, and AI research summaries. Genuinely differentiated: **notification-at-scale plus DNC screening (Cognism alone)**, **no-database real-time generation (Dropcontact alone)**, **data licensed for embedding in someone else's product (People Data Labs alone)**, and **closed-won-trained ICP scoring (ZoomInfo)**.

### Cited Findings
- Waterfall-with-refund-on-miss confirmed at both Clay and FullEnrich, and Apollo ships its own waterfall feature — three independent implementations, i.e. table stakes. `CONFIRMED` — [Clay University](https://university.clay.com/lessons/enrich-people-waterfalls-clay-101); [FullEnrich](https://fullenrich.com/content/best-waterfall-enrichment-tools); [Apollo knowledge base](https://knowledge.apollo.io/hc/en-us/articles/34071121664781-Use-Waterfall-Enrichment)
- ICP scoring + lookalike + AI research present at both Apollo and ZoomInfo. `CONFIRMED as product descriptions` — [Apollo vs ZoomInfo](https://www.apollo.io/insights/apollo-vs-zoominfo); [ZoomInfo ICP Builder](https://pipeline.zoominfo.com/marketing/icp-builder)
- Credit-metered per-data-point reveal with phone priced 5–10x email: Apollo (1 email / 8 phone), Lusha (1 / 5), FullEnrich (1 / 10). `CONFIRMED pattern across three vendors` — [supered](https://www.supered.io/blog/apollo-pricing/); [overloop](https://overloop.com/blog/cognism-pricing); [syncgtm](https://syncgtm.com/blog/fullenrich-review)
- Notification-at-scale + multi-registry DNC/TPS scrubbing: **only Cognism** markets this. `CONFIRMED as unique within this set` — [Cognism Compliance](https://www.cognism.com/compliance)
- No-database real-time generation: **only Dropcontact**. `UNCONFIRMED vendor claim, but uniquely positioned` — [Dropcontact — Why](https://www.dropcontact.com/why)
- Data licensed into other companies' platforms: **only PDL** positions this way, with bulk delivery via AWS/GCP/Snowflake. `CONFIRMED positioning` — [PDL homepage](https://www.peopledatalabs.com/); [PDL Person Data Pricing](https://www.peopledatalabs.com/pricing/person)

### Inferences
- **Measured against table stakes, our system's inventory is strong everywhere except data and sending.** We have search, ICP, scoring, lookalikes, research, segments, campaigns, suppression, analytics, metering, webhooks, export. We lack: real records, verification, waterfall orchestration, consent provenance, intent recency, and delivery.
- **Nothing in this category offers CASL-grade per-contact consent provenance.** That is not a gap we are behind on — it is an unoccupied position. For a Canadian sender it is also a hard requirement. Building it is both compliance necessity and the only defensible differentiation this research surfaced.
- The ranked build order that falls out of the evidence: **(1) consent-provenance schema + sending gate — mandatory under CASL and nobody sells it; (2) independent email verification — 13%→1.8% bounce is the largest measurable quality lever; (3) waterfall orchestration with per-provider cost accounting — table stakes, and we need provenance capture inside it anyway; (4) closed-won-trained scoring from our own outcome data — real differentiation over declarative ICP; (5) intent recency — cheapest acquired by bundling (Apollo) rather than built.**

### Gaps
- Deliverability/sending infrastructure was out of scope for this pass and is not covered. Note that the proxy also denied `postmarkapp.com`, so sending-vendor research was not possible here either.
- Clay was not in the assigned vendor list but surfaced repeatedly as the de facto orchestration layer; a dedicated pass on Clay-as-competitor may be warranted.

---

## RANKED SHORTLIST — what a small Canadian B2B sender should actually use

**Confidence statement:** this ranking follows from the evidence above, but every price is relayed rather than directly verified, and **three of the six assigned vendors' licence terms (Cognism, Dropcontact, ZoomInfo) could not be retrieved at all.** Treat this as a procurement starting point, not a decision.

### 1. Apollo.io — primary data + bundled intent. ~$79–$119/seat/month annual (~$950–$1,430/yr for one seat)
**Why:** the only vendor in the set with published pricing, a credit allowance that covers 10,000 verified emails inside a single seat (48,000 credits/yr on Professional), and **bundled Bombora-sourced intent at no extra cost** — a capability that costs $25k+/yr standalone. Reported 78% email match and 20% raw bounce are mediocre, but the Q1 evidence says our own verification layer fixes that more cheaply than paying a premium vendor would.

**Licence/compliance caveats — serious:**
- `CONFIRMED:` licence is **"solely for your internal business purposes"**; **"you may not sublicense, sell, or distribute (including but not limited to sharing)"**; **integrating the APIs into your product or services requires Apollo's authorization**; the pricing page says powering external products, sharing with customers, or reselling **is not permitted under standard terms**. **If our system exposes Apollo records to any external user, we need a negotiated agreement or a bring-your-own-key architecture.** — [Apollo API Terms](https://www.apollo.io/terms/api), [Apollo Pricing](https://www.apollo.io/pricing)
- `CONFIRMED:` AI clause bars allowing a third party to use Apollo data to train/fine-tune/improve a model — review our Anthropic adapter against this in writing. — [Apollo Privacy Policy](https://www.apollo.io/privacy-policy)
- `GAP:` no evidence Apollo does notification, DNC screening, or returns per-record provenance. **Assume it does not and build the CASL basis ourselves.**
- `UNCONFIRMED:` whether Apollo's API exposes lookalikes/scoring — test before relying on it (we supply these anyway).

### 2. A find-and-verify layer — Dropcontact and/or Hunter, with FullEnrich as the managed fallback. ~$55–$150/month
**Why:** this is the layer that delivers the single biggest measured quality gain in the whole research pass (bounce 13.3% → 1.8% with pre-send verification). Dropcontact's **no-stored-data, real-time generation** architecture is the most CASL-defensible shape available and sidesteps much of the redistribution question; Hunter is the category-standard finder/verifier; FullEnrich at **$55/mo for 1,000 credits, no charge on a miss** is the managed option. These enrich lists we have already identified — they are a complement to Apollo, not a substitute.

**Licence/compliance caveats — largely unknown, and that is the point:**
- `GAP — CRITICAL:` **Dropcontact's CGU was not retrieved. Its API-use and redistribution terms are unknown.** The assignment flagged this as unchecked and it remains unchecked. Must be read before commitment.
- `GAP — CRITICAL:` **Hunter.io's restrictions list is truncated mid-clause** at "may not build a similar or competitive service without…". Redistribution position unknown. `CONFLICTING:` its California notice discloses conduct that "may be considered a 'sale'" while its privacy policy says it does not sell — resolve this. — [Hunter Terms](https://www.hunter.io/terms-of-service), [Hunter California Notice](https://hunter.io/privacy-policy/california)
- `UNCONFIRMED:` Dropcontact's CNIL-audit claim has no regulator-side confirmation; its lower match rate (no database) is a real functional limit.
- `CONFIRMED:` FullEnrich/Clay refund on "nothing found" but **not on "found and wrong"** — our own verification step is still required.

### 3. People Data Labs — the only candidate if we ever embed data in a product others see. From $98/month self-serve; enterprise licence quote-only
**Why:** uniquely among the set, PDL's business is **supplying data into other companies' platforms**, and its own docs say that during the licence term the customer **"has the right to use the data in any way as long as it is compliant with our Acceptable Data Use Policy."** That is materially more permissive wording than Apollo's, Lusha's, or Seamless.ai's. If our roadmap genuinely requires end users to see purchased contact records, PDL is the only vendor here whose deal shape plausibly allows it.

**Licence/compliance caveats:**
- `GAP — CRITICAL:` **the standard data-licence and API terms document was not retrieved.** The clause that decides whether we may expose PDL data to end users is in a document I could not read. **Do not commit on the strength of the docs page wording alone.**
- `CONFIRMED:` AUP bars employment, credit, insurance and housing eligibility decisions, sensitive-characteristic profiling, and anything producing unlawful discrimination. — [PDL Data Sources & Compliance](https://docs.peopledatalabs.com/docs/data-sources)
- `UNCONFIRMED but material:` reported **$6.3M+ Colorado phone-number privacy class-action settlement.** Verify against the court record; it bears directly on indemnity terms.
- `UNCONFIRMED but structurally important:` a PDL opt-out **does not propagate to data we have already persisted** — we must schedule suppression-delta pulls. Our SQLite persistence takes on an ongoing obligation.
- `CONFIRMED:` must go through a Data Consultant; no self-serve path to a redistribution licence.

### Explicitly NOT recommended for a small Canadian sender
- **ZoomInfo** (~$33.5k/yr Vendr median; reported non-cancellable with a data-destruction-on-termination clause that is incompatible with persisting records in our own store) and **Cognism** (~$22k–$40k/yr, ~$15k platform fee, 12-month minimum, no trial, reported 10–15% annual renewal escalation). Both are an order of magnitude outside a small sender's budget. **Cognism is the painful exclusion:** it has by far the best compliance posture in the category — notification-at-scale, 13–16 DNC/TPS registries, an articulated lawful basis — and it is the one vendor whose compliance story we would most want to buy. **But its basis is GDPR legitimate interest, which CASL does not recognise, so even at $36k/yr it would not hand us a Canadian consent basis.** Revisit only if EMEA sending becomes material.
- **Lusha** — excluded on risk, not price. The reported **€2M Garante fine for collecting and reselling contact data without a legal basis** is uncorroborated but, if confirmed, concerns precisely our exposure; and its terms are the most explicit in the set that **data "cannot be resold or embedded in a third-party product without written consent"** and cannot be used to train AI/ML. Verify the fine before reconsidering.
- **Seamless.ai** — excluded on terms. Annual-only, all sales final, 60-day cancellation notice, explicit caps on records you may "export, download or view," and a clause barring **competitors** from using the service at all — which our system may well be. — [Seamless.AI Terms of Use](https://www.seamless.ai/termsofservice)
- **HubSpot Breeze Intelligence** — not a standalone option, but worth noting the unit economics are the best in the set ($0.01/credit; buying-intent tracking at $0.10/company/month). Only relevant if we are already paying for a HubSpot hub.

### The one-line build decision this research supports
**Buy records and intent from Apollo at ~$950–$1,430/yr per seat under a bring-your-own-key or single-tenant-internal architecture; buy verification/find from a Dropcontact-or-Hunter plus FullEnrich layer at ~$55–$150/month; and build the consent-provenance layer, the independent verification step, and the waterfall orchestrator ourselves — because no vendor in this category sells CASL-grade per-record provenance, and under CASL the burden of proving consent stays with us as the sender.** Total external data spend: roughly **$1,600–$3,200/yr**, against $22k–$40k for the enterprise route. Before signing anything, counsel must read the five documents this research could not retrieve: Dropcontact's CGU, Hunter's full restrictions list, PDL's standard data-licence and API terms plus the full AUP, Cognism's API terms, and ZoomInfo's MSA.
