from __future__ import annotations
import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv
from app.shared.middleware.prompt_validation import PromptValidationMiddleware

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Se configurado como proxy reverso leve (para economizar memória na Railway)
if os.getenv("RUN_AS_PROXY") == "true":
    from fastapi import FastAPI, Request, Response
    import httpx
    
    logging.basicConfig(level=logging.INFO)
    app = FastAPI(title="Railway Webhook Proxy")
    TARGET_HOST = os.getenv("PROXY_TARGET_HOST")
    if not TARGET_HOST:
        raise ValueError("PROXY_TARGET_HOST environment variable is not set!")
    # Limpa possíveis prefixos e barras finais inseridos por engano
    TARGET_HOST = TARGET_HOST.replace("https://", "").replace("http://", "").strip("/")
    
    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
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
                    timeout=120.0
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
                headers=resp_headers
            )
        except Exception as e:
            logging.error(f"Proxy error: {e}")
            return Response(content=f"{{\"error\": \"{str(e)}\"}}", status_code=500, media_type="application/json")

else:
    from app.routers_init import register_all_routers
    from app.core.utils.rate_limiter import setup_rate_limiting
    from app.core.utils.sentry_config import init_sentry
    from app.core.config import settings

    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.gzip import GZipMiddleware
    from starlette.middleware.base import BaseHTTPMiddleware
    from fastapi.responses import JSONResponse

    try:
        init_sentry()
    except Exception as e:
        logging.info(f'[Startup] Erro ao iniciar Sentry: {e}')

    is_local = os.getenv('VERCEL') is None
    _docs_url = '/docs' if (settings.debug or is_local) else None
    _redoc_url = '/redoc' if (settings.debug or is_local) else None

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    print = logging.info

    app = FastAPI(
        title='Teacher Tati AI',
        description='API para o aplicativo de ensino de inglês Teacher Tati',
        version='2.1.1',
        docs_url=_docs_url,
        redoc_url=_redoc_url)
    # Register Prompt Validation Middleware
    app.add_middleware(PromptValidationMiddleware)

    class ForceHTTPSMiddleware(BaseHTTPMiddleware):
        """Força scheme HTTPS e injeta cabeçalhos de segurança limpos."""

        async def dispatch(self, request: Request, call_next):
            if request.scope.get('type') == 'websocket':
                return await call_next(request)

            if request.headers.get('x-forwarded-proto') == 'https':
                request.scope['scheme'] = 'https'

            response = await call_next(request)
            # Limpeza do Permissions-Policy para evitar warnings de features obsoletas (ex: browsing-topics, run-ad-auction)
            response.headers["Permissions-Policy"] = "camera=(self), microphone=(self), geolocation=()"
            return response

    app.add_middleware(ForceHTTPSMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=500)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            'http://127.0.0.1:8080',
            'http://localhost:8080',
            'http://127.0.0.1:8000',
            'http://localhost:8000',
            'http://127.0.0.1:3000',
            'http://localhost:3000',
            'http://192.168.1.3:3000',
            'capacitor://localhost',
            'http://localhost',
            'https://tati-ai.vercel.app',
            'https://tati-ai.vercel.app/',
            'https://tati-ai-git-main-caio-andrades-projects.vercel.app',
            'https://tati-hub.vercel.app/',
            'https://tati-hub.vercel.app'
        ],
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
        allow_origin_regex=r'http://(localhost|127\.0\.0\.1|192\.168\.1\.3):[0-9]+',
    )

    setup_rate_limiting(app)
    register_all_routers(app)

    @app.on_event('startup')
    async def startup_event() -> None:
        # Inicia o Celery Worker de forma programática se USE_CELERY for true
        if os.getenv("USE_CELERY", "false").lower() == "true":
            try:
                import subprocess
                import sys
                # Inicia celery em subprocesso sem bloquear o loop de eventos
                subprocess.Popen(
                    [sys.executable, "-m", "celery", "-A", "app.core.celery_app", "worker", "--beat", "--loglevel=info", "--concurrency=2"],
                    stdout=None,
                    stderr=None
                )
                logging.info('[Startup] Celery Worker + Beat inicializados com sucesso via subprocesso!')
            except Exception as exc:
                logging.info(f'[Startup] Falha ao inicializar Celery Worker programaticamente: {exc}')

        async def _warmup():
            import asyncio
            try:
                from app.core.database import get_client
                get_client().table('users').select('username').limit(1).execute()
                logging.info('[Startup] Conexão com Supabase aquecida.')
            except Exception as exc:
                logging.info(f'[Startup] Warmup do banco falhou: {exc}')
                
            try:
                from app.modules.chat.services.rag_search import _get_vectorstore
                await asyncio.to_thread(_get_vectorstore)
                logging.info('[Startup] Vectorstore pré-carregado (Hugging Face).')
            except Exception as exc:
                logging.info(f'[Startup] Falha ao pré-carregar Vectorstore: {exc}')

            # Auto-start WAHA sessions configured in settings
            try:
                from app.modules.notifications.services.waha_service import WahaService
                sessions = [s.strip() for s in settings.waha_auto_start_sessions.split(',') if s.strip()]
                logging.info(f'[Startup] Auto-starting WAHA sessions: {sessions}')
                for session in sessions:
                    asyncio.create_task(WahaService.start_session(session))
            except Exception as exc:
                logging.info(f'[Startup] Failed to auto-start WAHA sessions: {exc}')

        await _warmup()

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Captura qualquer erro não tratado e loga o traceback completo."""
        logging.info(
            f"❌ [ERROR] {
                request.method} {
                request.url.path} -> {
                    type(exc).__name__}: {
                        str(exc)}")

        error_detail = str(
            exc) if settings.debug else "Ocorreu um erro interno. Por favor, tente novamente mais tarde."

        response = JSONResponse(
            status_code=500,
            content={
                "detail": "Internal Server Error",
                "error": error_detail,
                "path": request.url.path
            }
        )

        origin = request.headers.get(
            "Origin") or request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        else:
            response.headers["Access-Control-Allow-Origin"] = "*"

        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

    @app.get('/health')
    async def health():
        from app.shared.services.history import update_message
        msg_id = 'c5c0b412-6314-418d-9416-b8a7292d5cb4'
        username = 'programador'
        conversation_id = '20260616_114636_progra'
        content = "Create a pdf for me with 10 exercises about the Present Perfect, 10 exercises about Verb to be and Must be [EDITED]"
        
        db_status = "ok"
        try:
            res_msg = await update_message(msg_id, username, content, conversation_id=conversation_id)
        except Exception as e:
            res_msg = f"TEST_FAILED: {e}"
            db_status = "error"
            
        return {
            'status': 'ok',
            'database': db_status,
            "service": "Teacher Tati API",
            "version": "2.1.6",
            "db_update_check": res_msg
        }

if __name__ == '__main__':
    import uvicorn
    if os.getenv("RUN_AS_PROXY") == "true":
        port = int(os.getenv("PORT", "8080"))
        uvicorn.run(
            'main:app',
            host='0.0.0.0',
            port=port,
            reload=False,
        )
    else:
        uvicorn.run(
            'main:app',
            host='0.0.0.0',
            port=settings.port,
            reload=settings.debug,
        )
