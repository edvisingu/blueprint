# hermes-content — EdVisingU specialist agent (Masterbuild §31.3 pattern).
# The FastAPI router handles model selection and the AI call (§26.2, via
# POST /internal/complete); this service owns persona (SOUL.md), tool use
# (§23.8 whitelist) and task-bus state (§20.6/§24.7).
import asyncio
import json
import os
import re
import sys
from typing import List

import httpx
from fastapi import FastAPI
from pydantic import BaseModel

AGENT_NAME = "hermes-content"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# tools/ is volume-mounted at /app/tools in the container; tests point
# TOOLS_PARENT at the repo checkout instead.
sys.path.insert(0, os.environ.get("TOOLS_PARENT", BASE_DIR))

from tools import task_bus  # noqa: E402
from tools.file_tools import create_file  # noqa: E402
from tools.n8n_tools import trigger_content_pipeline  # noqa: E402
from tools.search import web_search  # noqa: E402

TOOLS = {
    "web_search": web_search,
    "create_file": create_file,
    "trigger_content_pipeline": trigger_content_pipeline,
}

with open(os.path.join(BASE_DIR, "SOUL.md")) as f:
    SOUL = f.read()

TOOL_INSTRUCTIONS = (
    "\n\n## Tools\n"
    "You can call exactly one tool per request when it helps. To call a tool, "
    "reply with ONLY a fenced JSON block:\n"
    '```json\n{"tool": "<name>", "args": {...}}\n```\n'
    "Available tools: " + ", ".join(TOOLS) + ". "
    "After the tool result comes back, answer the original request."
)

SYSTEM = SOUL + (TOOL_INSTRUCTIONS if TOOLS else "")

ROUTER_URL = os.environ.get("ROUTER_URL", "http://fastapi-router:8000")

app = FastAPI(title=AGENT_NAME)


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []


@app.get("/health")
def health():
    return {"status": "ok", "agent": AGENT_NAME}


async def _complete(messages: List[dict]) -> str:
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(
            f"{ROUTER_URL}/internal/complete",
            headers={"X-Internal-Token": os.environ.get("ROUTER_INTERNAL_TOKEN", "")},
            json={"agent": AGENT_NAME, "system": SYSTEM, "messages": messages},
        )
        r.raise_for_status()
        return r.json()["reply"]


def _extract_tool_call(text: str):
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.S)
    raw = m.group(1) if m else (text.strip() if text.strip().startswith("{") else None)
    if not raw:
        return None
    try:
        d = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return None
    return d if isinstance(d, dict) and "tool" in d else None


@app.post("/chat")
async def chat(req: ChatRequest):
    messages = list(req.history) + [{"role": "user", "content": req.message}]
    reply = await _complete(messages)
    call = _extract_tool_call(reply) if TOOLS else None
    if call and call.get("tool") in TOOLS:
        try:
            result = await asyncio.to_thread(TOOLS[call["tool"]], **call.get("args", {}))
        except Exception as e:  # tool failures go back to the model, not the user
            result = {"error": str(e)}
        messages += [
            {"role": "assistant", "content": reply},
            {
                "role": "user",
                "content": (
                    f"Tool {call['tool']} returned:\n{json.dumps(result, default=str)}\n"
                    "Use this result to answer the original request."
                ),
            },
        ]
        reply = await _complete(messages)
    return {"response": reply, "agent": AGENT_NAME}


@app.on_event("startup")
async def start_task_bus_poller():
    # §20.6 task flow over the §24.7 Redis bus: pop tasks:<agent>, execute via
    # the same chat path, push to tasks:results:<agent>.
    async def poll():
        while True:
            try:
                task = await asyncio.to_thread(task_bus.get_next_task, AGENT_NAME)
                if task:
                    msg = (
                        f"Task: {task.get('action', '')}\n"
                        f"Payload: {json.dumps(task.get('payload', {}))}"
                    )
                    res = await chat(ChatRequest(message=msg, history=[]))
                    await asyncio.to_thread(
                        task_bus.publish_result, AGENT_NAME, task, res["response"]
                    )
                    continue
            except Exception:
                pass  # Redis down or task failed — keep polling
            await asyncio.sleep(5)

    asyncio.create_task(poll())
