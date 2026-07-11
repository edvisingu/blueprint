# Tool 1 — Web Search via Tavily (Masterbuild §23.1)
import os


def web_search(query: str, max_results: int = 5) -> dict:
    from tavily import TavilyClient

    client = TavilyClient(api_key=os.environ["TAVILY_API_KEY"])
    result = client.search(query=query, max_results=max_results, search_depth="advanced")
    return {
        "query": query,
        "results": [
            {"title": r["title"], "url": r["url"], "content": r["content"]}
            for r in result["results"]
        ],
    }
