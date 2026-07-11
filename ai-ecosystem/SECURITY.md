# Security Checklist & Runbooks (Masterbuild §14)

Run the full checklist before each phase sign-off (§16).

## §14.1 Audit checklist

- [ ] `.env` exists only on the VPS at `/opt/edvisingu/.env`; never committed
- [ ] `.gitignore` covers `.env*`, `state.db`, `memories/`, `sessions/`, data volumes
- [ ] Secret scan clean: `grep -rE "sk-ant|sk-or-|sk_live|ghp_|AIzaSy" --exclude-dir=.git .`
- [ ] Repo is **private**
- [ ] 2FA enabled on: GitHub, Hetzner, Supabase, Cloudflare, Google, Stripe, Anthropic, OpenAI
- [ ] All credentials stored in Bitwarden, nowhere else
- [ ] Supabase RLS enabled on every table (service_role-only until auth lands)
- [ ] UFW: only 22/80/443 open; every container port binds 127.0.0.1
- [ ] n8n and Uptime Kuma are NOT publicly exposed (SSH tunnel or Tailscale only;
      kuma optionally via status.edvisingu.com behind nginx+TLS)
- [ ] `ROUTER_INTERNAL_TOKEN` set to a random 64-hex value; `/internal/complete`
      rejects requests without it
- [ ] Model API keys exist ONLY in the router container (check `docker inspect`)
- [ ] fail2ban active; root SSH login and password auth disabled
- [ ] No container can read another agent's `/data` (volume mounts are per-agent)

## §14.2 Key rotation — when a key leaks

1. **Revoke** the key at the provider immediately.
2. **Regenerate** and update Bitwarden + `/opt/edvisingu/.env`.
3. `docker compose up -d` to restart with the new key.
4. If the key hit git history: rewrite with BFG or `git filter-repo`,
   force-push, and treat the old history as public — rotate everything in it.
5. Log the incident (what leaked, where, blast radius) in Notion.

## curl | bash policy

Never pipe an installer straight to bash from a domain you haven't verified.
Download first, read it, then run. Known issue: the Masterbuild manual cites
`openjarvis.ai/install.sh` — an unverified domain. The official OpenJarvis
installer is `https://open-jarvis.github.io/OpenJarvis/install.sh`
(see docs/OPTIONAL-HOST-SERVICES.md).

## Weekly (§17.2)

- `grep -rE "sk-ant|sk-or-" --exclude-dir=.git .` on the VPS repo copy
- Review API spend dashboards (Anthropic, OpenAI, OpenRouter, Google)
- `sudo apt update && sudo apt upgrade -y`; `docker compose pull` for images
