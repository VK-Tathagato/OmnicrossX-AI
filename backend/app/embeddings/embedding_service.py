"""
Embedding Service — Generate text embeddings using Google text-embedding-004.
"""
from google import genai
from google.genai import types
import asyncio
import logging
from typing import List, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, api_key: str, model: str = "models/gemini-embedding-2"):
        self.client = genai.Client(api_key=api_key)
        self.model = model.replace("models/", "") if model.startswith("models/") else model
        self.dimension = 768

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def embed_text(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text. Returns 768-dim vector."""
        try:
            result = await self.client.aio.models.embed_content(
                model=self.model,
                contents=text[:8000],  # API limit safety
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=self.dimension
                )
            )
            return result.embeddings[0].values
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
            result = await self.client.aio.models.embed_content(
                model=self.model,
                contents=query,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_QUERY",
                    output_dimensionality=self.dimension
                )
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error(f"Query embedding failed: {e}")
            raise

    async def embed_batch(
        self, texts: List[str], batch_size: int = 100, max_concurrency: int = 1
    ) -> List[Optional[List[float]]]:
        """Embed a list of texts sequentially in batches to respect API rate limits."""
        embeddings = [None] * len(texts)

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            for attempt in range(6):
                try:
                    result = await self.client.aio.models.embed_content(
                        model=self.model,
                        contents=batch,
                        config=types.EmbedContentConfig(
                            task_type="RETRIEVAL_DOCUMENT",
                            output_dimensionality=self.dimension
                        )
                    )
                    for j, emb in enumerate(result.embeddings):
                        embeddings[i + j] = emb.values
                    
                    # Sleep to respect 15 RPM limit (~4s per request)
                    if i + batch_size < len(texts):
                        await asyncio.sleep(4.1)
                    break  # Success, move to next batch
                except Exception as e:
                    if "429" in str(e) or "exhausted" in str(e).lower() or "quota" in str(e).lower():
                        wait_time = 10 + (5 * attempt)
                        logger.warning(f"Rate limit hit during embedding. Backing off for {wait_time}s...")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Batch embedding error: {e}")
                        break
            else:
                logger.error(f"Batch embedding failed after multiple attempts.")

        return embeddings
