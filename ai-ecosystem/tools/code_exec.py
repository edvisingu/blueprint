# Tool 2 — Code Execution Sandbox (Masterbuild §23.2)
import os
import subprocess
import tempfile


def run_python_code(code: str, timeout: int = 30) -> dict:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp = f.name
    try:
        r = subprocess.run(["python3", tmp], capture_output=True, text=True, timeout=timeout)
        return {"stdout": r.stdout, "stderr": r.stderr, "returncode": r.returncode}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Timeout", "returncode": -1}
    finally:
        os.unlink(tmp)
