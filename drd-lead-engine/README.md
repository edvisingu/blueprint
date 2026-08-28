# Dr. D Lead Engineering System

An autonomous AI go-to-market platform. You tell it what you sell; it defines the ICP,
finds the companies and the decision-makers, researches them, writes and sends personalized
outreach, classifies the replies, surfaces hot leads and books the meetings.

Built to the architecture in *Explee: Full Business Breakdown* — original branding, UI, copy
and implementation, as that document specifies. Not a clone of Explee's source, assets or marks.

Open `index.html` in any browser, or `drd-lead-engine.html` for the single-file build.
No build step, no dependencies.

## Modules

| Spec module | Status |
| --- | --- |
| A. Autonomous GTM agent | ✅ Business profile, agent state machine, autopilot, run-cycle |
| B. Company search | ✅ Natural language → structured criteria, 6-factor fit scoring |
| C. People search | ✅ Title / seniority / department / geography, email verification status |
| D. Deep research | ✅ 11-section report: signals, pain, why-now, competitors, angles, sources |
| E. Lookalike engine | ✅ Company fingerprint → ranked lookalikes with reasons |
| F. Segments explorer | ✅ Market clusters sized and scored, with coverage + signal rate |
| G. Campaign manager | ✅ Sequences, budgets, start/pause, per-campaign autopilot |
| H. AI outbound email | ✅ Trigger-anchored personalization, 4 tones, follow-up steps |
| I. AI inbox | ✅ Reply classification across 12 intents + confidence + recommended action |
| J. Hot leads | ✅ Ranked by classifier confidence, with next action and meeting status |
| K. Analytics | ✅ Outcome metrics (cost/reply, cost/meeting) + narrative AI recommendations |
| L. Suppression / compliance | ✅ Person + domain suppression, safeguards, audit log |
| M. Billing / usage | ✅ Credit metering, plan tiers, usage-based rates |
| N. API | ✅ 17-endpoint surface, keys, webhook events |
| O. Lead scoring (§U) | ✅ Company fit, buyer fit, intent, timing, data confidence, personalization |

## Architecture

- `data.js` — seeded B2B graph (186 companies, 514 contacts), weighted toward higher-ed,
  EdTech, corporate L&D and professional services. Deterministic: same dataset every load.
- `engine.js` — pure intelligence layer. NL parsing, scoring, research synthesis, reply
  classification, email generation, segments, analytics. No DOM access, independently testable.
- `workspace.js` — the running-department state: campaigns, conversations, meetings,
  suppression, usage, agent feed. Persisted to `localStorage`.
- `app.js` — router, 14 module views, drawers.
- `styles.css` — "Refined Authority": Navy `#0A1628`, Gold `#C9A84C`, Montserrat only.

## Swapping in real infrastructure

The intelligence layer is provider-agnostic and is the part that matters. To go live:

1. **Data** — replace `DRD_DATA.companies` / `.people` with a licensed B2B provider response
   of the same shape. `engine.js` needs no changes.
2. **AI** — `generateEmail`, `deepResearch` and `classifyReply` are deterministic
   implementations of the spec's agent contracts. Swap each body for a model call; the
   inputs and return shapes are already defined.
3. **Sending** — `campaign.sent` is currently incremented locally. Point it at an email
   infrastructure provider and honour the suppression list before every send.
4. **Persistence** — `workspace.js` reads and writes one JSON blob. Replace `load`/`save`
   with API calls against the relational schema in spec §S.

## Scope note

This is a complete, working front-end product with real logic and persistent state — every
module is operable end to end. It is not a deployed multi-tenant backend: authentication,
a relational database, background job queues, real email delivery and live billing are
integration points (see above), not shipped infrastructure.
