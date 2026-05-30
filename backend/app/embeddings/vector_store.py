"""
Vector Store â€” Store and retrieve embeddings from Supabase pgvector.
"""
import logging
from typing import List, Dict, Any, Optional
from supabase import AClient

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(self, supabase: AClient):
        self.supabase = supabase

    async def store_embeddings(self, chunks: List[Dict[str, Any]]) -> int:
        """Store a list of chunk embeddings. Returns count stored."""
        if not chunks:
            return 0

        records = []
        for chunk in chunks:
            if chunk.get("embedding") is None:
                continue
            records.append({
                "paper_id": chunk["paper_id"],
                "chunk_index": chunk["chunk_index"],
                "chunk_text": chunk["chunk_text"],
                "embedding": chunk["embedding"],
                "metadata": chunk.get("metadata", {}),
            })

        if not records:
            return 0

        try:
            result = await self.supabase.table("embeddings").insert(records).execute()
            count = len(result.data) if result.data else 0
            logger.info(f"Stored {count} embeddings")
            return count
        except Exception as e:
            logger.error(f"Failed to store embeddings: {e}")
            return 0

    async def similarity_search(
        self,
        query_embedding: List[float],
        top_k: int = 25,
        paper_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Cosine similarity search against stored embeddings via RPC."""
        try:
            rpc_params: Dict[str, Any] = {
                "query_embedding": query_embedding,
                "match_count": top_k,
            }
            if paper_ids:
                rpc_params["filter_paper_ids"] = paper_ids

            result = await self.supabase.rpc(
                "match_embeddings", rpc_params
            ).execute()

            return result.data or []
        except Exception as e:
            logger.error(f"Similarity search failed: {e}")
            return []

    async def delete_paper_embeddings(self, paper_id: str) -> None:
        """Delete all embeddings for a paper (e.g., before reprocessing)."""
        try:
            await self.supabase.table("embeddings").delete().eq(
                "paper_id", paper_id
            ).execute()
        except Exception as e:
            logger.error(f"Failed to delete embeddings for {paper_id}: {e}")

    async def count_embeddings(self, paper_id: str) -> int:
        """Count embeddings stored for a paper."""
        try:
            result = (
                await self.supabase.table("embeddings")
                .select("id", count="exact")
                .eq("paper_id", paper_id)
                .execute()
            )
            return result.count or 0
        except Exception as e:
            logger.error(f"Count embeddings failed: {e}")
            return 0

