"""
Paper Search Service — Primary: OpenAlex API, Fallback: arXiv library.

WHY OPENALEX?
arXiv's API aggressively rate-limits shared cloud IPs (HuggingFace Spaces,
Render, etc.) with 429/503 errors that cannot be worked around with delays.

OpenAlex:
  - Completely open, no API key needed
  - 200M+ works including ALL arXiv papers + journal articles
  - No IP-based rate limiting (just >10 req/s = 429, easily avoided)
  - Returns abstracts, authors, OA PDF links
  - Recommended: add ?mailto= for polite pool (higher limits, no block risk)

Fallback:
  If OpenAlex returns nothing, we try the arXiv library (may fail on HF Spaces).
"""
import arxiv
import asyncio
import httpx
import logging
import re
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# OpenAlex API base
OA_API_BASE = "https://api.openalex.org"
# Polite pool email — required for higher rate limits and no block risk
OA_MAILTO = "contact@omnicrossx.ai"
# Fields to fetch from OpenAlex /works
OA_FIELDS = (
    "id,title,abstract_inverted_index,authorships,"
    "publication_date,primary_location,open_access,ids,concepts"
)

USER_AGENT = "OmnicrossX-AI/1.0 (research assistant; contact@omnicrossx.ai)"


class ArxivService:
    """Paper search service. Primary: OpenAlex. Fallback: arXiv library."""

    def __init__(self):
        # arXiv client kept only as fallback
        self.arxiv_client = arxiv.Client(
            page_size=10,
            delay_seconds=3.0,
            num_retries=0,
        )

    # ─── Query Cleaning ───────────────────────────────────────────────────────

    @staticmethod
    def _clean_query(query: str) -> str:
        """Strip stray JSON quotes/commas that Gemini sometimes appends."""
        q = query.strip().strip('"').strip("'").strip()
        q = q.rstrip(',;').strip()
        q = q.replace('"', '').replace("'", "")
        return q

    # ─── Abstract Reconstruction ──────────────────────────────────────────────

    @staticmethod
    def _reconstruct_abstract(inverted_index: Optional[Dict]) -> str:
        """
        OpenAlex stores abstracts as an inverted index: {word: [position, ...]}
        This reconstructs the original sentence from it.
        """
        if not inverted_index:
            return ""
        try:
            positions: Dict[int, str] = {}
            for word, pos_list in inverted_index.items():
                for pos in pos_list:
                    positions[pos] = word
            return " ".join(positions[i] for i in sorted(positions))
        except Exception:
            return ""

    # ─── Paper ID Helper ──────────────────────────────────────────────────────

    @staticmethod
    def _extract_arxiv_id(paper: Dict) -> str:
        """
        Extract the real arXiv ID from an OpenAlex paper record.
        OpenAlex stores arXiv IDs in two places:
          1. ids.arxiv  = 'https://arxiv.org/abs/XXXX.XXXXX'
          2. ids.doi    = 'https://doi.org/10.48550/arxiv.XXXX.XXXXX'
        """
        ids = paper.get("ids") or {}

        # Method 1: ids.arxiv field
        arxiv_url = ids.get("arxiv", "")
        if arxiv_url:
            raw = arxiv_url.split("/")[-1]
            return re.sub(r"v\d+$", "", raw)

        # Method 2: DOI that looks like 10.48550/arxiv.XXXX.XXXXX
        doi = ids.get("doi", "")
        arxiv_doi_match = re.search(
            r"10\.48550/arxiv\.([\d]{4}\.[\d]{4,5}(?:v\d+)?)",
            doi,
            re.IGNORECASE,
        )
        if arxiv_doi_match:
            return re.sub(r"v\d+$", "", arxiv_doi_match.group(1))

        return ""

    @staticmethod
    def _make_paper_id(paper: Dict, arxiv_id: str = "") -> str:
        """
        Derive a stable unique ID for a paper used as primary key in the pipeline.
        Preference: arXiv ID > DOI (cleaned) > OpenAlex ID.
        """
        if arxiv_id:
            return arxiv_id

        ids = paper.get("ids") or {}

        # DOI — strip URL prefix and make filesystem-safe
        doi = ids.get("doi", "")
        if doi:
            doi_clean = doi.replace("https://doi.org/", "").replace("/", "_")
            return f"doi_{doi_clean}"

        # OpenAlex ID — last resort
        oa_id = ids.get("openalex", "")
        if oa_id:
            return f"oa_{oa_id.split('/')[-1]}"

        return f"unknown_{abs(hash(paper.get('title', '')))}"

    # ─── Public: search_papers ────────────────────────────────────────────────

    async def search_papers(
        self,
        queries: List[str],
        max_per_query: int = 10,
        max_total: int = 30,
    ) -> List[Dict[str, Any]]:
        """Search for papers. Uses OpenAlex (primary) then arXiv (fallback)."""
        cleaned = [self._clean_query(q) for q in queries]
        cleaned = [q for q in cleaned if len(q) > 3][:2]  # Max 2 queries

        logger.info(f"Searching papers with queries: {cleaned}")

        seen_ids: set = set()
        all_papers: List[Dict[str, Any]] = []

        for i, query in enumerate(cleaned):
            if i > 0:
                await asyncio.sleep(1.0)

            papers = await self._search_openalex(query, max_per_query)

            if not papers:
                logger.warning(f"OpenAlex empty for '{query}', trying arXiv fallback...")
                papers = await self._search_arxiv_fallback(query, max_per_query)

            for p in papers:
                uid = p.get("arxiv_id", "")
                if uid and uid not in seen_ids and len(all_papers) < max_total:
                    seen_ids.add(uid)
                    all_papers.append(p)

            logger.info(f"Query '{query}': {len(papers)} papers, total so far: {len(all_papers)}")

        if not all_papers:
            raise RuntimeError(
                "No papers found. Both OpenAlex and arXiv returned empty results. "
                "Please try a different or broader search query."
            )

        logger.info(f"Total unique papers collected: {len(all_papers)}")
        return all_papers

    # ─── OpenAlex Search ──────────────────────────────────────────────────────

    async def _search_openalex(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Search OpenAlex /works. Returns [] on any error."""
        url = f"{OA_API_BASE}/works"
        params = {
            "search": query,
            "per-page": limit,
            "filter": "has_abstract:true",
            "sort": "relevance_score:desc",
            "select": OA_FIELDS,
            "mailto": OA_MAILTO,
        }
        try:
            async with httpx.AsyncClient(
                timeout=20.0,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                resp = await client.get(url, params=params)

                if resp.status_code == 429:
                    logger.warning("OpenAlex rate limited (429), waiting 5s and retrying...")
                    await asyncio.sleep(5.0)
                    resp = await client.get(url, params=params)

                if resp.status_code != 200:
                    logger.warning(f"OpenAlex returned HTTP {resp.status_code} for '{query}'")
                    return []

                results = resp.json().get("results", [])
                logger.info(f"OpenAlex: {len(results)} raw results for '{query}'")
                return [self._openalex_to_dict(p) for p in results if p.get("title")]

        except Exception as e:
            logger.error(f"OpenAlex error for '{query}': {e}")
            return []

    def _openalex_to_dict(self, paper: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize an OpenAlex work record to our internal paper format."""
        # Extract real arXiv ID (checks both ids.arxiv and arXiv DOIs)
        real_arxiv_id = self._extract_arxiv_id(paper)
        # Build stable unique paper ID
        paper_id = self._make_paper_id(paper, arxiv_id=real_arxiv_id)

        abstract = self._reconstruct_abstract(paper.get("abstract_inverted_index"))

        # PDF: prefer arXiv PDF (always openly accessible), then OA URL
        pdf_url = None
        if real_arxiv_id:
            pdf_url = f"https://arxiv.org/pdf/{real_arxiv_id}.pdf"
        else:
            oa = paper.get("open_access") or {}
            pdf_url = oa.get("oa_url")

        # Authors
        authorships = paper.get("authorships") or []
        authors = [
            a.get("author", {}).get("display_name", "")
            for a in authorships
            if a.get("author", {}).get("display_name")
        ]

        # Categories from OpenAlex "concepts" (top 3 by score)
        concepts = paper.get("concepts") or []
        categories = [
            c["display_name"]
            for c in sorted(concepts, key=lambda x: x.get("score", 0), reverse=True)[:3]
            if c.get("display_name")
        ]

        # Entry URL: arXiv abs page if available, else OA landing page
        entry_url = f"https://arxiv.org/abs/{real_arxiv_id}" if real_arxiv_id else (
            (paper.get("primary_location") or {}).get("landing_page_url", "")
        )

        return {
            "arxiv_id": paper_id,          # Stable unique key used throughout pipeline
            "real_arxiv_id": real_arxiv_id, # Actual arXiv ID if available (for PDF download)
            "title": (paper.get("title") or "").strip(),
            "abstract": abstract,
            "authors": authors,
            "published_date": paper.get("publication_date"),
            "categories": categories,
            "pdf_url": pdf_url,
            "entry_url": entry_url,
            "source": "openalex",
        }

    # ─── arXiv Fallback ───────────────────────────────────────────────────────

    async def _search_arxiv_fallback(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """arXiv fallback. Returns [] on any error."""
        try:
            papers = await asyncio.to_thread(self._search_arxiv_sync, query, max_results)
            return papers
        except Exception as e:
            logger.error(f"arXiv fallback error for '{query}': {e}")
            return []

    def _search_arxiv_sync(self, query: str, max_results: int) -> List[Dict[str, Any]]:
        """Synchronous arXiv search (runs in thread pool)."""
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance,
        )
        results = []
        for r in self.arxiv_client.results(search):
            results.append(self._arxiv_to_dict(r))
        return results

    def _arxiv_to_dict(self, result: arxiv.Result) -> Dict[str, Any]:
        """Convert arxiv.Result to our internal format."""
        raw_id = result.entry_id.split("/")[-1]
        arxiv_id = re.sub(r"v\d+$", "", raw_id)
        return {
            "arxiv_id": arxiv_id,
            "real_arxiv_id": arxiv_id,
            "title": result.title.strip(),
            "abstract": result.summary.strip(),
            "authors": [a.name for a in result.authors],
            "published_date": result.published.strftime("%Y-%m-%d") if result.published else None,
            "categories": result.categories,
            "pdf_url": result.pdf_url,
            "entry_url": result.entry_id,
            "source": "arxiv",
        }

    # ─── PDF Download ─────────────────────────────────────────────────────────

    async def download_pdf(
        self,
        arxiv_id: str,
        dest_dir: str,
        pdf_url: Optional[str] = None,
    ) -> Optional[str]:
        """Download PDF. Uses provided pdf_url or constructs from arxiv_id.

        For non-arXiv papers (DOI-based IDs), pdf_url must be provided.
        Returns local file path or None on failure.
        """
        # Determine PDF URL
        if not pdf_url:
            # Only works if arxiv_id is a real arXiv ID (not doi_ or oa_)
            if arxiv_id.startswith("doi_") or arxiv_id.startswith("oa_"):
                logger.warning(f"No PDF URL provided for non-arXiv paper {arxiv_id}, skipping.")
                return None
            pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

        # Make a safe filename (replace any non-alphanumeric chars)
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", arxiv_id)
        dest_path = Path(dest_dir) / f"{safe_name}.pdf"
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            async with httpx.AsyncClient(
                timeout=60.0,
                follow_redirects=True,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                for attempt in range(3):
                    resp = await client.get(pdf_url)
                    if resp.status_code == 200:
                        dest_path.write_bytes(resp.content)
                        logger.info(f"Downloaded PDF: {arxiv_id} ({len(resp.content)} bytes)")
                        return str(dest_path)
                    elif resp.status_code in [403, 429, 503]:
                        wait = 5 * (attempt + 1)
                        logger.warning(
                            f"PDF rate limited (HTTP {resp.status_code}) for {arxiv_id}, "
                            f"waiting {wait}s (attempt {attempt+1}/3)"
                        )
                        await asyncio.sleep(wait)
                    else:
                        logger.warning(f"PDF download HTTP {resp.status_code} for {arxiv_id}")
                        return None

            logger.error(f"Failed to download PDF {arxiv_id} after 3 attempts.")
            return None
        except Exception as e:
            logger.error(f"PDF download failed for {arxiv_id}: {e}")
            return None

    # ─── Single Paper Metadata ────────────────────────────────────────────────

    async def fetch_paper_metadata(self, arxiv_id: str) -> Optional[Dict[str, Any]]:
        """Fetch metadata for a single arXiv paper by ID.

        Tries OpenAlex first (via arXiv filter), then arXiv library.
        """
        # Try OpenAlex with arXiv ID filter
        try:
            url = f"{OA_API_BASE}/works"
            params = {
                "filter": f"ids.arxiv:{arxiv_id}",
                "select": OA_FIELDS,
                "mailto": OA_MAILTO,
            }
            async with httpx.AsyncClient(
                timeout=15.0,
                headers={"User-Agent": USER_AGENT},
            ) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    if results:
                        return self._openalex_to_dict(results[0])
        except Exception as e:
            logger.warning(f"OpenAlex single-paper lookup failed for {arxiv_id}: {e}")

        # Fallback to arXiv library
        try:
            search = arxiv.Search(id_list=[arxiv_id])
            results = list(self.arxiv_client.results(search))
            if results:
                return self._arxiv_to_dict(results[0])
        except Exception as e:
            logger.error(f"arXiv metadata fetch failed for {arxiv_id}: {e}")

        return None
