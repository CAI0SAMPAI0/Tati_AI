"""
Teacher Tati API - Entry Point

Este arquivo inicializa a aplicação FastAPI, configura middlewares (CORS, Rate Limiting),
integra o Sentry para monitoramento de erros e centraliza o roteamento de todos os módulos.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
import os

# Força o carregamento do .env da raiz do projeto para garantir consistência nas chaves
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Sentry - Inicialização crítica para captura de exceções em tempo de execução
from core.sentry_config import init_sentry
try:
    init_sentry()
except Exception as e:
    print(f"[Startup] Erro ao iniciar Sentry: {e}")

# Importação dos roteadores de cada domínio da aplicação
from routers.auth import router as auth_router
# ... (restante dos imports)
from routers.users.profile import router as profile_router
from routers.users.permissions import router as permissions_router
from routers.users.streaks import router as streaks_router
from routers.users.progress import router as progress_router
from routers.users.vocabulary import router as vocab_router
from routers.users.goals import router as goals_router
from routers.users.xp import router as xp_router
from routers.challenges import router as challenges_router
from routers.admin.dashboard import router as dashboard_router
from routers.ai.chat import router as chat_router
from routers.simulation import router as simulation_router
from routers.ai.avatar import router as avatar_router
from routers.activities.modules import router as modules_router
from routers.activities.quizzes import router as quizzes_router
from routers.activities.trophies import router as trophies_router
from routers.activities.submissions import router as submissions_router
from routers.activities.ranking import router as ranking_router
from routers.payments import asaas_router as payments_router
from routers.validation import router as validation_router

app = FastAPI(
    title="Teacher Tati API",
    description="API para o aplicativo de ensino de inglês Teacher Tati",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8080", "http://localhost:8080", "https://tati-ai.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting (Upstash Redis)
from core.rate_limiter import setup_rate_limiting
setup_rate_limiting(app)

# ── Auth ──────────────────────────────────────────────────────
app.include_router(auth_router,      prefix="/auth",      tags=["auth"])

# ── Users ─────────────────────────────────────────────────────
app.include_router(profile_router,   prefix="/profile",   tags=["users"])
app.include_router(permissions_router, prefix="/users/permissions", tags=["users"])
app.include_router(streaks_router, prefix="/users", tags=["users"])
app.include_router(progress_router, prefix="/users", tags=["users"])
app.include_router(vocab_router, prefix="/users", tags=["users"])
app.include_router(goals_router, prefix="/users", tags=["users"])
app.include_router(xp_router, prefix="/users", tags=["users"])

# ── Admin ─────────────────────────────────────────────────────
app.include_router(dashboard_router, prefix="/dashboard", tags=["admin"])

# ── Challenges ────────────────────────────────────────────────
app.include_router(challenges_router, tags=["challenges"])
app.include_router(chat_router,      prefix="/chat",      tags=["ai"])
app.include_router(chat_router,      prefix="/voice",     tags=["ai"])
app.include_router(avatar_router,    prefix="/avatar",    tags=["ai"])

# ── Simulation ────────────────────────────────────────────────
app.include_router(simulation_router, tags=["simulation"])

# ── Activities ────────────────────────────────────────────────
app.include_router(modules_router,   prefix="/activities/modules",  tags=["activities"])
app.include_router(quizzes_router,   prefix="/activities/quizzes",  tags=["activities"])
app.include_router(trophies_router,  prefix="/activities/trophies", tags=["activities"])
app.include_router(submissions_router, prefix="/activities/submissions", tags=["activities"])
app.include_router(ranking_router, prefix="/activities/ranking", tags=["activities"])

# ── Payments ──────────────────────────────────────────────────
app.include_router(payments_router,  prefix="/payments",   tags=["payments"])

# ── Validation ────────────────────────────────────────────────
app.include_router(validation_router, prefix="/validation", tags=["validation"])

# ── Health ────────────────────────────────────────────────────────
@app.get("/cors-test")
async def cors_test():
    return {"origins": ["https://tati-ai.vercel.app"]}


if __name__ == "__main__":
    import uvicorn
    from core.config import settings
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)