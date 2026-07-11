#!/usr/bin/env bash
# Add a new specialist agent in the Masterbuild §31 4-step pattern.
#   ./scripts/new-agent.sh hermes-seo 8013
# Renders agents/_template into agents/<name>/, then prints the registration
# lines for router/config.py and docker-compose.yml (§31.5) — those two edits
# stay manual so you consciously pick the model group.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NAME="${1:?Usage: ./scripts/new-agent.sh hermes-<name> <host-port>}"
PORT="${2:?Usage: ./scripts/new-agent.sh hermes-<name> <host-port>}"

[[ "$NAME" == hermes-* ]] || { echo "Agent name must start with 'hermes-'"; exit 1; }
[[ -d "agents/$NAME" ]] && { echo "agents/$NAME already exists"; exit 1; }

mkdir -p "agents/$NAME"
# No tools by default — edit TOOLS in main.py afterwards (§23.8 is the map).
sed -e "s/{{NAME}}/$NAME/g" \
    -e "s/^{{TOOL_IMPORTS}}$//" \
    -e "s/^{{TOOL_DICT}}$//" \
    agents/_template/main.py.tmpl > "agents/$NAME/main.py"
sed "s/{{EXTRA_DEPS}}//" agents/_template/requirements.txt.tmpl > "agents/$NAME/requirements.txt"
cp agents/_template/Dockerfile.tmpl "agents/$NAME/Dockerfile"
sed "s/{{NAME}}/$NAME/g" agents/_template/SOUL.md.tmpl > "agents/$NAME/SOUL.md"

cat <<EOF

Created agents/$NAME/. Now (Masterbuild §31.5):

1. Edit agents/$NAME/SOUL.md — identity, capabilities, rules.
2. Edit agents/$NAME/main.py — add tool imports + TOOLS entries if needed.
3. router/config.py — uncomment or add:
       "$NAME": "http://$NAME:8000",
   and add "$NAME" to HAIKU_AGENTS / GEMINI_AGENTS / CODEX_AGENTS
   (or nothing for the Claude Sonnet default). See §26.1 for the matrix.
4. docker-compose.yml — add:

  $NAME:
    <<: *agent-common
    build: ./agents/$NAME
    container_name: $NAME
    ports:
      - "127.0.0.1:$PORT:8000"
    volumes:
      - \${DATA_ROOT:-/srv}/$NAME/data:/data
      - \${DATA_ROOT:-/srv}/agent-bus:/agent-bus
      - \${DATA_ROOT:-/srv}/shared-files:/srv/shared-files
      - ./tools:/app/tools:ro

5. Runtime dir on the VPS:  sudo mkdir -p /srv/$NAME/data/{memories,skills,cron,sessions,logs}
6. Deploy + test (§31.6):   docker compose up -d --build $NAME
                            curl http://127.0.0.1:$PORT/health
7. Add an Uptime Kuma monitor (docs/MONITORING.md).
EOF
