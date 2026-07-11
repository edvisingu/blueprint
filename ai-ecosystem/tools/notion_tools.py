# Tool 5 — Notion API (Masterbuild §23.5)
import os


def _client():
    from notion_client import Client

    return Client(auth=os.environ["NOTION_TOKEN"])


def create_notion_page(parent_id: str, title: str, content: str) -> dict:
    notion = _client()
    p = notion.pages.create(
        parent={"page_id": parent_id},
        properties={"title": {"title": [{"text": {"content": title}}]}},
        children=[
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": content}}]},
            }
        ],
    )
    return {"page_id": p["id"], "url": p["url"]}


def append_to_database(db_id: str, properties: dict) -> dict:
    notion = _client()
    p = notion.pages.create(parent={"database_id": db_id}, properties=properties)
    return {"page_id": p["id"]}
