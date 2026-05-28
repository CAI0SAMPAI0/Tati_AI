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
from fastapi.responses import JSONResponse


# Força o carregamento do .env da raiz do projeto
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Sentry — Inicialização crítica para captura de exceções
from app.core.config import settings
from app.core.utils.sentry_config import init_sentry

try:
    init_sentry()
except Exception as e:
    print(f'[Startup] Erro ao iniciar Sentry: {e}')

# Desativa docs em produção — gerar o schema OpenAPI de 100+ rotas
# adiciona ~2s desnecessários em cada cold start
_docs_url = '/docs' if settings.debug else None
_redoc_url = '/redoc' if settings.debug else None

#  App 

app = FastAPI(
    title='Teacher Tati AI',
    description='API para o aplicativo de ensino de inglês Teacher Tati',
    version='2.1.0',
    docs_url=_docs_url,
    redoc_url=_redoc_url
)


#  Middlewares 


class ForceHTTPSMiddleware(BaseHTTPMiddleware):
    """Força scheme HTTPS quando X-Forwarded-Proto indica proxy SSL."""

    async def dispatch(self, request: Request, call_next):
        if request.scope.get('type') == 'websocket':
            return await call_next(request)
            
        if request.headers.get('x-forwarded-proto') == 'https':
            request.scope['scheme'] = 'https'
        return await call_next(request)


app.add_middleware(ForceHTTPSMiddleware)

# GZip — comprimindo respostas > 500 bytes (melhora ~60% em payloads JSON)
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


# Rate Limiting (Upstash Redis)
from app.core.utils.rate_limiter import setup_rate_limiting

setup_rate_limiting(app)


#  Routers (registro centralizado) 

from app.routers_init import register_all_routers

register_all_routers(app)



#  Startup Events 
@app.on_event('startup')
async def startup_event() -> None:
    import asyncio
 
    # 1. Aquece a conexão com o banco imediatamente — resolve o cold start
    #    da primeira tela aberta após o deploy
    async def _warmup():
        try:
            from app.core.database import get_client
            get_client().table('users').select('username').limit(1).execute()
            print('[Startup] Conexão com Supabase aquecida.')
        except Exception as exc:
            print(f'[Startup] Warmup do banco falhou: {exc}')
 
    await _warmup()
 
    # 2. Inicia schedulers em background (não bloqueia a API)
    async def _start_schedulers():
        await asyncio.sleep(3)
        try:
            from app.modules.notifications.services.notification_scheduler import (
                notification_scheduler,
            )
            from app.modules.cefr.services.cefr_scheduler import CEFRScheduler
 
            cefr_scheduler = CEFRScheduler(notification_scheduler.scheduler)
            cefr_scheduler.start()
 
            # 3. Registra o keepalive periódico no mesmo scheduler
            #    Roda a cada 4 minutos para manter a conexão TCP viva
            from app.core.database import keep_alive_ping
 
            notification_scheduler.scheduler.add_job(
                keep_alive_ping,
                'interval',
                minutes=4,
                id='db_keepalive',
                replace_existing=True,
            )
 
            notification_scheduler.start()
            print('[Startup] Schedulers e keepalive iniciados.')
        except Exception as exc:
            print(f'[Startup] Erro ao iniciar schedulers: {exc}')
 
    asyncio.create_task(_start_schedulers())



#  Entrypoint 

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Captura qualquer erro não tratado e loga o traceback completo."""
    # Sempre logamos no console/servidor
    print(f"❌ [ERROR] {request.method} {request.url.path} -> {type(exc).__name__}: {str(exc)}")
    
    # Em produção, escondemos o erro detalhado do usuário para evitar vazamento de dados
    error_detail = str(exc) if settings.debug else "Ocorreu um erro interno. Por favor, tente novamente mais tarde."

    response = JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error": error_detail,
            "path": request.url.path
        }
    )
    # Adiciona cabeçalhos CORS manualmente para que o erro seja visível no frontend
    origin = request.headers.get("Origin") or request.headers.get("origin")
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
        "version": "2.0.2"
    }
    
if __name__ == '__main__':
    import uvicorn

    uvicorn.run(
        'main:app',
        host='0.0.0.0',
        port=settings.port,
        reload=settings.debug,
    )