from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
'''from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse'''
from dotenv import load_dotenv
from pathlib import Path
import os
# carregando as variáveis de ambiente do arquivo .env
load_dotenv(Path(__file__).parent.parent / ".env")

from routers import auth, avatar, chat, dashboard, profile
# Frontend
#_FRONTEND_PATH = Path(__file__).parent.parent / "frontend"

app = FastAPI(title='Teacher Tati API', description='API para o aplicativo de ensino de inglês Teacher Tati', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tati-ai.vercel.app",
                   "http://localhost:8000", # dev
                   "http://localhost:3000"], # dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(avatar.router, prefix="/avatar", tags=["avatar"])
app.include_router(chat.router, prefix="/voice", tags=["voice"])

#app.mount("/static", StaticFiles(directory=_FRONTEND_PATH), name="static")

'''@app.get("/")
async def server_index() -> FileResponse:
    return FileResponse(_FRONTEND_PATH / "index.html")'''

@app.get("/cors-test")
async def cors_test():
    return {"origins": ["https://tati-ai.vercel.app"]}

if __name__ == "__main__":
    import uvicorn
    from core.config import settings
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)
