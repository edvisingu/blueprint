# n8n Content Factory (Masterbuild §9.2 / §6.3)

Build this workflow in the n8n UI (SSH tunnel to `127.0.0.1:5678`), then
export it as JSON into this folder (`content-factory.json`) and commit — the
§16 Phase-4 sign-off requires exported workflows in git.

## Webhook contract (what `tools/n8n_tools.py` expects)

| Webhook ID | Payload | Used by |
|---|---|---|
| `content-pipeline` | `{"topic": str, "platform": str}` | `trigger_content_pipeline` (hermes-content) |
| `gmail-send` | `{"to": str, "subject": str, "body": str}` | `trigger_email_send` (hermes-email — drafts require Dr. D approval before send, §24.5) |

## Workflow shape (7 nodes, §9.2)

1. **Webhook** — path `content-pipeline`
2. **HTTP Request** — POST `http://hermes-content:8000/chat` with
   `{"message": "Create {{platform}} content about: {{topic}}", "history": []}`
3. **Code** — parse/shape the agent response
4. **Supabase** — insert into `content_queue` (`topic, platform, raw_content, status='pending'`)
5. **IF** — `auto_publish` flag
6. **HTTP Request** — Blotato scheduling API (true branch)
7. **Gmail/Email** — review digest to Dr. D (false branch)

Platform format rules (§9.3) live in hermes-content's SOUL context — the agent
returns platform-correct output (LinkedIn post vs TikTok script vs newsletter).

## Daily trend workflow (§10.3)

Schedule 8 AM EST → trend fetch → POST `/agent/hermes-content/chat` →
Supabase `content_queue` (`pending_review`) → Gmail digest.
