#!/usr/bin/env bash
# Health gate for the foundation fleet (Masterbuild §15.1 / §25.2).
# Retries each endpoint until healthy or timeout; exits nonzero with a report.
set -uo pipefail

RETRIES="${RETRIES:-30}"
SLEEP="${SLEEP:-5}"

declare -A CHECKS=(
  [fastapi-router]="http://127.0.0.1:8000/health"
  [hermes-core]="http://127.0.0.1:8001/health"
  [hermes-content]="http://127.0.0.1:8002/health"
  [hermes-advisor]="http://127.0.0.1:8003/health"
  [hermes-credihire]="http://127.0.0.1:8004/health"
  [hermes-ops]="http://127.0.0.1:8005/health"
  [hermes-social]="http://127.0.0.1:8006/health"
  [hermes-builder]="http://127.0.0.1:8008/health"
  [hermes-research]="http://127.0.0.1:8009/health"
  [hermes-finance]="http://127.0.0.1:8010/health"
  [hermes-email]="http://127.0.0.1:8011/health"
  [open-webui]="http://127.0.0.1:3000"
  [n8n]="http://127.0.0.1:5678/healthz"
  [uptime-kuma]="http://127.0.0.1:3001"
)

check_url() { curl -fsS --max-time 5 "$1" >/dev/null 2>&1; }
check_redis() {
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -h 127.0.0.1 -p 6379 ping 2>/dev/null | grep -q PONG
  else
    docker exec redis redis-cli ping 2>/dev/null | grep -q PONG
  fi
}
check_chroma() {
  # heartbeat path moved between Chroma versions — accept either
  check_url "http://127.0.0.1:8800/api/v2/heartbeat" || check_url "http://127.0.0.1:8800/api/v1/heartbeat"
}

failed=()
for name in "${!CHECKS[@]}" redis chromadb; do
  ok=0
  for ((i = 1; i <= RETRIES; i++)); do
    case "$name" in
      redis) check_redis && ok=1 ;;
      chromadb) check_chroma && ok=1 ;;
      *) check_url "${CHECKS[$name]}" && ok=1 ;;
    esac
    [[ $ok -eq 1 ]] && break
    sleep "$SLEEP"
  done
  if [[ $ok -eq 1 ]]; then
    echo "OK      $name"
  else
    echo "FAILED  $name"
    failed+=("$name")
  fi
done

if ((${#failed[@]})); then
  echo ""
  echo "Unhealthy services: ${failed[*]}"
  echo "Inspect with: docker compose logs --tail=50 <service>"
  exit 1
fi
echo ""
echo "All services healthy."
