import os
import sys

import pytest
from fastapi.testclient import TestClient

ROUTER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROUTER_DIR)

os.environ.setdefault("ROUTER_INTERNAL_TOKEN", "test-token")

import config  # noqa: E402
import main  # noqa: E402

client = TestClient(main.app)

FOUNDATION_AGENTS = [
    "hermes-core",
    "hermes-content",
    "hermes-advisor",
    "hermes-credihire",
    "hermes-ops",
    "hermes-social",
    "hermes-builder",
    "hermes-research",
    "hermes-finance",
    "hermes-email",
]


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "agents": 10}


def test_v1_models_lists_exactly_the_foundation_fleet():
    r = client.get("/v1/models")
    ids = [m["id"] for m in r.json()["data"]]
    assert ids == FOUNDATION_AGENTS


def test_unknown_agent_404():
    r = client.post("/agent/hermes-nope/chat", json={"message": "hi", "history": []})
    assert r.status_code == 404


def test_oai_chat_forwards_to_agent_and_wraps_envelope(monkeypatch):
    seen = {}

    async def fake_forward(agent, message, history):
        seen.update(agent=agent, message=message, history=history)
        return "forwarded-reply"

    monkeypatch.setattr(main, "_forward_to_agent", fake_forward)
    r = client.post(
        "/v1/chat/completions",
        json={
            "model": "hermes-research",
            "messages": [
                {"role": "user", "content": "earlier"},
                {"role": "assistant", "content": "ok"},
                {"role": "user", "content": "now"},
            ],
        },
    )
    body = r.json()
    assert seen["agent"] == "hermes-research"
    assert seen["message"] == "now"
    assert len(seen["history"]) == 2
    assert body["object"] == "chat.completion"
    assert body["model"] == "hermes-research"
    assert body["choices"][0]["message"]["content"] == "forwarded-reply"
    assert body["choices"][0]["finish_reason"] == "stop"


def test_oai_chat_unknown_model_falls_back_to_core(monkeypatch):
    seen = {}

    async def fake_forward(agent, message, history):
        seen["agent"] = agent
        return "ok"

    monkeypatch.setattr(main, "_forward_to_agent", fake_forward)
    client.post(
        "/v1/chat/completions",
        json={"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]},
    )
    assert seen["agent"] == "hermes-core"


def test_agent_chat_forwards(monkeypatch):
    async def fake_forward(agent, message, history):
        return f"reply-from-{agent}"

    monkeypatch.setattr(main, "_forward_to_agent", fake_forward)
    r = client.post("/agent/hermes-ops/chat", json={"message": "status", "history": []})
    assert r.json() == {"response": "reply-from-hermes-ops", "agent": "hermes-ops"}


def test_internal_complete_rejects_bad_token():
    r = client.post(
        "/internal/complete",
        json={"agent": "hermes-core", "system": "", "messages": []},
        headers={"X-Internal-Token": "wrong"},
    )
    assert r.status_code == 401
    r = client.post(
        "/internal/complete", json={"agent": "hermes-core", "system": "", "messages": []}
    )
    assert r.status_code == 401


def test_internal_complete_fake_llm(monkeypatch):
    monkeypatch.setenv("FAKE_LLM", "1")
    r = client.post(
        "/internal/complete",
        json={"agent": "hermes-core", "system": "s", "messages": [{"role": "user", "content": "ping"}]},
        headers={"X-Internal-Token": "test-token"},
    )
    assert r.status_code == 200
    assert r.json()["reply"] == "[fake-llm:hermes-core] ping"


@pytest.mark.parametrize(
    "agent,expected_backend",
    [
        ("hermes-core", "claude:" + config.MODEL_DEFAULT),
        ("hermes-email", "claude:" + config.MODEL_DEFAULT),
        ("hermes-ops", "claude:" + config.MODEL_HAIKU),
        ("hermes-finance", "claude:" + config.MODEL_HAIKU),
        ("hermes-social", "gemini"),
        ("hermes-builder", "codex"),
    ],
)
def test_model_dispatch_per_agent_set(monkeypatch, agent, expected_backend):
    monkeypatch.setenv("FAKE_LLM", "0")
    calls = []
    monkeypatch.setattr(
        main, "_complete_claude", lambda msgs, system, model, mt: calls.append(f"claude:{model}") or "r"
    )
    monkeypatch.setattr(main, "_complete_gemini", lambda msgs, system: calls.append("gemini") or "r")
    monkeypatch.setattr(main, "_complete_codex", lambda msgs: calls.append("codex") or "r")
    r = client.post(
        "/internal/complete",
        json={"agent": agent, "system": "soul", "messages": [{"role": "user", "content": "hi"}]},
        headers={"X-Internal-Token": "test-token"},
    )
    assert r.status_code == 200
    assert calls == [expected_backend]


def test_haiku_max_tokens_and_sonnet_max_tokens(monkeypatch):
    monkeypatch.setenv("FAKE_LLM", "0")
    seen = []
    monkeypatch.setattr(
        main, "_complete_claude", lambda msgs, system, model, mt: seen.append((model, mt)) or "r"
    )
    for agent in ("hermes-ops", "hermes-core"):
        client.post(
            "/internal/complete",
            json={"agent": agent, "system": "", "messages": [{"role": "user", "content": "x"}]},
            headers={"X-Internal-Token": "test-token"},
        )
    assert seen == [(config.MODEL_HAIKU, 1024), (config.MODEL_DEFAULT, 8096)]


def test_gemma_routing_disabled(monkeypatch):
    monkeypatch.setenv("FAKE_LLM", "0")
    monkeypatch.setattr(config, "GEMMA_AGENTS", {"hermes-core"})
    monkeypatch.setattr(main, "GEMMA_AGENTS", {"hermes-core"})
    r = client.post(
        "/internal/complete",
        json={"agent": "hermes-core", "system": "", "messages": [{"role": "user", "content": "x"}]},
        headers={"X-Internal-Token": "test-token"},
    )
    assert r.status_code == 501
