# avatar que vai para o frontend

from __future__ import annotations
 
import base64
from pathlib import Path
 
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
 
router = APIRouter()
 
_AVATAR_DIR = Path(__file__).parent.parent / "assets" / "avatar"
 
_FRAME_FILES: dict[str, str] = {
    "normal":     "avatar_tati_normal.png",
    "meio":       "avatar_tati_meio.png",
    "bem_aberta": "avatar_tati_bem_aberta.png",
    "ouvindo":    "avatar_tati_ouvindo.png",
    "piscando":   "avatar_tati_piscando.png",
}
 
_EXT_TO_MIME = {".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".webp": "webp"}
 
 
def _load_frame_b64(filename: str) -> str | None:
    path = _AVATAR_DIR / filename
    if not path.exists():
        return None
    mime = _EXT_TO_MIME.get(path.suffix.lower(), "png")
    b64 = base64.b64encode(path.read_bytes()).decode()
    return f"data:image/{mime};base64,{b64}"
 
 
@router.get("/frames")
async def get_avatar_frames():
    frames = {key: (_load_frame_b64(fname) or "") for key, fname in _FRAME_FILES.items()}
    frames["has_frames"] = bool(frames.get("normal"))
    return JSONResponse(content=frames)
 
 
@router.get("/frame/{frame_name}")
async def get_single_frame(frame_name: str):
    if frame_name not in _FRAME_FILES:
        raise HTTPException(status_code=404, detail="Frame não encontrado")
    data = _load_frame_b64(_FRAME_FILES[frame_name])
    if not data:
        raise HTTPException(status_code=404, detail=f"Arquivo {_FRAME_FILES[frame_name]} não encontrado")
    return {"frame": data, "has_frame": True}
 
 
@router.get("/status")
async def get_avatar_status():
    status = {
        key: {
            "filename": fname,
            "exists": (_AVATAR_DIR / fname).exists(),
            "path": str(_AVATAR_DIR / fname),
            "size_kb": (_AVATAR_DIR / fname).stat().st_size / 1024 if (_AVATAR_DIR / fname).exists() else None,
        }
        for key, fname in _FRAME_FILES.items()
    }
    return {
        "avatar_dir": str(_AVATAR_DIR),
        "directory_exists": _AVATAR_DIR.exists(),
        "frames_status": status,
        "all_present": all(v["exists"] for v in status.values()),
    }