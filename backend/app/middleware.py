import asyncio
import logging
import os
import time

from asgiref.sync import iscoroutinefunction, markcoroutinefunction
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger("performance")


class NormalizePathMiddleware:
    """
    Normaliza caminhos com múltiplas barras (ex: //users/... -> /users/...)
    evitando erros 404 em clientes e proxies reversos.
    """
    sync_capable = True
    async_capable = True

    def __init__(self, get_response):
        self.get_response = get_response
        self.async_mode = iscoroutinefunction(self.get_response)
        if self.async_mode:
            markcoroutinefunction(self)

    def _normalize_request_path(self, request):
        if getattr(request, "path_info", "").startswith("//"):
            request.path_info = "/" + request.path_info.lstrip("/")
        if getattr(request, "path", "").startswith("//"):
            request.path = "/" + request.path.lstrip("/")

    def __call__(self, request):
        if self.async_mode:
            return self.__acall__(request)
        self._normalize_request_path(request)
        return self.get_response(request)

    async def __acall__(self, request):
        self._normalize_request_path(request)
        return await self.get_response(request)


class PerformanceMiddleware:
    sync_capable = True
    async_capable = True

    def __init__(self, get_response):
        self.get_response = get_response
        self.async_mode = iscoroutinefunction(self.get_response)
        if self.async_mode:
            markcoroutinefunction(self)

    def _log_perf(self, request, response, duration_ms):
        path = getattr(request, "path", "")
        if not path.startswith(("/static", "/media")):
            status = getattr(response, "status_code", "unknown")
            method = getattr(request, "method", "UNKNOWN")
            print(f"[PERF] {method} {path} -> {status} ({duration_ms:.1f}ms)")

    def __call__(self, request):
        if self.async_mode:
            return self.__acall__(request)

        start_time = time.perf_counter()
        response = self.get_response(request)

        if asyncio.iscoroutine(response):
            async def _perf_wrap(coro):
                res = await coro
                self._log_perf(request, res, (time.perf_counter() - start_time) * 1000)
                return res
            return _perf_wrap(response)

        duration_ms = (time.perf_counter() - start_time) * 1000
        self._log_perf(request, response, duration_ms)
        return response

    async def __acall__(self, request):
        start_time = time.perf_counter()
        try:
            response = await self.get_response(request)
        except asyncio.CancelledError:
            raise

        duration_ms = (time.perf_counter() - start_time) * 1000
        self._log_perf(request, response, duration_ms)
        return response


class RateLimitMiddleware:
    """
    Middleware de Rate Limiting baseado em cache (Redis ou LocMemCache).
    Protege endpoints críticos contra brute-force, abusos e requisições excessivas.
    Suporta execução nativa síncrona (WSGI) e assíncrona (ASGI/Uvicorn).
    """

    sync_capable = True
    async_capable = True

    def __init__(self, get_response):
        self.get_response = get_response
        self.enabled = os.getenv("ENABLE_RATE_LIMIT", "true").lower() in ("true", "1")
        self.async_mode = iscoroutinefunction(self.get_response)
        if self.async_mode:
            markcoroutinefunction(self)

    def _check_rate_limit(self, request):
        if not self.enabled:
            return None

        path = getattr(request, "path", "").rstrip("/")

        headers = getattr(request, "headers", {})
        meta = getattr(request, "META", {})

        # Bypass para testes de carga autorizados apenas se chave configurada no ambiente
        bypass_secret = (os.getenv("LOAD_TEST_BYPASS_SECRET") or "").strip()
        if bypass_secret and len(bypass_secret) >= 16:
            req_bypass = (
                headers.get("X-Load-Test-Secret")
                or headers.get("x-load-test-secret")
                or meta.get("HTTP_X_LOAD_TEST_SECRET")
            )
            if req_bypass and req_bypass.strip() == bypass_secret:
                return None

        # Ignora arquivos estáticos, media, websocket e healthchecks
        if (
            path.startswith(("/static", "/media", "/favicon.ico"))
            or path in ("", "/health", "/healthz", "/ping")
            or "/ws/" in path
            or headers.get("Upgrade") == "websocket"
        ):
            return None

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

        return None

    def __call__(self, request):
        if self.async_mode:
            return self.__acall__(request)

        blocked = self._check_rate_limit(request)
        if blocked is not None:
            return blocked
        return self.get_response(request)

    async def __acall__(self, request):
        blocked = self._check_rate_limit(request)
        if blocked is not None:
            return blocked
        try:
            return await self.get_response(request)
        except asyncio.CancelledError:
            raise

    def _get_client_ip(self, request):
        meta = getattr(request, "META", {})
        x_forwarded = meta.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return meta.get("REMOTE_ADDR", "127.0.0.1")


