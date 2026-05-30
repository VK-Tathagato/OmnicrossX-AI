"""
Solutions Routes — Get, save, generate more, and export solutions.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import logging
import io

from app.models.schemas import SolutionResponse, SolutionContent, CitationRef, GenerateMoreRequest
from app.utils.dependencies import get_supabase, get_pipeline, get_gemini
from app.background_tasks.paper_processor import run_additional_solutions

router = APIRouter(prefix="/api/solutions", tags=["solutions"])
logger = logging.getLogger(__name__)


@router.get("/{solution_id}", response_model=SolutionResponse)
async def get_solution(solution_id: str, supabase=Depends(get_supabase)):
    """Get full solution detail with citations."""
    sol_result = await supabase.table("solutions").select("*").eq(
        "id", solution_id
    ).single().execute()

    if not sol_result.data:
        raise HTTPException(404, "Solution not found")

    sol = sol_result.data

    # Fetch citations with paper info
    cit_result = await supabase.table("citations").select(
        "*, papers(id, arxiv_id, title)"
    ).eq("solution_id", solution_id).execute()

    citations = []
    for c in (cit_result.data or []):
        paper = c.get("papers", {})
        if paper:
            citations.append(CitationRef(
                paper_id=paper["id"],
                arxiv_id=paper.get("arxiv_id", ""),
                title=paper.get("title", ""),
                chunk_text=c.get("chunk_text", ""),
                relevance=c.get("relevance", 0.8),
            ))

    full_content_raw = sol.get("full_content", {})
    full_content = SolutionContent(
        idea=full_content_raw.get("idea", ""),
        why_it_works=full_content_raw.get("why_it_works", ""),
        advantages=full_content_raw.get("advantages", []),
        limitations=full_content_raw.get("limitations", []),
        feasibility_analysis=full_content_raw.get("feasibility_analysis", ""),
        implementation_ideas=full_content_raw.get("implementation_ideas", []),
        possible_risks=full_content_raw.get("possible_risks", []),
        cost_efficiency=full_content_raw.get("cost_efficiency", ""),
        cross_domain_inspirations=full_content_raw.get("cross_domain_inspirations", []),
    )

    return SolutionResponse(
        id=sol["id"],
        session_id=sol["session_id"],
        title=sol["title"],
        summary=sol["summary"],
        full_content=full_content,
        feasibility_score=sol["feasibility_score"],
        cost_score=sol["cost_score"],
        innovation_score=sol["innovation_score"],
        confidence_level=sol["confidence_level"],
        tags=sol.get("tags", []),
        domains=sol.get("domains", []),
        is_speculative=sol.get("is_speculative", False),
        citations=citations,
        created_at=sol["created_at"],
    )


@router.post("/{solution_id}/save")
async def save_solution(
    solution_id: str,
    user_id: str,
    supabase=Depends(get_supabase),
):
    """Save a solution to user's saved items."""
    result = await supabase.table("saved_items").upsert(
        {
            "user_id": user_id,
            "item_type": "solution",
            "item_id": solution_id,
        },
        on_conflict="user_id,item_type,item_id",
    ).execute()

    return {"saved": True, "id": result.data[0]["id"] if result.data else None}


@router.delete("/{solution_id}/save")
async def unsave_solution(
    solution_id: str,
    user_id: str,
    supabase=Depends(get_supabase),
):
    """Remove a solution from saved items."""
    await supabase.table("saved_items").delete().eq(
        "user_id", user_id
    ).eq("item_type", "solution").eq("item_id", solution_id).execute()
    return {"saved": False}


@router.delete("/{solution_id}")
async def delete_solution(solution_id: str, supabase=Depends(get_supabase)):
    """Delete a solution and its associated data."""
    # Since solutions table cascades or we use service key, this removes the solution
    result = await supabase.table("solutions").delete().eq("id", solution_id).execute()
    if not result.data:
        raise HTTPException(404, "Solution not found")
    return {"status": "success", "message": "Solution deleted"}


@router.post("/{solution_id}/generate-more")
async def generate_more_solutions(
    solution_id: str,
    body: GenerateMoreRequest,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
):
    """Generate additional solutions for a session."""
    sol_result = await supabase.table("solutions").select(
        "session_id"
    ).eq("id", solution_id).single().execute()

    if not sol_result.data:
        raise HTTPException(404, "Solution not found")

    session_id = sol_result.data["session_id"]

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
        )
    )

    return {"message": f"Generating {body.count} additional solutions in background"}


@router.get("/{solution_id}/export")
async def export_solution(solution_id: str, supabase=Depends(get_supabase)):
    """Export solution as formatted text (PDF generation handled client-side)."""
    sol_result = await supabase.table("solutions").select("*").eq(
        "id", solution_id
    ).single().execute()

    if not sol_result.data:
        raise HTTPException(404, "Solution not found")

    sol = sol_result.data
    content = sol.get("full_content", {})

    # Build text export
    lines = [
        f"# {sol['title']}",
        f"\n{sol['summary']}\n",
        f"## Scores",
        f"- Feasibility: {sol['feasibility_score']:.0%}",
        f"- Cost Efficiency: {sol['cost_score']:.0%}",
        f"- Innovation: {sol['innovation_score']:.0%}",
        f"- Confidence: {sol['confidence_level']:.0%}",
        f"\n## The Idea",
        content.get("idea", ""),
        f"\n## Why It Works",
        content.get("why_it_works", ""),
        f"\n## Advantages",
        *[f"- {a}" for a in content.get("advantages", [])],
        f"\n## Limitations",
        *[f"- {l}" for l in content.get("limitations", [])],
        f"\n## Feasibility Analysis",
        content.get("feasibility_analysis", ""),
        f"\n## Implementation Ideas",
        *[f"{i+1}. {step}" for i, step in enumerate(content.get("implementation_ideas", []))],
        f"\n## Cost Efficiency",
        content.get("cost_efficiency", ""),
        f"\n## Possible Risks",
        *[f"- {r}" for r in content.get("possible_risks", [])],
        f"\n---",
        f"Generated by OmniX AI — AI-Assisted Scientific Reasoning Platform",
        f"Note: This output is AI-generated from academic papers. Verify with domain experts.",
    ]

    text_content = "\n".join(lines)
    buf = io.BytesIO(text_content.encode("utf-8"))
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="text/plain",
        headers={
            "Content-Disposition": f'attachment; filename="omnix-solution-{solution_id[:8]}.txt"'
        },
    )
