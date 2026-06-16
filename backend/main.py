from __future__ import annotations
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

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

import os


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



class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    """Força scheme HTTPS quando X-Forwarded-Proto indica proxy SSL."""

    async def dispatch(self, request: Request, call_next):
        if request.scope.get('type') == 'websocket':
            return await call_next(request)

        if request.headers.get('x-forwarded-proto') == 'https':
            request.scope['scheme'] = 'https'
        return await call_next(request)


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
        'http://192.168.1.3:3000',  # Local IP for mobile device access
        'capacitor://localhost',      # Capacitor iOS origin
        'http://localhost',           # Capacitor Android origin
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

#  Startup Events
@app.on_event('startup')
async def startup_event() -> None:
    async def _warmup():
        try:
            from app.core.database import get_client
            get_client().table('users').select('username').limit(1).execute()
            logging.info('[Startup] Conexão com Supabase aquecida.')
        except Exception as exc:
            logging.info(f'[Startup] Warmup do banco falhou: {exc}')

    await _warmup() 


#  Entrypoint

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
    return {
        'status': 'ok',
        "service": "Teacher Tati API",
        "version": "2.1.1"
    }

if __name__ == '__main__':
    import uvicorn

    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=settings.port,
        reload=settings.debug,
    )
