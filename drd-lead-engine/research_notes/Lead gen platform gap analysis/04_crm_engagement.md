# CRM and Sales-Engagement Platforms — Gap Analysis vs Our Lead Engine (as of 13 Oct 2026)

> **Method / reliability note — read first.**
> **Direct page fetching failed completely for this assignment.** Every `WebFetch` call returned
> `getaddrinfo ENOTFOUND` (DNS resolution failure) for `developers.hubspot.com`,
> `knowledge.hubspot.com` and `www.rfc-editor.org`. The Tavily extract tool was also unavailable
> (invalid API key). **All findings below therefore come from a search index that quotes vendor
> documentation, not from the vendor pages themselves.** The index quoted HubSpot's own developer
> and knowledge-base pages verbatim in several places, which is the strongest evidence available
> here, but it is still one remove from the primary source.
>
> **Consequence for the consent work:** the field names and enum values in the "Data hygiene" and
> "Preference centres" sections are the ones we intend to copy into real code. They are labelled
> **CONFIRMED (via index quote of vendor docs)** where the index quoted the doc, but **every one of
> them must be re-verified against a live HubSpot API reference page or a live API call before it is
> written into a migration.** Do not treat this file as the authority for a schema that must match
> HubSpot byte-for-byte. It is the authority for the *shape* of the schema, which is what we
> actually need, since we are building our own store, not a HubSpot clone.
>
> Labels used: **CONFIRMED** = quoted from vendor/standards documentation via the index.
> **CONFLICTING** = sources disagree, both positions recorded. **UNCONFIRMED** = secondary blog,
> community post, or inference only.

---

## Object model: what each platform treats as core objects, and our minimum viable model

### Takeaway
HubSpot's four-object core (contact, company, deal, ticket) plus a generic association layer is the
industry's lowest common denominator, and Pipedrive's (person, organization, deal, lead, activity)
is the same model with an explicit pre-deal "lead" stage that maps almost exactly onto what we
already call a prospect. For a one-person five-brand operation the minimum viable model is
**person, company, opportunity, activity, and a brand/tenant scope** — ticket, product, line item
and custom-object machinery are enterprise weight we should refuse.

### Cited Findings
- **CONFIRMED** HubSpot's standard objects are Contacts, Companies, Deals and Tickets, described as
  "the foundational elements upon which all customization and integration tasks are built" —
  [HubSpot Developers: Guide to HubSpot CRM Objects, Standard Objects](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-standard-objects)
