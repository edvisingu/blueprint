# Optional Host-Level Services

These run on the VPS **host** (systemd), not in Docker, and are not part of
`bootstrap.sh`. Install deliberately, one at a time.

## hermes-agent (recommended — the Telegram/Discord gateway)

See [hermes-gateway/README.md](../hermes-gateway/README.md). This is the §22
interface layer and the main way Dr. D talks to the fleet from his phone.

## Tailscale (recommended for team access, §21.5)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up   # interactive browser auth
```
Gives the laptop + student devs private-mesh access to n8n (5678), Uptime Kuma
(3001), and the router (8000) without exposing public ports.

## OpenJarvis (optional, §0.1/§21.4b) — READ THIS FIRST

OpenJarvis is a real Stanford project (Scaling Intelligence Lab + Hazy
Research): local-first personal AI with agents, tools, and memory.

> **SECURITY (ERRATA #2):** the manual says to install from
> `https://openjarvis.ai/install.sh`. That domain is NOT the project's
> documented home and could serve anything. Use the official source only:

```bash
# Download, READ IT, then run:
curl -fsSL https://open-jarvis.github.io/OpenJarvis/install.sh -o /tmp/openjarvis-install.sh
less /tmp/openjarvis-install.sh
bash /tmp/openjarvis-install.sh

jarvis doctor
cd ~/OpenJarvis && ./scripts/quickstart.sh   # dashboard on :5173 (keep firewalled)
```

Config (`~/OpenJarvis/.env`): `MODEL_PROVIDER=anthropic`,
`ANTHROPIC_API_KEY=...`, `PRIMARY_MODEL=claude-sonnet-4-6`, `CODE_MODEL=gpt-4o`.
Auto-start unit: [deploy/systemd/openjarvis.service](../deploy/systemd/openjarvis.service).

Caveat: the manual's "OpenJarvis orchestrates hermes-agent + the fleet" story
is the author's architecture, not something OpenJarvis does out of the box.
Treat it as an experiment alongside the fleet, not a dependency of it —
nothing in this repo requires OpenJarvis.

## nginx + certbot (§21.6 — needed for public interfaces)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
# bootstrap.sh installs the site configs when nginx is present; then:
sudo certbot --nginx -d agents.edvisingu.com
sudo certbot --nginx -d status.edvisingu.com
```
