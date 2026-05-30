from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class SessionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"


class ChatRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


# ─── Research Session ─────────────────────────────────────────────────────────

class ResearchSessionCreate(BaseModel):
    query: str = Field(..., min_length=10, max_length=1000)
    user_id: Optional[str] = None
    arxiv_ids: Optional[List[str]] = None


class ResearchSessionResponse(BaseModel):
    id: str
    user_id: Optional[str]
    query: str
    expanded_queries: Optional[List[str]]
    status: SessionStatus
    papers_found: int
    created_at: datetime
    updated_at: datetime


class ResearchStatusResponse(BaseModel):
    session_id: str
    status: SessionStatus
    papers_found: int
    embeddings_generated: int
    solutions_count: int
    current_step: str
    progress_pct: int


# ─── Papers ───────────────────────────────────────────────────────────────────

class PaperResponse(BaseModel):
    id: str
    arxiv_id: str
    title: str
    abstract: Optional[str]
    authors: Optional[List[str]]
    published_date: Optional[str]
    categories: Optional[List[str]]
    pdf_url: Optional[str]
    is_processed: bool


# ─── Solutions ────────────────────────────────────────────────────────────────

class SolutionContent(BaseModel):
    idea: str
    why_it_works: str
    advantages: List[str]
    limitations: List[str]
    feasibility_analysis: str
    implementation_ideas: List[str]
    possible_risks: List[str]
    cost_efficiency: str
    cross_domain_inspirations: Optional[List[str]] = []


class CitationRef(BaseModel):
    paper_id: str
    arxiv_id: str
    title: str
    chunk_text: str
    relevance: float


class SolutionResponse(BaseModel):
    id: str
    session_id: str
    title: str
    summary: str
    full_content: SolutionContent
    feasibility_score: float
    cost_score: float
    innovation_score: float
    confidence_level: float
    tags: List[str]
    domains: List[str]
    is_speculative: bool
    citations: List[CitationRef]
    created_at: datetime


class SolutionCardResponse(BaseModel):
    id: str
    session_id: str
    title: str
    summary: str
    feasibility_score: float
    cost_score: float
    innovation_score: float
    confidence_level: float
    tags: List[str]
    domains: List[str]
    is_speculative: bool
    created_at: datetime


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    solution_id: Optional[str] = None
    user_id: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    solution_id: Optional[str]
    role: ChatRole
    content: str
    citations: Optional[List[CitationRef]]
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int


# ─── Generate More ────────────────────────────────────────────────────────────

class GenerateMoreRequest(BaseModel):
    count: int = Field(default=2, ge=1, le=5)

class GenerateSessionSolutionsRequest(BaseModel):
    count: int = Field(default=2, ge=1, le=5)
    instructions: Optional[str] = Field(None, max_length=1000)

# ─── Search ───────────────────────────────────────────────────────────────────

class PaperSearchRequest(BaseModel):
    query: str
    limit: int = Field(default=10, ge=1, le=50)


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
