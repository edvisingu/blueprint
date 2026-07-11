# Agent registry + model routing sets (Masterbuild §26.2, foundation fleet §24.1).
# Add a new agent: scripts/new-agent.sh prints the lines to add here (§31.5).
import os

# Foundation fleet — agents 1-10 (§24.1). Port 8007 is skipped in the manual's
# numbering; preserved as-is (docs/ERRATA.md #6).
AGENT_CONTAINERS = {
    "hermes-core": "http://hermes-core:8000",
    "hermes-content": "http://hermes-content:8000",
    "hermes-advisor": "http://hermes-advisor:8000",
    "hermes-credihire": "http://hermes-credihire:8000",
    "hermes-ops": "http://hermes-ops:8000",
    "hermes-social": "http://hermes-social:8000",
    "hermes-builder": "http://hermes-builder:8000",
    "hermes-research": "http://hermes-research:8000",
    "hermes-finance": "http://hermes-finance:8000",
    "hermes-email": "http://hermes-email:8000",
    # --- Agents 11-25 (§27) — uncomment as each is deployed via scripts/new-agent.sh ---
    # "hermes-ads": "http://hermes-ads:8000",
    # "hermes-seo": "http://hermes-seo:8000",
    # "hermes-funnel": "http://hermes-funnel:8000",
    # "hermes-etsy": "http://hermes-etsy:8000",
    # "hermes-outreach": "http://hermes-outreach:8000",
    # "hermes-proposals": "http://hermes-proposals:8000",
    # "hermes-crm": "http://hermes-crm:8000",
    # "hermes-crediversity": "http://hermes-crediversity:8000",
    # "hermes-hireed": "http://hermes-hireed:8000",
    # "hermes-educonnect": "http://hermes-educonnect:8000",
    # "hermes-whop": "http://hermes-whop:8000",
    # "hermes-tiktok": "http://hermes-tiktok:8000",
    # "hermes-campaign": "http://hermes-campaign:8000",
    # "hermes-gumroad": "http://hermes-gumroad:8000",
    # "hermes-pinterest": "http://hermes-pinterest:8000",
}

# Model assignment (§26.1/§26.2). Agents in no set default to Claude Sonnet.
CODEX_AGENTS = {"hermes-builder"}
GEMINI_AGENTS = {"hermes-social"}  # later: hermes-seo, hermes-tiktok, hermes-ads, hermes-pinterest
HAIKU_AGENTS = {"hermes-ops", "hermes-finance"}  # later: hermes-crm, hermes-whop, hermes-etsy, hermes-gumroad
GEMMA_AGENTS = set()  # local Ollama routing is disabled: NEVER run Ollama on the VPS (§25.6)

MODEL_DEFAULT = os.environ.get("MODEL_DEFAULT", "claude-sonnet-4-6")
MODEL_HAIKU = os.environ.get("MODEL_HAIKU", "claude-haiku-4-5-20251001")
MODEL_GEMINI = os.environ.get("MODEL_GEMINI", "gemini-2.0-flash")
MODEL_CODEX = os.environ.get("MODEL_CODEX", "gpt-4o")
