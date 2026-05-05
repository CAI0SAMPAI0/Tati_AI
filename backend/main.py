"""
Teacher Tati API — Entry Point

Inicializa a aplicação FastAPI, configura middlewares (CORS, GZip,
Rate Limiting, HTTPS), integra o Sentry para monitoramento e
centraliza o roteamento via ``register_all_routers``.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Força o carregamento do .env da raiz do projeto
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Sentry — Inicialização crítica para captura de exceções
from core.sentry_config import init_sentry

try:
    init_sentry()
except Exception as e:
    print(f'[Startup] Erro ao iniciar Sentry: {e}')


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title='Teacher Tati AI',
    description='API para o aplicativo de ensino de inglês Teacher Tati',
    version='2.0.0',
)


# ── Middlewares ───────────────────────────────────────────────────────────────


class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    """Força scheme HTTPS quando X-Forwarded-Proto indica proxy SSL."""

    async def dispatch(self, request: Request, call_next):
        if request.scope.get('type') == 'websocket':
            return await call_next(request)
            
        if request.headers.get('x-forwarded-proto') == 'https':
            request.scope['scheme'] = 'https'
        return await call_next(request)


app.add_middleware(ForceHTTPSMiddleware)

# GZip — comprime respostas > 500 bytes (melhora ~60% em payloads JSON)
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
        'https://tati-ai.vercel.app',
        'https://tati-ai.vercel.app/',
        'https://tati-ai-git-main-caio-andrades-projects.vercel.app',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
    allow_origin_regex='http://(localhost|127\.0\.0\.1):[0-9]+',
)

# Rate Limiting (Upstash Redis)
from core.rate_limiter import setup_rate_limiting

setup_rate_limiting(app)


# ── Routers (registro centralizado) ──────────────────────────────────────────

from routers import register_all_routers

register_all_routers(app)


# ── Health ────────────────────────────────────────────────────────────────────


@app.get('/cors-test')
async def cors_test() -> dict:
    """Endpoint leve para verificar CORS e keep-alive."""
    return {'origins': ['https://tati-ai.vercel.app']}


# ── Startup Events ───────────────────────────────────────────────────────────


@app.on_event('startup')
async def startup_notifications() -> None:
    """Inicia o scheduler de notificações e lembretes."""
    from services.notification_scheduler import notification_scheduler

    notification_scheduler.start()


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import uvicorn

    from core.config import settings

    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=settings.port,
        reload=settings.debug,
    )
