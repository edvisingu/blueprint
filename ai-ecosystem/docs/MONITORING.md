# Monitoring — Uptime Kuma + Telegram (Masterbuild §25)

Uptime Kuma runs at `127.0.0.1:3001` (compose) and optionally at
status.edvisingu.com behind nginx+TLS. First visit creates the admin account —
do this immediately after `bootstrap.sh`.

## Monitors to add (§25.2, adjusted to this compose)

| Monitor | Type | Target | Interval |
|---|---|---|---|
| FastAPI Router | HTTP | http://127.0.0.1:8000/health | 60s |
| hermes-core | HTTP | http://127.0.0.1:8001/health | 60s |
| hermes-content | HTTP | http://127.0.0.1:8002/health | 60s |
| hermes-advisor | HTTP | http://127.0.0.1:8003/health | 60s |
| hermes-credihire | HTTP | http://127.0.0.1:8004/health | 60s |
| hermes-ops | HTTP | http://127.0.0.1:8005/health | 60s |
| hermes-social | HTTP | http://127.0.0.1:8006/health | 60s |
| hermes-builder | HTTP | http://127.0.0.1:8008/health | 60s |
| hermes-research | HTTP | http://127.0.0.1:8009/health | 60s |
| hermes-finance | HTTP | http://127.0.0.1:8010/health | 60s |
| hermes-email | HTTP | http://127.0.0.1:8011/health | 60s |
| n8n | HTTP | http://127.0.0.1:5678/healthz | 60s |
| Open WebUI | HTTP | http://127.0.0.1:3000 | 60s |
| Redis | TCP | 127.0.0.1:6379 | 30s |
| ChromaDB | HTTP | http://127.0.0.1:8800/api/v2/heartbeat | 60s |
| agents.edvisingu.com | HTTPS | public check | 60s |

Note: Kuma runs inside Docker, so for container targets you can also use the
service DNS names (e.g. `http://fastapi-router:8000/health`) — same network.

## Telegram alerts (§25.3)

Settings > Notifications > Telegram: bot token (same BotFather bot) + Dr. D's
chat ID. Attach the notification to every monitor. Test-fire one alert.

## Daily 7am briefing (§25.4)

n8n workflow:
1. **Schedule Trigger** — `0 12 * * *` (UTC = 7:00 AM EST)
2. **HTTP Request** — POST `http://hermes-ops:8000/chat`, body:
   `{"message": "Full system health check. Check all containers, n8n workflows, Redis, ChromaDB, Stripe MRR today vs yesterday, any alerts or anomalies. Send morning briefing.", "history": []}`
3. **Telegram node** — send the response to Dr. D.

(If the hermes-agent gateway's cron briefing (§22.3 step 6) is active, pick
one of the two — don't run both.)
