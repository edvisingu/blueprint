# EdVisingU FastAPI router — merged from Masterbuild §20.8 (agent forwarding),
# §22.2 (OpenAI-compatible endpoints) and §26.2 (multi-model routing).
#
# The manual's §26.2 router answered requests itself and never forwarded to the
# agent containers, which left SOUL.md and tools unused (docs/ERRATA.md #1).
# This version restores the split §31.3 describes: the router owns every model
# call (all provider keys live ONLY in this container); agents own persona,
# tools, and state, and call back to POST /internal/complete.
import os
from typing import List, Optional

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from config import (
    AGENT_CONTAINERS,
    CODEX_AGENTS,
    GEMINI_AGENTS,
    GEMMA_AGENTS,
    HAIKU_AGENTS,
    MODEL_CODEX,
    MODEL_DEFAULT,
    MODEL_GEMINI,
    MODEL_HAIKU,
)

app = FastAPI(title="EdVisingU Agent Router")


class Message(BaseModel):
    role: str
    content: str


class OAIRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: Optional[bool] = False


class ChatRequest(BaseModel):
    message: str
    history: List[dict] = []


class InternalRequest(BaseModel):
    agent: str
    system: str = ""
    messages: List[dict]


@app.get("/health")
def health():
    return {"status": "ok", "agents": len(AGENT_CONTAINERS)}


@app.get("/v1/models")
def list_models():
    return {"data": [{"id": k, "object": "model"} for k in AGENT_CONTAINERS]}


async def _forward_to_agent(agent: str, message: str, history: List[dict]) -> str:
    url = f"{AGENT_CONTAINERS[agent]}/chat"
    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(url, json={"message": message, "history": history})
        r.raise_for_status()
        return r.json().get("response", "Agent error")


# Open WebUI entry point (§22.2): model dropdown = agent selector.
@app.post("/v1/chat/completions")
async def oai_chat(req: OAIRequest):
    agent = req.model if req.model in AGENT_CONTAINERS else "hermes-core"
    last = req.messages[-1].content
    history = [{"role": m.role, "content": m.content} for m in req.messages[:-1]]
    reply = await _forward_to_agent(agent, last, history)
    return {
        "id": "edvisingu",
        "object": "chat.completion",
        "model": agent,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": reply},
                "finish_reason": "stop",
            }
        ],
    }


# hermes-agent dispatch-skill entry point (§20.8/§22.3).
@app.post("/agent/{agent_name}/chat")
async def route_to_agent(agent_name: str, req: ChatRequest):
    if agent_name not in AGENT_CONTAINERS:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
    reply = await _forward_to_agent(agent_name, req.message, req.history)
    return {"response": reply, "agent": agent_name}


def _complete_codex(messages: List[dict]) -> str:
    r = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY', '')}"},
        json={"model": MODEL_CODEX, "messages": messages},
        timeout=120,
    )
    return r.json()["choices"][0]["message"]["content"]


def _complete_gemini(messages: List[dict], system: str) -> str:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GOOGLE_AI_API_KEY"])
    model = genai.GenerativeModel(MODEL_GEMINI, system_instruction=system or None)
    result = model.generate_content(messages[-1]["content"])
    return result.text


def _complete_claude(messages: List[dict], system: str, model: str, max_tokens: int) -> str:
    import anthropic

    client = anthropic.Anthropic()
    r = client.messages.create(
        model=model, max_tokens=max_tokens, system=system or "", messages=messages
    )
    return r.content[0].text


# Agents call back here for every model completion. Guarded by a shared token
# so nothing outside the Docker network can spend API credits.
@app.post("/internal/complete")
async def internal_complete(req: InternalRequest, x_internal_token: str = Header(default="")):
    expected = os.environ.get("ROUTER_INTERNAL_TOKEN", "")
    if not expected or x_internal_token != expected:
        raise HTTPException(status_code=401, detail="Invalid internal token")

    if os.environ.get("FAKE_LLM", "0") == "1":
        last = req.messages[-1]["content"] if req.messages else ""
        return {"reply": f"[fake-llm:{req.agent}] {last}"}

    agent = req.agent
    # OpenAI's API carries the system prompt as a leading system message.
    codex_messages = [{"role": "system", "content": req.system}] + req.messages if req.system else req.messages

    if agent in CODEX_AGENTS:
        reply = await run_in_threadpool(_complete_codex, codex_messages)
    elif agent in GEMINI_AGENTS:
        reply = await run_in_threadpool(_complete_gemini, req.messages, req.system)
    elif agent in HAIKU_AGENTS:
        reply = await run_in_threadpool(
            _complete_claude, req.messages, req.system, MODEL_HAIKU, 1024
        )
    elif agent in GEMMA_AGENTS:
        # Local Gemma via Ollama — intentionally disabled. §25.6 hard rule:
        # NEVER run Ollama on the VPS; it starves the container fleet.
        # To re-enable on a GPU box, POST to http://<ollama-host>:11434/api/chat
        # with {"model": "gemma3:12b", "messages": ..., "stream": False}.
        raise HTTPException(status_code=501, detail="GEMMA_AGENTS routing is disabled (§25.6)")
    else:
        reply = await run_in_threadpool(
            _complete_claude, req.messages, req.system, MODEL_DEFAULT, 8096
        )
    return {"reply": reply}
