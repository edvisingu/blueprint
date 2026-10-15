#!/usr/bin/env bash
# One-time setup on a Debian/Ubuntu server. Run as root.
#   sudo bash deploy/setup.sh
set -euo pipefail

APP_DIR=/opt/drd-lead-engine
DATA_DIR=/var/lib/drd-lead-engine
ENV_FILE=/etc/drd-lead-engine.env
REPO="${REPO:-https://github.com/edvisingu/blueprint.git}"
BRANCH="${BRANCH:-claude/explee-clone-ks2mdw}"

echo "==> Checking Node (need 22.5+ for the built-in node:sqlite module)"
if ! command -v node >/dev/null; then
  echo "Node is not installed. Installing Node 22 from NodeSource."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
NODE_MINOR=$(node -p "process.versions.node.split('.')[1]")
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "ERROR: Node $(node -v) is too old. Need 22.5 or newer for node:sqlite." >&2
  exit 1
fi
node -e "require('node:sqlite')" || { echo "ERROR: node:sqlite unavailable." >&2; exit 1; }
echo "    Node $(node -v) OK"

echo "==> Creating service user and directories"
id -u drd >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin drd
mkdir -p "$APP_DIR" "$DATA_DIR"

echo "==> Fetching the application"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$BRANCH" && git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" --depth 1 "$REPO" /tmp/drd-src
  mkdir -p "$APP_DIR"
  cp -r /tmp/drd-src/drd-lead-engine/. "$APP_DIR/"
  rm -rf /tmp/drd-src
fi
chown -R drd:drd "$APP_DIR" "$DATA_DIR"

echo "==> Writing secrets to $ENV_FILE (only if absent)"
if [ ! -f "$ENV_FILE" ]; then
  ADMIN_PW="${DRD_ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' )}"
  cat > "$ENV_FILE" <<ENVEOF
DRD_ADMIN_PASSWORD=$ADMIN_PW
DRD_SESSION_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
# Uncomment to use live Claude calls instead of the deterministic engine:
# ANTHROPIC_API_KEY=sk-ant-...
ENVEOF
  chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
  echo ""
  echo "    ******************************************************"
  echo "    LOGIN PASSWORD: $ADMIN_PW"
  echo "    Saved to $ENV_FILE. Store it in your password manager."
  echo "    ******************************************************"
  echo ""
else
  echo "    $ENV_FILE already exists, leaving it alone."
fi

echo "==> Installing the service"
cp "$APP_DIR/deploy/drd-lead-engine.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now drd-lead-engine
sleep 3
systemctl --no-pager --lines=15 status drd-lead-engine || true

echo "==> Local health check"
curl -fsS http://127.0.0.1:8080/v1/health && echo " <- app is up"

echo ""
echo "Next: point leads.drdlearn.com at this server in Porkbun DNS,"
echo "then configure the reverse proxy (see deploy/Caddyfile) for TLS."
