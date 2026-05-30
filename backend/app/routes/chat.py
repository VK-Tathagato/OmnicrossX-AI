"""
Chat Routes — Context-aware AI chat assistant for solution exploration.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import logging
import json

from app.models.schemas import ChatMessageCreate, ChatMessageResponse, ChatHistoryResponse
from app.utils.dependencies import get_supabase, get_pipeline, get_gemini

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


@router.post("/{session_id}")
async def send_message(
    session_id: str,
    body: ChatMessageCreate,
    supabase=Depends(get_supabase),
    pipeline=Depends(get_pipeline),
    gemini=Depends(get_gemini),
):
    """Send a chat message and get an AI response with paper context."""

    # Validate session
    sess_result = await supabase.table("research_sessions").select("query").eq(
        "id", session_id
    ).single().execute()
    if not sess_result.data:
        raise HTTPException(404, "Session not found")

    # Get solution context if provided
    solution_context = ""
    if body.solution_id:
        sol_result = await supabase.table("solutions").select(
            "title, summary, full_content, tags, domains"
        ).eq("id", body.solution_id).single().execute()
        if sol_result.data:
            sol = sol_result.data
            fc = sol.get("full_content", {})
            solution_context = f"""
SOLUTION BEING DISCUSSED: {sol['title']}
Summary: {sol['summary']}
Key Idea: {fc.get('idea', '')}
Why It Works: {fc.get('why_it_works', '')}
Domains: {', '.join(sol.get('domains', []))}
""".strip()

    # Get chat history
    hist_result = await supabase.table("chat_history").select("role, content").eq(
        "session_id", session_id
    ).order("created_at").limit(10).execute()
    history = hist_result.data or []

    # Get session paper IDs for retrieval
    paper_result = await supabase.table("session_papers").select("paper_id").eq(
        "session_id", session_id
    ).execute()
    paper_ids = [p["paper_id"] for p in (paper_result.data or [])]

    # Retrieve relevant paper chunks
    relevant_chunks = await pipeline.retrieve_for_chat(
        query=body.message, paper_ids=paper_ids, top_k=8
    )

    # Store user message
    user_msg_result = await supabase.table("chat_history").insert({
        "session_id": session_id,
        "solution_id": body.solution_id,
        "user_id": body.user_id,
        "role": "user",
        "content": body.message,
    }).execute()

    # Generate AI response
    try:
        response_text = await gemini.chat_response(
            user_message=body.message,
            solution_context=solution_context,
            chat_history=history,
            retrieved_chunks=relevant_chunks,
        )
    except Exception as e:
        logger.error(f"Chat generation failed: {e}")
        raise HTTPException(500, "Failed to generate response")

    # Store assistant message
    asst_result = await supabase.table("chat_history").insert({
        "session_id": session_id,
        "solution_id": body.solution_id,
        "user_id": body.user_id,
        "role": "assistant",
        "content": response_text,
        "citations": [
            {"arxiv_id": c.get("arxiv_id"), "title": c.get("title")}
            for c in relevant_chunks[:3]
        ],
    }).execute()

    msg_data = asst_result.data[0] if asst_result.data else {}

    return {
        "id": msg_data.get("id"),
        "role": "assistant",
        "content": response_text,
        "citations": [
            {"arxiv_id": c.get("arxiv_id"), "title": c.get("title")}
            for c in relevant_chunks[:3]
        ],
        "created_at": msg_data.get("created_at"),
    }


@router.get("/{session_id}/history")
async def get_chat_history(
    session_id: str,
    solution_id: str = None,
    supabase=Depends(get_supabase),
):
    """Get chat history for a session (optionally filtered by solution)."""
    query = supabase.table("chat_history").select("*").eq("session_id", session_id)
    if solution_id:
        query = query.eq("solution_id", solution_id)

    result = await query.order("created_at").execute()
    messages = result.data or []

    return {"messages": messages, "total": len(messages)}


@router.delete("/{session_id}/history")
async def clear_chat_history(session_id: str, supabase=Depends(get_supabase)):
    """Clear all chat messages for a session."""
    await supabase.table("chat_history").delete().eq(
        "session_id", session_id
    ).execute()
    return {"cleared": True}
