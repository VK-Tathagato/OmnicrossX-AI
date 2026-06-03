import asyncio, httpx, json

async def test():
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": "transition metal OER catalyst",
        "limit": 3,
        "fields": "title,abstract,authors,year,externalIds,openAccessPdf"
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        print("Status:", resp.status_code)
        data = resp.json()
        for p in data.get("data", []):
            ext = p.get("externalIds") or {}
            arxiv_id = ext.get("ArXiv", "NO-ARXIV")
            title = p["title"][:55]
            print(f"  arxiv={arxiv_id} | {title}")

asyncio.run(test())
