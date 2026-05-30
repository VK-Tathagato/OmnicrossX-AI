"""
Research Routes — Start sessions, poll status, get history.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Request
from typing import List, Optional
import logging
import uuid

from app.models.schemas import (
    ResearchSessionCreate,
    ResearchSessionResponse,
    ResearchStatusResponse,
    SolutionCardResponse,
    SessionStatus,
    GenerateSessionSolutionsRequest,
)
from app.utils.dependencies import get_supabase, get_pipeline
from app.background_tasks.paper_processor import run_research_pipeline, run_additional_solutions

router = APIRouter(prefix="/api/research", tags=["research"])
logger = logging.getLogger(__name__)


@router.post("/start", response_model=dict)
async def start_research(
    body: ResearchSessionCreate,
    background_tasks: BackgroundTasks,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
):
    """Create a new research session and kick off the background pipeline."""
    # Create session record
    session_data = {
        "query": body.query,
        "status": "pending",
        "papers_found": 0,
        "expanded_queries": [],
    }
    if body.user_id:
        session_data["user_id"] = body.user_id

    result = await supabase.table("research_sessions").insert(session_data).execute()
    if not result.data:
        raise HTTPException(500, "Failed to create research session")

    session = result.data[0]
    session_id = session["id"]

    # Kick off background research
    background_tasks.add_task(
        run_research_pipeline,
        session_id=session_id,
        user_query=body.query,
        pipeline=pipeline,
        arxiv_ids=body.arxiv_ids,
    )

    return {
        "session_id": session_id,
        "status": "pending",
        "message": "Research session started. Poll /status for updates.",
    }


@router.get("/{session_id}/status", response_model=ResearchStatusResponse)
async def get_status(session_id: str, supabase=Depends(get_supabase)):
    """Poll research session status and progress."""
    session_result = await supabase.table("research_sessions").select("*").eq(
        "id", session_id
    ).single().execute()

    if not session_result.data:
        raise HTTPException(404, "Session not found")

    session = session_result.data

    # Count solutions
    sol_result = await supabase.table("solutions").select(
        "id", count="exact"
    ).eq("session_id", session_id).execute()
    solutions_count = sol_result.count or 0

    # Count embeddings for session papers
    paper_result = await supabase.table("session_papers").select(
        "paper_id"
    ).eq("session_id", session_id).execute()
    paper_ids = [p["paper_id"] for p in (paper_result.data or [])]

    emb_count = 0
    if paper_ids:
        emb_result = await supabase.table("embeddings").select(
            "id", count="exact"
        ).in_("paper_id", paper_ids).execute()
        emb_count = emb_result.count or 0

    status = session.get("status", "pending")

    # Read real progress from the DB; fall back to status-based defaults
    fallback_pct = {"pending": 0, "processing": 5, "complete": 100, "failed": 0}
    progress_pct = session.get("progress_pct") or fallback_pct.get(status, 0)

    return ResearchStatusResponse(
        session_id=session_id,
        status=SessionStatus(status),
        papers_found=session.get("papers_found", 0),
        embeddings_generated=emb_count,
        solutions_count=solutions_count,
        current_step=session.get("current_step", "Initializing…"),
        progress_pct=progress_pct,
    )


@router.get("/{session_id}/solutions", response_model=List[SolutionCardResponse])
async def get_session_solutions(session_id: str, supabase=Depends(get_supabase)):
    """Get solution cards for a completed research session."""
    result = await supabase.table("solutions").select("*").eq(
        "session_id", session_id
    ).order("created_at").execute()

    if not result.data:
        return []

    return [
        SolutionCardResponse(
            id=s["id"],
            session_id=s["session_id"],
            title=s["title"],
            summary=s["summary"],
            feasibility_score=s["feasibility_score"],
            cost_score=s["cost_score"],
            innovation_score=s["innovation_score"],
            confidence_level=s["confidence_level"],
            tags=s.get("tags", []),
            domains=s.get("domains", []),
            is_speculative=s.get("is_speculative", False),
            created_at=s["created_at"],
        )
        for s in result.data
    ]


@router.get("/history", response_model=List[dict])
async def get_history(user_id: str, supabase=Depends(get_supabase)):
    """Get user's past research sessions."""
    result = await supabase.table("research_sessions").select("*").eq(
        "user_id", user_id
    ).order("created_at", desc=True).limit(20).execute()

    return result.data or []


@router.get("/{session_id}/papers")
async def get_session_papers(session_id: str, supabase=Depends(get_supabase)):
    """Get papers linked to a research session."""
    result = await supabase.table("session_papers").select(
        "*, papers(*)"
    ).eq("session_id", session_id).execute()

    papers = []
    for row in (result.data or []):
        p = row.get("papers", {})
        if p:
            papers.append({
                "id": p["id"],
                "arxiv_id": p["arxiv_id"],
                "title": p["title"],
                "abstract": p.get("abstract", "")[:300] + "...",
                "authors": p.get("authors", [])[:3],
                "published_date": p.get("published_date"),
                "categories": p.get("categories", []),
                "pdf_url": p.get("pdf_url"),
                "is_processed": p.get("is_processed", False),
            })
    return papers


@router.delete("/{session_id}")
async def delete_session(session_id: str, supabase=Depends(get_supabase)):
    """Delete a research session (used for cleaning up temporary anonymous sessions)."""
    # Due to ON DELETE CASCADE on session_papers, solutions, chat_history, citations,
    # deleting the session will clean up most linked data.
    # We also manually delete papers that were ONLY linked to this session if we wanted,
    # but cascading on research_sessions is enough for the immediate requirement.
    result = await supabase.table("research_sessions").delete().eq("id", session_id).execute()
    
    if not result.data:
        # It's possible the session didn't exist or was already deleted
        pass
        
    return {"status": "success", "message": f"Session {session_id} deleted"}


@router.post("/{session_id}/generate-more")
async def generate_more_session_solutions(
    session_id: str,
    body: GenerateSessionSolutionsRequest,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
):
    """Generate additional solutions for a session with optional instructions."""
    sess_result = await supabase.table("research_sessions").select("query").eq(
        "id", session_id
    ).single().execute()

    if not sess_result.data:
        raise HTTPException(404, "Session not found")

    import asyncio
    asyncio.create_task(
        run_additional_solutions(
            session_id=session_id,
            user_query=sess_result.data["query"],
            count=body.count,
            pipeline=pipeline,
            supabase=supabase,
            instructions=body.instructions,
        )
    )

    return {"message": f"Generating {body.count} additional solutions in background"}