class StructuredLoggingMiddleware:
    """
    Middleware de Observabilidade e Auditoria Estruturada (JSON Logs).
    - Injeta request_id único para rastreabilidade de ponta a ponta (frontend -> backend).
    - Captura user_id, latência, endpoint, status_code e IP em formato JSON estruturado.
    - Registra logs de auditoria para operações destrutivas ou de escrita sensíveis (DELETE, etc).
    """

    sync_capable = True
    async_capable = True

    def __init__(self, get_response):
        self.get_response = get_response
        self.async_mode = iscoroutinefunction(self.get_response)
        if self.async_mode:
            markcoroutinefunction(self)
        self.json_logger = logging.getLogger("structured_json")
        self.audit_logger = logging.getLogger("audit")

    def _extract_user_info(self, request):
        user = getattr(request, "user", None)
        if user and getattr(user, "is_authenticated", False):
            return str(getattr(user, "id", "")), getattr(user, "username", "authenticated")
        return "anonymous", "anonymous"

    def _get_client_ip(self, request):
        meta = getattr(request, "META", {})
        x_forwarded = meta.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return meta.get("REMOTE_ADDR", "127.0.0.1")

    def _log_request(self, request, response, duration_ms, request_id):
        path = getattr(request, "path", "")
        if path.startswith(("/static", "/media", "/favicon.ico")) or path in ("/health", "/ping"):
            return

        import json
        from datetime import datetime, timezone

        user_id, username = self._extract_user_info(request)
        status_code = getattr(response, "status_code", 500)

        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
            "user_id": user_id,
            "username": username,
            "method": getattr(request, "method", "GET"),
            "path": path,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "ip": self._get_client_ip(request),
        }

        # Emite log JSON estruturado
        self.json_logger.info(json.dumps(log_data))

        # Auditoria de operações destrutivas ou administrativas
        method = getattr(request, "method", "GET")
        is_destructive = method in ("DELETE", "PATCH") or (
            method == "POST" and any(k in path for k in ("/delete", "/reset", "/wipe", "/cancel", "/destroy", "/role", "/ban"))
        )
        if is_destructive:
            audit_data = {
                "audit_event": "DESTRUCTIVE_OPERATION",
                **log_data,
            }
            self.audit_logger.warning(json.dumps(audit_data))

    def _get_or_create_request_id(self, request):
        import uuid
        headers = getattr(request, "headers", {})
        request_id = (
            headers.get("X-Request-ID")
            or headers.get("x-request-id")
            or getattr(request, "request_id", None)
            or str(uuid.uuid4())
        )
        request.request_id = request_id
        return request_id

    def _attach_request_id(self, response, request_id):
        if response is not None and hasattr(response, "__setitem__"):
            try:
                response["X-Request-ID"] = request_id
            except (TypeError, ValueError):
                pass

    def __call__(self, request):
        if self.async_mode:
            return self.__acall__(request)

        request_id = self._get_or_create_request_id(request)

        start_time = time.perf_counter()
        response = self.get_response(request)

        if asyncio.iscoroutine(response):
            async def _logging_wrap(coro):
                res = await coro
                duration_ms = (time.perf_counter() - start_time) * 1000
                self._log_request(request, res, duration_ms, request_id)
                self._attach_request_id(res, request_id)
                return res
            return _logging_wrap(response)

        duration_ms = (time.perf_counter() - start_time) * 1000
        self._log_request(request, response, duration_ms, request_id)
        self._attach_request_id(response, request_id)
        return response

    async def __acall__(self, request):
        request_id = self._get_or_create_request_id(request)

        start_time = time.perf_counter()
        try:
            response = await self.get_response(request)
        except asyncio.CancelledError:
            raise
        duration_ms = (time.perf_counter() - start_time) * 1000

        self._log_request(request, response, duration_ms, request_id)
        self._attach_request_id(response, request_id)
        return response


