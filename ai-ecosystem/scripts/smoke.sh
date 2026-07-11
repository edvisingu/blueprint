#!/usr/bin/env bash
# Keyless end-to-end smoke test (runs in CI and on any Docker host).
# Boots the full fleet with FAKE_LLM=1 and proves the whole request path:
# Open-WebUI-shaped call -> router -> agent (SOUL load, /internal/complete) -> reply,
# plus the hermes-agent dispatch path and the Redis task bus round trip.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DATA_ROOT="${DATA_ROOT:-$PWD/.ci-data}"
mkdir -p "$DATA_ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  {
    echo "FAKE_LLM=1"
    echo "ROUTER_INTERNAL_TOKEN=smoke-test-token"
    echo "WEBUI_SECRET_KEY=smoke-test-webui-secret-key-32ch"
    echo "N8N_BASIC_AUTH_USER=smoke"
    echo "N8N_BASIC_AUTH_PASSWORD=smoke-test-password"
    echo "DATA_ROOT=$DATA_ROOT"
  } >> .env
  CLEANUP_ENV=1
else
  CLEANUP_ENV=0
  grep -qE '^FAKE_LLM=1' .env || { echo "Refusing to smoke-test against a real .env (set FAKE_LLM=1)"; exit 1; }
fi

cleanup() {
  docker compose down -v || true
  [[ "$CLEANUP_ENV" == "1" ]] && rm -f .env
}
trap cleanup EXIT

docker compose config -q
docker compose up -d --build

RETRIES=60 SLEEP=3 ./scripts/healthcheck.sh

echo ""
echo "==> E2E: Open WebUI path (/v1/chat/completions)"
reply=$(curl -fsS -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model": "hermes-core", "messages": [{"role": "user", "content": "smoke-ping"}]}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["choices"][0]["message"]["content"])')
echo "    reply: $reply"
[[ "$reply" == *"[fake-llm:hermes-core]"* ]] || { echo "FAIL: unexpected reply"; exit 1; }

echo "==> E2E: hermes-agent dispatch path (/agent/hermes-research/chat)"
reply=$(curl -fsS -X POST http://127.0.0.1:8000/agent/hermes-research/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "smoke-research", "history": []}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["response"])')
echo "    reply: $reply"
[[ "$reply" == *"[fake-llm:hermes-research]"* ]] || { echo "FAIL: unexpected reply"; exit 1; }

echo "==> E2E: Redis task bus round trip (hermes-ops)"
docker exec redis redis-cli LPUSH tasks:hermes-ops \
  '{"agent":"hermes-ops","action":"health_report","payload":{"scope":"smoke"}}' >/dev/null
result=""
for i in $(seq 1 30); do
  result=$(docker exec redis redis-cli RPOP tasks:results:hermes-ops || true)
  [[ -n "$result" ]] && break
  sleep 2
done
echo "    result: ${result:0:120}"
[[ "$result" == *"fake-llm:hermes-ops"* ]] || { echo "FAIL: no task bus result"; exit 1; }

echo ""
echo "SMOKE TEST PASSED — full UI->router->agent->router loop verified."
