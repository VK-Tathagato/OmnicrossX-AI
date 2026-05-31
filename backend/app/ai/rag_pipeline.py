"""
RAG Pipeline — Orchestrates the full research pipeline from query to solutions.
"""
import asyncio
import logging
import tempfile
import os
from typing import List, Dict, Any, Optional, Callable

from app.services.arxiv_service import ArxivService
from app.parsers.pdf_parser import PDFParser
from app.parsers.text_cleaner import TextChunker
from app.embeddings.embedding_service import EmbeddingService
from app.embeddings.vector_store import VectorStore
from app.ai.gemini_client import GeminiClient
from app.config import Settings

logger = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[str, int], None]]


class RAGPipeline:
    def __init__(
        self,
        settings: Settings,
        arxiv_service: ArxivService,
        pdf_parser: PDFParser,
        chunker: TextChunker,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
        gemini_client: GeminiClient,
        supabase,
    ):
        self.settings = settings
        self.arxiv = arxiv_service
        self.parser = pdf_parser
        self.chunker = chunker
        self.embedder = embedding_service
        self.vector_store = vector_store
        self.gemini = gemini_client
        self.supabase = supabase

    async def run(
        self,
        session_id: str,
        user_query: str,
        progress_cb: ProgressCallback = None,
        arxiv_ids: List[str] = None,
    ) -> Dict[str, Any]:
        """Run the full RAG pipeline for a research session."""

        async def progress(step: str, pct: int):
            """Update session step/progress in DB and log."""
            if progress_cb:
                progress_cb(step, pct)
            logger.info(f"[{session_id}] {step} ({pct}%)")
            await self._update_session(session_id, {
                "current_step": step,
                "progress_pct": pct,
            })

        # ── 1. Update session status ──────────────────────────────────────────
        await self._update_session(session_id, {"status": "processing"})
        await progress("Expanding search queries with AI", 5)

        # ── 2. Query Expansion ────────────────────────────────────────────────
        if arxiv_ids:
            expanded_queries = [user_query]
            await self._update_session(session_id, {"expanded_queries": expanded_queries})
        else:
            try:
                expanded_queries = await self.gemini.expand_query(user_query)
            except Exception as e:
                logger.error(f"Query expansion failed: {e}")
                expanded_queries = [user_query]  # Fallback to original query
            await self._update_session(session_id, {"expanded_queries": expanded_queries})

        # ── 3. Fetch papers from arXiv ────────────────────────────────────────
        if arxiv_ids:
            await progress("Fetching specific papers from arXiv", 15)
            papers_meta = []
            for arxiv_id in arxiv_ids:
                meta = await self.arxiv.fetch_paper_metadata(arxiv_id)
                if meta:
                    papers_meta.append(meta)
                else:
                    logger.warning(f"Failed to fetch metadata for provided arXiv ID: {arxiv_id}")
        else:
            await progress("Searching arXiv for relevant papers", 15)
            papers_meta = await self.arxiv.search_papers(
                expanded_queries,
                max_per_query=self.settings.max_papers_per_query,
                max_total=self.settings.max_total_papers,
            )

        if not papers_meta:
            await self._update_session(session_id, {"status": "failed", "current_step": "No papers found"})
            raise RuntimeError("No papers found for this query")

        await progress(f"Found {len(papers_meta)} relevant papers", 25)

        # ── 4. Store papers + link to session ─────────────────────────────────
        paper_info = await self._store_papers(session_id, papers_meta)
        paper_ids = {arxiv_id: info["id"] for arxiv_id, info in paper_info.items()}
        await self._update_session(session_id, {"papers_found": len(paper_ids)})

        # ── 5. Download + Process PDFs ────────────────────────────────────────
        await progress("Downloading and processing PDFs", 35)
        all_chunks: List[Dict[str, Any]] = []

        with tempfile.TemporaryDirectory() as tmpdir:
            tasks = []
            for paper_meta in papers_meta:
                arxiv_id = paper_meta["arxiv_id"]
                info = paper_info.get(arxiv_id)
                if info and not info.get("is_processed", False):
                    tasks.append(self._process_paper(paper_meta, info["id"], tmpdir))
                elif info and info.get("is_processed", False):
                    logger.info(f"Skipping download for {arxiv_id}, already processed.")
            
            # Concurrency limit (Semaphore)
            sem = asyncio.Semaphore(3)
            async def bounded_process(task):
                async with sem:
                    return await task
            
            results = await asyncio.gather(*(bounded_process(t) for t in tasks), return_exceptions=True)

        for r in results:
            if isinstance(r, list):
                all_chunks.extend(r)
            elif isinstance(r, Exception):
                logger.error(f"Paper processing error: {r}")

        await progress(f"Extracted {len(all_chunks)} text chunks", 55)

        # ── 6. Generate and store embeddings ──────────────────────────────────
        await progress("Generating embeddings", 60)
        texts = [c["chunk_text"] for c in all_chunks]
        embeddings = await self.embedder.embed_batch(texts)

        chunks_with_embeddings = []
        for chunk, emb in zip(all_chunks, embeddings):
            if emb is not None:
                chunks_with_embeddings.append({**chunk, "embedding": emb})

        stored = await self.vector_store.store_embeddings(chunks_with_embeddings)
        await progress(f"Stored {stored} embeddings in vector database", 70)

        # Mark papers as processed now that their chunks are safely stored
        processed_paper_ids = list(set([c["paper_id"] for c in chunks_with_embeddings if c.get("paper_id")]))
        if processed_paper_ids:
            try:
                await self.supabase.table("papers").update({"is_processed": True}).in_("id", processed_paper_ids).execute()
            except Exception as e:
                logger.error(f"Failed to mark papers as processed: {e}")

        # ── 7. Retrieve most relevant chunks ──────────────────────────────────
        await progress("Retrieving relevant paper sections", 75)
        query_embedding = await self.embedder.embed_query(user_query)
        relevant_chunks = await self.vector_store.similarity_search(
            query_embedding=query_embedding,
            top_k=self.settings.top_k_chunks,
            paper_ids=list(paper_ids.values()),
        )

        if not relevant_chunks:
            await self._update_session(session_id, {"status": "failed", "current_step": "Failed to extract text from papers"})
            raise RuntimeError("No relevant text chunks could be extracted from the papers.")

        # Enrich chunks with paper metadata
        relevant_chunks = await self._enrich_chunks(relevant_chunks, papers_meta)


        # ── 8. Generate solutions with Gemini ─────────────────────────────────
        await progress("Synthesizing solutions with AI reasoning", 85)
        solutions_raw = await self.gemini.generate_solutions(
            user_query=user_query,
            retrieved_chunks=relevant_chunks,
            num_solutions=self.settings.max_solutions,
        )

        # ── 9. Store solutions ────────────────────────────────────────────────
        await progress("Storing solutions", 92)
        solution_ids = await self._store_solutions(
            session_id, solutions_raw, relevant_chunks, paper_ids
        )

        await self._update_session(session_id, {
            "status": "complete",
            "current_step": "Research complete!",
            "progress_pct": 100,
        })

        return {
            "session_id": session_id,
            "papers_found": len(paper_ids),
            "chunks_processed": len(all_chunks),
            "solutions": solution_ids,
        }

    async def retrieve_for_chat(
        self, query: str, paper_ids: List[str], top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant chunks for a chat message."""
        query_embedding = await self.embedder.embed_query(query)
        chunks = await self.vector_store.similarity_search(
            query_embedding=query_embedding,
            top_k=top_k,
            paper_ids=paper_ids,
        )
        return chunks

    # ─── Private Helpers ──────────────────────────────────────────────────────

    async def _process_paper(
        self, paper_meta: Dict, paper_id: Optional[str], tmpdir: str
    ) -> List[Dict[str, Any]]:
        """Download, parse, and chunk a single paper."""
        arxiv_id = paper_meta["arxiv_id"]
        try:
            # Download PDF
            pdf_path = await self.arxiv.download_pdf(arxiv_id, tmpdir)
            if not pdf_path:
                return []

            # Parse PDF
            extracted = await self.parser.parse_async(pdf_path)
            full_text = extracted["full_text"]

            if not full_text or len(full_text) < 200:
                return []

            # Update paper record with extracted text
            if paper_id:
                await self.supabase.table("papers").update({
                    "extracted_text": full_text[:50000],  # Cap for storage
                }).eq("id", paper_id).execute()

            # Chunk
            chunks = self.chunker.chunk_text(
                text=full_text,
                paper_id=paper_id or arxiv_id,
                arxiv_id=arxiv_id,
                title=paper_meta["title"],
            )
            return chunks

        except Exception as e:
            logger.error(f"Failed to process paper {arxiv_id}: {e}")
            return []

    async def _store_papers(
        self, session_id: str, papers: List[Dict]
    ) -> Dict[str, Dict[str, Any]]:
        """Upsert papers and link to session. Returns {arxiv_id: {'id': paper_id, 'is_processed': bool}}."""
        id_map: Dict[str, Dict[str, Any]] = {}

        for p in papers:
            try:
                # Upsert paper (avoid duplicates)
                result = await self.supabase.table("papers").upsert(
                    {
                        "arxiv_id": p["arxiv_id"],
                        "title": p["title"],
                        "abstract": p.get("abstract"),
                        "authors": p.get("authors", []),
                        "published_date": p.get("published_date"),
                        "categories": p.get("categories", []),
                        "pdf_url": p.get("pdf_url"),
                    },
                    on_conflict="arxiv_id",
                ).execute()

                if result.data:
                    paper_id = result.data[0]["id"]
                    is_processed = result.data[0].get("is_processed", False)
                    id_map[p["arxiv_id"]] = {"id": paper_id, "is_processed": is_processed}

                    # Link to session
                    await self.supabase.table("session_papers").upsert(
                        {"session_id": session_id, "paper_id": paper_id},
                        on_conflict="session_id,paper_id",
                    ).execute()

            except Exception as e:
                logger.error(f"Failed to store paper {p['arxiv_id']}: {e}")

        return id_map

    async def _enrich_chunks(
        self, chunks: List[Dict], papers_meta: List[Dict]
    ) -> List[Dict]:
        """Add arxiv_id and title to retrieved chunks from metadata."""
        meta_map = {p["arxiv_id"]: p for p in papers_meta}
        enriched = []
        for chunk in chunks:
            arxiv_id = chunk.get("arxiv_id") or ""
            if arxiv_id in meta_map:
                chunk["title"] = meta_map[arxiv_id]["title"]
            enriched.append(chunk)
        return enriched

    async def _store_solutions(
        self,
        session_id: str,
        solutions_raw: List[Dict],
        relevant_chunks: List[Dict],
        paper_ids: Dict[str, str],
    ) -> List[str]:
        """Store generated solutions and their citations."""
        stored_ids = []

        for sol in solutions_raw:
            try:
                result = await self.supabase.table("solutions").insert({
                    "session_id": session_id,
                    "title": sol.get("title", "Untitled Solution"),
                    "summary": sol.get("summary", ""),
                    "full_content": sol.get("full_content", {}),
                    "feasibility_score": sol.get("feasibility_score", 0.5),
                    "cost_score": sol.get("cost_score", 0.5),
                    "innovation_score": sol.get("innovation_score", 0.5),
                    "confidence_level": sol.get("confidence_level", 0.5),
                    "tags": sol.get("tags", []),
                    "domains": sol.get("domains", []),
                    "is_speculative": sol.get("is_speculative", False),
                }).execute()

                if result.data:
                    solution_id = result.data[0]["id"]
                    stored_ids.append(solution_id)

                    # Store citations
                    excerpt_indices = sol.get("source_excerpt_indices", [])
                    citation_records = []
                    for idx in excerpt_indices:
                        if 0 < idx <= len(relevant_chunks):
                            chunk = relevant_chunks[idx - 1]
                            arxiv_id = chunk.get("arxiv_id", "")
                            paper_id = paper_ids.get(arxiv_id)
                            if paper_id:
                                citation_records.append({
                                    "solution_id": solution_id,
                                    "paper_id": paper_id,
                                    "chunk_text": chunk.get("chunk_text", "")[:500],
                                    "relevance": chunk.get("similarity", 0.8),
                                })

                    if citation_records:
                        await self.supabase.table("citations").insert(
                            citation_records
                        ).execute()

            except Exception as e:
                logger.error(f"Failed to store solution: {e}")

        return stored_ids

    async def _update_session(self, session_id: str, data: Dict) -> None:
        """Update research session fields."""
        try:
            result = await self.supabase.table("research_sessions").update(data).eq(
                "id", session_id
            ).execute()
            if not result.data:
                logger.warning(
                    f"Session update returned no data for {session_id} "
                    f"(possible RLS block). Data: {data}"
                )
        except Exception as e:
            logger.warning(
                f"Failed to update session {session_id} with {data}: {e}",
                exc_info=True,
            )
