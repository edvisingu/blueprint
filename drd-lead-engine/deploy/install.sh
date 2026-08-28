#!/usr/bin/env bash
# =====================================================================
# Dr. D Lead Engineering System — one-command install
#
#   sudo bash install.sh
#
# Installs the app as a service and (optionally) publishes it at
# leads.drdlearn.com through a Cloudflare Tunnel. Safe to re-run: it
# updates the code and never overwrites your existing secrets.
# =====================================================================
set -euo pipefail

APP_DIR=/opt/drd-lead-engine
DATA_DIR=/var/lib/drd-lead-engine
ENV_FILE=/etc/drd-lead-engine.env
HOSTNAME_FQDN="${HOSTNAME_FQDN:-leads.drdlearn.com}"
TUNNEL_NAME="${TUNNEL_NAME:-drd-lead-engine}"
REPO="${REPO:-https://github.com/edvisingu/blueprint.git}"
BRANCH="${BRANCH:-claude/explee-clone-ks2mdw}"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
die()  { printf "\033[31mERROR:\033[0m %s\n" "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Run with sudo."

# ---------------------------------------------------------------- 1. preflight
bold "1/6  Checking prerequisites"
. /etc/os-release 2>/dev/null || true
ok "OS: ${PRETTY_NAME:-unknown}"

if ! command -v node >/dev/null 2>&1; then
  warn "Node not found. Installing Node 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1 || die "Could not install Node. Install Node 22.5+ manually and re-run."
fi

NODE_MAJ=$(node -p "process.versions.node.split('.')[0]")
NODE_MIN=$(node -p "process.versions.node.split('.')[1]")
if [ "$NODE_MAJ" -lt 22 ] || { [ "$NODE_MAJ" -eq 22 ] && [ "$NODE_MIN" -lt 5 ]; }; then
  warn "Node $(node -v) is too old (need 22.5+). Upgrading..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
fi
node -e "require('node:sqlite')" 2>/dev/null || die "node:sqlite unavailable. Node 22.5+ is required; found $(node -v)."
ok "Node $(node -v) with node:sqlite"

command -v git >/dev/null 2>&1 || apt-get install -y git >/dev/null 2>&1
ok "git present"

# ---------------------------------------------------------------- 2. fetch app
bold "2/6  Installing the application"
id -u drd >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin drd
mkdir -p "$APP_DIR" "$DATA_DIR"

TMP=$(mktemp -d)
git clone --quiet --branch "$BRANCH" --depth 1 "$REPO" "$TMP/src" \
  || die "Clone failed. If the repo is private, run: git clone -b $BRANCH $REPO first, then re-run this script from inside it."
rsync -a --delete --exclude 'drd.db*' --exclude '.dev-token' "$TMP/src/drd-lead-engine/" "$APP_DIR/" 2>/dev/null \
  || cp -r "$TMP/src/drd-lead-engine/." "$APP_DIR/"
rm -rf "$TMP"
chown -R drd:drd "$APP_DIR" "$DATA_DIR"
ok "Installed to $APP_DIR"

# ---------------------------------------------------------------- 3. secrets
bold "3/6  Configuring secrets"
NEW_PASSWORD=""
if [ ! -f "$ENV_FILE" ]; then
  NEW_PASSWORD="${DRD_ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-20)}"
  cat > "$ENV_FILE" <<ENVEOF
DRD_ADMIN_PASSWORD=$NEW_PASSWORD
DRD_SESSION_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
# Uncomment for live Claude calls instead of the deterministic engine:
# ANTHROPIC_API_KEY=sk-ant-...
ENVEOF
  chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
  ok "Secrets written to $ENV_FILE"
else
  ok "Existing secrets kept ($ENV_FILE untouched)"
fi

# ---------------------------------------------------------------- 4. service
bold "4/6  Starting the service"
cp "$APP_DIR/deploy/drd-lead-engine.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now drd-lead-engine >/dev/null 2>&1
sleep 4
systemctl is-active --quiet drd-lead-engine \
  || { journalctl -u drd-lead-engine --no-pager -n 25; die "Service failed to start (log above)."; }
curl -fsS --max-time 10 http://127.0.0.1:8080/v1/health >/dev/null \
  || die "Service is running but not answering on 127.0.0.1:8080."
ok "App healthy on 127.0.0.1:8080"

# ---------------------------------------------------------------- 5. tunnel
bold "5/6  Publishing at $HOSTNAME_FQDN"
if [ "${SKIP_TUNNEL:-0}" = "1" ]; then
  warn "SKIP_TUNNEL=1 set, leaving the app on loopback only."
else
  if ! command -v cloudflared >/dev/null 2>&1; then
    warn "Installing cloudflared..."
    mkdir -p /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg > /usr/share/keyrings/cloudflare-main.gpg
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
      > /etc/apt/sources.list.d/cloudflared.list
    apt-get update -qq && apt-get install -y cloudflared >/dev/null 2>&1 \
      || die "cloudflared install failed. Install it manually, then re-run."
  fi
  ok "cloudflared $(cloudflared --version 2>/dev/null | head -1)"

  if [ ! -f /root/.cloudflared/cert.pem ]; then
    echo ""
    bold "  ACTION NEEDED — authorize this server with Cloudflare"
    echo "  A URL will print below. Open it in any browser, sign in,"
    echo "  and pick the drdlearn.com zone. Then this will continue."
    echo ""
    cloudflared tunnel login
  fi
  [ -f /root/.cloudflared/cert.pem ] || die "Cloudflare authorization did not complete."
  ok "Authorized with Cloudflare"

  if ! cloudflared tunnel list 2>/dev/null | grep -q "\b$TUNNEL_NAME\b"; then
    cloudflared tunnel create "$TUNNEL_NAME" >/dev/null
  fi
  TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const t=JSON.parse(d).find(x=>x.name==='$TUNNEL_NAME');process.stdout.write(t?t.id:'')})")
  [ -n "$TUNNEL_ID" ] || die "Could not determine the tunnel id."
  ok "Tunnel $TUNNEL_NAME ($TUNNEL_ID)"

  cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$HOSTNAME_FQDN" >/dev/null 2>&1 \
    || warn "DNS route already existed, continuing."
  ok "DNS route -> $HOSTNAME_FQDN"

  mkdir -p /etc/cloudflared
  cat > /etc/cloudflared/config.yml <<CFEOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME_FQDN
    service: http://127.0.0.1:8080
    originRequest:
      connectTimeout: 30s
  - service: http_status:404
