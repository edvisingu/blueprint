# Deploying to leads.drdlearn.com

## Fastest path: one command

On the server, as root:

```bash
git clone -b claude/explee-clone-ks2mdw https://github.com/edvisingu/blueprint.git /tmp/drd \
  && sudo bash /tmp/drd/drd-lead-engine/deploy/install.sh
```

It checks Node, installs the app and service, installs cloudflared, walks you
through Cloudflare authorization, creates the tunnel and DNS route, starts
everything, then prints your login password and the URL.

Re-run the same script to update; it never overwrites existing secrets.
To install the app only and wire up the network yourself, add `SKIP_TUNNEL=1`.

Everything below is the same process done manually, plus operations notes.

Two supported paths. Both end with the app on `https://leads.drdlearn.com`,
password-protected, with the database on local disk.

**Before either path, check the one thing that usually blocks it:**

```bash
node -v                        # must be 22.5.0 or newer
node -e "require('node:sqlite')"   # must print nothing (no error)
```

The app uses Node's built-in SQLite. On Node older than 22.5 it will not run.
`deploy/setup.sh` installs Node 22 from NodeSource if it is missing or too old.

---

## Path A — Cloudflare Tunnel (recommended)

Best fit when you already have a server and a Cloudflare account. The server
dials out to Cloudflare, so you open **no inbound ports**, need **no static IP**,
and get TLS without managing certificates. Your origin IP stays private.

**Requirement:** `drdlearn.com` must use Cloudflare nameservers. Porkbun stays
your registrar; Cloudflare becomes the DNS host. A tunnel route creates a CNAME
to `<tunnel-id>.cfargotunnel.com`, which only resolves inside Cloudflare DNS, so
this step is not optional for this path.

### 1. Move DNS to Cloudflare (one time, ~10 minutes to propagate)

1. Cloudflare dashboard → **Add a site** → `drdlearn.com` → Free plan.
2. Cloudflare imports your existing records. **Check them against Porkbun before
   continuing** — especially MX and TXT, or you will break email.
3. Cloudflare shows two nameservers. In **Porkbun → Domain Management →
   Authoritative Nameservers**, replace Porkbun's with Cloudflare's two.

### 2. Install the app on the server

```bash
sudo bash deploy/setup.sh          # installs to /opt, creates the drd user,
                                   # writes secrets, starts the systemd service
```

It prints a generated login password once. Save it. To choose your own instead:

```bash
sudo DRD_ADMIN_PASSWORD='your-password' bash deploy/setup.sh
```

Confirm it is up locally:

```bash
curl -fsS http://127.0.0.1:8080/v1/health
```

### 3. Create the tunnel

```bash
# install cloudflared (Debian/Ubuntu)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

cloudflared tunnel login                        # opens a browser to authorize
cloudflared tunnel create drd-lead-engine       # prints the tunnel id
cloudflared tunnel route dns drd-lead-engine leads.drdlearn.com
```

Copy `deploy/cloudflared-config.yml` to `/etc/cloudflared/config.yml` and replace
`<TUNNEL-ID>` in both places. Then run it as a service:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

Visit **https://leads.drdlearn.com** and sign in.

### Optional: add Cloudflare Access

Zero Trust → Access → Applications → add `leads.drdlearn.com` and allow only
your email. That puts an identity check in front of the app's own password.

---

## Path B — Direct A record, keep DNS at Porkbun

Use this if you would rather not move nameservers. Requires a **static public
IP** and ports **80** and **443** open to the internet.

### 1. Porkbun DNS

Porkbun → `drdlearn.com` → **DNS Records** → add:

| Type | Host    | Answer              | TTL |
| ---- | ------- | ------------------- | --- |
| A    | `leads` | your server's IPv4  | 600 |

Add an `AAAA` record with the IPv6 address too if the server has one. Leave the
apex `drdlearn.com` record alone — this only adds a subdomain.

### 2. Install the app

```bash
sudo bash deploy/setup.sh
```

### 3. Terminate TLS with Caddy

```bash
sudo apt-get install -y caddy
```

Append the block in `deploy/Caddyfile` to `/etc/caddy/Caddyfile`, then:

```bash
sudo systemctl reload caddy
```

Caddy requests a Let's Encrypt certificate automatically on first request.
DNS must already resolve, or the certificate request fails.

---

## Operating it

```bash
sudo systemctl status drd-lead-engine      # is it running
sudo journalctl -u drd-lead-engine -f      # live logs
sudo systemctl restart drd-lead-engine     # after a config change
```

**Update to the latest code:**

```bash
sudo bash deploy/setup.sh                  # re-runs git fetch + reset, restarts
```

`setup.sh` will not overwrite `/etc/drd-lead-engine.env`, so your password and
session secret survive updates.

**Back up the database** — it is a single file:

```bash
sudo sqlite3 /var/lib/drd-lead-engine/drd.db ".backup '/root/drd-$(date +%F).db'"
```

**Reset to a clean seeded state:** stop the service, delete
`/var/lib/drd-lead-engine/drd.db*`, start it again. It re-seeds on boot.

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DRD_ADMIN_PASSWORD` | yes, when public | Login password. Server refuses to start public without it. |
| `DRD_SESSION_SECRET` | yes, when public | Signs session cookies. Changing it logs everyone out. |
| `DRD_PUBLIC` | yes | `1` enables HSTS, forces `Secure` cookies, enforces the two guards above. |
| `DRD_DB_PATH` | recommended | Where SQLite lives. Keep it outside the app directory so updates never touch it. |
| `PORT` / `HOST` | recommended | `8080` / `127.0.0.1` behind a proxy. |
| `ANTHROPIC_API_KEY` | optional | Switches the AI layer from deterministic to live Claude calls. |

## Security notes

- The browser never receives an API key. It authenticates with an httpOnly,
  `SameSite=Lax`, `Secure` session cookie that expires after 12 hours.
- API keys are for server-to-server callers (n8n, scripts) and are stored hashed.
- `/etc/drd-lead-engine.env` is `chmod 600`, root-owned, and holds the secrets.
- The service runs as an unprivileged `drd` user under systemd hardening, with
  write access only to the database directory.
