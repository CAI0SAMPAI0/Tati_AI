import logging
import json
import asyncio
from django.core.cache import cache
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── CACHE HELPERS (DJANGO CORE CACHE + REDIS) ─────────────────────────

async def cache_get(key: str) -> Optional[Any]:
    """
    Obtém valor do cache do Django de forma assíncrona (não bloqueante).
    """
    try:
        return await asyncio.to_thread(cache.get, key)
    except Exception as e:
        logger.warning(f"[Cache] Erro ao buscar chave {key}: {e}")
        return None


async def cache_set(key: str, value: Any, ttl: int = 3600) -> bool:
    """
    Salva valor no cache do Django com TTL especificado.
    """
    try:
        await asyncio.to_thread(cache.set, key, value, ttl)
        return True
    except Exception as e:
        logger.warning(f"[Cache] Erro ao salvar chave {key}: {e}")
        return False


async def cache_delete(key: str) -> bool:
    """
    Remove uma chave do cache.
    """
    try:
        await asyncio.to_thread(cache.delete, key)
        return True
    except Exception as e:
        logger.warning(f"[Cache] Erro ao deletar chave {key}: {e}")
        return False


async def invalidate_user_cache(username: str):
    """
    Invalida todo o conjunto de chaves de cache associadas a um aluno da Teacher Tati.
    """
    keys = [
        f"tati_ai:profile:{username}",
        f"tati_ai:xp:{username}",
        f"tati_ai:streak:{username}",
        f"tati_ai:vocabulary:{username}",
        f"tati_ai:trophies:{username}",
        f"tati_ai:trophies_all:{username}",
        f"tati_ai:modules:list:{username}",
        f"tati_ai:report:weekly:{username}",
        f"tati_ai:report:monthly:{username}",
        f"tati_ai:study_time:{username}",
        f"tati_ai:user_stats:{username}",
        f"tati_ai:fluency_evolution:{username}",
    ]
    for key in keys:
        await cache_delete(key)


async def acquire_lock(lock_name: str, expire_seconds: int = 300) -> bool:
    """
    Tenta adquirir um lock distribuído no Redis (SETNX via django-redis ou cache nativo).
    """
    try:
        # cache.add() no Django é o equivalente nativo do SETNX (retorna True se a chave não existia)
        return await asyncio.to_thread(cache.add, f"lock:{lock_name}", "1", expire_seconds)
    except Exception as e:
        logger.warning(f"[Lock] Falha ao adquirir lock {lock_name}: {e}")
        return True  # Fallback permissivo


async def release_lock(lock_name: str):
    """
    Libera um lock distribuído.
    """
    try:
        await asyncio.to_thread(cache.delete, f"lock:{lock_name}")
    except Exception as e:
        logger.warning(f"[Lock] Erro ao liberar lock {lock_name}: {e}")
