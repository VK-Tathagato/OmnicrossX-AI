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
        self, texts: List[str], batch_size: int = 100
    ) -> List[Optional[List[float]]]:
        """Embed a list of texts in batches to respect rate limits."""
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                # Use a single API call for the entire batch
                result = await asyncio.to_thread(
                    genai.embed_content,
                    model=self.model,
                    content=batch,
                    task_type="retrieval_document",
                    output_dimensionality=self.dimension
                )
                
                # If a single text was sent (batch_size=1), it returns a dict with 'embedding' as a flat list
                # If multiple texts were sent, it returns a dict where 'embedding' is a list of lists
                if isinstance(result["embedding"][0], list):
                    embeddings.extend(result["embedding"])
                else:
                    embeddings.append(result["embedding"])
                    
            except Exception as e:
                logger.error(f"Batch embedding error: {e}")
                if "429" in str(e) or "exhausted" in str(e).lower() or "quota" in str(e).lower():
                    # Wait and retry manually for rate limits
                    logger.warning("Rate limit hit during embedding. Backing off for 15s...")
                    await asyncio.sleep(15)
                    try:
                        result = await asyncio.to_thread(
                            genai.embed_content,
                            model=self.model,
                            content=batch,
                            task_type="retrieval_document",
                            output_dimensionality=self.dimension
                        )
                        if isinstance(result["embedding"][0], list):
                            embeddings.extend(result["embedding"])
                        else:
                            embeddings.append(result["embedding"])
                        continue
                    except Exception as retry_err:
                        logger.error(f"Retry batch embedding failed: {retry_err}")
                embeddings.extend([None] * len(batch))
                
            # Small delay between batches to avoid rate limits
            if i + batch_size < len(texts):
                await asyncio.sleep(1.0)
                
        return embeddings
