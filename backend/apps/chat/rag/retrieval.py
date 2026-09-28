import logging
from typing import List, Optional, Dict, Any
from shared.ai_cache import ai_cache, AICache
from .models import DocumentChunk, RetrievalResult
from .vector_store import VectorStore

logger = logging.getLogger(__name__)


class RAGRetriever:
    """
    Componente de Retrieval para busca semântica em materiais de aula da Teacher Tatiana.
    - Suporte a cache multi-nível (L1 RAM + L2 Redis).
    - Formatação inteligente de contexto e citações obrigatórias.
    - Avaliação de confiança de resposta.
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        cache: Optional[AICache] = None,
    ):
        self.vector_store = vector_store or VectorStore()
        self.cache = cache or ai_cache

    def retrieve(
        self,
        query: str,
        top_k: int = 4,
        score_threshold: float = 0.20,
        filter_metadata: Optional[Dict[str, Any]] = None,
        use_cache: bool = True,
    ) -> List[RetrievalResult]:
        """
        Recupera os top-k trechos mais relevantes para a dúvida do aluno.
        """
        clean_query = query.strip()
        if not clean_query:
            return []

        # 1. Tenta recuperar do Cache de Retrieval
        if use_cache:
            cached_data = self.cache.get_retrieval(clean_query, top_k=top_k)
            if cached_data and isinstance(cached_data, list):
                logger.debug(f"[RAGRetriever] Cache HIT para retrieval da query: '{clean_query[:40]}...'")
                results: List[RetrievalResult] = []
                for item in cached_data:
                    chunk = DocumentChunk.from_dict(item.get("chunk", {}))
                    results.append(
                        RetrievalResult(
                            chunk=chunk,
                            score=item.get("score", 1.0),
                            citation=item.get("citation", f"conforme nos materiais em '{chunk.title}'"),
                        )
                    )
                return results

        # 2. Executa busca vetorial híbrida
        raw_results = self.vector_store.search(
            query=clean_query,
            top_k=top_k,
            score_threshold=score_threshold,
            filter_metadata=filter_metadata,
        )

        # 3. Constrói resultados com citações formatadas
        results: List[RetrievalResult] = []
        for chunk, score in raw_results:
            page_info = f" (pág. {chunk.page})" if chunk.page else ""
            citation = f"conforme nos materiais da Teacher Tati em '{chunk.title}'{page_info}"
            results.append(
                RetrievalResult(
                    chunk=chunk,
                    score=round(score, 4),
                    citation=citation,
                )
            )

        # 4. Salva no Cache para futuras queries
        if use_cache and results:
            self.cache.set_retrieval(
                clean_query,
                [r.to_dict() for r in results],
                top_k=top_k,
            )

        return results

    def format_context_for_prompt(self, results: List[RetrievalResult]) -> str:
        """
        Formata os chunks recuperados em um bloco de contexto Markdown para injeção no prompt do LLM.
        """
        if not results:
            return ""

        lines = [
            "### Materiais Oficiais da Teacher Tatiana (Contexto Relevante):",
            "Use estritamente as explicações e exemplos abaixo para enriquecer a resposta. Ao utilizar uma informação, cite a fonte conforme indicado.\n",
        ]

        for i, res in enumerate(results, start=1):
            page_str = f" | Página: {res.chunk.page}" if res.chunk.page else ""
            lines.append(f"[{i}] Fonte: \"{res.chunk.title}\"{page_str} (Tipo: {res.chunk.doc_type.upper()})")
            lines.append(f"Citação recomendada: \"{res.citation}\"")
            lines.append(f"Conteúdo:\n\"\"\"\n{res.chunk.text}\n\"\"\"\n")

        lines.append("Instrução de Citação:")
        lines.append("- Sempre que basear uma resposta em um dos trechos acima, mencione a referência de forma natural, por exemplo: 'Como vemos nos meus materiais em...' ou 'Conforme o material de...'")

        return "\n".join(lines)

    def has_high_confidence(self, results: List[RetrievalResult], min_score: float = 0.45) -> bool:
        """Verifica se o resultado de maior relevância atinge o patamar de alta confiança."""
        if not results:
            return False
        return results[0].score >= min_score
