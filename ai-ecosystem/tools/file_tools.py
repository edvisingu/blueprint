# Tool 3 — File Creator (Masterbuild §23.3)
import os
from datetime import datetime

SHARED = os.environ.get("SHARED_FILES", "/srv/shared-files")


def create_file(filename: str, content: str, subfolder: str = "") -> dict:
    folder = os.path.join(SHARED, subfolder) if subfolder else SHARED
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    with open(path, "w") as f:
        f.write(content)
    return {"path": path, "size": os.path.getsize(path), "created": datetime.now().isoformat()}
