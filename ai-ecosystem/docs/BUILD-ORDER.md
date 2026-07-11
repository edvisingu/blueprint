# Build Order (Masterbuild §19.3 + §20.9)

> Do NOT build everything in parallel. Follow this order exactly (§19.3).

## Where this repo fits

This repo delivers **Levels 1–2** of the §20.9 ladder in one shot: the control
room (repo = brain), hermes-core, all 9 other foundation specialists, and API
routing. `bootstrap.sh` compresses the manual's Phases 0–2 infrastructure into
one idempotent run.

## §19.3 Fastest path (mapped to this repo)

1. **Remote access + accounts + environment** — VPS provisioned (§21.2),
   `bootstrap.sh` hardening + Docker + folders; accounts per §4 into Bitwarden.
2. **Stack live** — router `/health` green, n8n dashboard reachable
   (SSH tunnel), `scripts/healthcheck.sh` passes. *(Ollama is intentionally
   NOT on the VPS — ERRATA #3.)*
3. **Agents + database** — agents respond with their SOUL personas
   (`curl 127.0.0.1:8000/agent/hermes-core/chat`), Supabase schema run on the
   existing project, buckets created.
4. **Automation + interfaces** — n8n Content Factory imported
   (docs/n8n/content-factory.md), Open WebUI behind agents.edvisingu.com,
   Whop webhook firing.
5. **Gateway + integrations** — hermes-agent on Telegram with the dispatch
   skill, Blotato connected, integrations tested end-to-end.
6. **Sign-off** — SECURITY.md audit, docs in Notion, §16 Phase-4 checklist.

## §20.9 The 4 levels

| Level | What | Status in this repo |
|---|---|---|
| 1 | Control room + hermes-core working | ✅ shipped |
| 2 | Specialist agents, direct API routing | ✅ shipped (10 agents) |
| 3 | Orchestrator front door: hermes-core decomposes multi-agent tasks over the task bus and synthesizes results | 🔩 plumbing shipped (task bus + `publish_task`); orchestration logic is the next build |
| 4 | Full automation: overnight crons, hermes-ops daily audits, intelligent routing, automatic backups | ⏳ after Level 3 |

## Post-deploy verification (§15.1 / §20.10, real-keys)

- [ ] Every `/health` endpoint green (`scripts/healthcheck.sh`)
- [ ] hermes-core replies **in persona** via Open WebUI and via Telegram dispatch
- [ ] hermes-research performs a real Tavily search and cites URLs
- [ ] hermes-finance returns live Stripe MRR
- [ ] hermes-ops runs a health check via `run_python_code`
- [ ] Task bus: `publish_task` → result lands in `tasks:results:<agent>`
- [ ] n8n Content Factory: topic in → content in Supabase `content_queue`
- [ ] Uptime Kuma monitors green + Telegram alert test fired
- [ ] SECURITY.md checklist passes

## Time budget (§19)

Experienced dev: 32–52 h (~1–1.5 wk). Learning dev: 50–80 h (2–3 wk).
Biggest sinks (§19.1): Google OAuth for n8n, DNS propagation, Discord
permissions. (Ollama downloads no longer apply — ERRATA #3.)
