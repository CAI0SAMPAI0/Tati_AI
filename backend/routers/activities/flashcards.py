from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.database import get_client
from core.level_utils import matches_level

router = APIRouter()

@router.get('/my')
async def get_my_flashcards(user=Depends(get_current_user)):
    """Retorna flashcards do usuário filtrados por nível."""
    from services.database import get_client
    db = get_client()
    user_level = user.get('level')
    
    try:
        res = db.table('modules').select('*').not_.is_('flashcards', 'null').eq('is_published', True).order('created_at', desc=True).execute()
        data = res.data or []
        
        filtered = []
        for d in data:
            if matches_level(user_level, d.get('level'), d.get('levels')):
                fc = d.get('flashcards')
                d['card_count'] = len(fc) if isinstance(fc, list) else 0
                filtered.append(d)
                
        return filtered
    except Exception:
        return []
