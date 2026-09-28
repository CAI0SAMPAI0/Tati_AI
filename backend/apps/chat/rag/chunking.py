import re
from typing import List, Dict, Any, Optional
from .models import DocumentChunk


class SmartChunker:
    """
    Estratégia de chunking inteligente para materiais de curso de inglês.
    - Chunks de 500 a 1000 tokens (aproximadamente 2000 a 3500 caracteres).
    - Overlap de 100 a 200 tokens (aproximadamente 400 a 700 caracteres).
    - Respeita quebra de parágrafos e frases completas.
    - Inclui metadados de rastreabilidade (título, fonte, página).
    """

    def __init__(
        self,
        chunk_size_chars: int = 2200,
        chunk_overlap_chars: int = 400,
        min_chunk_chars: int = 150,
    ):
        self.chunk_size = chunk_size_chars
        self.chunk_overlap = chunk_overlap_chars
        self.min_chunk_chars = min_chunk_chars

    def split_text(
        self,
        text: str,
        source: str,
        title: str,
        doc_type: str = "pdf",
        page: Optional[int] = None,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[DocumentChunk]:
        clean_text = re.sub(r"\s+", " ", text).strip()
        if not clean_text:
            return []

        if len(clean_text) <= self.chunk_size:
            chunk_id = f"{re.sub(r'[^a-zA-Z0-9_]', '_', title[:30])}_p{page or 1}_0"
            return [
                DocumentChunk(
                    id=chunk_id,
                    text=clean_text,
                    source=source,
                    title=title,
                    doc_type=doc_type,
                    page=page,
                    metadata=extra_metadata or {},
                )
            ]

        paragraphs = text.split("\n\n")
        chunks: List[DocumentChunk] = []
        current_text = ""
        chunk_index = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if len(current_text) + len(para) + 1 <= self.chunk_size:
                current_text = f"{current_text}\n\n{para}".strip()
            else:
                if current_text and len(current_text) >= self.min_chunk_chars:
                    chunk_id = f"{re.sub(r'[^a-zA-Z0-9_]', '_', title[:30])}_p{page or 1}_{chunk_index}"
                    chunks.append(
                        DocumentChunk(
                            id=chunk_id,
                            text=current_text,
                            source=source,
                            title=title,
                            doc_type=doc_type,
                            page=page,
                            metadata=extra_metadata or {},
                        )
                    )
                    chunk_index += 1

                    # Aplica overlap retrocedendo parte do texto anterior
                    overlap_start = max(0, len(current_text) - self.chunk_overlap)
                    overlap_text = current_text[overlap_start:].strip()
                    current_text = f"{overlap_text}\n\n{para}".strip()
                else:
                    current_text = f"{current_text}\n\n{para}".strip()

        if current_text and len(current_text) >= self.min_chunk_chars:
            chunk_id = f"{re.sub(r'[^a-zA-Z0-9_]', '_', title[:30])}_p{page or 1}_{chunk_index}"
            chunks.append(
                DocumentChunk(
                    id=chunk_id,
                    text=current_text,
                    source=source,
                    title=title,
                    doc_type=doc_type,
                    page=page,
                    metadata=extra_metadata or {},
                )
            )

        return chunks
