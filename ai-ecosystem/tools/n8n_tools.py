# Tool 4 — n8n Workflow Trigger (Masterbuild §23.4)
# Webhook contract: docs/n8n/content-factory.md
import os

import httpx


def trigger_workflow(webhook_id: str, payload: dict) -> dict:
    n8n = os.environ.get("N8N_BASE_URL", "http://n8n:5678")
    r = httpx.post(f"{n8n}/webhook/{webhook_id}", json=payload, timeout=30)
    return {"status": r.status_code, "response": r.text}


def trigger_content_pipeline(topic: str, platform: str) -> dict:
    return trigger_workflow("content-pipeline", {"topic": topic, "platform": platform})


def trigger_email_send(to: str, subject: str, body: str) -> dict:
    return trigger_workflow("gmail-send", {"to": to, "subject": subject, "body": body})
