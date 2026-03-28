import base64
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
 
router = APIRouter()
 
# Diretório dos frames — relativo ao backend/
AVATAR_DIR = Path(__file__).parent.parent / "assets" / "avatar"
 
FRAME_FILES = {
    "normal":      "avatar_tati_normal.png",
    "meio":        "avatar_tati_meio.png",
    "bem_aberta":  "avatar_tati_bem_aberta.png",
    "ouvindo":     "avatar_tati_ouvindo.png",
    "piscando":    "avatar_tati_piscando.png",
}

def load_frame_b64(filename: str) -> str | None:
    """Carrega um frame e retorna como string base64."""
    path = AVATAR_DIR / filename
    if not path.exists():
        return None
    
    # detectando o tipo de imagem
    suffix = path.suffix.lower()
    map_ext = {
        ".png": "png",
        ".jpg": "jpeg",
        ".jpeg": "jpeg",
        ".gif": "gif",
        ".webp": "webp",
    }
    img_type = map_ext.get(suffix, "png")  # default para png
    
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/{img_type};base64,{b64}"

@router.get("/frames")
async def get_avatar_frames():
    """Rota para obter os frames do avatar em base64.
    O frontend carrega esses frames e armazena para uso durante a animação.
    Resposta:
    {
        "normal":     "data:image/png;base64,...",
        "meio":       "data:image/png;base64,...",
        "bem_aberta": "data:image/png;base64,...",
        "ouvindo":    "data:image/png;base64,...",
        "piscando":   "data:image/png;base64,...",
        "has_frames": true
    }
    """
    
    frames = {}
    for key, filename in FRAME_FILES.items():
        data = load_frame_b64(filename)
        frames[key] = data or ""  # Se não conseguiu carregar, retorna string vazia
    frames["has_frames"] = bool(frames.get("normal"))  # Indicador se os frames foram carregados com sucesso

    return JSONResponse(content=frames)

@router.get("/frame/{frame_name}")
async def get_single_frame(frame_name: str):
    """Rota para obter um frame específico do avatar em base64.
    Exemplo de uso: /frame/normal, /frame/meio, etc.
    Resposta:
    {
        "frame": "data:image/png;base64,...",
        "has_frame": true
    }
    """
    if frame_name not in FRAME_FILES:
        raise HTTPException(status_code=404, detail="Frame não encontrado")
    
    filename = FRAME_FILES[frame_name]
    frame_data = load_frame_b64(filename)
    if not frame_data:
        raise HTTPException(status_code=404, detail=f"Arquivo {filename} não encontrado")
    
    return {"frame": frame_data, "has_frame": frame_data}
        
@router.get("/status")
async def get_avatar_status():
    """Rota para verificar se os frames do avatar estão disponíveis.
    Resposta:
    {
        "has_frames": true
    }"""
    status = {}
    for key, filename in FRAME_FILES.items():
        path = AVATAR_DIR / filename
        status[key] = {
            "filename": filename,
            "exists": path.exists(),
            "path": str(path),
            "size_kb": path.stat().st_size / 1024 if path.exists() else None,
        }
        
    return {
        "avatar_dir" : str(AVATAR_DIR),
        "directory_exists": AVATAR_DIR.exists(),
        "frames_status": status,
        "all_present": all(v['exists'] for v in status.values()),
    }