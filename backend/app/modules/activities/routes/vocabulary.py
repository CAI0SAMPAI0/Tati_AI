"""
routers/activities/vocabulary.py
Router para gerenciamento de vocabulário pessoal e SRS.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.vocabulary_srs import vocabulary_srs_service

router = APIRouter()

@router.get('/due')
async def get_due_vocabulary(user: dict = Depends(get_current_user)):
    """Retorna palavras que precisam de revisão hoje."""
    return await vocabulary_srs_service.get_due_words(user['username'])

@router.post('/review/{entry_id}')
async def record_vocabulary_review(entry_id: str, quality_score: int, user: dict = Depends(get_current_user)):
    """Registra uma revisão de palavra e calcula próximo intervalo."""
    if not (0 <= quality_score <= 5):
        raise HTTPException(status_code=400, detail="Score must be between 0 and 5")
    
    await vocabulary_srs_service.record_review(entry_id, quality_score)
    return {"ok": True}

@router.post('/add')
async def add_word_manually(data: dict, user: dict = Depends(get_current_user)):
    """Adiciona manualmente uma palavra ao SRS."""
    word = data.get('word')
    if not word:
        raise HTTPException(status_code=400, detail="Word is required")
        
    await vocabulary_srs_service.add_to_srs(
        user['username'],
        word,
        data.get('definition', ''),
        data.get('example', '')
    )
    return {"ok": True}
