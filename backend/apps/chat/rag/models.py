import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class DocumentChunk:
    id: str
    text: str
    source: str
    title: str
    doc_type: str = "pdf"  # pdf, pptx, doc, md, drive
    page: Optional[int] = None
    author: str = "Teacher Tatiana Duarte"
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    embedding: Optional[List[float]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "text": self.text,
            "source": self.source,
            "title": self.title,
            "doc_type": self.doc_type,
            "page": self.page,
            "author": self.author,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DocumentChunk":
        return cls(
            id=data.get("id", ""),
            text=data.get("text", ""),
            source=data.get("source", ""),
            title=data.get("title", ""),
            doc_type=data.get("doc_type", "pdf"),
            page=data.get("page"),
            author=data.get("author", "Teacher Tatiana Duarte"),
            created_at=data.get("created_at", time.time()),
            metadata=data.get("metadata", {}),
            embedding=data.get("embedding"),
        )


@dataclass
class RetrievalResult:
    chunk: DocumentChunk
    score: float
    citation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk": self.chunk.to_dict(),
            "score": self.score,
            "citation": self.citation,
        }


@dataclass
class EvalItem:
    id: str
    question: str
    expected_answer_keywords: List[str]
    expected_sources: List[str]
    category: str
    cefr_level: str = "B1"


@dataclass
class EvalReport:
    total_queries: int
    hit_rate: float
    recall_at_k: float
    faithfulness_score: float
    avg_latency_ms: float
    details: List[Dict[str, Any]]
