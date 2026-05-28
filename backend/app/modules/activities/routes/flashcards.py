from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from app.core.dependencies.auth import get_current_user
from app.core.database import get_client
from app.core.utils.level_utils import matches_level
from typing import Optional
from datetime import datetime, timedelta, timezone

router = APIRouter()

class FlashcardProgressPayload(BaseModel):
    deck_id: str
    card_front: str
    status: str  # 'correct' | 'wrong' | 'unknown'

@router.get('/my')
async def get_my_flashcards(user=Depends(get_current_user)):
    """Retorna flashcards do usuário filtrados por nível."""
    db = get_client()
    user_level = user.get('level')
    
    try:
        res = (
            db.table('modules')
            .select('*')
            .not_.is_('flashcards', 'null')
            .eq('is_published', True)
            .neq('id', '00000000-0000-0000-0000-000000000001')
            .order('created_at', desc=True)
            .execute()
        )
        data = res.data or []
        
        filtered = []
        for d in data:
            if matches_level(user_level, d.get('level'), d.get('levels')):
                fc = d.get('flashcards')
                d['card_count'] = len(fc) if isinstance(fc, list) else 0
                filtered.append(d)
                
        filtered.sort(key=lambda x: x.get('created_at') or '', reverse=True)
        return filtered
    except Exception as e:
        print(f"[FlashcardsRouter] Erro: {e}")
        return []


@router.post('/progress')
async def save_flashcard_progress(
    payload: FlashcardProgressPayload,
    user=Depends(get_current_user)
):
    """Salva o resultado de um card (correto, errado, não sei)."""
    db = get_client()
    username = user.get('username')
    
    # Calculate next review date using simple spaced repetition
    now = datetime.now(timezone.utc)
    if payload.status == 'correct':
        next_review = None  # Correct: no forced review needed
    elif payload.status == 'wrong':
        next_review = (now + timedelta(days=2)).isoformat()  # Review in 2 days
    else:  # unknown
        next_review = (now + timedelta(days=1)).isoformat()  # Review tomorrow

    try:
        # Upsert: update if exists, insert if not
        existing = (
            db.table('user_flashcard_progress')
            .select('id')
            .eq('username', username)
            .eq('deck_id', payload.deck_id)
            .eq('card_front', payload.card_front)
            .execute()
        )
        
        record = {
            'username': username,
            'deck_id': payload.deck_id,
            'card_front': payload.card_front,
            'status': payload.status,
            'next_review_date': next_review,
            'reviewed_at': now.isoformat(),
        }
        
        if existing.data:
            db.table('user_flashcard_progress').update(record).eq('id', existing.data[0]['id']).execute()
        else:
            db.table('user_flashcard_progress').insert(record).execute()
            
        return {'ok': True}
    except Exception as e:
        print(f"[FlashcardsProgress] Erro: {e}")
        return {'ok': False, 'error': str(e)}


@router.get('/review/friday')
async def get_friday_review(user=Depends(get_current_user)):
    """
    Retorna um deck de revisão com os cards que o aluno errou ou não sabia.
    Usado principalmente nas sextas-feiras para reforço.
    Nunca repete cards que o aluno acertou.
    """
    db = get_client()
    username = user.get('username')
    
    try:
        # Get cards marked 'wrong' or 'unknown'
        res = (
            db.table('user_flashcard_progress')
            .select('*')
            .eq('username', username)
            .in_('status', ['wrong', 'unknown'])
            .execute()
        )
        progress_rows = res.data or []
        
        if not progress_rows:
            return {'has_review': False, 'cards': [], 'total': 0}
        
        # For each failed card, try to get full card data from the deck module
        review_cards = []
        deck_cache: dict = {}
        
        for row in progress_rows:
            deck_id = row.get('deck_id')
            card_front = row.get('card_front')
            
            if deck_id not in deck_cache:
                deck_res = db.table('modules').select('flashcards, title').eq('id', deck_id).execute()
                deck_cache[deck_id] = deck_res.data[0] if deck_res.data else None
                
            deck_data = deck_cache.get(deck_id)
            if not deck_data or not deck_data.get('flashcards'):
                continue
                
            # Find the specific card
            matching = [c for c in deck_data['flashcards'] if c.get('front') == card_front]
            if matching:
                card = matching[0]
                card['_deck_title'] = deck_data.get('title', '')
                card['_status'] = row.get('status')
                card['_deck_id'] = deck_id
                review_cards.append(card)
        
        return {
            'has_review': len(review_cards) > 0,
            'total': len(review_cards),
            'cards': review_cards
        }
    except Exception as e:
        print(f"[FridayReview] Erro: {e}")
        return {'has_review': False, 'cards': [], 'total': 0, 'error': str(e)}

