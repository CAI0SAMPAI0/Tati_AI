from fastapi import APIRouter, Depends
from app.core.dependencies.auth import get_current_user
from app.core.database import get_client
from app.core.utils.level_utils import matches_level

router = APIRouter()

@router.get('/my')
async def get_my_flashcards(user=Depends(get_current_user)):
    """Retorna flashcards do usuário filtrados por nível."""
    from app.core.database import get_client
    db = get_client()
    user_level = user.get('level')
    
    try:
        res = (
            db.table('modules')
            .select('*')
            .not_.is_('flashcards', 'null')
            .eq('is_published', True)
            .neq('id', '00000000-0000-0000-0000-000000000001') # Exclui práticas personalizadas
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
                
        return filtered
    except Exception:
        return []
