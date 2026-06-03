import asyncio, httpx, json

async def test_openalex_no_filter():
    """Test without arXiv filter but check which have arXiv IDs"""
    url = "https://api.openalex.org/works"
    params = {
        "search": "transition metal OER electrocatalyst",
        "per-page": 8,
        "filter": "has_abstract:true,open_access.is_oa:true",  # only OA papers with PDFs
        "sort": "relevance_score:desc",
        "mailto": "contact@omnicrossx.ai"
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params)
        print("Status:", resp.status_code)
        data = resp.json()
        results = data.get("results", [])
        print(f"Got {len(results)} OA results")
        for p in results[:5]:
            ids = p.get("ids", {})
            arxiv_url = ids.get("arxiv", "")
            arxiv_id = arxiv_url.split("/")[-1] if arxiv_url else ""
            oa = p.get("open_access", {})
            pdf = oa.get("oa_url", "")
            abstract = p.get("abstract_inverted_index")
            has_abstract = abstract is not None
            print(f"\nTitle: {p.get('title', '')[:60]}")
            print(f"arXiv ID: {arxiv_id or 'none'}")
            print(f"PDF: {pdf or 'none'}")
            print(f"Has abstract: {has_abstract}")

asyncio.run(test_openalex_no_filter())
