# Redis Task Bus (Masterbuild §24.7 — production upgrade of the §20.6 file bus)
import json
import os


def _redis():
    import redis

    return redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379"))


def publish_task(agent: str, action: str, payload: dict) -> dict:
    r = _redis()
    task = {"agent": agent, "action": action, "payload": payload}
    r.lpush(f"tasks:{agent}", json.dumps(task))
    return {"queued": True, "agent": agent}


def get_next_task(agent_name: str):
    r = _redis()
    raw = r.rpop(f"tasks:{agent_name}")
    return json.loads(raw) if raw else None


def publish_result(agent_name: str, task: dict, result: str) -> None:
    r = _redis()
    r.lpush(f"tasks:results:{agent_name}", json.dumps({"task": task, "result": result}))
