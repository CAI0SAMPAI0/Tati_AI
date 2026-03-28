from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv(Path(__file__).parent.parent / ".env")

from routers import auth, chat, profile, dashboard, avatar

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Servir Frontend
FRONTEND_PATH = Path(__file__).parent.parent / "frontend"
app.mount("/static", StaticFiles(directory=FRONTEND_PATH), name="static")

@app.get("/")
async def read_index():
    return FileResponse(FRONTEND_PATH / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
