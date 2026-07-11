#!/usr/bin/env bash
# First-login server hardening (Masterbuild §21.3) — run once as root on a
# fresh VPS. Idempotent via marker file; re-runs exit immediately.
# WARNING: disables root SSH login and password auth. After this,
# log in as: ssh deploy@YOUR_SERVER_IP (key auth only).
set -euo pipefail

MARKER=/var/lib/edvisingu/.hardened
if [[ -f "$MARKER" ]]; then
  echo "Already hardened ($MARKER exists) — skipping."
  exit 0
fi
[[ "$(id -u)" -eq 0 ]] || { echo "Run as root."; exit 1; }

apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unzip htop rsync

if ! id deploy >/dev/null 2>&1; then
  adduser deploy --disabled-password --gecos ""
  usermod -aG sudo deploy
fi
mkdir -p /home/deploy/.ssh
[[ -f /root/.ssh/authorized_keys ]] && cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
[[ -f /home/deploy/.ssh/authorized_keys ]] && chmod 600 /home/deploy/.ssh/authorized_keys

sed -i 's/#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd || systemctl restart ssh

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

systemctl enable fail2ban && systemctl start fail2ban

mkdir -p "$(dirname "$MARKER")"
touch "$MARKER"
echo "Server hardened. Use: ssh deploy@YOUR_SERVER_IP from now on"
