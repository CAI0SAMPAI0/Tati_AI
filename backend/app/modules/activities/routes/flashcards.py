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
        
        # Mapeamento para níveis CEFR
        def map_user_level_to_cefr(ulvl: str) -> list[str]:
            mapping = {
                'Beginner': ['A1'],
                'Pre-Intermediate': ['A2'],
                'Intermediate': ['B1', 'B2'],
                'Business English': ['C1'],
                'Advanced': ['C2']
            }
            return mapping.get(ulvl or 'Intermediate', ['B1', 'B2'])
            
        cefr_levels = map_user_level_to_cefr(user_level)
        
        # Busca flashcards CEFR publicados para os níveis do usuário
        cefr_res = db.table('cefr_flashcards').select('*').in_('level', cefr_levels).eq('is_published', True).execute()
        cefr_rows = cefr_res.data or []
        
        # Agrupa por tópico
        from collections import defaultdict
        import re
        
        grouped = defaultdict(list)
        for r in cefr_rows:
            topic = r.get('topic') or 'General Vocabulary'
            grouped[topic].append(r)
            
        # Adiciona decks virtuais na lista
        for topic, cards in grouped.items():
            level_str = cards[0]['level']
            topic_slug = re.sub(r'[^a-zA-Z0-9]', '_', topic.lower())
            virtual_id = f"cefr_fc_{level_str}_{topic_slug}"
            
            filtered.append({
                "id": virtual_id,
                "title": f"CEFR {level_str}: {topic}",
                "description": f"Vocabulary deck about {topic}.",
                "level": level_str,
                "card_count": len(cards),
                "flashcards": cards, # Opcional, o frontend pode ler direto
                "created_at": cards[0].get('created_at')
            })
            
        # Ordena a lista consolidada (pode ordenar por data de criação se disponível)
        filtered.sort(key=lambda x: x.get('created_at') or '', reverse=True)
                
        return filtered
    except Exception as e:
        print(f"[FlashcardsRouter] Erro: {e}")
        return []
