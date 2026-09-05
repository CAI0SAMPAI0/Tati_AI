import os
import time
import logging
from django.db import connection
from django.core.cache import cache
from django.http import JsonResponse

logger = logging.getLogger("performance")


class PerformanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.perf_counter()
        initial_queries = len(connection.queries)

        response = self.get_response(request)

        duration_ms = (time.perf_counter() - start_time) * 1000
        num_queries = len(connection.queries) - initial_queries

        # Loga desempenho das requisições de API no terminal
        if not request.path.startswith("/static") and not request.path.startswith(
            "/media"
        ):
            print(
                f"[PERF] {request.method} {request.path} -> {response.status_code} ({duration_ms:.1f}ms)"
            )

        return response


class RateLimitMiddleware:
    """
    Middleware de Rate Limiting baseado em cache (Redis ou LocMemCache).
    Protege endpoints críticos contra brute-force, abusos e requisições excessivas.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.getenv("ENABLE_RATE_LIMIT", "true").lower() in ("true", "1")

    def __call__(self, request):
        if not self.enabled:
            return self.get_response(request)

        path = request.path.rstrip("/")

        # Ignora arquivos estáticos, media, websocket e healthchecks
        if (
            path.startswith(("/static", "/media", "/favicon.ico"))
            or path in ("", "/health", "/healthz", "/ping")
            or "/ws/" in path
            or request.headers.get("Upgrade") == "websocket"
        ):
            return self.get_response(request)

        ip = self._get_client_ip(request)

        # Regras de limite por categoria de endpoint:
        # Auth (login/register/forgot): 25 req/min
        # AI (chat/voice/document): 60 req/min
        # Geral: 240 req/min
        if any(
            auth_p in path
            for auth_p in ("/auth/login", "/auth/register", "/auth/forgot-password", "/auth/token")
        ):
            limit = int(os.getenv("RATE_LIMIT_AUTH_PER_MIN", "25"))
            bucket = "auth"
        elif any(
            ai_p in path
            for ai_p in ("/chat", "/voice", "/activities/generate", "/translate", "/word-info")
        ):
            limit = int(os.getenv("RATE_LIMIT_AI_PER_MIN", "60"))
            bucket = "ai"
        else:
            limit = int(os.getenv("RATE_LIMIT_DEFAULT_PER_MIN", "240"))
            bucket = "gen"

        now_min = int(time.time() // 60)
        cache_key = f"ratelimit:{bucket}:{ip}:{now_min}"

        try:
            current_count = cache.get(cache_key, 0)
            if current_count >= limit:
                return JsonResponse(
                    {
                        "detail": "Muitas requisições. Por favor, aguarde um momento antes de tentar novamente.",
                        "error": "rate_limit_exceeded",
                    },
                    status=429,
                    headers={"Retry-After": "60"},
                )

            if current_count == 0:
                cache.set(cache_key, 1, timeout=65)
            else:
                try:
                    cache.incr(cache_key)
                except Exception:
                    cache.set(cache_key, current_count + 1, timeout=65)
        except Exception as e:
            logger.debug(f"[RateLimit] Erro no cache: {e}")

        return self.get_response(request)

    def _get_client_ip(self, request):
        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "127.0.0.1")

