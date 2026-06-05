from fastapi import APIRouter, Depends, HTTPException
from app.core.exceptions import ContentNotFoundError, BusinessLogicError
from pydantic import BaseModel
from typing import Optional
from app.core.enums import normalize_level

from app.core.dependencies.auth import require_staff, get_current_user
from app.core.dependencies.db import get_db
from supabase import Client
from app.modules.admin.services.dashboard_service import DashboardService
from app.modules.activities.services.activity_service import ActivityService
from app.modules.chat.services.llm import groq_chat

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────


class StudentUpdate(BaseModel):
    """Payload para atualizar dados de um aluno."""

    level: Optional[str] = None
    custom_prompt: Optional[str] = None


class UrlGenerationRequest(BaseModel):
    """Payload para gerar um módulo a partir de uma URL externa."""

    url: str
    level: Optional[str] = 'B1'


# ── Estatísticas e visão geral ────────────────────────────────────────


@router.post('/generate-from-url')
async def generate_from_url_endpoint(
    req: UrlGenerationRequest,
    user: dict = Depends(require_staff)
):
    """Gera um módulo completo a partir de uma URL externa."""
    from app.modules.activities.services.url_to_module import url_to_module_service
    result = await url_to_module_service.generate_from_url(
        req.url,
        user['username'],
        req.level
    )
    if not result.get('ok'):
        raise BusinessLogicError(detail=result.get('error'))
    return result


@router.get('/config-status')
async def get_config_status(user=Depends(require_staff)):
    """Verifica se as chaves principais estão configuradas (redigido)."""
    from app.core.config import settings
    return {
        'groq': len(settings.groq_keys) > 0,
        'tavily': len(settings.tavily_keys) > 0,
        'cloudinary': bool(settings.cloudinary_cloud_name and settings.cloudinary_api_key),
        'elevenlabs': len(settings.eleven_keys) > 0,
        'openai': bool(settings.openai_api_key),
    }


