"""
PDF Parser — Extract and clean text from scientific PDFs using PyMuPDF.
"""
import fitz  # PyMuPDF
import re
import logging
import asyncio
from typing import Optional, Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)


class PDFParser:
    """Extracts structured text from scientific PDFs."""

    # Patterns for garbage text removal
    GARBAGE_PATTERNS = [
        r"^\d+$",                          # lone page numbers
        r"^Page \d+ of \d+$",             # page markers
        r"^arXiv:\d+\.\d+",               # arXiv headers in body
        r"^\s*$",                          # empty lines (handled separately)
        r"^https?://\S+$",                # lone URLs
        r"^\[?\d+\]?\s*$",               # lone reference markers
    ]
    GARBAGE_RE = [re.compile(p, re.IGNORECASE) for p in GARBAGE_PATTERNS]

    # Minimum line length to keep (filters headers/footers)
    MIN_LINE_LENGTH = 20

    def parse(self, pdf_path: str) -> Dict[str, Any]:
        """Extract text and metadata from a PDF. Returns structured dict."""
        path = Path(pdf_path)
        if not path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        doc = fitz.open(str(path))
        try:
            return self._extract_document(doc)
        finally:
            doc.close()

    async def parse_async(self, pdf_path: str) -> Dict[str, Any]:
        """Async wrapper for parse()."""
        return await asyncio.to_thread(self.parse, pdf_path)

    def _extract_document(self, doc: fitz.Document) -> Dict[str, Any]:
        """Main extraction logic."""
        full_text_parts: List[str] = []
        sections: List[Dict[str, str]] = []
        current_section: Optional[Dict[str, str]] = None
        references_text: str = ""
        in_references = False

        for page_num in range(len(doc)):
            page = doc[page_num]
            blocks = page.get_text("blocks", sort=True)  # type: ignore

            for block in blocks:
                if block[6] != 0:  # Skip image blocks
                    continue
                text = block[4].strip()
                if not text:
                    continue

                # Detect references section start
                if re.match(r"^(References|Bibliography|Works Cited)\s*$", text, re.IGNORECASE):
                    in_references = True
                    if current_section:
                        sections.append(current_section)
                        current_section = None
                    continue

                if in_references:
                    references_text += text + "\n"
                    continue

                # Detect section headers (short, bold-like, title-case lines)
                if self._is_section_header(text):
                    if current_section:
                        sections.append(current_section)
                    current_section = {"title": text, "content": ""}
                else:
                    cleaned = self._clean_block(text)
                    if cleaned:
                        if current_section:
                            current_section["content"] += cleaned + "\n"
                        else:
                            full_text_parts.append(cleaned)

        # Flush last section
        if current_section:
            sections.append(current_section)

        # Build full clean text from sections + loose paragraphs
        section_text = "\n\n".join(
            f"## {s['title']}\n{s['content'].strip()}"
            for s in sections if s["content"].strip()
        )
        preamble = "\n".join(full_text_parts)
        full_text = f"{preamble}\n\n{section_text}".strip()

        return {
            "full_text": full_text,
            "sections": sections,
            "references_text": references_text.strip(),
            "page_count": len(doc),
            "char_count": len(full_text),
        }

    def _is_section_header(self, text: str) -> bool:
        """Heuristic: short, ends without period, looks like a title."""
        lines = text.strip().splitlines()
        if len(lines) > 2:
            return False
        text = text.strip()
        if len(text) > 80:
            return False
        if text.endswith("."):
            return False
        # Numbered sections like "1. Introduction" or "2.3 Methods"
        if re.match(r"^\d+(\.\d+)*[\.\s]+[A-Z]", text):
            return True
        # All caps short title
        if text.isupper() and len(text) > 3:
            return True
        return False

    def _clean_block(self, text: str) -> str:
        """Clean a text block: remove garbage lines, normalize whitespace."""
        lines = text.splitlines()
        cleaned = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if len(line) < self.MIN_LINE_LENGTH:
                # Keep short lines that look like section data (not page numbers)
                if not any(p.match(line) for p in self.GARBAGE_RE):
                    cleaned.append(line)
                continue
            if any(p.match(line) for p in self.GARBAGE_RE):
                continue
            # Fix hyphenation at line breaks
            cleaned.append(line)

        result = " ".join(cleaned)
        # Normalize multiple spaces
        result = re.sub(r" {2,}", " ", result)
        # Fix broken words from PDF hyphenation: "param- eter" → "parameter"
        result = re.sub(r"(\w+)-\s+(\w+)", r"\1\2", result)
        return result.strip()
