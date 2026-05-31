"""
Embedding Service — Generate text embeddings using Google text-embedding-004.
"""
import google.generativeai as genai
import asyncio
import logging
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, api_key: str, model: str = "models/text-embedding-004"):
        genai.configure(api_key=api_key)
        self.model = model
        self.dimension = 768

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def embed_text(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text. Returns 768-dim vector."""
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=self.model,
                content=text[:8000],  # API limit safety
                task_type="retrieval_document",
                output_dimensionality=self.dimension
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            raise

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def embed_query(self, query: str) -> Optional[List[float]]:
        """Generate embedding for a search query (different task type)."""
        try:
            result = await asyncio.to_thread(
                genai.embed_content,
                model=self.model,
                content=query,
                task_type="retrieval_query",
                output_dimensionality=self.dimension
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Query embedding failed: {e}")
            raise

    async def embed_batch(
        self, texts: List[str], batch_size: int = 100, max_concurrency: int = 5
    ) -> List[Optional[List[float]]]:
        """Embed a list of texts concurrently in batches to improve speed."""
        embeddings = [None] * len(texts)
        sem = asyncio.Semaphore(max_concurrency)

        async def _process_batch(start_idx: int, batch: List[str]):
            async with sem:
                try:
                    result = await asyncio.to_thread(
                        genai.embed_content,
                        model=self.model,
                        content=batch,
                        task_type="retrieval_document",
                        output_dimensionality=self.dimension
                    )
                    
                    if isinstance(result["embedding"][0], list):
                        for j, emb in enumerate(result["embedding"]):
                            embeddings[start_idx + j] = emb
                    else:
                        embeddings[start_idx] = result["embedding"]
                        
                except Exception as e:
                    logger.error(f"Batch embedding error: {e}")
                    if "429" in str(e) or "exhausted" in str(e).lower() or "quota" in str(e).lower():
                        logger.warning("Rate limit hit during embedding. Backing off for 10s...")
                        await asyncio.sleep(10)
                        try:
                            result = await asyncio.to_thread(
                                genai.embed_content,
                                model=self.model,
                                content=batch,
                                task_type="retrieval_document",
                                output_dimensionality=self.dimension
                            )
                            if isinstance(result["embedding"][0], list):
                                for j, emb in enumerate(result["embedding"]):
                                    embeddings[start_idx + j] = emb
                            else:
                                embeddings[start_idx] = result["embedding"]
                        except Exception as retry_err:
                            logger.error(f"Retry batch embedding failed: {retry_err}")

        tasks = [
            _process_batch(i, texts[i : i + batch_size])
            for i in range(0, len(texts), batch_size)
        ]
        await asyncio.gather(*tasks)
                
        return embeddings