@router.get('/stats')
async def get_stats(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> dict:
    """Estatísticas rápidas do dashboard."""
    return await service.get_quick_stats()


@router.get('/stats/my')
async def get_my_stats(
        user: dict = Depends(get_current_user),
        service: DashboardService = Depends()) -> dict:
    """Estatísticas do aluno logado (usado no perfil e achievements)."""
    return await service.get_user_stats(user['username'])


@router.get('/reports/overview')
async def get_reports_overview(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> dict:
    """Visão geral de relatórios com dados reais do banco."""
    return await service.get_reports_overview()


# ── Alunos ────────────────────────────────────────────────────────────


@router.get('/students')
async def get_students(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> list:
    """Lista todos os alunos com metadados completos."""
    return await service.get_students_list()


@router.put('/students/{username}')
async def update_student(
    username: str,
    body: StudentUpdate,
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Atualiza nível e/ou prompt customizado de um aluno."""
    return await service.update_student(
        username,
        level=body.level,
        custom_prompt=body.custom_prompt,
    )


@router.delete('/students/{username}', status_code=200)
async def delete_student(
    username: str,
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Remove um aluno do sistema com limpeza de todas as dependências (FK-safe)."""
    try:
        await service.delete_student(username)
        return {'ok': True}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao deletar aluno: {e}")


@router.delete('/buyers/{username}', status_code=200)
async def delete_buyer(
    username: str,
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Remove um buyer e todos os seus dados (orders, order_items, purchases) — FK-safe."""
    try:
        # reutiliza a mesma lógica completa
        await service.delete_student(username)
        return {'ok': True}
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erro ao deletar buyer: {e}")


# ── Análises por aluno ────────────────────────────────────────────────


@router.get('/students/{username}/insight')
async def get_insight(
    username: str,
    lang: str = 'en-US',
    service: DashboardService = Depends(),
    db: Client = Depends(get_db),
    user=Depends(require_staff)
) -> dict:
    """Gera insight pedagógico sobre um aluno via IA (English only)."""
    rows = (
        db.table('messages')
        .select('content')
        .eq('username', username)
        .eq('role', 'user')
        .order('created_at', desc=True)
        .limit(20)
        .execute()
        .data
        or []
    )
    context = ' | '.join(r.get('content', '') for r in rows)[:1500]
    prompt = (
        f'Generate a short pedagogical report (strictly in English) for student "{username}" '
        f'based on their recent messages. Be specific. Messages: {context}'
    )
    try:
        insight = await groq_chat([{'role': 'user', 'content': prompt}])
        return {'insight': insight}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get('/students/{username}/grammar-errors')
async def get_grammar_errors(
    username: str,
    lang: str = 'en-US',
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Analisa erros gramaticais recorrentes de um aluno."""
    return await service.get_grammar_errors(username, lang)


@router.get('/students/{username}/recommendations')
async def get_recommendations(
    username: str,
    lang: str = 'en-US',
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Retorna interesses e recomendações pedagógicas para um aluno."""
    return await service.get_recommendations(username, lang)


# ── Simulações, Flashcards, Submissões ────────────────────────────────


@router.get('/simulations')
async def list_simulations(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> list:
    """Lista todas as simulações registradas."""
    return await service.get_all_simulations()


@router.get('/simulations/{simulation_id}')
def get_simulation(
        simulation_id: str,
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Detalhes de uma simulação."""
    res = db.table('simulations').select(
        '*').eq('id', simulation_id).limit(1).execute()
    if not res.data:
        raise ContentNotFoundError(detail='Simulação não encontrada')
    return res.data[0]


@router.post('/simulations')
async def create_simulation(
        data: dict,
        service: DashboardService = Depends(),
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Cria uma nova simulação (manual ou via IA se is_ai_generated)."""
    if data.get('is_ai_generated') or data.get('use_ai_generation'):
        return await service.generate_simulation(
            data.get('topic') or data.get('name', 'Nova Simulação'),
            normalize_level(data.get('level') or data.get('difficulty')),
            data.get('instructions', '')
        )

    # Limpeza de dados para evitar erro de coluna inexistente
    allowed_fields = {
        'name',
        'slug',
        'description',
        'icon',
        'emoji',
        'difficulty',
        'system_prompt',
        'is_active'}
    filtered_data = {
        k: v for k,
        v in data.items() if k in allowed_fields}

    if 'difficulty' in filtered_data and filtered_data['difficulty']:
        val = filtered_data['difficulty']
        if val and str(val).lower().strip() in ['all', 'todos', 'any', 'all levels']:
            filtered_data['difficulty'] = 'all'
        else:
            filtered_data['difficulty'] = normalize_level(val)

    # Garantir is_active=True para que o RLS não esconda o registro (Fix
    # 23506)
    if 'is_active' not in filtered_data:
        filtered_data['is_active'] = True

    # Garantir campos obrigatórios
    if 'system_prompt' not in filtered_data or not filtered_data['system_prompt']:
        filtered_data['system_prompt'] = f"You are a helpful assistant for the scenario {
            filtered_data.get(
                'name', 'English Practice')}."

    if 'difficulty' in filtered_data:
        val = data.get('level') or data.get('difficulty')
        if val and str(val).lower().strip() in ['all', 'todos', 'any', 'all levels']:
            filtered_data['difficulty'] = 'all'
        else:
            filtered_data['difficulty'] = normalize_level(val)

    from fastapi.concurrency import run_in_threadpool
    def _save():
        return db.table('simulations').insert(filtered_data).execute()
        
    res = await run_in_threadpool(_save)

    # Desabilitado: Notificação global de nova simulação
    """
    if res.data:
        try:
            from app.modules.notifications.services.notifications import notify_all_students
            notify_all_students(
                category='new_simulation',
                title='New Simulation Available! 🎭',
                message=f"New scenario: {filtered_data.get('name', 'English Practice')}. Try it now!",
                url='/simulation.html'
            )
        except Exception as e:
            logging.info(f'[Admin] Erro ao notificar simulação: {e}')
    """

    return res


@router.put('/simulations/{simulation_id}')
def update_simulation(
        simulation_id: str,
        data: dict,
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Atualiza uma simulação."""

    allowed_fields = {
        'name',
        'slug',
        'description',
        'icon',
        'emoji',
        'difficulty',
        'system_prompt',
        'greeting',
        'is_active'}
    filtered_data = {
        k: v for k,
        v in data.items() if k in allowed_fields}

    if 'difficulty' in filtered_data and filtered_data['difficulty']:
        val = filtered_data['difficulty']
        if val and str(val).lower().strip() in ['all', 'todos', 'any', 'all levels']:
            filtered_data['difficulty'] = 'all'
        else:
            filtered_data['difficulty'] = normalize_level(val)

    return db.table('simulations').update(
        filtered_data).eq('id', simulation_id).execute()


@router.delete('/simulations/{simulation_id}')
def delete_simulation(
        simulation_id: str,
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Exclui uma simulação."""
    return db.table('simulations').delete().eq(
        'id', simulation_id).execute()


@router.get('/modules')
def list_all_modules(
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Lista todos os módulos (quizzes e conteúdos), ignorando flashcards."""
    from app.modules.activities.routes.personalized import PERSONALIZED_MODULE_ID
    res = db.table('modules').select('*').is_('flashcards',
                                              'null').neq('id',
                                                          PERSONALIZED_MODULE_ID).order('created_at',
                                                                                        desc=True).execute()
    return res.data or []


@router.put('/modules/{module_id}')
def update_module_admin(
        module_id: str,
        data: dict,
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Atualiza metadados de um módulo."""
    return db.table('modules').update(
        data).eq('id', module_id).execute()


@router.delete('/modules/{module_id}')
async def delete_module_admin(
        module_id: str,
        service: ActivityService = Depends(),
        user=Depends(require_staff)):
    """Remove um módulo e seus dependentes."""
    success = await service.delete_module(module_id)
    if not success:
        raise BusinessLogicError(
            detail="Não foi possível excluir o módulo")
    return {"ok": True}


@router.get('/flashcards')
def get_dashboard_flashcards(
        db: Client = Depends(get_db),
        user=Depends(require_staff)) -> list:
    """Lista flashcards globais ou de admin."""
    try:
        # Flashcards são armazenados na tabela modules com o campo
        # flashcards preenchido
        from app.modules.activities.routes.personalized import PERSONALIZED_MODULE_ID
        res = db.table('modules').select('*').not_.is_(
            'flashcards', 'null').neq(
            'id', PERSONALIZED_MODULE_ID).order(
            'created_at', desc=True).execute()
        data = res.data or []
        for d in data:
            fc = d.get('flashcards')
            d['card_count'] = len(fc) if isinstance(fc, list) else 0
        return data
    except Exception:
        return []


@router.post('/flashcards')
def create_flashcard_deck(
        data: dict,
        service: DashboardService = Depends(),
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Cria um novo deck de flashcards."""
    val = data.get('level')
    if val and str(val).lower().strip() in ['all', 'todos', 'any', 'all levels']:
        payload_level = 'all'
    else:
        payload_level = normalize_level(val) if val else 'all'
    payload = {
        'title': data.get('title'),
        'description': data.get('description'),
        'level': payload_level,
        'flashcards': data.get('flashcards', []),
        'is_published': True
    }
    res = db.table('modules').insert(payload).execute()

    return res


@router.put('/flashcards/{deck_id}')
def update_flashcard_deck(
        deck_id: str,
        data: dict,
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Atualiza um deck de flashcards."""
    payload = {
        'title': data.get('title'),
        'description': data.get('description'),
        'level': normalize_level(data.get('level')) if data.get('level') else None,
        'flashcards': data.get('flashcards')}
    # Filtra None
    payload = {k: v for k, v in payload.items() if v is not None}

    return db.table('modules').update(
        payload).eq('id', deck_id).execute()


@router.delete('/flashcards/{deck_id}')
async def delete_flashcard_deck(
        deck_id: str,
        service: ActivityService = Depends(),
        user=Depends(require_staff)):
    """Exclui um deck de flashcards usando o ActivityService para tratar dependências."""
    success = await service.delete_module(deck_id)
    if not success:
        raise BusinessLogicError(
            detail="Não foi possível excluir o baralho (ex: existem progresso de alunos vinculados)")
    return {"ok": True}


@router.get('/submissions/all')
async def get_all_submissions(
        act_service: ActivityService = Depends(),
        user=Depends(require_staff)) -> list:
    """Lista todas as submissões usando o ActivityService."""
    return await act_service.get_all_submissions()


@router.get('/difficulties')
async def get_difficulties(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> dict:
    """Retorna distribuição de dificuldades/níveis."""
    return await service.get_difficulties_stats()


@router.get('/buyers')
async def get_buyers(
        service: DashboardService = Depends(),
        user=Depends(require_staff)) -> list:
    return await service.get_buyers_list()
