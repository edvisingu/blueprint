# Parametrized checks over all 10 foundation agents: SOUL.md present, app
# imports, /health identity, and the tool whitelist matches Masterbuild §23.8.
import importlib.util
import os
import sys

import pytest
from fastapi.testclient import TestClient

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ["TOOLS_PARENT"] = REPO_ROOT

# Masterbuild §23.8 — the authoritative tool assignment map
EXPECTED_TOOLS = {
    "hermes-core": {"web_search", "create_file", "create_notion_page", "trigger_workflow"},
    "hermes-content": {"web_search", "create_file", "trigger_content_pipeline"},
    "hermes-advisor": {"web_search", "create_notion_page", "append_to_database"},
    "hermes-credihire": {"create_file", "web_search"},
    "hermes-ops": {"run_python_code", "trigger_workflow", "create_file"},
    "hermes-social": {"trigger_workflow", "web_search", "create_notion_page"},
    "hermes-builder": {"run_python_code", "create_repo", "push_file", "create_file", "web_search"},
    "hermes-research": {"web_search", "create_file", "create_notion_page", "run_python_code"},
    "hermes-finance": {"get_mrr", "get_recent_revenue", "run_python_code", "create_file"},
    "hermes-email": {"trigger_email_send", "create_notion_page", "web_search"},
}

AGENTS = sorted(EXPECTED_TOOLS)


def _load(agent: str):
    path = os.path.join(REPO_ROOT, "agents", agent, "main.py")
    spec = importlib.util.spec_from_file_location(f"agent_{agent.replace('-', '_')}", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module", params=AGENTS)
def agent_module(request):
    return request.param, _load(request.param)


def test_soul_exists_and_nonempty(agent_module):
    agent, mod = agent_module
    soul_path = os.path.join(REPO_ROOT, "agents", agent, "SOUL.md")
    assert os.path.isfile(soul_path)
    assert len(mod.SOUL.strip()) > 100
    assert mod.SOUL.startswith(f"# SOUL: {agent}")


def test_health_reports_agent_name(agent_module):
    agent, mod = agent_module
    with TestClient(mod.app) as client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "agent": agent}


def test_tool_whitelist_matches_section_23_8(agent_module):
    agent, mod = agent_module
    assert set(mod.TOOLS) == EXPECTED_TOOLS[agent]
    assert all(callable(f) for f in mod.TOOLS.values())


def test_system_prompt_includes_soul_and_tools(agent_module):
    agent, mod = agent_module
    assert mod.SYSTEM.startswith(mod.SOUL)
    for tool in EXPECTED_TOOLS[agent]:
        assert tool in mod.SYSTEM


def test_tool_directive_parser(agent_module):
    _, mod = agent_module
    call = mod._extract_tool_call('```json\n{"tool": "web_search", "args": {"query": "x"}}\n```')
    assert call == {"tool": "web_search", "args": {"query": "x"}}
    assert mod._extract_tool_call("plain text answer") is None
    assert mod._extract_tool_call('{"tool": "web_search", "args": {}}')["tool"] == "web_search"
    assert mod._extract_tool_call('{"not_a_tool": 1}') is None
