# Dr. D Lead Engineering System

An autonomous AI go-to-market platform. You tell it what you sell; it defines the ICP,
finds the companies and the decision-makers, researches them, writes and sends personalized
outreach, classifies the replies, surfaces hot leads and books the meetings.

Built to the architecture in *Explee: Full Business Breakdown* — original branding, UI, copy
and implementation, as that document specifies. Not a clone of Explee's source, assets or marks.

## Run it

Requires Node 22.5+ (uses the built-in `node:sqlite`). No install step needed.

```bash
npm run dev      # seed the database, then start the API + web client
# → http://localhost:8787
npm test         # 89 integration tests against a live server + real database
```

The page also opens straight from disk (`index.html`) and falls back to a seeded
in-browser workspace. The header pill tells you which mode you are in:
**Live backend** (reading and writing the database) or **Local demo**.

## Architecture

```
Browser client ──HTTP──> API (node:http) ──> SQLite (node:sqlite)
      │                       │
      └──── engine.js ────────┘   same scoring / classification code both sides
                              │
                              └──> ai.js ──> deterministic  |  Claude API
```

| File | Role |
| --- | --- |
| `server/db.js` | 20-table relational schema (spec §S) |
| `server/seed.js` | Seeds org, API key, graph, campaigns, conversations, meetings |
| `server/server.js` | REST API, bearer auth, rate limiting, static hosting |
| `server/ai.js` | AI orchestration: deterministic default, real Claude when keyed |
| `server/shared.js` | Loads the browser engine into Node so both runtimes share one implementation |
| `server/test.js` | Integration suite — real HTTP against a real database, no mocks |
| `data.js` / `engine.js` | Prospect graph + intelligence (parsing, scoring, research, classification) |
| `workspace.js` | Client state: hydrates from the API, or seeds locally |
| `app.js` / `styles.css` | 14 module views; Navy `#0A1628`, Gold `#C9A84C`, Montserrat |

## Modules

| Spec module | Status |
| --- | --- |
| A. Autonomous GTM agent | Business profile, ICP hypotheses, agent states, autopilot |
| B. Company search | Natural language → structured criteria, 6-factor fit scoring |
| C. People search | Title / seniority / department / geography, verification status |
| D. Deep research | 11-section report, persisted, credit-metered |
| E. Lookalike engine | Company fingerprint → ranked lookalikes with reasons |
| F. Segments explorer | Market clusters sized and scored |
| G. Campaign manager | Sequences, budgets, start/pause, bulk import, autopilot |
| H. AI outbound email | Trigger-anchored personalization, 4 tones |
| I. AI inbox | 12-intent classification, confidence, recommended action |
| J. Hot leads | Ranked by confidence, with next action and meeting status |
| K. Analytics | Cost per reply, cost per meeting, narrative recommendations |
| L. Suppression / compliance | Person + domain, auto-suppression, audit log |
| M. Billing / usage | Credit metering per send and per research report |
| N. API | 24 endpoints, bearer auth, rate limits, webhooks |
| O. Lead scoring (§U) | Six explainable sub-scores summing to 0-100 |

## What the backend actually enforces

These are behaviours, not display logic, and each has a test:

- **Suppression is real.** A suppressed address is skipped on import, skipped on send,
  and a reply to one returns `409`. Unsubscribe and explicit-negative replies suppress
  automatically and fire `unsubscribe.received`.
- **Budgets hold.** Sending stops at the campaign cap; spend never exceeds budget.
- **Imports are safe.** Dedupe, suppression, unmatched rows and malformed rows are each
  reported separately rather than silently dropped.
- **Usage is metered.** Every send and research report writes a `usage_events` row and
  increments org credits.
- **Actions are audited.** Every mutation writes to `audit_logs`.
- **Webhooks respect subscriptions.** A hook only receives the events it subscribed to.

## AI providers

`server/ai.js` exposes `classifyReply`, `generateEmail` and `deepResearch`. Routes never
branch on provider.

- **Default** — deterministic implementations in `engine.js`. No key, no cost, no network.
- **Claude** — set `ANTHROPIC_API_KEY` and `npm i @anthropic-ai/sdk`. Uses `claude-opus-5`
  with adaptive thinking and strict tool use, so structured returns validate against a
  schema instead of being parsed out of prose. Any failure falls back to deterministic
  and reports it on `_fallback`.

`GET /v1/health` reports which provider is live.

## Still integration points

Honest list of what is wired but not shipped:

- **Email delivery.** `POST /v1/campaigns/:id/send` runs the full pipeline (suppression,
  budget, generation, conversation + message rows, metering) but does not hand off to an
  ESP. Add that call at the end of the send loop.
- **Webhook delivery.** Deliveries are recorded in `webhook_deliveries` with status
  `recorded`; outbound POST with retries is the remaining step.
- **Auth.** Single-org bearer API keys, hashed at rest. There is no login flow or
  multi-tenant role model; `/config.js` hands the browser a dev token locally.
- **Data.** The graph is seeded (186 companies, 514 contacts) rather than licensed.
  Replace the `companies` and `contacts` tables from a real provider; nothing above changes.
- **Jobs.** The `jobs` table records state, but research runs inline rather than on a queue.
