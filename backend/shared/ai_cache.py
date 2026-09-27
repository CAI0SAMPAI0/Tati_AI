import os
import hashlib
import json
import logging
import time
from typing import Any, Dict, List, Optional
from django.conf import settings

logger = logging.getLogger(__name__)


class AICache:
    """
    Camada de Caching de Alta Performance para IA (Teacher Tatiana AI).
    - Cache de respostas de LLM para queries idempotentes (ex: dicionário, explicações de gramática).
    - Cache de vetores de embeddings (evita recomputar vetor para a mesma string).
    - Cache de retrieval semântico para perguntas frequentes de alunos.
    - Suporta Redis / Upstash com fallback resiliente para memória local (LRU com TTL).
    """

    _MEMORY_STORE: Dict[str, Dict[str, Any]] = {}
    _MAX_MEMORY_ITEMS = 2000

    @classmethod
    def make_hash(cls, *args: Any) -> str:
        """Gera um hash SHA-256 determinístico dos argumentos."""
        hasher = hashlib.sha256()
        for a in args:
            if isinstance(a, (dict, list)):
                hasher.update(json.dumps(a, sort_keys=True).encode("utf-8"))
            else:
                hasher.update(str(a).encode("utf-8"))
        return hasher.hexdigest()

    @classmethod
    def _is_enabled(cls) -> bool:
        try:
            if settings.configured:
                return getattr(settings, "AI_CACHE_ENABLED", True)
        except Exception:
            pass
        return os.getenv("AI_CACHE_ENABLED", "true").lower() in ("true", "1", "yes")

    @classmethod
    def _get_redis(cls):
        try:
            from app.shared.services.upstash import upstash_service
            if upstash_service._ensure_connected() and upstash_service._redis:
                return upstash_service._redis
        except Exception:
            pass
        return None

    # 1. CACHE DE RESPOSTAS DE LLM
    @classmethod
    def get_llm_response(cls, key_or_prompt: str) -> Optional[str]:
        if not cls._is_enabled():
            return None

        cache_key = f"ai:llm:{cls.make_hash(key_or_prompt)}"

        # 1. Tenta Redis
        r = cls._get_redis()
        if r:
            try:
                val = r.get(cache_key)
                if val:
                    return val.decode("utf-8") if isinstance(val, bytes) else str(val)
            except Exception as e:
                logger.debug(f"[AICache] Redis get_llm_response falhou: {e}")

        # 2. Fallback Memória
        entry = cls._MEMORY_STORE.get(cache_key)
        if entry:
            if entry["expires_at"] > time.time():
                return entry["data"]
            else:
                cls._MEMORY_STORE.pop(cache_key, None)

        return None

    @classmethod
    def set_llm_response(cls, key_or_prompt: str, response: str, ttl: Optional[int] = None):
        if not cls._is_enabled() or not response:
            return

        try:
            default_ttl = getattr(settings, "AI_CACHE_TTL", 86400) if settings.configured else 86400
        except Exception:
            default_ttl = int(os.getenv("AI_CACHE_TTL", "86400"))
        effective_ttl = ttl or default_ttl
        cache_key = f"ai:llm:{cls.make_hash(key_or_prompt)}"

        r = cls._get_redis()
        if r:
            try:
                r.set(cache_key, response, ex=effective_ttl)
                return
            except Exception as e:
                logger.debug(f"[AICache] Redis set_llm_response falhou: {e}")

        # Fallback Memória
        if len(cls._MEMORY_STORE) >= cls._MAX_MEMORY_ITEMS:
            # Remove 20% das entradas mais antigas
            sorted_keys = sorted(cls._MEMORY_STORE.keys(), key=lambda k: cls._MEMORY_STORE[k]["expires_at"])
            for old_k in sorted_keys[: len(sorted_keys) // 5]:
                cls._MEMORY_STORE.pop(old_k, None)

        cls._MEMORY_STORE[cache_key] = {
            "data": response,
            "expires_at": time.time() + effective_ttl,
        }

    # 2. CACHE DE EMBEDDINGS
    @classmethod
    def get_embedding(cls, text: str, model_name: str = "") -> Optional[List[float]]:
        if not cls._is_enabled():
            return None

        cache_key = f"ai:emb:{cls.make_hash(model_name, text)}"

        r = cls._get_redis()
        if r:
            try:
                val = r.get(cache_key)
                if val:
                    data_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
                    return json.loads(data_str)
            except Exception as e:
                logger.debug(f"[AICache] Redis get_embedding falhou: {e}")

        entry = cls._MEMORY_STORE.get(cache_key)
        if entry and entry["expires_at"] > time.time():
            return entry["data"]

        return None

    @classmethod
    def set_embedding(cls, text: str, embedding: List[float], model_name: str = "", ttl: int = 604800):
        """Salva embedding com TTL padrão de 7 dias."""
        if not cls._is_enabled() or not embedding:
            return

        cache_key = f"ai:emb:{cls.make_hash(model_name, text)}"
        data_str = json.dumps(embedding)

        r = cls._get_redis()
        if r:
            try:
                r.set(cache_key, data_str, ex=ttl)
                return
            except Exception as e:
                logger.debug(f"[AICache] Redis set_embedding falhou: {e}")

        cls._MEMORY_STORE[cache_key] = {
            "data": embedding,
            "expires_at": time.time() + ttl,
        }

    # 3. CACHE DE RETRIEVAL SEMÂNTICO (RAG)
    @classmethod
    def get_retrieval(cls, query: str, top_k: int = 4) -> Optional[List[Dict[str, Any]]]:
        if not cls._is_enabled():
            return None

        cache_key = f"ai:retrieval:{cls.make_hash(query.strip().lower(), top_k)}"

        r = cls._get_redis()
        if r:
            try:
                val = r.get(cache_key)
                if val:
                    data_str = val.decode("utf-8") if isinstance(val, bytes) else str(val)
                    return json.loads(data_str)
            except Exception as e:
                logger.debug(f"[AICache] Redis get_retrieval falhou: {e}")

        entry = cls._MEMORY_STORE.get(cache_key)
        if entry and entry["expires_at"] > time.time():
            return entry["data"]

        return None

    @classmethod
    def set_retrieval(cls, query: str, chunks: List[Dict[str, Any]], top_k: int = 4, ttl: int = 3600):
        """Salva resultados de busca semântica com TTL padrão de 1 hora."""
        if not cls._is_enabled() or not chunks:
            return

        cache_key = f"ai:retrieval:{cls.make_hash(query.strip().lower(), top_k)}"
        data_str = json.dumps(chunks)

        r = cls._get_redis()
        if r:
            try:
                r.set(cache_key, data_str, ex=ttl)
                return
            except Exception as e:
                logger.debug(f"[AICache] Redis set_retrieval falhou: {e}")

        cls._MEMORY_STORE[cache_key] = {
            "data": chunks,
            "expires_at": time.time() + ttl,
        }

    @classmethod
    def clear(cls):
        cls._MEMORY_STORE.clear()


ai_cache = AICache()

