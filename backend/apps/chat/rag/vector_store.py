import os
import json
import logging
from typing import List, Optional, Dict, Any, Tuple
from django.conf import settings
from .models import DocumentChunk
from .embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class VectorStore:
    """
    Banco Vetorial e Gerenciador de Índices para RAG da Teacher Tatiana.
    - Indexação semântica com suporte a busca híbrida (vetorial + palavras-chave).
    - Persistência automática em disco no diretório MEDIA_ROOT/rag_index/.
    - Filtragem flexível por metadados (curso, título, categoria).
    """

    def __init__(
        self,
        index_name: str = "tati_course_materials",
        embedding_service: Optional[EmbeddingService] = None,
    ):
        self.index_name = index_name
        self.embedding_service = embedding_service or EmbeddingService()
        self.chunks: List[DocumentChunk] = []

        try:
            media_root = getattr(settings, "MEDIA_ROOT", "/app/media") if settings.configured else "media"
        except Exception:
            media_root = os.getenv("MEDIA_ROOT", "media")

        self.storage_dir = os.path.join(media_root, "rag_index")
        self.storage_file = os.path.join(self.storage_dir, f"{self.index_name}.json")
        self._load_from_disk()

    def add_chunks(self, chunks: List[DocumentChunk]):
        """Calcula embeddings faltantes e adiciona os chunks ao índice."""
        for c in chunks:
            if not c.embedding:
                c.embedding = self.embedding_service.get_embedding(c.text)
            self.chunks.append(c)

        self._save_to_disk()
        logger.info(f"[VectorStore] {len(chunks)} chunks adicionados. Total no índice: {len(self.chunks)}.")

    def search(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: float = 0.20,
        filter_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Executa busca híbrida (similaridade de cosseno vetorial + overlap léxico refinado).
        Retorna lista de tuplas (DocumentChunk, score) ordenada por relevância decrescente.
        """
        import re

        if not self.chunks or not query.strip():
            return []

        stopwords = {
            "o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "em", "no", "na",
            "nos", "nas", "por", "para", "com", "como", "que", "e", "é", "se", "qual", "quais",
            "quando", "onde", "você", "posso", "dizer", "significa", "the", "an", "at", "to", "for", "of", "and", "is", "are"
        }

        query_vector = self.embedding_service.get_embedding(query)
        raw_tokens = re.findall(r'[a-zA-ZÀ-ÿ0-9]+', query.lower())
        query_words = [w for w in raw_tokens if w not in stopwords]
        if not query_words:
            query_words = raw_tokens

        query_words_set = set(query_words)
        scored_results: List[Tuple[DocumentChunk, float]] = []

        for chunk in self.chunks:
            # Aplica filtro de metadados se fornecido
            if filter_metadata:
                match = True
                for k, v in filter_metadata.items():
                    if chunk.metadata.get(k) != v and getattr(chunk, k, None) != v:
                        match = False
                        break
                if not match:
                    continue

            # Similaridade Vetorial (0.0 a 1.0)
            if chunk.embedding:
                cos_sim = self.embedding_service.cosine_similarity(query_vector, chunk.embedding)
            else:
                cos_sim = 0.0

            # Similaridade Léxica Refinada (Token matching com palavras-chave significativas)
            chunk_tokens = set(re.findall(r'[a-zA-ZÀ-ÿ0-9]+', chunk.text.lower()))
            intersection = query_words_set.intersection(chunk_tokens)
            lex_sim = len(intersection) / max(len(query_words_set), 1) if query_words_set else 0.0

            # Score Híbrido: 60% semântico + 40% léxico
            hybrid_score = (cos_sim * 0.60) + (lex_sim * 0.40)

            if hybrid_score >= score_threshold:
                scored_results.append((chunk, hybrid_score))

        # Ordena decrescente pelo score
        scored_results.sort(key=lambda x: x[1], reverse=True)
        return scored_results[:top_k]


    def _save_to_disk(self):
        """Persiste o índice no disco para persistência entre restarts do servidor."""
        try:
            os.makedirs(self.storage_dir, exist_ok=True)
            data = [
                {
                    **c.to_dict(),
                    "embedding": c.embedding,
                }
                for c in self.chunks
            ]
            with open(self.storage_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"[VectorStore] Falha ao persistir índice em disco: {e}")

    def _load_from_disk(self):
        """Carrega índice pré-existente do disco."""
        if not os.path.exists(self.storage_file):
            return

        try:
            with open(self.storage_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.chunks = [DocumentChunk.from_dict(d) for d in data]
            logger.info(f"[VectorStore] {len(self.chunks)} chunks carregados de {self.storage_file}.")
        except Exception as e:
            logger.warning(f"[VectorStore] Falha ao carregar índice do disco: {e}")

    def clear(self):
        """Limpa o índice em memória e no disco."""
        self.chunks.clear()
        if os.path.exists(self.storage_file):
            try:
                os.remove(self.storage_file)
            except Exception:
                pass
