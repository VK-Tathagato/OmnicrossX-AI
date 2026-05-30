"""
Background task wrapper for the RAG pipeline.
"""
import logging
import asyncio
from typing import List

logger = logging.getLogger(__name__)


async def run_research_pipeline(session_id: str, user_query: str, pipeline, arxiv_ids: List[str] = None) -> None:
    """Background task: runs the full RAG pipeline for a session."""
    try:
        logger.info(f"Starting pipeline for session {session_id}")
        await pipeline.run(
            session_id=session_id,
            user_query=user_query,
            arxiv_ids=arxiv_ids,
        )
        logger.info(f"Pipeline complete for session {session_id}")
    except Exception as e:
        logger.error(f"Pipeline failed for session {session_id}: {e}", exc_info=True)
        try:
            await pipeline.supabase.table("research_sessions").update(
                {"status": "failed", "current_step": f"Error: {str(e)[:200]}"}
            ).eq("id", session_id).execute()
        except Exception as db_err:
            logger.error(f"Failed to update session status to failed: {db_err}")


async def run_additional_solutions(
    session_id: str,
    user_query: str,
    count: int,
    pipeline,
    supabase,
    instructions: str = None,
) -> None:
    """Generate additional solutions for an existing session."""
    try:
        # Get existing paper IDs for this session
        paper_result = await supabase.table("session_papers").select(
            "paper_id"
        ).eq("session_id", session_id).execute()
        paper_ids = [p["paper_id"] for p in (paper_result.data or [])]

        if not paper_ids:
            logger.warning(f"No papers for session {session_id} — cannot generate more solutions")
            return

        # Update session status to processing
        await supabase.table("research_sessions").update({
            "status": "processing",
            "current_step": "Generating additional solutions based on your request..." if instructions else "Generating additional solutions..."
        }).eq("id", session_id).execute()

        # Augment query if instructions are provided
        effective_query = user_query
        if instructions:
            effective_query = f"Original Problem: {user_query}\n\nAdditional Requirements from Researcher: {instructions}"

        # Re-retrieve relevant chunks
        query_embedding = await pipeline.embedder.embed_query(effective_query)
        relevant_chunks = await pipeline.vector_store.similarity_search(
            query_embedding=query_embedding,
            top_k=pipeline.settings.top_k_chunks,
            paper_ids=paper_ids,
        )

        # Fetch paper metadata for enrichment
        papers_result = await supabase.table("papers").select(
            "arxiv_id, title"
        ).in_("id", paper_ids).execute()
        papers_meta = papers_result.data or []
        relevant_chunks = await pipeline._enrich_chunks(relevant_chunks, papers_meta)

        # Generate
        solutions_raw = await pipeline.gemini.generate_solutions(
            user_query=effective_query,
            retrieved_chunks=relevant_chunks,
            num_solutions=count,
        )

        # Get paper_ids map
        id_map = {p["arxiv_id"]: pid for p, pid in zip(papers_meta, paper_ids)}

        await pipeline._store_solutions(
            session_id=session_id,
            solutions_raw=solutions_raw,
            relevant_chunks=relevant_chunks,
            paper_ids=id_map,
        )

        logger.info(f"Generated {len(solutions_raw)} additional solutions for {session_id}")

        # Restore status to complete
        await supabase.table("research_sessions").update({
            "status": "complete",
            "current_step": "Additional solutions generated"
        }).eq("id", session_id).execute()

    except Exception as e:
        logger.error(f"Additional solution generation failed: {e}")
        try:
            await supabase.table("research_sessions").update({
                "status": "complete", # Restore to complete so user isn't stuck loading
                "current_step": f"Generation failed: {str(e)[:100]}"
            }).eq("id", session_id).execute()
        except Exception:
            pass
