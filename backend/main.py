from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

from app.shared.middleware.prompt_validation import PromptValidationMiddleware
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Se configurado como proxy reverso leve (para economizar memória na Railway)
if os.getenv("RUN_AS_PROXY") == "true":
    import httpx
    from fastapi import FastAPI, Request, Response

    logging.basicConfig(level=logging.INFO)
    app = FastAPI(title="Railway Webhook Proxy")
    TARGET_HOST = os.getenv("PROXY_TARGET_HOST")
    if not TARGET_HOST:
        raise ValueError("PROXY_TARGET_HOST environment variable is not set!")
    # Limpa possíveis prefixos e barras finais inseridos por engano
    TARGET_HOST = TARGET_HOST.replace("https://", "").replace("http://", "").strip("/")

    @app.api_route(
        "/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    )
    async def proxy_request(path: str, request: Request):
        url = f"https://{TARGET_HOST}/{path}"
        headers = dict(request.headers)
        headers["host"] = TARGET_HOST
        headers.pop("content-length", None)

        body = await request.body()
        params = dict(request.query_params)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body,
                    params=params,
                    timeout=120.0,
                )

            resp_headers = {k.lower(): v for k, v in response.headers.items()}
            # Remove compression and length headers because httpx has decoded the body
            resp_headers.pop("content-encoding", None)
            resp_headers.pop("content-length", None)
            resp_headers.pop("transfer-encoding", None)
            resp_headers.pop("connection", None)
            resp_headers.pop("keep-alive", None)

            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=resp_headers,
            )
        except Exception as e:
            logging.error(f"Proxy error: {e}")
            return Response(
                content=f'{{"error": "{e!s}"}}',
                status_code=500,
                media_type="application/json",
            )

