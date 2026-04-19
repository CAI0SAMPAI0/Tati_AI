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
        self._enabled = False
        
        # Tenta inicializar o Redis
        try:
            upstash_url = os.getenv('UPSTASH_REDIS_URL')
            upstash_token = os.getenv('UPSTASH_REDIS_TOKEN')
            
            if upstash_url and upstash_token:
                from upstash_redis import Redis
                self._redis = Redis(url=upstash_url, token=upstash_token)
                self._enabled = True
                print("[Upstash] ✅ Conectado ao Redis")
            else:
                print("[Upstash] ⚠️ UPSTASH_REDIS_URL ou UPSTASH_REDIS_TOKEN não configurado")
        except ImportError:
            print("[Upstash] ⚠️ Pacote upstash-redis não instalado")
        except Exception as e:
            print(f"[Upstash] ⚠️ Erro ao conectar: {e}")
        
        self._initialized = True
    
    @property
    def enabled(self) -> bool:
        """Verifica se o Redis está habilitado."""
        return self._enabled
    
    @property
    def redis(self):
        """Retorna a instância do Redis."""
        return self._redis
    
    # ── Helpers de cache ──────────────────────────────────────────────
    
    async def cache_get(self, key: str) -> Optional[dict]:
        """Retorna um valor do cache."""
        if not self._enabled or not self._redis:
            return None

        try:
            import asyncio
            value = await asyncio.to_thread(self._redis.get, key)
            if value:
                return json.loads(value)
        except Exception as e:
            print(f"[Upstash] Erro ao obter cache: {e}")

        return None
    
    async def cache_set(self, key: str, value: dict, ttl: int = 3600) -> bool:
        """
        Salva um valor no cache.
        ttl: tempo de vida em segundos (padrão: 1 hora)
        """
        if not self._enabled or not self._redis:
            return False

        try:
            import asyncio
            await asyncio.to_thread(self._redis.set, key, json.dumps(value), ex=ttl)
            return True
        except Exception as e:
            print(f"[Upstash] Erro ao salvar cache: {e}")
            return False
    
    async def cache_delete(self, key: str) -> bool:
        """Remove um valor do cache."""
        if not self._enabled or not self._redis:
            return False

        try:
            import asyncio
            await asyncio.to_thread(self._redis.delete, key)
            return True
        except Exception as e:
            print(f"[Upstash] Erro ao deletar cache: {e}")
            return False
    
    # ── Rate Limiting ─────────────────────────────────────────────────
    
    async def rate_limit_check(
        self,
        key: str,
        max_requests: int = 10,
        window_seconds: int = 60
    ) -> dict:
        """
        Verifica se uma requisição está dentro do limite.
        Retorna: {allowed: bool, remaining: int, reset_at: int}
        """
        if not self._enabled or not self._redis:
            # Se não há Redis, permite a requisição
            return {'allowed': True, 'remaining': -1, 'reset_at': 0}

        import asyncio

        try:
            current = await asyncio.to_thread(self._redis.get, key)
            current_count = int(current) if current else 0

            if current_count >= max_requests:
                # Verifica quando o contador expira
                ttl = await asyncio.to_thread(self._redis.ttl, key)
                return {
                    'allowed': False,
                    'remaining': 0,
                    'reset_at': ttl if ttl > 0 else window_seconds,
                }

            # Incrementa o contador e define expiração (comandos individuais para evitar erro de pipeline)
            await asyncio.to_thread(self._redis.incr, key)
            await asyncio.to_thread(self._redis.expire, key, window_seconds)

            return {
                'allowed': True,
                'remaining': max_requests - current_count - 1,
                'reset_at': window_seconds,
            }
        except Exception as e:
            print(f"[Upstash] Erro no rate limit: {e}")
            # Desabilita Redis para próximas chamadas
            self._enabled = False
            # Em caso de erro, permite a requisição
            return {'allowed': True, 'remaining': -1, 'reset_at': 0}
    
    # ── Cache de sessão de usuário ────────────────────────────────────
    
    def user_cache_key(self, username: str, prefix: str = 'user') -> str:
        """Gera uma chave de cache para o usuário."""
        return f"{prefix}:{username}"
    
    def rate_limit_key(self, identifier: str, action: str) -> str:
        """Gera uma chave de rate limit."""
        return f"ratelimit:{action}:{identifier}"


# Singleton
upstash_service = UpstashService()


async def invalidate_user_cache(username: str):
    """Invalida todo o cache de um usuário de uma vez."""
    keys = [
        f"profile:{username}",
        f"xp:{username}",
        f"streak:{username}",
        f"vocabulary:{username}",
        f"trophies:{username}",
        f"trophies_all:{username}",
        f"modules:list:{username}",
        f"report:weekly:{username}",
        f"report:monthly:{username}",
        f"study_time:{username}",
    ]
    for key in keys:
        await cache_delete(key)


# ── Funções de conveniência ──────────────────────────────────────────────

async def cache_get(key: str) -> Optional[dict]:
    """Retorna um valor do cache."""
    return await upstash_service.cache_get(key)


async def cache_set(key: str, value: dict, ttl: int = 3600) -> bool:
    """Salva um valor no cache."""
    return await upstash_service.cache_set(key, value, ttl)


async def cache_delete(key: str) -> bool:
    """Remove um valor do cache."""
    return await upstash_service.cache_delete(key)


async def rate_limit_check(
    key: str,
    max_requests: int = 10,
    window_seconds: int = 60
) -> dict:
    """Verifica se uma requisição está dentro do limite."""
    return await upstash_service.rate_limit_check(key, max_requests, window_seconds)
