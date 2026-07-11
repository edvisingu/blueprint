# hermes-agent Gateway (Masterbuild §22.3)

[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) is
the user-facing gateway: Telegram, Discord, Slack, WhatsApp, CLI, plus memory,
skills, cron, and MCP. It runs as a **host systemd service, NOT in Docker** —
Docker is reserved for the specialist fleet. Do NOT build a custom Telegram
bot; this replaces it entirely (§0.2).

## Install (on the VPS)

```bash
# 1. Install (official install script from the GitHub repo)
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes --version

# 2. Setup wizard
hermes setup
#   AI provider:  Anthropic
#   API key:      ANTHROPIC_API_KEY from Bitwarden
#   Model:        claude-sonnet-4-6  (claude-haiku-4-5-20251001 for cheap/fast)
#   Telegram:     yes — token from @BotFather (/newbot > "EdVisingU Hermes")
#   Memory:       yes
#   MCP:          yes

# 3. Default model
hermes config set model anthropic:claude-sonnet-4-6

# 4. Gateway as a service
hermes gateway install-service
sudo systemctl enable hermes-gateway && sudo systemctl start hermes-gateway
```

> Review any `curl | bash` script before running it (see SECURITY.md).
> Download first, read, then execute if it checks out.

## Wire it to the fleet

```bash
mkdir -p ~/.hermes/skills
cp skills/dispatch-to-fleet.md ~/.hermes/skills/
```

The dispatch skill routes specialist requests to the FastAPI router at
`http://localhost:8000/agent/<name>/chat`. The router port is bound to
127.0.0.1, so only host processes (like hermes-agent) can reach it.

## Cron briefings (§22.3 step 6)

```bash
# Morning briefing, 7:00 AM EST daily (12:00 UTC)
hermes cron add "0 12 * * *" "Morning briefing: check Stripe MRR vs yesterday, any system alerts from Uptime Kuma, top 3 priorities for today. Dispatch to hermes-finance for MRR and hermes-ops for system status." --deliver telegram

# Weekly revenue report, Mondays 8 AM EST
hermes cron add "0 13 * * 1" "Weekly revenue report: MRR, new Whop members, total vs last week." --deliver telegram
```