CFEOF

  cloudflared service install >/dev/null 2>&1 || true
  systemctl enable --now cloudflared >/dev/null 2>&1 || systemctl restart cloudflared
  sleep 5
  systemctl is-active --quiet cloudflared \
    || { journalctl -u cloudflared --no-pager -n 20; die "Tunnel failed to start (log above)."; }
  ok "Tunnel running"
fi

# ---------------------------------------------------------------- 6. done
bold "6/6  Done"
echo ""
echo "  URL:      https://$HOSTNAME_FQDN"
if [ -n "$NEW_PASSWORD" ]; then
  echo ""
  echo "  ============================================================"
  echo "   LOGIN PASSWORD:  $NEW_PASSWORD"
  echo "   Save this now. It is stored in $ENV_FILE"
  echo "  ============================================================"
else
  echo "  Password:  unchanged (see $ENV_FILE)"
fi
echo ""
echo "  Logs:     journalctl -u drd-lead-engine -f"
echo "  Restart:  systemctl restart drd-lead-engine"
echo "  Update:   sudo bash $APP_DIR/deploy/install.sh"
echo "  Backup:   sqlite3 $DATA_DIR/drd.db \".backup '/root/drd-\$(date +%F).db'\""
echo ""
echo "  DNS may take a minute to propagate on first run."
