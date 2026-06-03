import asyncio
import sys
sys.path.insert(0, ".")
from app.services.arxiv_service import ArxivService

async def test():
    svc = ArxivService()
    
    print("Testing with CS/ML topic (arXiv DOI detection)...")
    papers = await svc.search_papers(["transformer attention mechanism neural network"], max_per_query=5)
    print(f"Found {len(papers)} papers")
    for p in papers[:3]:
        real_id = p.get("real_arxiv_id", "none")
        print(f"  paper_id={p['arxiv_id']}")
        print(f"  real_arxiv={real_id}")
        print(f"  pdf={p['pdf_url'] or 'none'}")
        print(f"  abstract_len={len(p['abstract'])} chars")
        print()

asyncio.run(test())
