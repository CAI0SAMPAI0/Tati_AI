"""
routers/activities/vocabulary.py
Router para gerenciamento de vocabulário pessoal e SRS.
"""

from fastapi import APIRouter, Depends
from app.core.exceptions import BusinessLogicError
from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.vocabulary_srs import vocabulary_srs_service

router = APIRouter()


@router.get('/due')
async def get_due_vocabulary(user: dict = Depends(get_current_user)):
    """Retorna palavras que precisam de revisão hoje."""
    return await vocabulary_srs_service.get_due_words(user['username'])


@router.post('/review/{entry_id}')
async def record_vocabulary_review(
        entry_id: str,
        quality_score: int,
        user: dict = Depends(get_current_user)):
    """Registra uma revisão de palavra e calcula próximo intervalo."""
    if not (0 <= quality_score <= 5):
        raise BusinessLogicError(detail="Score must be between 0 and 5")

    await vocabulary_srs_service.record_review(entry_id, quality_score, user['username'])
    return {"ok": True}


@router.post('/add')
async def add_word_manually(
        data: dict,
        user: dict = Depends(get_current_user)):
    """Adiciona manualmente uma palavra ao SRS."""
    word = data.get('word')
    if not word:
        raise BusinessLogicError(detail="Word is required")

    await vocabulary_srs_service.add_to_srs(
        user['username'],
        word,
        data.get('definition', ''),
        data.get('example', '')
    )
    return {"ok": True}


@router.get('')
@router.get('/')
async def list_vocabulary(user: dict = Depends(get_current_user)):
    """Retorna todas as palavras do dicionário do aluno."""
    from app.core.database import get_client
    db = get_client()
    username = user['username']

    try:
        res = db.table('user_vocabulary').select('*').eq('username', username).order('created_at', desc=True).execute()
        data = res.data or []

        words = []
        for row in data:
            reps = row.get('repetitions') or 0
            if reps == 0:
                status = 'new'
            elif reps >= 4:
                status = 'learned'
            else:
                status = 'learning'

            words.append({
                'id': row.get('id'),
                'term': row.get('word'),
                'translation': row.get('definition') or '',
                'example': row.get('example_sentence') or '',
                'status': status
            })

        return {'words': words, 'total': len(words)}
    except Exception as e:
        import logging
        logging.error(f"[VocabularyRouter] Erro ao listar vocabulário: {e}")
        return {'words': [], 'total': 0}


@router.put('/{entry_id}')
async def update_vocabulary_entry(
    entry_id: str,
    payload: dict,
    user: dict = Depends(get_current_user)
):
    """Atualiza tradução/definição e exemplo de uma palavra no vocabulário pessoal."""
    from app.core.database import get_client
    db = get_client()
    username = user['username']

    # Valida se a palavra pertence ao usuário
    existing = db.table('user_vocabulary').select('id').eq('id', entry_id).eq('username', username).execute().data
    if not existing:
        raise BusinessLogicError(detail="Palavra não encontrada no seu dicionário.")

    update_data = {}
    if 'translation' in payload:
        update_data['definition'] = payload['translation']
    if 'example' in payload:
        update_data['example_sentence'] = payload['example']

    # Se quiser permitir edição do status
    if 'status' in payload:
        status = payload['status']
        if status == 'new':
            update_data['repetitions'] = 0
            update_data['interval'] = 0
        elif status == 'learned':
            update_data['repetitions'] = 4
            update_data['interval'] = 15
        elif status == 'learning':
            update_data['repetitions'] = 1
            update_data['interval'] = 1

    try:
        db.table('user_vocabulary').update(update_data).eq('id', entry_id).execute()
        return {"ok": True}
    except Exception as e:
        import logging
        logging.error(f"[VocabularyRouter] Erro ao atualizar palavra: {e}")
        raise BusinessLogicError(detail=f"Erro ao salvar alterações: {e}")


@router.delete('/{entry_id}')
async def delete_vocabulary_entry(
    entry_id: str,
    user: dict = Depends(get_current_user)
):
    """Remove uma palavra do vocabulário pessoal do aluno."""
    from app.core.database import get_client
    db = get_client()
    username = user['username']

    # Valida se a palavra pertence ao usuário
    existing = db.table('user_vocabulary').select('id').eq('id', entry_id).eq('username', username).execute().data
    if not existing:
        raise BusinessLogicError(detail="Palavra não encontrada no seu dicionário.")

    try:
        db.table('user_vocabulary').delete().eq('id', entry_id).execute()
        return {"ok": True}
    except Exception as e:
        import logging
        logging.error(f"[VocabularyRouter] Erro ao excluir palavra: {e}")
        raise BusinessLogicError(detail=f"Erro ao excluir palavra: {e}")
