import logging
"""
Serviço Upstash Redis para cache e rate limiting.
Usado para melhorar performance e controlar limites de requisições.
"""

from typing import Optional
import os
import json


class UpstashService:
    """Serviço singleton para Upstash Redis."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._redis = None
        self._enabled: bool | None = None

        self._initialized = True

    def _ensure_connected(self) -> bool | None:
        """Tenta conectar ao Redis na primeira vez que for necessário."""
        if self._enabled is not None:
            return self._enabled

        try:
            upstash_url = os.getenv('UPSTASH_REDIS_URL')
            upstash_token = os.getenv('UPSTASH_REDIS_TOKEN')

            if upstash_url and upstash_token:
                from upstash_redis import Redis

                self._redis = Redis(
                    url=upstash_url, token=upstash_token)
                self._enabled = True
                logging.info(
                    '[Upstash] ✅ Conectado ao Redis (lazy init)')
            else:
                logging.info(
                    '[Upstash] ⚠️ UPSTASH_REDIS_URL ou UPSTASH_REDIS_TOKEN não configurado')
                self._enabled = False
        except ImportError:
            logging.info(
                '[Upstash] WARNING Pacote upstash-redis não instalado')
            self._enabled = False
        except Exception as e:
            logging.info(f'[Upstash] WARNING Erro ao conectar: {e}')
            self._enabled = False

        return self._enabled

    @property
    def enabled(self) -> bool | None:
        """Verifica se o Redis está habilitado."""
        return self._ensure_connected()

    @property
    def redis(self):
        self._ensure_connected()
        return self._redis

    # ── Helpers de cache ──────────────────────────────────────────────

    async def cache_get(self, key: str) -> Optional[dict]:
        if not self._ensure_connected() or not self._redis:
            return None
        try:
            import asyncio
            value = await asyncio.to_thread(self._redis.get, key)
            if value:
                return json.loads(value)
        except Exception as e:
            logging.info(f'[Upstash] Erro ao obter cache: {e}')
        return None

    async def cache_set(
            self,
            key: str,
            value: dict,
            ttl: int = 3600) -> bool:
        if not self._ensure_connected() or not self._redis:
            return False
        try:
            import asyncio
            await asyncio.to_thread(self._redis.set, key, json.dumps(value), ex=ttl)
            return True
        except Exception as e:
            logging.info(f'[Upstash] Erro ao salvar cache: {e}')
            return False

    async def cache_delete(self, key: str) -> bool:
        if not self._ensure_connected() or not self._redis:
            return False
        try:
            import asyncio
            await asyncio.to_thread(self._redis.delete, key)
            return True
        except Exception as e:
            logging.info(f'[Upstash] Erro ao deletar cache: {e}')
            return False

    async def rate_limit_check(
        self, key: str, max_requests: int = 10, window_seconds: int = 60
    ) -> dict:
        if not self._ensure_connected() or not self._redis:
            return {'allowed': True, 'remaining': -1, 'reset_at': 0}

        import asyncio

        try:
            current = await asyncio.to_thread(self._redis.get, key)
            current_count = int(current) if current else 0

            if current_count >= max_requests:
                ttl = await asyncio.to_thread(self._redis.ttl, key)
                return {
                    'allowed': False,
                    'remaining': 0,
                    'reset_at': ttl if ttl > 0 else window_seconds,
                }

            await asyncio.to_thread(self._redis.incr, key)
            await asyncio.to_thread(self._redis.expire, key, window_seconds)

            return {
                'allowed': True,
                'remaining': max_requests - current_count - 1,
                'reset_at': window_seconds,
            }
        except Exception as e:
            logging.info(f'[Upstash] Erro no rate limit: {e}')
            self._enabled = False
            return {'allowed': True, 'remaining': -1, 'reset_at': 0}

    def user_cache_key(
            self,
            username: str,
            prefix: str = 'user') -> str:
        return f'{prefix}:{username}'

    def rate_limit_key(self, identifier: str, action: str) -> str:
        return f'ratelimit:{action}:{identifier}'


# Singleton — instanciação aqui é barata (não conecta)
upstash_service = UpstashService()


async def invalidate_user_cache(username: str):
    keys = [
        f'profile:{username}',
        f'xp:{username}',
        f'streak:{username}',
        f'vocabulary:{username}',
        f'trophies:{username}',
        f'trophies_all:{username}',
        f'modules:list:{username}',
        f'report:weekly:{username}',
        f'report:monthly:{username}',
        f'study_time:{username}',
        f'user_stats:{username}',
        f'fluency_evolution:{username}',
    ]
    for key in keys:
        await cache_delete(key)


async def cache_get(key: str) -> Optional[dict]:
    return await upstash_service.cache_get(key)


async def cache_set(key: str, value: dict, ttl: int = 3600) -> bool:
    return await upstash_service.cache_set(key, value, ttl)


async def cache_delete(key: str) -> bool:
    return await upstash_service.cache_delete(key)


async def rate_limit_check(
    key: str, max_requests: int = 10, window_seconds: int = 60
) -> dict:
    return await upstash_service.rate_limit_check(key, max_requests, window_seconds)


async def acquire_lock(lock_name: str, expire_seconds: int = 300) -> bool:
    """Tenta obter um lock distribuído no Redis (SETNX). Retorna True se obtiver com sucesso."""
    if not upstash_service._ensure_connected() or not upstash_service._redis:
        return True  # Fallback se Redis estiver indisponível
    try:
        import asyncio
        res = await asyncio.to_thread(
            upstash_service._redis.set,
            f"lock:{lock_name}",
            "1",
            ex=expire_seconds,
            nx=True
        )
        return bool(res)
    except Exception as e:
        logging.info(f"[Lock] Erro ao adquirir lock {lock_name}: {e}")
        return True  # Fallback para permitir processamento


async def release_lock(lock_name: str):
    """Libera um lock distribuído no Redis."""
    if not upstash_service._ensure_connected() or not upstash_service._redis:
        return
    try:
        import asyncio
        await asyncio.to_thread(upstash_service._redis.delete, f"lock:{lock_name}")
    except Exception as e:
        logging.info(f"[Lock] Erro ao liberar lock {lock_name}: {e}")
