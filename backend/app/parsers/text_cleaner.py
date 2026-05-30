"""
Text Chunker — Split extracted text into overlapping chunks for embedding.
"""
import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class TextChunker:
    """Splits long text into overlapping chunks suitable for embedding."""

    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size  # in approximate words
        self.overlap = overlap

    def chunk_text(
        self,
        text: str,
        paper_id: str,
        arxiv_id: str,
        title: str,
    ) -> List[Dict[str, Any]]:
        """Chunk text into overlapping segments with metadata."""
        # Split into paragraphs first to respect natural boundaries
        paragraphs = self._split_paragraphs(text)
        words_buffer: List[str] = []
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0

        for para in paragraphs:
            words = para.split()
            words_buffer.extend(words)

            while len(words_buffer) >= self.chunk_size:
                chunk_words = words_buffer[: self.chunk_size]
                chunk_text = " ".join(chunk_words)

                if len(chunk_text.strip()) > 100:  # Skip tiny chunks
                    chunks.append({
                        "paper_id": paper_id,
                        "arxiv_id": arxiv_id,
                        "title": title,
                        "chunk_index": chunk_idx,
                        "chunk_text": chunk_text,
                        "metadata": {
                            "word_count": len(chunk_words),
                            "char_count": len(chunk_text),
                        },
                    })
                    chunk_idx += 1

                # Slide window with overlap
                words_buffer = words_buffer[self.chunk_size - self.overlap :]

        # Flush remaining buffer
        if words_buffer and len(" ".join(words_buffer)) > 100:
            chunk_text = " ".join(words_buffer)
            chunks.append({
                "paper_id": paper_id,
                "arxiv_id": arxiv_id,
                "title": title,
                "chunk_index": chunk_idx,
                "chunk_text": chunk_text,
                "metadata": {
                    "word_count": len(words_buffer),
                    "char_count": len(chunk_text),
                },
            })

        logger.info(f"Chunked paper {arxiv_id} into {len(chunks)} chunks")
        return chunks

    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text on double newlines / section headers."""
        # Split on double newlines or markdown headers
        parts = re.split(r"\n{2,}|(?=^##\s)", text, flags=re.MULTILINE)
        return [p.strip() for p in parts if p.strip()]
