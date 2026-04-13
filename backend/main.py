from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

from routers.auth import router as auth_router
from routers.users.profile import router as profile_router
from routers.users.permissions import router as permissions_router
from routers.admin.dashboard import router as dashboard_router
from routers.ai.chat import router as chat_router
from routers.ai.avatar import router as avatar_router
from routers.activities.modules import router as modules_router
from routers.activities.quizzes import router as quizzes_router
from routers.activities.trophies import router as trophies_router
from routers.activities.submissions import router as submissions_router
from routers.payments import asaas_router as payments_router

app = FastAPI(
    title="Teacher Tati API",
    description="API para o aplicativo de ensino de inglês Teacher Tati",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://tati-ai.vercel.app",
        "http://localhost:8000",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────
app.include_router(auth_router,      prefix="/auth",      tags=["auth"])

# ── Users ─────────────────────────────────────────────────────
app.include_router(profile_router,   prefix="/profile",   tags=["users"])
app.include_router(permissions_router, prefix="/users/permissions", tags=["users"])

# ── Admin ─────────────────────────────────────────────────────
app.include_router(dashboard_router, prefix="/dashboard", tags=["admin"])

# ── AI ────────────────────────────────────────────────────────
app.include_router(chat_router,      prefix="/chat",      tags=["ai"])
app.include_router(chat_router,      prefix="/voice",     tags=["ai"])
app.include_router(avatar_router,    prefix="/avatar",    tags=["ai"])

# ── Activities ────────────────────────────────────────────────
app.include_router(modules_router,   prefix="/activities/modules",  tags=["activities"])
app.include_router(quizzes_router,   prefix="/activities/quizzes",  tags=["activities"])
app.include_router(trophies_router,  prefix="/activities/trophies", tags=["activities"])
app.include_router(submissions_router, prefix="/activities/submissions", tags=["activities"])

# ── Payments ──────────────────────────────────────────────────
app.include_router(payments_router,  prefix="/payments",   tags=["payments"])

# ── Health ────────────────────────────────────────────────────────
@app.get("/cors-test")
async def cors_test():
    return {"origins": ["https://tati-ai.vercel.app"]}


if __name__ == "__main__":
    import uvicorn
    from core.config import settings
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)