else:
    from app.core.config import settings
    from app.core.utils.rate_limiter import setup_rate_limiting
    from app.core.utils.sentry_config import init_sentry
    from app.routers_init import register_all_routers
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.gzip import GZipMiddleware
    from fastapi.responses import JSONResponse
    from starlette.middleware.base import BaseHTTPMiddleware

    try:
        init_sentry()
    except Exception as e:
        logging.info(f"[Startup] Erro ao iniciar Sentry: {e}")

    is_local = os.getenv("VERCEL") is None
    _docs_url = "/docs" if (settings.debug or is_local) else None
    _redoc_url = "/redoc" if (settings.debug or is_local) else None

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    class TokenMaskFilter(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:
            import re

            if record.args:
                args = list(record.args)
                for i, arg in enumerate(args):
                    if isinstance(arg, str) and "token=" in arg:
                        args[i] = re.sub(r'token=[^&\s"]+', "token=***", arg)
                record.args = tuple(args)
            if isinstance(record.msg, str) and "token=" in record.msg:
                record.msg = re.sub(r'token=[^&\s"]+', "token=***", record.msg)
            return True

    # Adiciona o filtro nos loggers principais e root para evitar vazamento de JWT
    logging.getLogger().addFilter(TokenMaskFilter())
    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logging.getLogger(logger_name).addFilter(TokenMaskFilter())

    # Silenciar logs detalhados de requisições HTTP do httpx e httpcore (evita vazar URLs do Supabase, etc.)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    app = FastAPI(
        title="Teacher Tati AI",
        description="API para o aplicativo de ensino de inglês Teacher Tati",
        version="2.1.1",
        docs_url=_docs_url,
        redoc_url=_redoc_url,
    )
    # Register Prompt Validation Middleware
    app.add_middleware(PromptValidationMiddleware)

    class ForceHTTPSMiddleware(BaseHTTPMiddleware):
        """Força scheme HTTPS e injeta cabeçalhos de segurança limpos."""

        async def dispatch(self, request: Request, call_next):
            if request.scope.get("type") == "websocket":
                return await call_next(request)

            if request.headers.get("x-forwarded-proto") == "https":
                request.scope["scheme"] = "https"

            response = await call_next(request)
            # Limpeza do Permissions-Policy para evitar warnings de features obsoletas (ex: browsing-topics, run-ad-auction)
            response.headers["Permissions-Policy"] = (
                "camera=(self), microphone=(self), geolocation=()"
            )
            return response

    app.add_middleware(ForceHTTPSMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=500)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:8080",
            "http://localhost:8080",
            "http://127.0.0.1:8000",
            "http://localhost:8000",
            "http://127.0.0.1:3000",
            "http://localhost:3000",
            "http://192.168.1.3:3000",
            "capacitor://localhost",
            "http://localhost",
            "https://tati-ai.vercel.app",
            "https://tati-ai.vercel.app/",
            "https://tati-ai-git-main-caio-andrades-projects.vercel.app",
            "https://tati-hub.vercel.app/",
            "https://tati-hub.vercel.app",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.1\.3):[0-9]+",
    )

    setup_rate_limiting(app)
    register_all_routers(app)

    # Instrumentação do Prometheus com autenticação Bearer Token para segurança
    try:
        from fastapi import Depends, HTTPException, status
        from fastapi.responses import Response
        from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
        from prometheus_fastapi_instrumentator import Instrumentator

        security = HTTPBearer(auto_error=False)
        Instrumentator().instrument(app)

        @app.get("/metrics")
        async def metrics(
            credentials: HTTPAuthorizationCredentials = Depends(security),
        ):
            token = os.getenv("METRICS_TOKEN", "tati-ai-metrics-token-secure-2026")
            if not credentials or credentials.credentials != token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized metrics access",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    except Exception as e:
        logging.info(f"[Startup] Erro ao iniciar Instrumentator do Prometheus: {e}")

    @app.on_event("startup")
    async def startup_event() -> None:
        # Inicia o Celery Worker de forma programática se USE_CELERY for true
        if os.getenv("USE_CELERY", "false").lower() == "true":
            try:
                import subprocess
                import sys

                # Inicia celery em subprocesso sem bloquear o loop de eventos
                subprocess.Popen(
                    [
                        sys.executable,
                        "-m",
                        "celery",
                        "-A",
                        "app.core.celery_app",
                        "worker",
                        "--beat",
                        "--loglevel=info",
                        "--concurrency=2",
                    ],
                    stdout=None,
                    stderr=None,
                )
                logging.info(
                    "[Startup] Celery Worker + Beat inicializados com sucesso via subprocesso!"
                )
            except Exception as exc:
                logging.info(
                    f"[Startup] Falha ao inicializar Celery Worker programaticamente: {exc}"
                )

        async def _warmup():
            import asyncio

            try:
                from app.core.database import get_client

                get_client().table("users").select("username").limit(1).execute()
                logging.info("[Startup] Conexão com Supabase aquecida.")
            except Exception as exc:
                logging.info(f"[Startup] Warmup do banco falhou: {exc}")

            try:
                from app.modules.chat.services.rag_search import _get_vectorstore

                await asyncio.to_thread(_get_vectorstore)
                logging.info("[Startup] Vectorstore pré-carregado (Hugging Face).")
            except Exception as exc:
                logging.info(f"[Startup] Falha ao pré-carregar Vectorstore: {exc}")

            # Auto-start WAHA sessions configured in settings
            try:
                from app.modules.notifications.services.waha_service import WahaService

                sessions = [
                    s.strip()
                    for s in settings.waha_auto_start_sessions.split(",")
                    if s.strip()
                ]
                logging.info(f"[Startup] Auto-starting WAHA sessions: {sessions}")
                for session in sessions:
                    asyncio.create_task(WahaService.start_session(session))
            except Exception as exc:
                logging.info(f"[Startup] Failed to auto-start WAHA sessions: {exc}")

        await _warmup()

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Captura qualquer erro não tratado e loga o traceback completo."""
        logging.info(f"❌ [ERROR] {
                request.method} {
                request.url.path} -> {
                    type(exc).__name__}: {
                        exc!s}")

        error_detail = (
            str(exc)
            if settings.debug
            else "Ocorreu um erro interno. Por favor, tente novamente mais tarde."
        )

        response = JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "error": error_detail,
                "path": request.url.path,
            },
        )

        origin = request.headers.get("Origin") or request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

    @app.get("/health")
    async def health():
        db_status = "ok"
        try:
            from app.core.database import get_client

            # Apenas verifica conectividade fazendo um read leve e rápido
            get_client().table("users").select("username").limit(1).execute()
            res_msg = "Database connection verified successfully"
        except Exception as e:
            res_msg = f"TEST_FAILED: {e}"
            db_status = "error"

        return {
            "status": "ok",
            "database": db_status,
            "service": "Teacher Tati API",
            "version": "2.1.6",
            "db_check": res_msg,
        }

    @app.get("/app/version")
    async def app_version():
        download_url = os.getenv("APP_DOWNLOAD_URL", "")
        if not download_url:
            download_url = "https://tati-ai.vercel.app/downloads/tati-ai.apk"
        return {
            "android": os.getenv("APP_VERSION_ANDROID", "1.0.0"),
            "download_url": download_url,
        }


if __name__ == "__main__":
    import uvicorn

    if os.getenv("RUN_AS_PROXY") == "true":
        port = int(os.getenv("PORT", "8080"))
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            reload=False,
        )
    else:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=settings.port,
            reload=settings.debug,
        )
