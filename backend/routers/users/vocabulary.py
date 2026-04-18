"""
Router de Caderno de Vocabulário Pessoal.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from routers.deps import get_current_user
from services.database import get_client

router = APIRouter()


class VocabWord(BaseModel):
    term: str
    translation: Optional[str] = None
    example: Optional[str] = None
    status: str = "new"  # new, learning, learned


class VocabUpdate(BaseModel):
    words: List[VocabWord]


@router.get("/vocabulary")
async def get_vocabulary(current_user: dict = Depends(get_current_user)):
    """Retorna vocabulário do usuário."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("vocabulary")
            .eq("username", current_user["username"])
            .single()
            .execute()
            .data
        )
        
        words = row.get("vocabulary", []) if row else []
    except Exception:
        words = []
    
    return {"words": words, "total": len(words)}


@router.post("/vocabulary")
async def save_vocabulary(body: VocabUpdate, current_user: dict = Depends(get_current_user)):
    """Salva vocabulário do usuário."""
    db = get_client()
    
    words_data = [w.dict() for w in body.words]
    
    db.table("users").update({
        "vocabulary": words_data
    }).eq("username", current_user["username"]).execute()
    
    return {"ok": True, "total": len(words_data)}


@router.post("/vocabulary/add")
async def add_word(body: VocabWord, current_user: dict = Depends(get_current_user)):
    """Adiciona uma palavra ao vocabulário."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("vocabulary")
            .eq("username", current_user["username"])
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
        }).eq("username", current_user["username"]).execute()
        
        return {"ok": True, "total": len(words)}
    except Exception as e:
        return {"ok": False, "error": str(e)}
