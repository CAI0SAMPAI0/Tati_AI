import logging
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)


class UpstashService:
    """
    Serviço centralizado para conexão e operações no Redis / Upstash.
    Fornece cliente direto compatível e integração com o cache do Django.
    """

    def __init__(self):
        self._redis: Optional[Any] = None
        self._connected: bool = False

    def _ensure_connected(self) -> bool:
        if self._connected and self._redis is not None:
            return True

        redis_url = os.getenv("UPSTASH_REDIS_URL") or os.getenv("REDIS_URL")
        if redis_url and isinstance(redis_url, str) and redis_url.strip():
            clean_url = redis_url.strip()
            # Valida que a URL não contém placeholders de template
            if not ("{" in clean_url or "}" in clean_url or "$" in clean_url):
                try:
                    import redis

                    self._redis = redis.from_url(clean_url, decode_responses=True)
                    self._connected = True
                    return True
                except Exception as err:
                    logger.debug(f"[UpstashService] Falha ao conectar via redis-py: {err}")

        # Fallback: tenta usar django.core.cache se disponível
        try:
            from django.core.cache import cache

            class _CacheRedisAdapter:
                def __init__(self, cache_backend):
                    self._cache = cache_backend

                def delete(self, *keys):
                    for k in keys:
                        try:
                            self._cache.delete(k)
                        except Exception:
                            pass
                    return True

            self._redis = _CacheRedisAdapter(cache)
            self._connected = True
            return True
        except Exception:
            pass

        return False


upstash_service = UpstashService()
