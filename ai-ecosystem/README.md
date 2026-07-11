# EdVisingU AI Ecosystem — Foundation Fleet

Implementation of the **EdVisingU AI Masterbuild manual** (v2.0), Levels 1–2:
a FastAPI multi-model router + 10 specialist "hermes" agents in Docker,
with Open WebUI, n8n, ChromaDB, Redis, and Uptime Kuma — all on one
Hetzner CPX41 VPS. The manual's known defects are corrected here and
documented in [docs/ERRATA.md](docs/ERRATA.md).

## Quickstart (from your desktop)

```bash
git clone <this repo> && cd ai-ecosystem
cp .env.example .env          # fill in keys from Bitwarden (§21.9)
python3 -c "import secrets; print(secrets.token_hex(32))"   # -> ROUTER_INTERNAL_TOKEN

./bootstrap.sh remote deploy@YOUR_VPS_IP
```

`bootstrap.sh` is idempotent: hardening (first run), Docker, `/srv` folders,
compose build/up, then a health gate across every service. It ends by printing
the steps that stay manual (DNS, certbot, Supabase, Telegram, hermes-agent).

Keyless local test drive: `make smoke` (uses `FAKE_LLM=1`, no API keys needed).

## Architecture

```
Telegram/Discord ──> hermes-agent (host systemd) ──┐  dispatch skill
Browser ──> nginx ──> Open WebUI (:3000) ──────────┤  /v1/chat/completions
                                                   v
                                    FastAPI router (:8000)
                                    - owns ALL model API keys
                                    - /agent/{name}/chat  + /v1/*
                                    - /internal/complete = model switch (§26.2)
                                                   |
                     forwards to agent containers  v
        hermes-core :8001 · content :8002 · advisor :8003 · credihire :8004
        ops :8005 · social :8006 · builder :8008 · research :8009
        finance :8010 · email :8011
        - each: SOUL.md persona + §23.8 tool whitelist + Redis task bus
                                                   |
                        n8n :5678 · chromadb :8800 · redis :6379 · kuma :3001
```

Request path: interface → router → agent (loads SOUL.md, may run one tool) →
router `/internal/complete` (picks the model per §26.1) → reply. Keys never
leave the router container; agent ports bind to 127.0.0.1 only.

## Agent / port / model table

| Agent | Port | Model | Role |
|---|---|---|---|
| hermes-core | 8001 | Sonnet | Executive assistant, strategy, daily driver |
| hermes-content | 8002 | Sonnet | Content factory (LinkedIn/TikTok/newsletters) |
| hermes-advisor | 8003 | Sonnet | Student advising, courses, OSAP guidance |
| hermes-credihire | 8004 | Sonnet | ATS scoring, resumes, cover letters |
| hermes-ops | 8005 | Haiku | Health checks, monitoring, morning report |
| hermes-social | 8006 | Gemini Flash | Discord/Whop community, trends |
| hermes-builder | 8008 | GPT-4o | Repos, scaffolds, boilerplate |
| hermes-research | 8009 | Sonnet | Web research, competitor analysis |
| hermes-finance | 8010 | Haiku | Stripe MRR, revenue intelligence |
| hermes-email | 8011 | Sonnet | Email drafts (draft-only, never sends) |

Port 8007 is intentionally skipped (manual numbering, ERRATA #6).

## Build order

This repo is **Levels 1–2** of the manual's §20.9 ladder. See
[docs/BUILD-ORDER.md](docs/BUILD-ORDER.md) for the full §19.3 fastest path and
what Levels 3–4 add. Agents 11–25 are one command away:
`./scripts/new-agent.sh hermes-seo 8013` (§31 pattern).

## Verification

| What | How |
|---|---|
| Syntax + compose validity | `make lint` |
| Router routing, token guard, envelopes | `make test` (router/tests) |
| Agent SOUL/tools/identity ×10 | `make test` (tests/) |
| Full E2E without keys | `make smoke` — boots the fleet with `FAKE_LLM=1`, proves UI→router→agent→router loop + task bus |
| Real model calls, TLS, Telegram, Supabase, n8n | Post-deploy only — follow §15.1/§20.10 checklists (docs/BUILD-ORDER.md) |

## Repo map

```
router/          merged multi-model router (§20.8 + §22.2 + §26.2)
agents/          10 foundation agents + _template for new ones (§31)
tools/           §23 tool modules + Redis task bus (§24.7)
hermes-gateway/  hermes-agent install guide + dispatch-to-fleet skill (§22.3)
supabase/        schema.sql (§8.2) + bucket checklist — EXISTING project only
deploy/          vps-harden.sh (§21.3), nginx confs, openjarvis.service (reference)
scripts/         healthcheck, smoke, new-agent generator
docs/            ERRATA, BUILD-ORDER, MONITORING, OPTIONAL-HOST-SERVICES, n8n notes
bootstrap.sh     one-command idempotent VPS provisioner
```

Security checklist and key-rotation runbook: [SECURITY.md](SECURITY.md).
