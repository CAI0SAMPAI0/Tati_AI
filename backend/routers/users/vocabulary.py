"""
Router de Caderno de Vocabulário Pessoal.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from routers.deps import get_current_user
from services.database import get_client
from services.upstash import cache_get, cache_set, cache_delete

router = APIRouter()


class VocabWord(BaseModel):
    term: str
    translation: Optional[str] = None
    example: Optional[str] = None
    status: str = "new"  # new, learning, learned

    def dict(self, *args, **kwargs):
        return super().model_dump(*args, **kwargs)


class VocabUpdate(BaseModel):
    words: List[VocabWord]


@router.get("/vocabulary")
async def get_vocabulary(current_user: dict = Depends(get_current_user)):
    """Retorna vocabulário do usuário."""
    username = current_user["username"]
    cache_key = f"vocabulary:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()
    try:
        row = db.table("users").select("vocabulary").eq("username", username).single().execute().data
        words = row.get("vocabulary", []) if row else []
    except Exception:
        words = []

    result = {"words": words, "total": len(words)}
    await cache_set(cache_key, result, ttl=600)  # 10 minutos
    return result


@router.post("/vocabulary")
async def save_vocabulary(body: VocabUpdate, current_user: dict = Depends(get_current_user)):
    """Salva vocabulário do usuário."""
    username = current_user["username"]
    db = get_client()
    words_data = [w.dict() for w in body.words]
    db.table("users").update({"vocabulary": words_data}).eq("username", username).execute()
    await cache_delete(f"vocabulary:{username}")  # invalida ao salvar
    return {"ok": True, "total": len(words_data)}


@router.post("/vocabulary/add")
async def add_word(body: VocabWord, current_user: dict = Depends(get_current_user)):
    """Adiciona uma palavra ao vocabulário."""
    username = current_user["username"]
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("vocabulary")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        words = row.get("vocabulary", []) if row else []
        
        # Verifica se já existe
        existing = next((w for w in words if w.get("term") == body.term), None)
        if existing:
            return {"ok": False, "message": "Word already exists"}
        
        words.append({
            "term": body.term,
            "translation": body.translation,
            "example": body.example,
            "status": body.status,
            "added_at": datetime.now(timezone.utc).isoformat()
        })
        
        db.table("users").update({
            "vocabulary": words
        }).eq("username", username).execute()
        
        await cache_delete(f"vocabulary:{username}")  # invalida ao adicionar palavra
        return {"ok": True, "total": len(words)}
    except Exception as e:
        return {"ok": False, "error": str(e)}
