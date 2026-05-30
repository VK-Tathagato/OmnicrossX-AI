"""
Dependency injection â€” Supabase client, services, pipeline singletons.
"""
from functools import lru_cache
from fastapi import Request
from supabase import acreate_client, AClient

from app.config import get_settings
from app.services.arxiv_service import ArxivService
from app.parsers.pdf_parser import PDFParser
from app.parsers.text_cleaner import TextChunker
from app.embeddings.embedding_service import EmbeddingService
from app.embeddings.vector_store import VectorStore
from app.ai.gemini_client import GeminiClient
from app.ai.rag_pipeline import RAGPipeline


# â”€â”€â”€ Singleton factories (cached per process) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_supabase: AClient = None
_pipeline: RAGPipeline = None
_gemini: GeminiClient = None


async def init_dependencies():
    """Called on app startup to initialize all singletons."""
    global _supabase, _pipeline, _gemini
    settings = get_settings()

    _supabase = await acreate_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )

    _gemini = GeminiClient(
        api_key=settings.gemini_api_key,
        model=settings.generation_model,
    )

    embedding_service = EmbeddingService(
        api_key=settings.gemini_api_key,
        model=settings.embedding_model,
    )

    vector_store = VectorStore(supabase=_supabase)
    arxiv_service = ArxivService()
    pdf_parser = PDFParser()
    chunker = TextChunker(
        chunk_size=settings.chunk_size,
        overlap=settings.chunk_overlap,
    )

    _pipeline = RAGPipeline(
        settings=settings,
        arxiv_service=arxiv_service,
        pdf_parser=pdf_parser,
        chunker=chunker,
        embedding_service=embedding_service,
        vector_store=vector_store,
        gemini_client=_gemini,
        supabase=_supabase,
    )


async def get_supabase() -> AClient:
    return _supabase


async def get_pipeline() -> RAGPipeline:
    return _pipeline


async def get_gemini() -> GeminiClient:
    return _gemini