- **CONFIRMED** HubSpot addresses objects by numeric type ID: Companies `0-2`, Contacts `0-1`,
  Deals `0-3`, Tickets `0-5`; records are managed at `/crm/v3/objects/{type}` —
  [HubSpot Developers: Using Object APIs](https://developers.hubspot.com/docs/api-reference/latest/crm/using-object-apis)
- **CONFIRMED** Relationships are a separate first-class concern: the v4 Associations API supports
  cross-object links (contact→company) *and* same-object links (company→company), each with an
  association type ID resolvable via a labels endpoint; associations can also be set inline at
  create time via an `associations` array in the POST body —
  [HubSpot Associations v4 guide](https://developers.hubspot.com/docs/api-reference/crm-associations-v4/guide),
  [HubSpot Tickets guide](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/tickets/guide)
- **CONFIRMED** HubSpot search can filter on an association pseudo-property such as
  `associations.contact`, but custom-object associations are *not* supported in search and require
  the associations API — [HubSpot CRM Search API](https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm)
- **CONFIRMED** Products cannot be associated to records directly; you must create a *line item*
  from a product and attach that to a deal or quote, and each line item belongs to exactly one
  parent — [HubSpot CRM Products API guide](https://developers.hubspot.com/docs/api-reference/crm-products-v3/guide)
- **CONFIRMED** Pipedrive treats persons and organizations together as "contacts"; organization
  parent/child hierarchies live on a *separate* endpoint rather than as a field —
  [Pipedrive: Core API concepts](https://pipedrive.readme.io/docs/core-api-concepts-about-pipedrive-api)
- **CONFIRMED** Pipedrive has a distinct pre-deal object: "Leads are potential deals stored in Leads
  Inbox before they are archived or converted to a deal"; each lead must have a `title` and must
  link to a person or an organization; conversion is `POST /api/v2/leads/{id}/convert/deal` —
  [Pipedrive Leads API](https://developers.pipedrive.com/docs/api/v1/Leads),
  [Pipedrive API v2 overview](https://pipedrive.readme.io/docs/pipedrive-api-v2)
- **CONFIRMED** Pipedrive activities are calendar-shaped and polymorphic: "appointments/tasks/events
  on a calendar that can be associated with a deal, a lead, a person and an organization" —
  [Pipedrive Activities API](https://developers.pipedrive.com/docs/api/v1/Activities)
- **CONFIRMED** The Pipedrive REST surface exposes deals, persons, organizations, activities, leads,
  products, pipelines, stages, mail, calls, files, notes, users, permissions, filters and goals —
  [API Evangelist: Pipedrive API profile](https://github.com/api-evangelist/pipedrive) (third-party
  catalogue of the public surface, not Pipedrive's own page)
- **CONFIRMED** Attio's model has four components, not three: "Objects are your tables, attributes
  are your columns, records are your rows, and lists are the process layer where your team actually
  works" — [Attio custom objects and data model explained](https://www.automationjinn.com/blog/attio-custom-objects-data-model)
  (third-party explainer quoting the model)
- **CONFIRMED (important design idea)** Attio splits attributes by lifetime: "Object attributes live
  on the record itself and appear everywhere that record does. List attributes belong to a single
  list, and their values live on the list entry rather than the record" — e.g. an onboarding stage
  is a *list* attribute, not a record field —
  [Attio custom objects and data model explained](https://www.automationjinn.com/blog/attio-custom-objects-data-model)
- **CONFIRMED** Attio relationships are first-class with declared cardinality (one-to-one,
  one-to-many, many-to-many), named on both sides, configured under Settings → Objects —
  [How to model complex data in Attio](https://novlini.io/blog/how-to-model-complex-data-in-attio-with-custom-objects-and-relationships)
- **CONFLICTING** Attio custom objects are plan-gated, but sources disagree on which plan: "available
  on Pro and Enterprise plans" — [automationjinn](https://www.automationjinn.com/blog/attio-custom-objects-data-model);
  versus "only available on Pro ($69/user/month annual)" —
  [novlini](https://novlini.io/blog/how-to-model-complex-data-in-attio-with-custom-objects-and-relationships)
  (the $69 figure also predates the July 2026 price rise, see Pricing)
- **CONFLICTING** Whether Folk has a real object model at all. Older comparison: in Folk "you can't
  create custom object types or model relationships between entities the way Attio lets you", the
  core object being a person or company record with drag-and-drop pipeline views layered on top —
  [Attio vs Folk](https://lightfield.app/blog/attio-vs-folk); newer comparison claims Folk now
  offers custom objects and deals on its Premium tier —
  [Attio vs Folk 2026](https://tomba.io/blog/attio-vs-folk). Both are third-party.

### Inferences
- The universal spine is **person ↔ company ↔ opportunity, with activities hanging off any of
  them**. Every platform here implements that; the differences are above it (tickets, products,
  custom objects) and beside it (lists, leads inbox).
- Pipedrive's *lead* object is the single most relevant precedent for us. Our current "prospect with
  fit score" is already a lead-inbox record. The cheap, honest move is to name it that and give it
  one transition (`convert → opportunity`) rather than inventing a deal object that every prospect
  must enter.
- Attio's list-attribute vs object-attribute split is directly useful for our five-brand problem: a
  person's email and name belong to the person; their *stage with Brand C* belongs to the
  brand-scoped membership row. Putting stage on the contact row would be a bug at five brands.
- HubSpot's `0-1`/`0-3` type IDs and polymorphic association table are how you get "activity can
  attach to anything" in SQL without a column per parent type. In `node:sqlite` that is one
  `associations(from_type, from_id, to_type, to_id, label)` table — cheap, and it replaces several
  future nullable-FK migrations.
- Tickets, products and line items are refusable for us with no loss: we have no support function
  and no quoting. Line items in particular carry a whole pricing model.

### Gaps
- Attio's and Folk's *official* API object references were not reachable (fetch failure), so Attio's
  exact attribute type list and Folk's current object set are unverified. Everything on Attio and
  Folk here is third-party.
- Close's object model was not covered by any search result in usable detail; it is a gap.
- HubSpot's full standard-object list beyond the four (e.g. quotes, calls, notes as first-class
  engagement objects) was not retrieved in detail.

---

## Pipeline and forecasting: what is useful at very small scale vs theatre

### Takeaway
Weighted forecasting is arithmetically trivial and statistically invalid at our volume — the method
assumes the law of large numbers and breaks at roughly twenty open deals, which is our likely
steady state across five brands. Stage, stale-deal detection and a required loss reason are worth
building; probability percentages and a weighted forecast number are theatre we should refuse.

### Cited Findings
- **CONFIRMED (method)** The weighted forecast is value × probability per deal, summed: "The CRM
  multiplies value by probability for every deal, then sums the results into a weighted forecast" —
  [Weighted pipeline forecasting](https://www.numigtm.com/blog/weighted-pipeline-forecasting-call-data)
- **CONFIRMED (the key argument against it at our scale)** The averaging behind weighted forecasts
  assumes the law of large numbers, so at around twenty deals "the weighted total can describe an
  outcome that won't happen"; the recommendation is deal-by-deal forecasting with committed /
  likely / possible buckets instead —
  [How to forecast sales when you only have 20 deals](https://siela.in/blog/sales-forecasting-small-teams)
- **CONFIRMED** Default stage probabilities are guesses unless validated; the stated test is to
  export at least four quarters of closed deals (eight where the cycle exceeds 90 days) and compare
  each stage's actual win rate against the configured probability —
  [Sales forecast accuracy: fix the input, not the formula](https://peliqan.io/blog/sales-forecast-accuracy/)
- **CONFIRMED** Stale open deals inflate the forecast, so last-activity and next-action tracking is
  what makes the number non-fictional — it "helps detect opportunities that appear advanced in the
  CRM but are actually stalled" —
  [Why CRM forecasts are often wrong](https://kynetto.com/why-crm-forecasts-are-often-wrong-and-how-to-fix-them/)
- **CONFIRMED** HubSpot deals are the object that "track sales pipeline"; pipelines and stages are
  first-class in Pipedrive's API surface (`pipelines`, `stages` endpoints) —
  [HubSpot standard objects](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-standard-objects),
  [API Evangelist: Pipedrive](https://github.com/api-evangelist/pipedrive)
- **UNCONFIRMED** Won/lost reason capture: the search found no vendor documentation and no concrete
  method. Sources mention reviewing forecast misses for recurring biases but give no field design —
  [Sales forecast accuracy](https://peliqan.io/blog/sales-forecast-accuracy/). A required
  loss-reason picklist on closed-lost is an inference, explicitly flagged as such by the source.

### Inferences
- **Build:** `stage` (ordered enum), `stage_entered_at`, `last_activity_at`, `next_action_at`, and
  `lost_reason` on close. `stage_entered_at` gives velocity and stale detection for free and costs
  one column. This is the genuinely useful 10%.
- **Refuse:** per-stage probability percentages, a weighted forecast figure, forecast categories,
  quota attainment, forecast submission/roll-up. At one operator these produce a number that is
  wrong in a way that *looks* authoritative, which is worse than no number.
- A defensible substitute for a forecast at our scale is a three-bucket list (committed / likely /
  possible) that the operator sets by hand — it is honest about being a judgement call, and it is a
  single enum column, not a forecasting subsystem.
- Velocity reporting (days in stage, stage-to-stage conversion) is only meaningful once we have tens
  of closed opportunities per brand. Ship the timestamps now so the history exists; ship the report
  later.

### Gaps
- No vendor-documented won/lost-reason schema found (field name, whether free text or picklist,
  whether required). Pipedrive and HubSpot both have this in product; the docs were not retrievable.
- No vendor documentation retrieved on HubSpot's forecast object or Pipedrive's revenue-forecast
  report, so I cannot say what fields they expose via API.

---

## Calendar and meeting booking: native booking, round-robin, buffers, reschedule, no-shows

### Takeaway
Native booking is a scheduling-constraint engine (availability windows, buffers, minimum notice,
daily caps, multi-host intersection) plus a public page plus calendar write-back — and the hard part
is not the API, it is being the authoritative source of free/busy. For us, round-robin is
structurally irrelevant (one operator, one calendar), and the right move is a thin Google Calendar
integration for free/busy reads and event writes, with Cal.com as the booking-page layer if a public
page is wanted — not a booking engine of our own.

### Cited Findings
- **CONFIRMED** HubSpot offers three meeting page types: One-on-One, Group, and Round robin, and
  "Group (Sales Hub or Service Hub required)" and "Round robin (Sales Hub or Service Hub required)"
  are paid-tier gated — [HubSpot Meetings: setup, round-robin, limits (2026)](https://www.supered.io/blog/hubspot-meetings/)
- **CONFIRMED (the real constraint model)** Buffers, minimum notice and working hours are set per
  page or per user, and for multi-host pages "a time slot is only offered if it satisfies the rules
  for every host attached to that group meeting link"; per-user daily caps exist — "Maximum meetings
  per day: once a host hits their cap, they are no longer available for additional bookings that
  day" — [HubSpot Meetings guide](https://www.supered.io/blog/hubspot-meetings/)
- **CONFIRMED** Round-robin's purpose is routing: "Instead of routing every booking to one rep, a
  round-robin page shows each teammate's own availability and books the meeting with one of them",
  for inbound demos and SDR-to-AE handoff — [HubSpot Meetings guide](https://www.supered.io/blog/hubspot-meetings/)
- **CONFIRMED (a real failure mode)** Round-robin does not understand leave. A HubSpot Community user
  reported a rep on leave still appearing next in rotation; HubSpot staff replied that with
  "Prioritize contact owner" enabled, "the availability of other users" is suppressed and only the
  owner's is shown, so absence must be handled by a manual toggle —
  [HubSpot Community: round robin when someone on leave](https://community.hubspot.com/t/meeting-scheduler-using-round-robin-allocation-when-someone-on-leave/150725)
- **CONFIRMED** Reschedule/cancel is a per-page toggle that lets the prospect return to the page and
  "cancel or reschedule any events currently on the calendar"; reminder emails can carry the
  reschedule/cancel link — [HubSpot Meetings guide](https://www.supered.io/blog/hubspot-meetings/),
  [Mavlers: reduce no-shows with HubSpot meeting scheduler](https://www.mavlers.com/blog/stop-no-shows-advanced-hubspot-meeting-scheduler-strategies-to-boost-show-rate/)
- **CONFIRMED (no-show is weak even in HubSpot)** "With HubSpot, you can send confirmation emails and
  meeting reminders, but that's about it" — no-show follow-up has to be built as a workflow
  branching on a meeting-outcome property (`outcome = "no-show"` → alert/follow-up) —
  [Mavlers](https://www.mavlers.com/blog/stop-no-shows-advanced-hubspot-meeting-scheduler-strategies-to-boost-show-rate/).
  **UNCONFIRMED:** the exact outcome property name; the source explicitly says to verify it in-portal.
- **CONFIRMED** Cal.com v2 API basics: base URL `https://api.cal.com/v2`, API-key bearer auth, a
  **required `cal-api-version` header**, and main endpoints `/v2/bookings`, `/v2/event-types`,
  `/v2/availability` — [Cal.com API: build custom booking flows](https://blog.elest.io/cal-com-api-build-custom-booking-flows-and-integrate-with-your-stack/)
  (third-party; the official reference pages surfaced but returned only partial content)
- **CONFIRMED (endpoints exist)** `POST /v2/bookings` (create) and `GET` a booking are documented —
  [Cal.com docs: create a booking](https://cal.com/docs/api-reference/v2/bookings/create-a-booking),
  [Cal.com docs: get a booking](https://cal.com/docs/api-reference/v2/bookings/get-a-booking)
- **CONFIRMED (risk, open bug reports)** API-created Cal.com bookings have had both of the failure
  modes that matter to us: (a) round-robin events returning a booking conflict via
  `POST /v2/bookings` even with a free host, where the web UI assigns one correctly —
  [calcom issue #17693](https://github.com/calcom/cal.diy/issues/17693); and (b) bookings created via
  `POST /bookings` appearing on the Cal.com dashboard but **not syncing to the connected Google
  Calendar and not sending confirmation emails**, while the same booking via the public page did —
  [calcom issue #25009](https://github.com/calcom/cal.com/issues/25009). Both are bug reports; #17693
  is marked closed with no resolution shown in results, #25009's status is unknown.
- **CONFIRMED** Cal.com buffers are an event-level setting adding time before and after events
  (default example 30 minutes) — [Cal.com](https://cal.com/). Whether buffers are enforced for
  API-created bookings is **not documented in anything retrieved**.
- **CONFIRMED** Cal.com shipped round-robin fixes and "Round-robin groups", and has announced API V1
  deprecation — [Cal.com v2.5 release notes](https://cal.com/blog/v-2-5),
  [Cal.com v5.6 release notes](https://cal.com/blog/calcom-v5-6)
- **UNCONFIRMED** Chili Piper: no usable documentation was returned by any search in this
  assignment. I have nothing citable on its routing, handoff or no-show behaviour.
- **UNCONFIRMED** No-show handling in the Cal.com API: "None of the results mention no-show handling
  in the API or in booking flows."

### Inferences
- **Our Google Calendar connector path is the right one, and it is narrow.** We need exactly three
  operations: (1) read free/busy to compute slots, (2) create an event with the prospect as
  attendee, (3) detect subsequent updates/cancellations. The available connector tools cover this
  (`list_events`, `suggest_time`, `create_event`, `update_event`, `delete_event`,
  `respond_to_event`). This is a bounded integration, not a project.
- **The hard dependency is authority over free/busy.** If we compute slots from our own `meetings`
  table we will double-book the operator's real calendar. Any slot computation must read the actual
  calendar at request time. That single requirement is why "meetings records only" cannot become
  "booking" without the calendar read.
- **Refuse round-robin outright.** It is multi-host routing. At one operator across five brands the
  analogue is not round-robin but *which brand's branding the invite carries* — a template choice,
  not a routing engine. HubSpot's own leave-handling failure is a good illustration of the
  complexity we would inherit for nothing.
- **Build the constraint model, it is cheap and it is the whole value.** `availability_window`,
  `buffer_before_min`, `buffer_after_min`, `min_notice_min`, `max_per_day`, `slot_duration_min`.
  Six integers and a window table reproduce most of what HubSpot Meetings actually enforces.
- **No-show tracking is ours to build because nobody does it well.** HubSpot's answer is a workflow
  on an outcome property; Cal.com's API apparently has no concept of it. A `meeting.outcome` enum
  (`scheduled`, `held`, `no_show`, `cancelled`, `rescheduled`) plus `rescheduled_from_id` gives us
  show-rate analytics the incumbents treat as a workflow afterthought — and it slots straight into
  our existing analytics and hot-lead surfacing.
- **Cal.com is a buy-vs-build decision with a known defect risk.** If we want a *public* booking page
  with branding per brand, Cal.com event-types give us five pages cheaply. But issue #25009 means we
  must not assume an API-created booking reaches the calendar or the invitee — if we go this route we
  must verify write-back and send our own confirmation. Writing events directly to Google Calendar
  ourselves avoids that class of bug entirely, at the cost of building the public page.

### Gaps
- Chili Piper: nothing citable found. Its distinctive features (inbound concierge routing, instant
  booking from a form, handoff) are undocumented in these results.
- Salesloft's native calendar/booking capability was not retrieved.
- Whether Cal.com enforces buffers and daily limits on API-created bookings — undocumented in
  everything retrieved, and this is exactly the thing that determines whether Cal.com can be trusted
  as the constraint engine.
- Google Calendar API quota/scope requirements for free/busy were not researched (connector is
  already available, so the OAuth work is presumably done — but this is unverified).

---

## Sequence / cadence engines: how they differ from a cold-email tool

### Takeaway
The structural difference is that a cadence engine's steps are **tasks for a human**, not just sends:
email, phone, "other"/manual and integration steps, with the engine owning the due-date queue and the
removal rules. Notably, even Outreach and Salesloft do *not* execute LinkedIn natively on most
plans — LinkedIn is a manual task with a reminder, which means the feature we might feel behind on is
largely a to-do list.

### Cited Findings
- **CONFIRMED** Salesloft cadence step types are enumerated as **Email, Phone, Other, and Integration
  steps** — [Spekit: Salesloft processes enablement template](https://www.spekit.com/templates/salesloft-processes)
  (third-party enablement template, ~732 days old per the source note)
- **CONFIRMED** LinkedIn is not a native step on most plans: "all plans can add 'Other' steps labeled
  as LinkedIn tasks, a manual workaround"; native Sales Navigator integration is limited to Advanced
  and Premier plans and provides "embedded views and direct action links"; the guide recommends
  keeping connection requests manual —
  [Octave: Salesloft + LinkedIn Sales Navigator social touches](https://www.octavehq.com/post/salesloft-linkedin-sales-navigator-social-touches)
- **CONFIRMED** Outreach sequences are time-based and mix automated email with manual tasks for calls
  and social touches; "LinkedIn and social steps remain manual tasks with no in-app execution, so the
  rep gets a reminder, works LinkedIn separately, then marks the step complete" —
  [Unify: multichannel sales sequences compared](https://www.unifygtm.com/explore/multichannel-sales-sequences-platform-comparison)
- **CONFIRMED (mid-flight controls)** Salesloft supports moving a person to a different step, skipping
  a step, and removing a person from the cadence "when they no longer need to continue" —
  [Spekit: Salesloft processes](https://www.spekit.com/templates/salesloft-processes)
- **UNCONFIRMED (but the right default set)** Automatic removal rules on positive reply, booked
  meeting, hard bounce, or explicit opt-out — the source presents these as a *recommendation*, and
  the search summary explicitly flags: "That is a recommendation, not a documented product feature" —
  [Octave: how to build high-converting Salesloft cadences](https://www.octavehq.com/post/how-to-build-high-converting-salesloft-cadences)
- **CONFIRMED** HubSpot sequences are tier-gated and throttled: not in Free, not in Starter, first
  appearing at Professional — [Docket: HubSpot Sales Hub pricing 2026](https://www.docket.io/resources/research/hubspot-sales-hub-pricing)
- **CONFIRMED (caps, single source)** A cap of 500 sequence emails per day per Professional user and
  1,000 per Enterprise user, with 5,000 sequences per account —
  [Docket: HubSpot Sales Hub pricing](https://www.docket.io/resources/research/hubspot-sales-hub-pricing)
- **UNCONFIRMED** A/B testing within sequences, and enrolment rules (automatic enrolment from a saved
  filter/list): no vendor documentation was returned for either, from any vendor.

### Inferences
- **We are closer than the gap list suggests.** Our campaigns with goal/tone/autopilot/budget counters
  plus 12-intent reply classification already give us the two things that matter: scheduled sends and
  automatic exit on reply intent. What we lack is the *task step* — a step that creates a to-do
  instead of a send.
- **Build: a `step_type` enum and a task queue.** `email` | `call` | `linkedin` | `manual` | `wait`.
  Given that Outreach and Salesloft execute LinkedIn as a reminder anyway, our `linkedin` step is
  feature-equivalent to theirs for a fraction of the work — no LinkedIn API, no automation risk, no
  ToS exposure. This is the single highest-leverage item in this whole report: it converts our
  email-only campaign engine into a multichannel cadence engine with one column and one list view.
- **Build: explicit exit criteria as data, not code.** `exit_on_reply_intents` (array of our 12
  intents), `exit_on_meeting_booked`, `exit_on_bounce`, `exit_on_unsubscribe`. We already compute all
  four signals; we just need them declared per campaign rather than hard-coded. Our 12-intent
  classifier makes our exit criteria *finer-grained than theirs*, which is a genuine advantage worth
  surfacing.
- **Refuse: A/B testing inside sequences, at least for now.** With one operator and five brands, per-
  step sample sizes will never reach significance. The honest version is a template library with
  recorded outcomes, not an experiment framework.
- **Worth building, cheaply: enrolment rules.** A saved prospect filter that auto-enrols new matches
  is a few lines on top of our existing search + fit scoring, and it is the difference between a
  campaign and a machine. Hard dependency: our suppression check must run at enrolment *and* at send.

### Gaps
- No official Outreach or Salesloft documentation was retrievable; all cadence findings are
  third-party, and the Salesloft enablement material is ~2 years old with some cited decks from
  2018–19. Step-type lists may have changed.
- A/B testing and enrolment-rule mechanics: no sources found for any vendor. Genuine gap.
- Nothing found on how cadences interact with sending-window/timezone logic, or on per-step throttling.

---

## Reply / inbox handling: shared inbox, assignment, SLA, conversation intelligence

### Takeaway
This section is badly under-sourced and I will not pad it. The one solid, actionable finding is
structural: HubSpot's *ticket* object is the thing that carries assignment and SLA, which means
"shared inbox with SLA" is really "a pipeline on a ticket object" — and at one operator both the
shared-inbox and SLA concepts are definitionally empty.

### Cited Findings
- **CONFIRMED** Tickets are one of HubSpot's four standard objects and "handle support requests",
  created via `POST /crm/v3/objects/tickets` —
  [HubSpot standard objects](https://developers.hubspot.com/blog/a-developers-guide-to-hubspot-crm-objects-standard-objects),
  [HubSpot Tickets guide](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/tickets/guide)
- **CONFIRMED** A deleted HubSpot contact "can still come back through a form submission, **a team
  inbox email**, or an API request" — confirming the team/shared inbox is a first-class contact-
  creating surface in HubSpot, not a side feature —
  [HubSpot KB: how do I perform a GDPR delete](https://knowledge.hubspot.com/privacy-and-consent/how-do-i-perform-a-gdpr-delete-in-hubspot)
- **CONFIRMED** Pipedrive exposes `mail` and `calls` as API resources alongside the CRM objects —
  [API Evangelist: Pipedrive](https://github.com/api-evangelist/pipedrive)
- **CONFIRMED** Close bills call minutes and phone numbers separately from seats —
  [Attio vs Close CRM comparison](https://www.folk.app/articles/attio-vs-close-crm) (vendor-authored
  by a competitor; treat the framing with suspicion, the billing-structure fact is plausible and
  consistent across sources)
- **UNCONFIRMED** Call recording, transcription and conversation intelligence (Gong-style) across any
  of these vendors: **no usable sources found in this assignment.** Nothing on assignment rules, SLA
  timers, or inbox routing from any vendor's documentation.

### Inferences
- **Refuse: shared inbox, assignment, SLA.** Assignment requires ≥2 assignees. SLA requires a
  commitment to a third party and someone to escalate to. At one operator across five brands, both
  are zero-value ceremony. Our existing conversation threads + hot leads already solve the real
  problem (what needs my attention first).
- **Refuse: call recording and transcription.** Hard dependencies we do not have and should not take
  on: telephony (a carrier/number provider), per-jurisdiction two-party consent handling, audio
  storage, and an ASR pipeline. For a Canadian operator this additionally drags in call-recording
  consent law on top of the CASL work already in flight. The cost is wildly out of proportion to one
  operator's call volume.
- **The one thing worth taking from this section** is HubSpot's insight that the inbox *creates
  records*. Our inbox should be able to create a person + consent provenance row from an inbound
  reply, because an inbound reply is itself evidence for consent (see Data hygiene). That is a small
  change with direct CASL value.
- Our 12-intent classification is, on the evidence available, a *more* structured treatment of reply
  handling than anything documented here. This is not a gap; it is a differentiator.

### Gaps
- Conversation intelligence: no sources. Could not assess what Outreach/Salesloft/Close actually
  provide, or whether any of it is API-accessible.
- SLA mechanics, assignment rules, round-robin inbox routing: no sources.
- HubSpot Conversations / Inbox documentation was not retrievable.

---

## Reporting: essential reports and their grain

### Takeaway
I found no vendor documentation enumerating "essential reports", so I will not invent a list. What the
sources do establish is the *grain* that matters and the one grain that is load-bearing: per-stage
actual win rate measured against configured probability, and last-activity recency — both of which
require timestamps we should be writing now even if we never build the report.

### Cited Findings
- **CONFIRMED (grain: per-stage, against history)** The validation report that matters is per-stage
  actual win rate from at least four quarters of closed deals (eight if the cycle exceeds 90 days),
  compared with the configured probability —
  [Peliqan: sales forecast accuracy](https://peliqan.io/blog/sales-forecast-accuracy/)
- **CONFIRMED (grain: per-deal recency)** Last-activity and next-action tracking is what separates a
  real pipeline report from one inflated by stalled deals —
  [Kynetto: why CRM forecasts are often wrong](https://kynetto.com/why-crm-forecasts-are-often-wrong-and-how-to-fix-them/)
- **CONFIRMED (reporting is the tier gate)** HubSpot's free tier excludes "automation, custom
  reporting, and branding removal" — i.e. vendors treat custom reporting as the thing worth charging
  for, which tells you it is where buyers feel pain —
  [Sybill: HubSpot Sales Hub pricing 2026](https://www.sybill.ai/blogs/hubspot-sales-hub-pricing)
- **CONFIRMED (report-to-forecast discipline)** Recommendation to "report a range instead of a single
  number" at small scale — [Siela: forecasting with 20 deals](https://siela.in/blog/sales-forecasting-small-teams)
- **UNCONFIRMED** Per-rep, per-sequence, per-step and per-segment report grains, and revenue
  attribution: **no vendor documentation found.** These grains are named in the assignment but I
  found nothing citable on how any of these platforms implement them.

### Inferences
- **Per-rep grain is void for us** (one rep). That removes the single most common CRM report axis and
  with it most of the reporting surface area these vendors sell.
- **Per-brand replaces per-rep as our primary grain.** This is the genuinely distinctive reporting
  requirement of our system and no vendor here is organised around it (HubSpot's nearest equivalent,
  Business Units, is Marketing Hub Enterprise + paid add-on — see Preference centres). Every report
  we build should be brand-scoped by default, and cross-brand roll-up should be the explicit opt-in.
- **Per-step grain is the one to build** because it is where cadence decisions are actually made
  (which step kills the sequence) and because we already log sends and classified replies. Grain:
  `campaign_id × step_index → sent, delivered, replied, positive_intent, unsubscribed, meeting_booked`.
- **Refuse revenue attribution.** It requires closed-won revenue data we do not have (nothing sends;
  data is generated fiction) and a multi-touch model. Record `opportunity.value` and
  `opportunity.source_campaign_id` so first-touch attribution is computable later from one join; build
  no attribution engine.

### Gaps
- The whole "what reports do they consider essential" question is substantially unanswered. No vendor
  report catalogues were retrievable. The report-writer should treat this section as thin.
- No sources on per-sequence or per-segment reporting in Outreach/Salesloft.

---

## Data hygiene, GDPR/CASL, and consent modelling — **PRIORITY SECTION**

### Takeaway
HubSpot models consent as **two independent things**, and this separation is the proven schema we
should copy: (1) a **lawful basis for processing** the person's data, stored once per contact as a
property; and (2) **per-subscription-type communication consent**, stored per (contact × subscription
type × channel) with its *own* legal basis and a required free-text explanation. The second of these
is the consent-provenance table we are building, and HubSpot's field set —
`subscriberIdString`, `subscriptionId`, `channel`, `statusState`, `legalBasis`,
`legalBasisExplanation` — is directly transplantable. Critically, HubSpot's status is **tri-state**
(`SUBSCRIBED` / `UNSUBSCRIBED` / `NOT_SPECIFIED`) only when data-privacy settings are on, which is
exactly the distinction CASL requires between express consent, withdrawal, and no consent on record.

### Cited Findings — consent / subscription schema

- **CONFIRMED (field set, v4 batch write)** Each item in the `inputs` array carries exactly:
  `channel`, `legalBasis`, `legalBasisExplanation`, `statusState`, `subscriberIdString`,
  `subscriptionId`. The documented sample uses `channel: "EMAIL"`, `legalBasis:
  "CONSENT_WITH_NOTICE"`, `statusState: "NOT_SPECIFIED"` —
  [HubSpot Communication Preferences v4 API guide](https://developers.hubspot.com/docs/api-reference/communication-preferences-subscriptions-v4/guide)
- **CONFIRMED (status enum)** `statusState` is "the opt-in or opt-out state to set, with values
  **`SUBSCRIBED`, `UNSUBSCRIBED`, or `NOT_SPECIFIED`**" —
  [HubSpot Communication Preferences API guide](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide)
- **CONFLICTING (read-side status)** The v3 docs instead describe read-side statuses of `SUBSCRIBED`
  and **`NOT_SUBSCRIBED`** (not `UNSUBSCRIBED`) —
  [HubSpot subscriptions preferences v3 guide](https://developers.hubspot.com/docs/api-reference/legacy/communication-preferences/v3/guide).
  **Design implication: do not assume read enum == write enum. Our own schema should use one enum for
  both.**
- **CONFIRMED (legalBasis enum — the key finding)** The update-subscription endpoint reference lists
  options including: **`LEGITIMATE_INTEREST_PQL`, `LEGITIMATE_INTEREST_CLIENT`,
  `PERFORMANCE_OF_CONTRACT`, `CONSENT_WITH_NOTICE`, `NON_GDPR`, `PROCESS_AND_STORE`,
  `LEGITIMATE_INTEREST_OTHER`** —
  [HubSpot: update a contact's subscription status](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/status/update-subscription).
  Note the word "including" in the source summary — this may not be the complete enum. **Re-verify
  before coding.**
- **CONFIRMED (explanation is mandatory)** "If data privacy settings are turned on, `legalBasis` is
  required along with `legalBasisExplanation`"; `legalBasisExplanation` is free text describing the
  basis, e.g. "Contact provided explicit consent via sign-up form" —
  [HubSpot Communication Preferences API guide](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide)
- **CONFIRMED (tri-state is gated on the privacy setting)** "With GDPR enabled, each subscription type
  has three states (opted in, opted out, or not opted in or out by default). Without it, there are
  two (opted in by default, or opted out)" —
  [How to set up HubSpot subscription types](https://support.makewebbetter.com/hubspot-knowledge-base/how-to-setup-hubspot-subscription-types/)
- **CONFIRMED (danger: null basis defaults to subscribed)** A community report states that if
  `legalBasis` is null, the returned status is the default `SUBSCRIBED` — so a null basis does **not**
  reflect explicit consent —
  [HubSpot Community: inconsistency between API and UI on email subscription status](https://community.hubspot.com/t/inconsistency-between-api-and-ui-regarding-email-subscription-status/134466).
  **UNCONFIRMED** (community post), but a critical design warning: our schema must make
  "no consent record" distinguishable from "consented", and must never default to sendable.
- **CONFIRMED (subscriptionId)** `subscriptionId` is a number, "the internal ID of the subscription
  type"; the full list of subscription IDs is obtained with a GET to the statuses endpoint for a
  subscriber — [HubSpot Communication Preferences API guide](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide)
- **CONFIRMED (current path, dated versioning)** Current docs are on a dated path: single-contact POST
  to `/communication-preferences/2026-03/statuses/{subscriberIdString}`; the 2026-03 sample shows
  only `channel`, `subscriptionId`, `legalBasisExplanation` and **does not show `statusState`** —
  [HubSpot: update a contact's subscription status](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/status/update-subscription).
  **CONFLICTING with the v4 field set above.** Verify against the version actually called.
- **CONFIRMED (separate, distinct field for processing basis)** HubSpot has a *contact property*,
  display name **"Legal basis for processing contact's data"**, to "collect, track, and store legal
  basis of processing via contract, legitimate interest, and/or consent" —
  [HubSpot KB: how can I track lawful basis of processing in HubSpot](https://knowledge.hubspot.com/contacts/how-can-i-track-lawful-basis-of-processing-in-hubspot)
- **CONFIRMED (it is explicitly NOT the same field as subscription legal basis)** "This property
  covers the lawful basis for processing. HubSpot treats communication consent separately through
  subscription types. As for a lawful basis to communicate, that will be done using the new
  subscription types" — [HubSpot GDPR product playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook)
- **CONFLICTING (the property's option list)** HubSpot's KB says there are **six** default options,
  "the first three are different types of legitimate interests" —
  [HubSpot KB](https://knowledge.hubspot.com/contacts/how-can-i-track-lawful-basis-of-processing-in-hubspot).
  One source lists five: legitimate interest (prospect/lead), legitimate interest (existing customer),
  performance of a contract, freely given consent, not applicable —
  [Huble: preparing for GDPR](https://huble.com/blog/preparing-for-gdpr-hubspot-users).
  Another lists six: legitimate interest – prospect, legitimate interest – customer, legitimate
  interest – other, performance of a contract, freely given consent, not applicable —
  [Ascend: HubSpot training, maintaining GDPR compliance](https://www.ascendbusinessgrowth.com/blog/hubspot-training-maintaining-gdpr-compliance).
  The six-option version is consistent with the KB's count and with the API enum's
  PQL/CLIENT/OTHER triplet.
- **UNCONFIRMED** The internal property name. The search explicitly reports: "The search didn't confirm
  the internal name `hs_legal_basis`." **Do not use `hs_legal_basis` in code on the strength of this
  document.**
- **CONFIRMED (HubSpot offers 6 bases, grouped in 3 families)** "In HubSpot we ask customers to choose
  from 6 types of legal basis that cover Consent, Performance of a Contract, and Legitimate Interest.
  There may be more than one legal basis that fits each situation" —
  [HubSpot GDPR product playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook)
- **CONFIRMED (examples of basis selection)** Performance of a contract: "if a contact is your
  customer, you can email them a bill." Legitimate interest – Lead: "processing data from a prospect
  or lead to communicate about potential business, such as a prospect's name and email after they've
  signed up to receive a newsletter." On legitimate interest generally: you need to "be confident to
  take on the responsibility for protecting the interests of the individual" —
  [HubSpot GDPR playbook](https://www.hubspot.com/data-privacy/gdpr/hubspot-product-playbook),
  [HubSpot KB on lawful basis](https://knowledge.hubspot.com/contacts/how-can-i-track-lawful-basis-of-processing-in-hubspot)
- **CONFIRMED (forms carry consent at capture time)** HubSpot forms carry a `legalConsentOptions`
  structure alongside `subscriptionTypeId`, i.e. consent is captured at the point of form submission
  rather than set afterwards —
  [HubSpot Community: updating legalConsentOptions / subscriptionTypeId](https://community.hubspot.com/t/how-do-you-update-legalconsentoptions-or-subscriptiontypeid-when-updating-a-contact-properties/73956)
  (community thread; the existence of the `legalConsentOptions` object is **CONFIRMED** by its use in
  the thread, its internal sub-fields are **UNCONFIRMED**)

### Cited Findings — CASL specifically

- **CONFIRMED (the operative deadline)** Opt-outs must be honoured within **10 business days** —
  [Sender: CASL compliance guide 2026](https://www.sender.net/blog/casl-compliance/),
  [SendCheckIt: CASL compliance guide](https://sendcheckit.com/blog/casl-compliance-guide)
- **CONFIRMED** The unsubscribe mechanism must remain functional for at least **60 days** after the
  message is sent — [Sender: CASL compliance](https://www.sender.net/blog/casl-compliance/)
- **CONFIRMED** Implied consent in business circumstances **expires after 24 months**; an inquiry
  (e.g. a business card) gives a shorter window, cited as **6 months** —
  [QuickCasa: CASL implied consent, when permission expires](https://quickcasa.ai/news/casl-implied-consent-when-permission-to-email-a-lead-expires),
  [Litmus: CASL debunked](https://www.litmus.com/blog/casl-debunked-everything-you-need-to-know-about-canadas-anti-spam-law-in-2017)
- **CONFIRMED** Express consent does **not** expire on a schedule —
  [SendCheckIt: CASL compliance guide](https://sendcheckit.com/blog/casl-compliance-guide)
- **CONFLICTING / CORRECTION TO OUR ASSUMPTION** On record retention, multiple sources say **three
  years**, and one specifies "3 years after the business relationship ends". **No source described a
  two-year retention rule.** The 24-month figure is the *implied consent validity window*, not the
  records-retention period — these are two different clocks and our schema must keep them separate —
  [SenderReputation: CASL compliance guide](https://senderreputation.org/blog/casl-compliance-canada-anti-spam-law-guide),
  [BillionVerify: CASL compliance guide](https://billionverify.com/blog/casl-compliance-guide)
- **All CASL findings are from vendor/deliverability blogs, not the statute or CRTC guidance.** The
  search summary flags this explicitly and recommends checking the official CASL text and CRTC
  guidance, "especially the retention period and the implied-consent durations." **Treat the 3-year
  retention and 6-month inquiry window as UNCONFIRMED pending a read of the CRTC source.**

### Cited Findings — dedupe, merge, deletion, audit, retention

- **CONFIRMED (deletion semantics worth copying)** A HubSpot GDPR permanent delete "removes the
  contact's personal data", and a **blocklist** then stops that email being re-added through the UI or
  an import. The contact can still return via a form submission, a team inbox email, or an API
  request. Anonymised analytics remain. Requests "should be attended to within 30 days" —
  [HubSpot KB: how do I perform a GDPR delete](https://knowledge.hubspot.com/privacy-and-consent/how-do-i-perform-a-gdpr-delete-in-hubspot)
- **CONFIRMED (deletion unlinks rather than cascades)** The GDPR delete "will delete the contact
  record and any associations between the contact record and other CRM objects" — associated
  companies and notes are **kept, just unlinked** —
  [HubSpot changelog: GDPR deletion endpoints for the CRM Contact Object API](https://developers.hubspot.com/changelog/gdpr-deletion)
- **CONFIRMED** There are dedicated GDPR-deletion endpoints on the Contact object, distinct from
  ordinary delete — [HubSpot changelog: GDPR deletion](https://developers.hubspot.com/changelog/gdpr-deletion)
- **CONFIRMED (merge and delete surface via webhooks)** A `contact.deleted` event is sent "for GDPR
  deletions or merges when using webhooks on a Private App", while standard API endpoints do not
  emit deletion events; the suggested workaround for detecting merges is diffing periodic ID
  snapshots — [HubSpot Community: record deletions and warehousing considerations](https://community.hubspot.com/t5/128172-RevOps-Discussions/Record-Deletions-and-warehousing-considerations/m-p/1108094)
  (community thread — **UNCONFIRMED** but a useful warning that merge is a destructive event an
  integration must handle)
- **CONFIRMED (gaps even in HubSpot)** "There currently is not a GDPR compliant bulk-delete feature in
  HubSpot", requiring one-at-a-time deletion —
  [HubSpot Community: deleting mass contacts](https://community.hubspot.com/t5/GDPR/Deleting-Mass-Contacts/m-p/540611);
  and "it is not possible to generate a log / protocol of the regular deletion of contacts" —
  [HubSpot Ideas: export deletion protocol / deletion log](https://community.hubspot.com/t5/HubSpot-Ideas/Export-deletion-protocol-deletion-log-for-deleted-records/idi-p/865491).
  Both are community posts (**UNCONFIRMED**, and possibly dated).
- **UNCONFIRMED / CONTRADICTED** Generic blog claims that "HubSpot keeps detailed logs of all actions
  taken within the CRM" are **not supported by HubSpot's own documentation** in these results, and the
  search flagged them as needing verification —
  [Clevyr: is HubSpot GDPR compliant](https://clevyr.com/blog/post/is-hubspot-gdpr-compliant)
- **UNCONFIRMED** Dedupe/merge *rules* (match keys, survivorship, required fields, validation,
  enrichment-on-create): **no vendor documentation found for any platform.** Genuine gap.
- **CONFIRMED (role allocation)** HubSpot is the processor; the customer selects the legal basis.
  "HubSpot cannot be 'GDPR certified' on your behalf. It can only give you controls that make meeting
  your obligations easier" — [HubSpot data privacy glossary](https://www.hubspot.com/data-privacy/gdpr-glossary)

### Inferences
- **The single most important structural lesson: two separate consent concepts, not one.** HubSpot's
  own playbook says so explicitly. Our schema must therefore have both (a) a per-person
  `processing_basis` (why we may hold this data at all) and (b) a per-(person × brand × channel ×
  purpose) `consent` row (why we may send this message). Collapsing them into one "consented" boolean
  is the mistake that makes a CASL audit unanswerable.
- **`legalBasisExplanation` being *required* is the design insight to steal.** A free-text, mandatory
  provenance string alongside the enum is what turns a consent flag into consent *provenance*. CASL
  enforcement asks "prove consent", and an enum alone cannot answer. We should make ours required and
  structured-ish (source URL / form id / message id / verbatim wording shown).
- **CASL needs one field HubSpot's schema does not have: an expiry.** Implied consent expires at 24
  months (6 for an inquiry); express consent does not. HubSpot's model has no expiry concept because
  GDPR consent does not time out this way. So our schema needs `consent_expires_at` (nullable; null =
  express/no expiry) and a sweep that flips status to expired. **This is the one place we must extend
  beyond HubSpot's schema rather than copy it.**
- **Three distinct clocks must be stored separately or we will conflate them:** consent validity
  (24 months implied), unsubscribe honouring deadline (10 business days — and we should target
  immediate), and records retention (3 years, unconfirmed). Separate columns, separate jobs.
- **Deletion must unlink, not cascade, and must leave a tombstone.** HubSpot's approach — delete the
  personal data, keep the associated objects unlinked, keep anonymised analytics, and maintain a
  **blocklist so the address cannot be re-imported** — is directly implementable in SQLite and solves
  the re-import hole that otherwise silently resurrects a deleted person. The blocklist is the piece
  most people miss; our org-wide suppression table is already most of the way there and should be
  extended to carry a `reason = 'erasure_request'` tombstone that survives the person row's deletion.
- **HubSpot's own weaknesses are our cheap wins.** No bulk GDPR delete, no deletion log, no documented
  action audit log. An append-only `audit_log` table in SQLite is trivial for us and is a hard CASL/
  PIPEDA asset. We should build it, and we should build it as append-only (no UPDATE/DELETE) so it is
  evidentially useful.
- **Merge is a destructive event with integration consequences.** HubSpot only surfaces merges as a
  `contact.deleted` webhook on a private app. If we ever sync, we must handle "the ID I hold no longer
  exists because it was merged." For our own merge, keep a `merged_into_id` redirect row rather than
  hard-deleting, so old IDs in campaign history still resolve.
- **Refuse: enrichment-on-create, required-field enforcement engines, validation rule builders.** With
  generated fiction data and one operator, these are configuration surfaces with no user.
- **Build, minimal: dedupe on normalised email as a UNIQUE index, plus a manual merge with
  `merged_into_id`.** Normalised email (lowercase, trim; consider Gmail dot/plus normalisation
  deliberately *not* applied, since that changes identity) is the only match key worth having at our
  scale. Hard dependency: our brand scoping means the UNIQUE must be on the *person*, not per brand —
  one human, five brand relationships. Getting this wrong creates five consent records that disagree.

### Gaps
- **The complete `legalBasis` enum is not verified** — the source summary says "options including",
  and a HubSpot SDK's allowable-values list was recommended as the authoritative check. Before coding,
  read the live endpoint reference or inspect an SDK enum.
- **The internal name of the lawful-basis contact property is unknown.** `hs_legal_basis` is unverified.
- **The exact option values of that property conflict** (five vs six; different labels).
- **Whether the 2026-03 single-contact POST still accepts `statusState`** is unresolved and the docs
  sample conflicts with v4.
- **CASL primary sources were never read.** No CRTC guidance, no statute text. The retention period
  (3 years) and inquiry window (6 months) rest entirely on vendor blogs. **This must be closed before
  the retention job is written.**
- **No dedupe/merge/survivorship documentation for any vendor.**
- **Nothing retrieved on data-subject access (export) requests** as a product feature — only deletion.
- **Nothing retrieved on HubSpot's actual audit-log product**, so the "they don't have one" inference
  rests on community posts and absence of evidence.

---

## Preference centres and unsubscribe (RFC 8058, global vs per-brand) — **PRIORITY SECTION**

### Takeaway
RFC 8058 is small, fully specified, and we can implement it correctly in an afternoon — two headers,
a DKIM requirement over those headers, an HTTPS POST endpoint with **no redirect**, and the URI
itself must carry enough to identify recipient and list. The harder finding is strategic: **HubSpot's
multi-brand preference story is genuinely broken** — subscription types can be scoped to business
units only on Marketing Hub Enterprise plus a paid add-on, several default types cannot be scoped at
all, and users report one preference page per account. Our five-brand requirement is a real gap in the
market leader, which means per-brand subscription scoping is a feature we should build *properly from
day one* rather than copy.

### Cited Findings — RFC 8058
- **CONFIRMED (headers)** The sender includes both `List-Unsubscribe` and `List-Unsubscribe-Post`. The
  `List-Unsubscribe` header needs **one HTTPS URI** and may also carry others such as `mailto`. The
  `List-Unsubscribe-Post` header **must contain only the key/value pair
  `List-Unsubscribe=One-Click`** — [RFC 8058](https://rfc-editor.org/rfc/rfc8058)
- **CONFIRMED (DKIM)** The message needs a valid DKIM signature **covering at least the
  `List-Unsubscribe` and `List-Unsubscribe-Post` headers** — [RFC 8058](https://rfc-editor.org/rfc/rfc8058)
- **CONFIRMED (URI content)** The URI must carry enough information to identify **the recipient and
  the list**, so the unsubscribe completes automatically —
  [RFC 8058 inline errata](https://www.rfc-editor.org/rfc/inline-errata/rfc8058.html)
- **CONFIRMED (no redirect)** The sender **must not** use an HTTPS redirect, "because redirected POSTs
  have historically been unreliable and browsers often convert them to GETs" —
  [RFC 8058](https://rfc-editor.org/rfc/rfc8058)
- **CONFIRMED (no credentials)** The POST **must not** include cookies, HTTP authorization, or other
  context — [RFC 8058 inline errata](https://www.rfc-editor.org/rfc/inline-errata/rfc8058.html)
- **CONFIRMED (receiver side)** The receiver performs an HTTPS POST to the `List-Unsubscribe` URI,
  sending the `List-Unsubscribe-Post` value as the request body —
  [RFC 8058](https://rfc-editor.org/rfc/rfc8058)
- **CONFIRMED (provenance)** RFC 8058 is Standards Track, January 2017, by J. Levine and T. Herkula —
  [RFC 8058](https://rfc-editor.org/rfc/rfc8058). An errata page with verified corrections exists —
  [inline errata](https://www.rfc-editor.org/rfc/inline-errata/rfc8058.html)
- **CONFIRMED (enforcement context)** Gmail's requirement applies to senders above **5,000 messages a
  day** to Gmail accounts, effective **1 February 2024** —
  [Palisade: one-click unsubscribe law](https://www.palisade.email/learning/one-click-unsubscribe-law);
  the expected processing window is cited as **48 hours**, tied to Google and Yahoo's 2024 bulk-sender
  requirements — [Customer.io: custom unsubscribe links and RFC 8058](https://docs.customer.io/messaging/channels/email/deliverability/custom-unsubscribe-links/)
- Note: the RFC text itself was **not fetchable** (DNS failure on `www.rfc-editor.org`); the above is
  the search index quoting the RFC. The normative text should be read before implementation —
  it is short and the errata matter.

### Cited Findings — preference centres and per-brand scoping
- **CONFIRMED (the scoping exists but is heavily gated)** With Marketing Hub Enterprise **and** the
  Business Units add-on, subscription types can be associated with specific business units, selected
  via a "Current View" dropdown —
  [How to set up HubSpot subscription types](https://support.makewebbetter.com/hubspot-knowledge-base/how-to-setup-hubspot-subscription-types/)
- **CONFIRMED (default types cannot be scoped)** Default subscription types — one-to-one emails,
  customer service communication emails, transactional emails — **cannot** be associated with business
  units; the "One-to-one" default is tied to the account brand —
  [HubSpot Ideas: allow different preference pages per business unit](https://community.hubspot.com/t5/HubSpot-Ideas/Allow-different-preference-pages-per-business-unit/idi-p/901502)
- **CONFIRMED (opt-out scope leaks)** Contacts imported in an opt-out list or manually opted out "will
  only be opted out of the Account business unit" —
  [HubSpot Ideas](https://community.hubspot.com/t5/HubSpot-Ideas/Allow-different-preference-pages-per-business-unit/idi-p/901502)
- **CONFIRMED (one preference page per account)** Users report HubSpot "only allows you to use one
  preference page per account and this can only be a HubSpot default page", that customising default
  types per brand "isn't available at this time", and that per-unit pages require Design Manager work
  described as complicated —
  [HubSpot Community: marketing emails / subscription preferences with business units](https://community.hubspot.com/t5/Email-Marketing-Tool/Marketing-Emails-Subscription-Preferences-with-Business-Units/m-p/1217891),
  [HubSpot Ideas: make subscription preferences pages editable for business units](https://community.hubspot.com/t/make-subscription-preferences-pages-editable-for-business-units/88016),
  [HubSpot Community: subscription preference page for different business unit](https://community.hubspot.com/t/subscription-preference-page-for-different-business-unit/51926/3)
- **CONFIRMED (business unit IDs in the API; default brand is 0)** HubSpot's Communication Preferences
  API accepts business unit IDs for batch opt-outs, and the default Account brand always uses **ID 0** —
  [HubSpot Communication Preferences API guide](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide)
- **CONFIRMED (subscription types are the consent structure)** "The subscription types in HubSpot
  precisely structure the contact's consent to communicate" —
  [How to set up HubSpot subscription types](https://support.makewebbetter.com/hubspot-knowledge-base/how-to-setup-hubspot-subscription-types/);
  see also [Fuelius: how to manage subscription types in HubSpot](https://www.fuelius.com/blog/how-to-manage-subscription-types-in-hubspot)
- **CONFIRMED (global unsubscribe exists as a distinct operation)** A documented
  "batch unsubscribe all" endpoint exists, separate from per-type status writes —
  [HubSpot v4: batch unsubscribe contacts from all subscriptions](https://developers.hubspot.de/docs/api-reference/communication-preferences-subscriptions-v4/subscription-status/post-communication-preferences-v4-statuses-batch-unsubscribe-all)
- **Caveat flagged by the search itself:** several of the business-unit sources are community posts
  roughly 1–4 years old and "the restrictions may have changed"; no current HubSpot KB statement
  confirming the present state was found. Treat the per-brand limitations as **CONFLICTING/dated**.

### Inferences
- **RFC 8058 is table stakes and cheap for us — build it now.** Our stack needs: a signed,
  non-guessable token in the URI encoding (person, brand, subscription type, message), a `POST`-only
  route on `node:http` that performs the unsubscribe without auth and without redirect, and the two
  headers emitted at send time. The one **hard dependency we cannot satisfy ourselves is DKIM**: the
  signature must cover both headers, and that is a property of the sending infrastructure. Since
  nothing currently sends, this is a constraint to write into the sender spec now rather than a
  blocker today. Flag it loudly: **if the eventual ESP does not sign those two headers, our RFC 8058
  compliance is void regardless of our code.**
- **The "no redirect, no cookies, no auth" rules have an architectural consequence**: the unsubscribe
  endpoint cannot live behind our session-cookie auth and cannot be a SPA route. It must be a plain
  unauthenticated POST handler. Worth noting because our front end is vanilla JS and the temptation
  would be to make it a page.
- **Also build the GET**, for the human who clicks a link in the body: GET renders the preference
  centre, POST to the same URI does the one-click. Both must work; the RFC governs only the POST.
- **Three-level subscription model is required for five brands:** global suppression (never contact,
  any brand — we have this) → per-brand subscription → per-purpose subscription type within brand.
  HubSpot's leaked opt-out scope ("only opted out of the Account business unit") is precisely the bug
  we must avoid: an unsubscribe must have an explicit, stored scope, and the default for an
  RFC 8058 one-click should be **the brand + type the message came from**, with a prominent "opt out
  of everything" on the preference page.
- **Our org-wide suppression table is the right foundation and we should keep it authoritative.** It
  must be consulted at enrolment *and* at send, and it must win over any per-brand subscription row.
- **Honouring window: do it synchronously.** CASL allows 10 business days and Google expects 48 hours;
  with SQLite and no queue we can simply write the suppression row inside the POST handler. There is
  no reason to build a window at all — but we should still *record* `honoured_at` to prove the
  interval was zero.
- **Refuse: a preference-centre page builder, per-brand template design surfaces, Design-Manager-style
  customisation.** One operator, five brands: five hard-coded templates parameterised by brand is
  correct, and HubSpot's community pain shows what the alternative costs.
- **Transactional must be a non-subscribable type.** HubSpot treats transactional and
  service-communication types as defaults that cannot be opted out of per-brand. We need the same
  concept: a `purpose = 'transactional'` that bypasses marketing consent but still respects global
  suppression for erasure requests.

### Gaps
- The RFC's normative text and its errata were not read directly (fetch failure). Specifically
  unverified: the exact ABNF of `List-Unsubscribe-Post`, and what response status/body the endpoint
  should return (the search gave no response-behaviour requirement).
- No current HubSpot KB confirmation of the present business-unit/preference-page limitations; the
  evidence is dated community posts.
- HubSpot's subscription-type *definition* object (what fields a subscription type itself has — name,
  internal name, description, purpose, channel, business unit, opt-in-by-default) was not retrieved.
  We have the *status* schema but not the *type* schema. This is a real gap for our build.
- Nothing retrieved on how Outreach, Salesloft, Close, Attio or Folk implement unsubscribe or
  preference centres at all.

---

## Pricing and real cost at 1–3 seats (figures as of October 2026)

### Takeaway
At one seat the only genuinely free option with a real object model is **Attio's free plan (up to 3
seats)**; HubSpot's free CRM exists but excludes sequences, automation and custom reporting, which is
most of what we would want it for. Realistically, buying parity with what we already have costs
$15–35/seat/month at the floor and $90–150/seat/month for the sequence tier — which is the strongest
argument for building the narrow pieces ourselves.

### Cited Findings
- **CONFIRMED** Attio has a free plan covering **up to three seats** —
  [Attio CRM pricing 2026](https://marketbetter.ai/blog/attio-crm-pricing-breakdown-2026/)
- **CONFIRMED (dated, with a stated price event)** After a **July 2026 price increase**, Attio paid
  plans are **Plus $35/seat/month and Pro $79/seat/month billed annually**, or **$44 and $99 billed
  monthly** — [Attio CRM pricing 2026](https://marketbetter.ai/blog/attio-crm-pricing-breakdown-2026/),
  corroborated by [Coworker: Attio pricing](https://coworker.ai/blog/attio-pricing)
- **CONFLICTING** Lower Attio figures of **$29 / $69** appear in other 2026 posts and "likely predate
  the increase" — [novlini](https://novlini.io/blog/how-to-model-complex-data-in-attio-with-custom-objects-and-relationships)
- **CONFIRMED** Close: **Essentials from $35/user/month, Growth from $99, Scale from $139**, annual
  billing; **call minutes and phone numbers billed separately**; **no free tier** —
  [Attio vs Close CRM](https://www.folk.app/articles/attio-vs-close-crm) (competitor-authored),
  [G2: Attio vs Close](https://www.g2.com/compare/attio-vs-close)
- **CONFLICTING** A **$9 Solo tier** for Close appears in some sources but not others —
  [Attio vs Close CRM](https://www.folk.app/articles/attio-vs-close-crm)
- **CONFIRMED** Folk: **Standard $24, Premium $48, Custom/Enterprise $80** per user/month annual; **no
  free tier published**, two-week trial instead —
  [Attio vs Folk](https://www.breakcold.com/blog/attio-vs-folk)
- **CONFLICTING** Older Folk figures of **$20 / $40** for Standard and Premium —
  [Attio vs Folk 2026](https://tomba.io/blog/attio-vs-folk)
- **CONFIRMED** Pipedrive has **no free plan, only a 14-day trial** —
  [Pipedrive alternatives 2026](https://www.getcreator.io/learn/pipedrive-alternatives-in-2026-6-better-options-compared)
- **CONFLICTING** Pipedrive tier prices: one source gives **Lite $14, Premium $59, Ultimate $79**;
  others give **Growth $39** or **Growth $49** per seat —
  [Attio: Pipedrive alternatives](https://attio.com/f/pipedrive-crm-alternatives),
  [Attio vs Pipedrive](https://www.automationjinn.com/blog/attio-vs-pipedrive),
  [Pipedrive vs Attio](https://www.folk.app/articles/pipedrive-vs-attio)
- **CONFIRMED** HubSpot Sales Hub **Starter $15/seat/month annual, $20 monthly** —
  [Docket: HubSpot Sales Hub pricing 2026](https://www.docket.io/resources/research/hubspot-sales-hub-pricing).
  **CONFLICTING:** one source lists $9 —
  [Clarify: HubSpot CRM pricing](https://www.clarify.ai/blog/hubspot-crm-pricing)
- **CONFIRMED** Sales Hub **Professional $90/seat/month annual ($100 monthly) plus a required one-time
  $1,500 onboarding fee**; **Enterprise $150/seat/month**; onboarding listed as **$3,500** in one
  source and **$3,000** in another —
  [Docket](https://www.docket.io/resources/research/hubspot-sales-hub-pricing),
  [Sybill: HubSpot Sales Hub pricing 2026](https://www.sybill.ai/blogs/hubspot-sales-hub-pricing)
- **CONFIRMED** **Sequences start at Professional** — excluded from both Free and Starter —
  [Docket](https://www.docket.io/resources/research/hubspot-sales-hub-pricing)
- **CONFLICTING (free tier user cap)** One source: HubSpot free CRM covers **up to 2 users**, excluding
  automation, custom reporting and branding removal —
  [Sybill](https://www.sybill.ai/blogs/hubspot-sales-hub-pricing); another: "Free = $0 (unlimited
  users, basic features)" — [mo.agency: HubSpot pricing 2026](https://www.mo.agency/blog/hubspot-pricing)
- **All pricing above is from secondary blogs, not vendor pricing pages** (fetch failure). The search
  summaries flagged this directly. Several of these sources are competitor-authored (folk.app on
  Close and Pipedrive; attio.com on Pipedrive), which is a conflict of interest on the comparative
  framing though less so on the raw numbers.

### Inferences
- **Multi-brand makes per-seat pricing misleading in our favour.** We are one seat, so even
  Professional-tier HubSpot at $90/month is not ruinous in absolute terms. But the features we would
  be buying it *for* (sequences) we already have, and the feature we actually need (per-brand
  subscription scoping) is the Enterprise + add-on tier. **The thing we most need is the most
  expensive thing on the price list**, which is a strong build signal.
- **Attio's free 3-seat tier is the right benchmark to measure ourselves against**, and the honest
  read is that it would give us a better object model than we have today for $0 — but no sequences,
  no consent provenance, and no per-brand subscription model.
- **Close's separate billing for call minutes** confirms the earlier judgement that telephony is a
  cost centre we should not enter.
- Pricing conflicts here are wide enough (Pipedrive Growth $39 vs $49; Attio $29 vs $35) that no
  procurement decision should rest on this file. Re-check vendor pages.

### Gaps
- **No vendor pricing page was read.** Every figure is secondary. Date-stamped "2026" blogs disagree,
  and Attio's own July 2026 increase shows these move within the year.
- Outreach and Salesloft pricing: **no figures found at all.** Both are known to be quote-based with
  platform fees, but I have nothing citable.
- Cal.com pricing: not retrieved.

---

## API and integration: two-way sync vs building our own pipeline

### Takeaway
A thin two-way sync is technically well-supported — Pipedrive's webhooks (`event_action` ×
`event_object`, with wildcards) and HubSpot's object + association APIs are both adequate — but both
have a documented hole in exactly the place that matters for consent: **deletions and merges are not
reliably delivered over standard endpoints**. For a one-person operation whose distinctive asset is
consent provenance, a sync would import a liability without removing work.

### Cited Findings
- **CONFIRMED** Pipedrive webhooks push rather than poll: "Instead of pulling information via our API,
  webhooks will push information to your endpoint", created via the web app or
  `POST` to the webhooks endpoint, delivered as JSON over HTTP —
  [Pipedrive Webhooks API](https://developers.pipedrive.com/docs/api/v1/Webhooks)
- **CONFIRMED (subscription model)** "Specifying an event which triggers the Webhook combines 2
  parameters - `event_action` and `event_object`", with a wildcard matching everything; supported
  object types are **activity, deal, lead, note, organization, person, pipeline, product** —
  [Pipedrive Webhooks API](https://developers.pipedrive.com/docs/api/v1/Webhooks)
- **CONFIRMED** Pipedrive auth is an **API token (query parameter or header) or OAuth 2.0
  authorization-code flow** — [Pipedrive: core API concepts](https://pipedrive.readme.io/docs/core-api-concepts-about-pipedrive-api)
- **CONFIRMED (versioning in flux)** Pipedrive is migrating to v2; Activities, Deals, Organizations,
  Persons, Search and several Fields/Followers endpoints are v2, while leads endpoints appear in both,
  with lead→deal conversion listed under v2 —
  [Pipedrive API v2 overview](https://pipedrive.readme.io/docs/pipedrive-api-v2)
- **CONFIRMED** HubSpot search is versioned on a dated path (e.g. `/crm/objects/2026-09/...`), and
  communication preferences on `2026-03` — i.e. HubSpot now ships dated API versions, so an
  integration pins a date —
  [HubSpot CRM Search API](https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm),
  [HubSpot: update subscription status](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/status/update-subscription)
- **CONFIRMED (the sync hole)** HubSpot "doesn't send deletion events via standard API endpoints"; a
  `contact.deleted` event is sent for GDPR deletions or merges **only when using webhooks on a Private
  App**; the fallback is diffing periodic ID snapshots —
  [HubSpot Community: record deletions and warehousing](https://community.hubspot.com/t5/128172-RevOps-Discussions/Record-Deletions-and-warehousing-considerations/m-p/1108094)
  (community thread, **UNCONFIRMED**)
- **CONFIRMED** HubSpot batch endpoints exist for subscription status (batch write, batch
  unsubscribe-all), and accept business unit IDs —
  [HubSpot v4 batch write](https://developers.hubspot.jp/docs/api-reference/communication-preferences-subscriptions-v4/subscription-status/post-communication-preferences-v4-statuses-batch-write),
  [HubSpot v4 batch unsubscribe-all](https://developers.hubspot.de/docs/api-reference/communication-preferences-subscriptions-v4/subscription-status/post-communication-preferences-v4-statuses-batch-unsubscribe-all)
- **CONFIRMED** An official-ish generated SDK surface exists for the subscriptions API, useful for
  reading allowable enum values —
  [Ballerina Central: hubspot.marketing.subscriptions](https://central.ballerina.io/ballerinax/hubspot.marketing.subscriptions/latest)
- **UNCONFIRMED (flagged as inference by the source)** "A common pattern is to combine webhooks for
  real-time changes with periodic API reads to reconcile missed events" —
  [Pipedrive API review](https://pipeline.zoominfo.com/sales/pipedrive-api)-adjacent summary; the
  search explicitly noted this as its own inference, not documentation.

### Inferences
- **A thin sync does not beat building our own object model, for one specific reason: consent.** Our
  differentiator is per-contact consent provenance for CASL. If subscription state lives in HubSpot
  and sending lives in our system, we have two sources of truth for the one fact we must be able to
  prove in an audit — and HubSpot's documented null-`legalBasis`-defaults-to-SUBSCRIBED behaviour
  means the remote copy can silently assert consent we never collected. **Consent must be local and
  authoritative.**
- **The deletion/merge hole compounds this.** Erasure requests and merges are precisely the events a
  consent store cannot afford to miss, and both platforms deliver them worst. An ID-diffing
  reconciliation job is not something a one-person operation should be maintaining.
- **What a sync *is* good for, if ever wanted: export, not sync.** One-directional push of
  opportunities and activities out to a CRM the operator already pays for. Our existing CSV export
  plus webhooks already covers this at near-zero cost, and Pipedrive's `person` / `deal` /
  `activity` objects map cleanly onto the minimum model below.
- **Design lessons worth copying into our own 24 REST endpoints:** (1) dated API versioning rather
  than `v1/v2` — HubSpot's `2026-03` style is cheap and removes a future migration argument;
  (2) `event_action` × `event_object` as the webhook subscription shape, which generalises our
  existing webhooks without new tables; (3) batch endpoints for the consent writes specifically, since
  bulk opt-out is a real operation (list imports, erasure sweeps).
- **Hard dependency note:** we are zero-dependency (`node:http`, `node:sqlite`). Any OAuth 2.0
  integration means implementing the authorization-code flow and token refresh by hand. API-token auth
  (Pipedrive supports it) is the only integration path that does not compromise that constraint.
  This is a further argument for export-over-sync.

### Gaps
- HubSpot's rate limits, and Pipedrive's, were not retrieved. Relevant to any sync design.
- Whether HubSpot's Private App webhooks can be created without OAuth was not established.
- Attio's and Folk's APIs: nothing retrieved.
- No source found on bidirectional-sync conflict resolution in any vendor's docs.

---

## Judgement: table stakes / worth building / refuse

### Takeaway
Only four things are genuinely table stakes for going live, and three of them are consent machinery.
The large CRM features we "lack" — pipeline forecasting, round-robin, shared inbox, tickets, call
recording — are either void at one seat or carry hard dependencies we should not take on. The
expensive-looking gap that is actually cheap is the step-type enum; the cheap-looking gap that is
actually expensive is calendar authority.

### Cited Findings
(Judgements below rest on the findings already cited above; the load-bearing ones are repeated here.)
- **CONFIRMED** Weighted forecasting's assumption breaks at ~20 deals —
  [Siela](https://siela.in/blog/sales-forecasting-small-teams)
- **CONFIRMED** LinkedIn steps in Outreach and Salesloft are manual tasks with no in-app execution —
  [Unify](https://www.unifygtm.com/explore/multichannel-sales-sequences-platform-comparison),
  [Octave](https://www.octavehq.com/post/salesloft-linkedin-sales-navigator-social-touches)
- **CONFIRMED** HubSpot requires GDPR settings on for tri-state subscription status —
  [makewebbetter](https://support.makewebbetter.com/hubspot-knowledge-base/how-to-setup-hubspot-subscription-types/)
- **CONFIRMED** `legalBasis` + `legalBasisExplanation` are both required when privacy settings are on —
  [HubSpot Communication Preferences guide](https://developers.hubspot.com/docs/api-reference/latest/communication-preferences/guide)
- **CONFIRMED** RFC 8058 requires DKIM over the two unsubscribe headers and forbids redirects —
  [RFC 8058](https://rfc-editor.org/rfc/rfc8058)
- **CONFIRMED** CASL: 10 business days to honour, 60-day minimum mechanism life, 24-month implied
  consent expiry — [Sender](https://www.sender.net/blog/casl-compliance/),
  [QuickCasa](https://quickcasa.ai/news/casl-implied-consent-when-permission-to-email-a-lead-expires)
- **CONFIRMED** Multi-brand subscription scoping in HubSpot needs Marketing Hub Enterprise + Business
  Units add-on, and preference pages remain one-per-account —
  [makewebbetter](https://support.makewebbetter.com/hubspot-knowledge-base/how-to-setup-hubspot-subscription-types/),
  [HubSpot Community](https://community.hubspot.com/t5/Email-Marketing-Tool/Marketing-Emails-Subscription-Preferences-with-Business-Units/m-p/1217891)

### Inferences — the verdict table

| Feature | Verdict | Why / stack fit | Hard dependencies |
|---|---|---|---|
| Consent provenance table (per person × brand × channel × purpose, with basis + explanation) | **(a) Table stakes** | CASL exposure is live the moment anything sends; HubSpot's schema is proven and copyable | None — pure `node:sqlite` |
| RFC 8058 one-click unsubscribe + preference centre | **(a) Table stakes** | Gmail/Yahoo bulk-sender rules + CASL; ~1 day of work | **DKIM signing over both headers** — a property of the eventual ESP, not of our code. Must be in the sender spec. |
| Three-level suppression (global → brand → type), global winning | **(a) Table stakes** | We already have org-wide suppression; this is two tables and a precedence rule | None |
| Minimum object model (person / company / opportunity / activity / brand scope + associations) | **(a) Table stakes** | Everything else hangs off it; retrofitting later rewrites the 24 endpoints | None |
| Append-only audit log | **(b) Worth building** | Trivial in SQLite; HubSpot reportedly lacks a deletion log, so this is a differentiator with real CASL value | None |
| Erasure: unlink-not-cascade + blocklist tombstone | **(b) Worth building** | Copies HubSpot's semantics and closes the re-import hole; extends existing suppression | None |
| `step_type` enum (email / call / linkedin / manual / wait) + task queue | **(b) Worth building — highest leverage** | One column + one view turns our campaign engine into a cadence engine at parity with Outreach, which executes LinkedIn as a reminder anyway | None — deliberately *no* LinkedIn API |
| Declarative exit criteria wired to our 12 intents | **(b) Worth building** | Signals already computed; makes ours finer-grained than documented competitors | None |
| Enrolment rules from a saved filter | **(b) Worth building** | Small addition to existing search + fit scoring | Suppression check must run at enrolment *and* send |
| Stage + `stage_entered_at` + `last_activity_at` + `lost_reason` | **(b) Worth building** | Four columns; gives velocity and stale detection; makes future reporting possible without a forecasting engine | None |
| Meeting outcome enum + `rescheduled_from_id` (no-show tracking) | **(b) Worth building** | Incumbents treat this as a workflow afterthought; feeds our existing analytics | None |
| Google Calendar free/busy read + event write | **(b) Worth building, narrow** | Connector already available; 3 operations | **Calendar must be authoritative for free/busy at request time** — otherwise we double-book. This is the real dependency, not the API. |
| Per-step and per-brand reporting grain | **(b) Worth building** | Per-rep grain is void at one seat; per-brand is our distinctive axis and no vendor is organised around it | Requires the timestamps above to exist first |
| Dedupe: UNIQUE on normalised email at the *person* level + manual merge with `merged_into_id` | **(b) Worth building** | Five brand relationships per human means per-brand uniqueness would create five disagreeing consent records | None |
| Weighted forecast / stage probabilities / forecast categories / quota | **(c) Refuse** | Statistically invalid below ~20 deals; produces authoritative-looking wrong numbers | — |
| Round-robin, group booking, multi-host availability intersection | **(c) Refuse** | One operator; HubSpot's own leave-handling failure shows the inherited complexity | — |
| Shared inbox, assignment rules, SLA timers | **(c) Refuse** | Definitionally empty at one seat; hot leads already answers "what needs me first" | — |
| Call recording, transcription, conversation intelligence | **(c) Refuse** | Telephony carrier + ASR + per-jurisdiction call-recording consent on top of the CASL work; Close bills minutes separately for a reason | — |
| Tickets, products, line items, quotes | **(c) Refuse** | No support function, no quoting; line items drag in a pricing model | — |
| Custom-object / custom-field builder (Attio-style) | **(c) Refuse** | Configuration surface with one user; Attio gates it behind Pro for a reason | — |
| A/B testing inside sequences | **(c) Refuse (for now)** | Per-step sample sizes will not reach significance across five brands; a template library with recorded outcomes is the honest version | — |
| Enrichment-on-create, validation rule builder, required-field engine | **(c) Refuse** | Generated-fiction data, one operator | — |
| Preference-centre page builder / per-brand design surfaces | **(c) Refuse** | Five parameterised templates is correct; HubSpot's community pain is the counter-example | — |
| Two-way CRM sync | **(c) Refuse** | Two sources of truth for consent is the one thing we cannot afford; deletions/merges are the worst-delivered events on both platforms; OAuth 2.0 breaks our zero-dependency constraint | — |
| One-way export to a CRM (if ever wanted) | **(b) Worth building, already mostly done** | Existing CSV export + webhooks already cover it; Pipedrive's person/deal/activity map cleanly | API-token auth only (OAuth would break zero-dependency) |

### Gaps
- The refuse verdicts on conversation intelligence and shared-inbox/SLA rest partly on *absence* of
  retrievable documentation rather than on evidence about their value. The reasoning (one seat) is
  sound independent of the sources, but the report-writer should not present these as
  well-sourced comparisons.

---

## Recommended minimum object model for us

Scoped to `node:sqlite`, additive to the existing 20 tables. Types are SQLite affinities.

### Core objects

| Table | Field | Type | Purpose |
|---|---|---|---|
| `brand` | `id` | INTEGER PK | The five portfolio brands; already implied by brand scoping |
| | `name` | TEXT NOT NULL | Display name |
| | `sending_domain` | TEXT | Needed for DKIM / RFC 8058 header host per brand |
| | `is_default` | INTEGER (0/1) | Mirrors HubSpot's business-unit ID 0 "Account" concept |
| `person` | `id` | INTEGER PK | One row per human, **across all brands** |
| | `email_normalised` | TEXT NOT NULL **UNIQUE** | Lowercased/trimmed; the only dedupe key. UNIQUE at person level, not per brand |
| | `email_display` | TEXT | As supplied |
| | `first_name`, `last_name` | TEXT | — |
| | `title` | TEXT | — |
| | `company_id` | INTEGER FK → `company.id` | Primary employer; richer links go in `association` |
| | `processing_basis` | TEXT | Lawful basis for *holding* data — distinct from consent to send. Enum below |
| | `processing_basis_note` | TEXT | Free text provenance, mirroring HubSpot's required explanation |
| | `merged_into_id` | INTEGER FK → `person.id` NULL | Merge redirect; never hard-delete, so historic campaign rows resolve |
| | `erased_at` | TEXT (ISO 8601) NULL | Erasure tombstone; personal fields nulled, row retained |
| | `created_at`, `updated_at` | TEXT (ISO 8601) | — |
| `company` | `id` | INTEGER PK | — |
| | `name` | TEXT NOT NULL | — |
| | `domain` | TEXT UNIQUE NULL | Dedupe key |
| | `parent_company_id` | INTEGER FK → `company.id` NULL | Pipedrive keeps hierarchy separate; one nullable FK is enough at our scale |
| | `icp_fit_score` | REAL NULL | Links existing fit scoring to the object model |
| `opportunity` | `id` | INTEGER PK | Replaces "deal"; one per brand-relationship worth pursuing |
| | `brand_id` | INTEGER FK → `brand.id` NOT NULL | **Brand scope is mandatory** — this is our per-rep substitute |
| | `person_id` | INTEGER FK → `person.id` | — |
| | `company_id` | INTEGER FK → `company.id` NULL | — |
| | `stage` | TEXT NOT NULL | Ordered enum, e.g. `new`/`engaged`/`meeting`/`proposal`/`won`/`lost` |
| | `stage_entered_at` | TEXT (ISO 8601) | Gives velocity + stale detection for one column |
| | `confidence` | TEXT NULL | `committed`/`likely`/`possible` — the honest substitute for a probability % |
| | `value` | REAL NULL | Recorded so first-touch attribution is a join away; no attribution engine |
| | `source_campaign_id` | INTEGER FK NULL | — |
| | `lost_reason` | TEXT NULL | Required when `stage = 'lost'`; enforced in app, not schema |
| | `last_activity_at` | TEXT (ISO 8601) NULL | The anti-stale field |
| | `next_action_at` | TEXT (ISO 8601) NULL | — |
| `activity` | `id` | INTEGER PK | Polymorphic, Pipedrive-style |
| | `kind` | TEXT NOT NULL | `email`/`call`/`meeting`/`note`/`task`/`linkedin` |
| | `subject_type` | TEXT NOT NULL | `person`/`company`/`opportunity` |
| | `subject_id` | INTEGER NOT NULL | — |
| | `brand_id` | INTEGER FK → `brand.id` | — |
| | `due_at` | TEXT (ISO 8601) NULL | Makes this the task queue for manual cadence steps |
| | `completed_at` | TEXT (ISO 8601) NULL | — |
| | `body` | TEXT NULL | — |
| `association` | `from_type` | TEXT NOT NULL | HubSpot's lesson: one polymorphic link table beats N nullable FKs |
| | `from_id` | INTEGER NOT NULL | — |
| | `to_type` | TEXT NOT NULL | — |
| | `to_id` | INTEGER NOT NULL | — |
| | `label` | TEXT NULL | e.g. `decision_maker`, `referred_by`; supports same-type links |
| `audit_log` | `id` | INTEGER PK | **Append-only**: no UPDATE, no DELETE |
| | `at` | TEXT (ISO 8601) NOT NULL | — |
| | `actor` | TEXT NOT NULL | Session user, API key id, or `system` |
| | `action` | TEXT NOT NULL | `consent.grant`, `consent.withdraw`, `person.erase`, `person.merge`, … |
| | `object_type`, `object_id` | TEXT / INTEGER | — |
| | `detail_json` | TEXT NULL | Before/after for consent and erasure specifically |

`processing_basis` enum (modelled on HubSpot's six, which the KB confirms are three legitimate-interest
variants plus contract, consent, and not-applicable — **exact HubSpot labels unverified, so these are
ours**): `legitimate_interest_lead`, `legitimate_interest_customer`, `legitimate_interest_other`,
`performance_of_contract`, `freely_given_consent`, `not_applicable`.

### Consent / subscription schema (the priority deliverable)

Three tables. `subscription_type` is the catalogue, `consent` is the per-person state **with
provenance**, `consent_event` is the immutable history. HubSpot keeps only the first two; we add the
third because CASL asks us to *prove* consent, not merely assert it.

| Table | Field | Type | Purpose |
|---|---|---|---|
| `subscription_type` | `id` | INTEGER PK | HubSpot's `subscriptionId` equivalent |
| | `brand_id` | INTEGER FK → `brand.id` NULL | **NULL = account-wide**, mirroring HubSpot's business-unit 0. This single nullable FK is the per-brand scoping HubSpot charges Enterprise + add-on for |
| | `internal_name` | TEXT NOT NULL UNIQUE | Stable key for code |
| | `display_name` | TEXT NOT NULL | Shown on the preference centre |
| | `description` | TEXT | Shown on the preference centre; CASL likes specificity about what you're consenting to |
| | `channel` | TEXT NOT NULL | `EMAIL` (HubSpot's value) — reserved for future `SMS` |
| | `purpose` | TEXT NOT NULL | `marketing` / `transactional` / `service`. **`transactional` bypasses consent but NOT global suppression** |
| | `opt_in_required` | INTEGER (0/1) NOT NULL | 1 = must have explicit consent (CASL default for marketing); 0 = default-on types |
| | `active` | INTEGER (0/1) | Retire a type without deleting history |
| `consent` | `id` | INTEGER PK | Current state; one row per (person × subscription_type) |
| | `person_id` | INTEGER FK → `person.id` NOT NULL | — |
| | `subscription_type_id` | INTEGER FK NOT NULL | Together with `person_id`: **UNIQUE** |
| | `brand_id` | INTEGER FK → `brand.id` | Denormalised from the type for cheap brand-scoped queries |
| | `channel` | TEXT NOT NULL | HubSpot's `channel`; `EMAIL` |
| | `status` | TEXT NOT NULL | **Tri-state, one enum for read and write** (HubSpot's read/write enums disagree — we will not repeat that): `subscribed` / `unsubscribed` / `not_specified`. **Default `not_specified`, never `subscribed`** — HubSpot's null-basis-defaults-to-SUBSCRIBED behaviour is the bug we are avoiding |
| | `consent_kind` | TEXT NOT NULL | **CASL-specific, not in HubSpot**: `express` / `implied_business_relationship` / `implied_inquiry` / `none` |
| | `legal_basis` | TEXT NOT NULL | Basis to *communicate*. Enum modelled on HubSpot's: `consent_with_notice`, `legitimate_interest_lead`, `legitimate_interest_client`, `legitimate_interest_other`, `performance_of_contract`, `process_and_store`, `non_gdpr`. **Re-verify HubSpot's exact strings before claiming parity** |
| | `legal_basis_explanation` | TEXT NOT NULL | **Mandatory, as HubSpot makes it.** The provenance string: source URL / form id / inbound message id / the verbatim wording the person agreed to. This field is the CASL deliverable |
| | `consent_source` | TEXT NOT NULL | `web_form` / `inbound_reply` / `import` / `manual` / `preference_centre` / `verbal` |
| | `consent_at` | TEXT (ISO 8601) NOT NULL | When consent was given |
| | `consent_ip` | TEXT NULL | Evidence for web-form consent |
| | `consent_expires_at` | TEXT (ISO 8601) NULL | **The field HubSpot has no equivalent for.** NULL = express (does not expire); set to `consent_at + 24 months` for implied business relationship, `+ 6 months` for inquiry. **Both durations UNCONFIRMED against CRTC — verify before the sweep job ships** |
| | `withdrawn_at` | TEXT (ISO 8601) NULL | — |
| | `withdrawn_via` | TEXT NULL | `one_click` (RFC 8058) / `preference_centre` / `reply` / `manual` |
| | `honoured_at` | TEXT (ISO 8601) NULL | When suppression actually took effect. Write it synchronously so the proven interval is zero against CASL's 10 business days |
| | `updated_at` | TEXT (ISO 8601) | — |
| `consent_event` | `id` | INTEGER PK | **Append-only history.** Retain per CASL records rule (**3 years, UNCONFIRMED**) |
| | `at` | TEXT (ISO 8601) NOT NULL | — |
| | `person_id`, `subscription_type_id` | INTEGER FK | — |
| | `event` | TEXT NOT NULL | `granted` / `withdrawn` / `expired` / `re_granted` / `suppressed` / `erased` |
| | `status_before`, `status_after` | TEXT | — |
| | `legal_basis`, `legal_basis_explanation` | TEXT | Snapshotted at the time of the event, so later edits cannot rewrite history |
| | `source`, `ip`, `user_agent` | TEXT NULL | — |
| | `message_id` | TEXT NULL | Which send the unsubscribe came from — the RFC 8058 token decodes to this |
| `suppression` | *(extend existing org-wide table)* | | |
| | `scope` | TEXT NOT NULL | **`global` / `brand` / `type`** — HubSpot's leaked opt-out scope is the bug; make scope explicit. `global` always wins, and wins over `transactional` |
| | `reason` | TEXT NOT NULL | `unsubscribe` / `complaint` / `bounce_hard` / `erasure_request` / `manual` |
| | `retain_after_erasure` | INTEGER (0/1) | 1 for `erasure_request`: the hash survives the person row so the address cannot be re-imported (HubSpot's blocklist behaviour) |

**Unsubscribe token (for the RFC 8058 URI).** The URI must identify recipient *and* list, carry no
cookies or auth, and must not redirect. Store nothing new: HMAC-sign a compact payload of
`person_id`, `subscription_type_id`, `brand_id`, `message_id` with a server secret, base64url it, and
expose one unauthenticated route that accepts **POST** (one-click, body `List-Unsubscribe=One-Click`)
and **GET** (renders the preference centre). Emit both `List-Unsubscribe: <https://…>` and
`List-Unsubscribe-Post: List-Unsubscribe=One-Click`. **Outstanding hard dependency: the sender must
DKIM-sign both headers, or the compliance is void.**
