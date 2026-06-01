"""
arXiv Service — Fetch paper metadata and PDFs via the arXiv API.
"""
import arxiv
import asyncio
import httpx
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
import re
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class ArxivService:
    def __init__(self):
        self.client = arxiv.Client(
            page_size=10,
            delay_seconds=3.0,
            num_retries=5,
        )

    async def search_papers(
        self,
        queries: List[str],
        max_per_query: int = 8,
        max_total: int = 30,
    ) -> List[Dict[str, Any]]:
        """Search arXiv for papers matching multiple queries. Returns deduplicated results."""
        seen_ids: set = set()
        all_papers: List[Dict[str, Any]] = []
        last_error = None

        for query in queries:
            try:
                papers = await asyncio.to_thread(
                    self._search_sync, query, max_per_query
                )
                for p in papers:
                    if p["arxiv_id"] not in seen_ids and len(all_papers) < max_total:
                        seen_ids.add(p["arxiv_id"])
                        all_papers.append(p)
            except Exception as e:
                logger.error(f"arXiv search error for query '{query}': {e}")
                last_error = e

        if not all_papers and last_error:
            raise RuntimeError(f"arXiv search failed: {last_error}")

        logger.info(f"Found {len(all_papers)} unique papers across {len(queries)} queries")
        return all_papers

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(min=4, max=30))
    def _search_sync(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """Synchronous arXiv search (runs in thread pool)."""
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        results = []
        for r in self.client.results(search):
            results.append(self._paper_to_dict(r))
        return results

    def _paper_to_dict(self, result: arxiv.Result) -> Dict[str, Any]:
        """Convert arxiv.Result to a serializable dict."""
        arxiv_id = result.entry_id.split("/")[-1]
        # Strip version suffix (e.g., 2301.12345v2 → 2301.12345)
        arxiv_id = re.sub(r"v\d+$", "", arxiv_id)
        return {
            "arxiv_id": arxiv_id,
            "title": result.title.strip(),
            "abstract": result.summary.strip(),
            "authors": [a.name for a in result.authors],
            "published_date": result.published.strftime("%Y-%m-%d") if result.published else None,
            "categories": result.categories,
            "pdf_url": result.pdf_url,
            "entry_url": result.entry_id,
        }

    async def download_pdf(self, arxiv_id: str, dest_dir: str) -> Optional[str]:
        """Download PDF for a given arXiv ID. Returns local file path or None."""
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        dest_path = Path(dest_dir) / f"{arxiv_id}.pdf"
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                for attempt in range(3):
                    resp = await client.get(pdf_url, headers={"User-Agent": "OmnicrossX-AI/1.0 (mailto:admin@example.com)"})
                    if resp.status_code == 200:
                        dest_path.write_bytes(resp.content)
                        logger.info(f"Downloaded PDF: {arxiv_id} ({len(resp.content)} bytes)")
                        return str(dest_path)
                    elif resp.status_code in [403, 429, 503]:
                        logger.warning(f"ArXiv download rate limited (Status {resp.status_code}) on attempt {attempt+1}. Waiting...")
                        await asyncio.sleep(3 * (attempt + 1))
                    else:
                        resp.raise_for_status()
                logger.error(f"Failed to download PDF {arxiv_id} after retries.")
                return None
        except Exception as e:
            logger.error(f"Failed to download PDF {arxiv_id}: {e}")
            return None

    async def fetch_paper_metadata(self, arxiv_id: str) -> Optional[Dict[str, Any]]:
        """Fetch metadata for a single paper by arXiv ID."""
        try:
            search = arxiv.Search(id_list=[arxiv_id])
            results = list(self.client.results(search))
            if results:
                return self._paper_to_dict(results[0])
        except Exception as e:
            logger.error(f"Failed to fetch metadata for {arxiv_id}: {e}")
        return None
