# Tool 7 — GitHub API, hermes-builder (Masterbuild §23.7)
import os


def _gh():
    from github import Github

    return Github(os.environ["GITHUB_TOKEN"])


def create_repo(name: str, description: str, private: bool = True) -> dict:
    g = _gh()
    repo = g.get_user().create_repo(
        name=name, description=description, private=private, auto_init=True
    )
    return {"url": repo.html_url, "clone": repo.clone_url}


def push_file(repo_name: str, path: str, content: str, message: str) -> dict:
    g = _gh()
    repo = g.get_user().get_repo(repo_name)
    try:
        existing = repo.get_contents(path)
        repo.update_file(path, message, content, existing.sha)
    except Exception:
        repo.create_file(path, message, content)
    return {"status": "pushed", "repo": repo_name, "file": path}
