#!/usr/bin/env bash
# EdVisingU AI Ecosystem — one-command VPS provisioner.
#
# From your desktop:   ./bootstrap.sh remote deploy@YOUR_VPS_IP
# On the VPS itself:   ./bootstrap.sh local
#
# Idempotent: every step checks before it acts, so re-running is always safe.
# Covers Masterbuild §21.3 (hardening), §21.4 (Docker), §21.8 (folders),
# compose build/up, and the §15.1 health gate. DNS, certbot, API keys,
# Supabase schema, and hermes-agent/OpenJarvis setup stay manual — the
# script prints those next steps at the end.
set -euo pipefail

INSTALL_DIR="/opt/edvisingu"
AGENTS=(hermes-core hermes-content hermes-advisor hermes-credihire hermes-ops hermes-social hermes-builder hermes-research hermes-finance hermes-email)
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo -e "\n==> $*"; }

mode="${1:-local}"

if [[ "$mode" == "remote" ]]; then
  target="${2:?Usage: ./bootstrap.sh remote deploy@VPS_IP}"
  log "Syncing repo to $target:$INSTALL_DIR"
  ssh "$target" "sudo mkdir -p $INSTALL_DIR && sudo chown \$(whoami) $INSTALL_DIR"
  rsync -az --delete --exclude '.git' --exclude '.env' --exclude '.ci-data' "$REPO_DIR/" "$target:$INSTALL_DIR/"
  # Ship a local .env once if the VPS doesn't have one yet (never clobber live secrets)
  if [[ -f "$REPO_DIR/.env" ]]; then
    ssh "$target" "[ -f $INSTALL_DIR/.env ]" || scp "$REPO_DIR/.env" "$target:$INSTALL_DIR/.env"
  fi
  log "Running bootstrap on the VPS"
  ssh -t "$target" "cd $INSTALL_DIR && ./bootstrap.sh local"
  exit 0
fi

[[ "$mode" == "local" ]] || { echo "Unknown mode: $mode (use 'local' or 'remote')"; exit 1; }

# --- 1. Preflight -----------------------------------------------------------
if [[ ! -f "$REPO_DIR/.env" ]]; then
  echo "ERROR: $REPO_DIR/.env not found."
  echo "  cp .env.example .env   # then fill in keys from Bitwarden (§21.9)"
  exit 1
fi
if ! grep -qE '^ANTHROPIC_API_KEY=..+' "$REPO_DIR/.env" && ! grep -qE '^FAKE_LLM=1' "$REPO_DIR/.env"; then
  echo "ERROR: ANTHROPIC_API_KEY is empty in .env (set it, or FAKE_LLM=1 for a keyless smoke run)."
  exit 1
fi
if ! grep -qE '^ROUTER_INTERNAL_TOKEN=..+' "$REPO_DIR/.env"; then
  echo "ERROR: ROUTER_INTERNAL_TOKEN is empty in .env."
  echo "  Generate one: python3 -c \"import secrets; print(secrets.token_hex(32))\""
  exit 1
fi

# --- 2. Harden (first run as root only, §21.3) ------------------------------
if [[ -f /var/lib/edvisingu/.hardened ]]; then
  log "Hardening: already done, skipping"
elif [[ "$(id -u)" -eq 0 ]]; then
  log "Hardening server (§21.3)"
  bash "$REPO_DIR/deploy/vps-harden.sh"
else
  log "Hardening: not root, skipping (run deploy/vps-harden.sh as root once if this is a fresh VPS)"
fi

# --- 3. Docker (§21.4) ------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  log "Docker: already installed"
else
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$(whoami)" || true
fi
docker compose version >/dev/null 2>&1 || sudo apt-get install -y docker-compose-plugin

# --- 4. Folder structure (§21.8) --------------------------------------------
log "Creating agent runtime folders under /srv"
for a in "${AGENTS[@]}"; do
  sudo mkdir -p "/srv/$a/data"/{memories,skills,cron,sessions,logs}
done
sudo mkdir -p /srv/agent-bus/{inbox,working,outbox}
sudo mkdir -p /srv/shared-files/{research,content,builds,finance,email}
sudo chown -R "$(whoami):$(whoami)" /srv/hermes-* /srv/agent-bus /srv/shared-files
sudo chmod -R 755 /srv

# --- 5. Install into /opt/edvisingu (when run from elsewhere) ---------------
if [[ "$REPO_DIR" != "$INSTALL_DIR" ]]; then
  log "Installing repo to $INSTALL_DIR"
  sudo mkdir -p "$INSTALL_DIR"
  sudo chown "$(whoami)" "$INSTALL_DIR"
  rsync -a --delete --exclude '.git' --exclude '.env' --exclude '.ci-data' "$REPO_DIR/" "$INSTALL_DIR/"
  [[ -f "$INSTALL_DIR/.env" ]] || cp "$REPO_DIR/.env" "$INSTALL_DIR/.env"
  cd "$INSTALL_DIR"
else
  cd "$REPO_DIR"
fi

# --- 6. Nginx configs (§21.6/§25.1) — copied only if nginx exists -----------
if command -v nginx >/dev/null 2>&1; then
  log "Installing nginx site configs (certbot stays manual)"
  for conf in deploy/nginx/*.conf; do
    name="$(basename "$conf" .conf)"
    sudo cp "$conf" "/etc/nginx/sites-available/$name"
    sudo ln -sf "/etc/nginx/sites-available/$name" "/etc/nginx/sites-enabled/$name"
  done
  sudo nginx -t && sudo systemctl reload nginx
else
  log "nginx not installed — skipping site configs (sudo apt install -y nginx certbot python3-certbot-nginx)"
fi

# --- 7. Validate, build, start ----------------------------------------------
log "Validating compose file"
docker compose config -q

log "Building and starting the fleet (first build takes several minutes)"
docker compose up -d --build

# --- 8. Health gate (§15.1) --------------------------------------------------
log "Waiting for services to pass health checks"
./scripts/healthcheck.sh

# --- 9. Manual next steps -----------------------------------------------------
cat <<'EOF'

============================================================
FLEET IS UP. Remaining manual steps (in order):
============================================================
 1. Cloudflare DNS (§21.7): A records for agents.edvisingu.com and
    status.edvisingu.com -> this VPS IP.
 2. TLS (§21.6): sudo certbot --nginx -d agents.edvisingu.com
                 sudo certbot --nginx -d status.edvisingu.com
 3. Supabase (§8): run supabase/schema.sql in the SQL Editor of the
    EXISTING project bvxhicdnaordolguuyal. NEVER create a new project.
    Create the 5 storage buckets (supabase/README.md).
 4. Telegram: @BotFather > /newbot > put token in .env.
 5. hermes-agent gateway (§22.3): see hermes-gateway/README.md, then
    copy hermes-gateway/skills/dispatch-to-fleet.md to ~/.hermes/skills/.
 6. n8n (localhost:5678 via SSH tunnel): import workflows,
    see docs/n8n/content-factory.md.
 7. Uptime Kuma (localhost:3001): add monitors from docs/MONITORING.md.
 8. Optional host services (Tailscale, OpenJarvis):
    docs/OPTIONAL-HOST-SERVICES.md — note the corrected OpenJarvis URL.
 9. Security audit before sign-off: SECURITY.md.
============================================================
EOF
