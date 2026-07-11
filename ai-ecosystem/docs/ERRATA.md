# ERRATA — Masterbuild manual defects and how this repo resolves them

The manual (v2.0, June 2026) is buildable but contradicts itself in places and
contains two material errors. Each item below names the resolution baked into
this repo.

## 1. §26.2 router never calls the agent fleet (CRITICAL)
The manual's final router defines `AGENT_CONTAINERS` for all 25 agents but
uses it only to validate the model name — it answers every request itself.
Built literally, all agent containers are dead weight: SOUL.md is never
loaded, tools never run, and the §22.3 dispatch skill's `/agent/{name}/chat`
endpoints don't exist.
**Resolution:** merged router (`router/main.py`) — `/v1/*` and
`/agent/{name}/chat` forward to the agent's `/chat` (§20.8/§22.2 behavior);
agents call back to `/internal/complete`, which contains §26.2's model switch.
This matches §31.3's own comment: "router handles model selection and AI
call; this endpoint handles tool use and state management."

## 2. OpenJarvis installer URL is an unverified domain (SECURITY)
§0.1/§21.4b say `curl -fsSL https://openjarvis.ai/install.sh | bash`.
OpenJarvis is real (Stanford Scaling Intelligence Lab + Hazy Research), but
`openjarvis.ai` is not the project's documented domain. The official installer
is `https://open-jarvis.github.io/OpenJarvis/install.sh`.
**Resolution:** OpenJarvis is excluded from bootstrap; documented as an
optional host service with the corrected URL and a review-before-run warning
(docs/OPTIONAL-HOST-SERVICES.md, SECURITY.md).

## 3. Ollama-on-VPS contradiction
§6.1 installs Ollama on the VPS and §26.1 routes GEMMA_AGENTS to local Ollama;
§25.6 says "NEVER run Ollama on the VPS" (a 7B model would starve the fleet).
**Resolution:** §25.6 wins. `GEMMA_AGENTS` stays empty and the Ollama branch
returns 501 with a pointer for re-enabling on a GPU host.

## 4. §26.2 code has a Python syntax error
`f"Bearer {os.environ.get("OPENAI_API_KEY","")}"` — nested double quotes are a
SyntaxError on Python 3.11 (the §31.4 base image). **Resolution:** fixed
quoting in `router/main.py`.

## 5. Per-agent .env (§20.7) vs master .env (§21.9/§24.6)
§20.7 mounts `/srv/<agent>/data/.env` per agent; §24.6 and §21.9 use one
master `/opt/edvisingu/.env`. **Resolution:** master `.env`, with a stronger
guarantee than the manual's: model keys live ONLY in the router container.
Per-agent least-privilege env split is a Level-3 upgrade.

## 6. Port 8007 skipped
The fleet numbering jumps 8006 → 8008. Preserved as-is for fidelity with the
manual's port table (§24.1/§25.5).

## 7. Tool modules crash at import without unrelated keys
§23's modules build API clients at import time (`TavilyClient(...)`,
`stripe.api_key = os.environ[...]`), so any container missing any key dies at
boot. **Resolution:** all clients are created lazily inside functions.

## 8. ChromaDB port mismatch
§25.2 monitors `:8800` but the Chroma image serves 8000. **Resolution:**
compose maps `127.0.0.1:8800:8000`; healthcheck accepts both v1 and v2
heartbeat paths.

## 9. Conflicting router endpoint shapes
§22.3's dispatch skill needs `/agent/{name}/chat`; Open WebUI needs `/v1/*`;
§26.2 ships only `/v1/*`. **Resolution:** merged router serves both.

## 10. hermes-agent star count is stale
§0.2 claims 153k stars / 24k forks. Live counts differ (roughly 190–215k
stars depending on tracker). The substantive claim — real, production-grade
agent framework — is correct; treat the numbers as approximate.

## 11. Fleet-size contradictions
The manual variously says 6, 10, 23, 25, and (by port count) 26 agents, and
hermes-skillplate is described (§27.1) but never wired into compose or the
router. **Resolution:** this repo ships the 10-agent foundation (§24.1);
agents 11+ are added deliberately via `scripts/new-agent.sh`, resolving the
skillplate/pinterest port collision (8026 vs 8027) at add time.

## 12. Deviations added by this repo (not in the manual)
- All host ports bind `127.0.0.1` — nginx is the only public surface (§14.1 intent).
- `ROUTER_INTERNAL_TOKEN` guards `/internal/complete` so nothing outside the
  Docker network can spend API credits.
- `DATA_ROOT` parameterizes the `/srv` volume roots so CI and local machines
  can run the fleet without touching `/srv`.
- `FAKE_LLM=1` makes the router return canned replies — enables the keyless
  E2E smoke test (`make smoke`).
- Supabase URL: the project ID is treated as config, the service key as secret.
