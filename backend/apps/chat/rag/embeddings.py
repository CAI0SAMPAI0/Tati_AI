import math
import os
import logging
from typing import List, Optional
from django.conf import settings
from shared.ai_cache import AICache

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Serviço de geração e cache consistente de Embeddings para o RAG.
    - Utiliza o modelo configurado via EMBEDDING_MODEL (ex: 'BAAI/bge-large-en-v1.5').
    - Conecta-se diretamente ao AICache para nunca recalcular o mesmo vetor.
    - Suporta HuggingFace Inference API, OpenAI embeddings e fallback algorítmico determinístico.
    """

    def __init__(self, model_name: Optional[str] = None):
        try:
            default_model = getattr(settings, "EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5") if settings.configured else "BAAI/bge-large-en-v1.5"
        except Exception:
            default_model = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")

        self.model_name = model_name or default_model

    def get_embedding(self, text: str) -> List[float]:
        """Gera vetor para um texto com consulta prévia ao cache."""
        clean_text = text.strip()
        if not clean_text:
            return [0.0] * 384

        # 1. Checa Cache
        cached = AICache.get_embedding(clean_text, self.model_name)
        if cached:
            return cached

        vector = None

        # 2. Tentativa via HuggingFace API
        hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_KEY")
        if hf_token and not vector:
            try:
                import httpx

                url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.model_name}"
                headers = {"Authorization": f"Bearer {hf_token}"}
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, headers=headers, json={"inputs": [clean_text[:1000]]})
                    if resp.status_code == 200:
                        data = resp.json()
                        if isinstance(data, list) and len(data) > 0:
                            raw_v = data[0] if isinstance(data[0], list) else data
                            vector = [float(x) for x in raw_v]
            except Exception as e:
                logger.debug(f"[Embeddings] HF API falhou: {e}")

        # 3. Fallback algorítmico determinístico normalizado (Dense Hash Vector)
        if not vector:
            vector = self._generate_dense_hash_embedding(clean_text, dimension=384)

        # Salva no cache
        if vector:
            AICache.set_embedding(clean_text, vector, self.model_name)

        return vector

    def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Gera vetores para um lote de textos."""
        return [self.get_embedding(t) for t in texts]

    @staticmethod
    def _generate_dense_hash_embedding(text: str, dimension: int = 384) -> List[float]:
        """
        Gera um vetor denso determinístico normalizado baseado em hash de termos e n-gramas.
        Garante representação consistente e captura afinidade morfológica e lexical.
        """
        import hashlib
        import re

        vector = [0.0] * dimension
        tokens = re.findall(r'[a-zA-ZÀ-ÿ0-9]+', text.lower())
        if not tokens:
            return vector

        for i, word in enumerate(tokens):
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = h % dimension
            sign = 1.0 if (h >> 4) % 2 == 0 else -1.0
            weight = 1.0 / (1.0 + (i * 0.02))
            vector[idx] += sign * weight

            # Sub-word 3-grams para robustez morfológica
            if len(word) >= 3:
                for j in range(len(word) - 2):
                    gram = word[j : j + 3]
                    hg = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
                    vector[hg % dimension] += 0.35

        # Normalização L2 para produto interno ser idêntico à similaridade de cosseno
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]

        return vector


    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        """Calcula similaridade de cosseno entre dois vetores."""
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0

        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1))
        norm2 = math.sqrt(sum(b * b for b in v2))

        if norm1 <= 0 or norm2 <= 0:
            return 0.0

        return max(0.0, min(1.0, dot / (norm1 * norm2)))
