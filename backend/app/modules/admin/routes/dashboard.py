from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, File, UploadFile, Form
from app.core.task_manager import run_task_in_background, delegate_to_worker_if_needed
from app.core.exceptions import ContentNotFoundError, BusinessLogicError
from pydantic import BaseModel
from typing import Optional, List
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


class StudentNudge(BaseModel):
    """Payload para enviar uma mensagem nudge para um aluno."""
    message: str


class UrlGenerationRequest(BaseModel):
    """Payload para gerar um módulo a partir de uma URL externa."""

    url: str
    level: Optional[str] = 'B1'


class DispatchQuizRequest(BaseModel):
    """Payload para despachar um quiz para vários alunos."""

    quiz_id: str
    student_usernames: List[str]


class GenerateQuizAIRequest(BaseModel):
    """Payload para gerar um quiz via IA."""

    topic: str
    num_questions: int = 5
    level: str = 'B1'


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

    from app.modules.notifications.services.notifications import notify_ai_generation
    notify_ai_generation(
        username=user['username'],
        title="✨ Módulo Gerado",
        message="O módulo a partir da URL foi gerado com sucesso.",
        url="/admin"
    )

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


@router.get('/students/{username}/analytics')
async def get_student_analytics(
    username: str,
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Retorna o detalhamento de progresso de módulos e tempo de estudo semanal do aluno."""
    return await service.get_student_detail_analytics(username)


@router.get('/students/{username}/certificate')
async def get_student_certificate(
    username: str,
    user=Depends(require_staff)
):
    """Gera o certificado de conclusão de nível do aluno em PDF landscape."""
    from app.core.database import get_client
    from fastapi.responses import FileResponse
    from app.shared.services.pdf_generator import generate_certificate_pdf
    from datetime import datetime
    
    db = get_client()
    res = db.table('users').select('name, level').eq('username', username).execute()
    if not res.data:
        raise HTTPException(404, detail="Student not found")
        
    student_name = res.data[0].get('name') or username
    level = res.data[0].get('level') or 'A1'
    date_str = datetime.now().strftime("%B %d, %Y")
    
    pdf_path = generate_certificate_pdf(student_name, level, date_str)
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Certificate_{username.replace(' ', '_')}_{level}.pdf"
    )


@router.post('/students/{username}/nudge')
async def nudge_student(
    username: str,
    body: StudentNudge,
    service: DashboardService = Depends(),
    user=Depends(require_staff)
) -> dict:
    """Envia mensagem no chat e notificação push de aviso para o estudante."""
    return await service.nudge_student(username, body.message, sender_username=user['username'])



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
    normal_sims = await service.get_all_simulations()

    # Map is_published/is_active
    for sim in normal_sims:
        if 'is_published' not in sim:
            sim['is_published'] = sim.get('is_active', True)

    from app.core.database import get_client
    import logging
    db = get_client()
    try:
        cefr_res = db.table('cefr_simulations').select('*').order('created_at', desc=True).execute()
        cefr_data = cefr_res.data or []
        for sim in cefr_data:
            roles = sim.get('roles') or {}
            student_role = roles.get('student', '')
            ai_role = roles.get('ai', '')
            sys_prompt = f"You are {ai_role}. The user is {student_role}. Goal: {sim.get('goal')}. Scenario: {sim.get('scenario')}"

            normal_sims.append({
                'id': f"cefr_sim_{sim['id']}",
                'name': f"CEFR {sim['level'].upper()}: {sim['topic']}",
                'description': sim.get('scenario') or '',
                'difficulty': sim.get('level') or 'A1',
                'system_prompt': sys_prompt,
                'emoji': '🎭',
                'is_active': sim.get('is_published', False),
                'is_published': sim.get('is_published', False),
                'is_cefr': True,
                'created_at': sim.get('created_at') or ''
            })
    except Exception as e:
        logging.error(f"[DashboardRouter] Erro ao buscar cefr_simulations para admin: {e}")

    normal_sims.sort(key=lambda x: x.get('created_at') or '', reverse=True)
    return normal_sims


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
    background_tasks: BackgroundTasks,
    request: Request,
    service: DashboardService = Depends(),
    db: Client = Depends(get_db),
    user=Depends(require_staff)
):
    """Cria uma nova simulação (manual ou via IA se is_ai_generated)."""
    if data.get('is_ai_generated') or data.get('use_ai_generation'):
        delegate_res = await delegate_to_worker_if_needed(request)
        if delegate_res is not None:
            return delegate_res

        from app.modules.activities.tasks import generate_simulation_task

        topic = data.get('topic') or data.get('name', 'Nova Simulação')
        level = normalize_level(data.get('level') or data.get('difficulty'))
        instructions = data.get('instructions', '')

        task_id = run_task_in_background(
            background_tasks,
            generate_simulation_task,
            topic=topic,
            level=level,
            instructions=instructions,
            username=user['username']
        )
        return {"success": True, "task_id": task_id}

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
    if simulation_id.startswith('cefr_sim_'):
        real_id = simulation_id.replace('cefr_sim_', '')
        update_data = {}
        if 'is_active' in data:
            update_data['is_published'] = data['is_active']
        if 'is_published' in data:
            update_data['is_published'] = data['is_published']
        if 'name' in data:
            import re
            name = data['name']
            name = re.sub(r'^CEFR\s+[A-Z0-9]+:\s*', '', name)
            update_data['topic'] = name
        if 'description' in data:
            update_data['scenario'] = data['description']
        if 'difficulty' in data:
            update_data['level'] = data['difficulty']
        if 'system_prompt' in data:
            update_data['scenario'] = data['system_prompt']

        return db.table('cefr_simulations').update(update_data).eq('id', real_id).execute()

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
    if simulation_id.startswith('cefr_sim_'):
        real_id = simulation_id.replace('cefr_sim_', '')
        return db.table('cefr_simulations').delete().eq('id', real_id).execute()

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
        from app.modules.activities.routes.personalized import PERSONALIZED_MODULE_ID
        res = db.table('modules').select('*').not_.is_(
            'flashcards', 'null').neq(
            'id', PERSONALIZED_MODULE_ID).order(
            'created_at', desc=True).execute()
        data = res.data or []
        for d in data:
            fc = d.get('flashcards')
            d['card_count'] = len(fc) if isinstance(fc, list) else 0
            if 'is_published' not in d:
                d['is_published'] = True

        # Now fetch all cefr_flashcards
        try:
            cefr_res = db.table('cefr_flashcards').select('*').order('created_at', desc=True).execute()
            cefr_data = cefr_res.data or []

            from collections import defaultdict
            import re

            grouped_cf = defaultdict(list)
            for row in cefr_data:
                row_level = row.get('level', 'A1').upper()
                topic = row.get('topic') or 'General Vocabulary'
                grouped_cf[(row_level, topic)].append(row)

            for (lvl, topic), cards in grouped_cf.items():
                topic_slug = re.sub(r'[^a-zA-Z0-9]', '_', topic.lower())
                deck_id = f"cefr_fc_{lvl.lower()}_{topic_slug}"

                # Check if published
                is_pub = all(c.get('is_published', False) for c in cards)

                data.append({
                    'id': deck_id,
                    'title': f"CEFR {lvl}: {topic}",
                    'description': f"Vocabulary deck about {topic}.",
                    'card_count': len(cards),
                    'level': lvl,
                    'is_published': is_pub,
                    'flashcards': [{
                        'front': c.get('front'),
                        'back': c.get('back'),
                        'explanation': c.get('explanation'),
                        'image_url': c.get('image_url')
                    } for c in cards],
                    'is_cefr': True,
                    'created_at': cards[0].get('created_at') or ''
                })
        except Exception as cefr_err:
            import logging
            logging.error(f"[DashboardRouter] Erro ao buscar cefr_flashcards para admin: {cefr_err}")

        # Sort the merged list by created_at desc
        data.sort(key=lambda x: x.get('created_at') or '', reverse=True)
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
        'is_published': data.get('is_published', True)
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
    if deck_id.startswith('cefr_fc_'):
        parts = deck_id.split('_')
        if len(parts) >= 4:
            level = parts[2].upper()
            topic_slug = "_".join(parts[3:])

            res = db.table('cefr_flashcards').select('*').eq('level', level).execute()
            rows = res.data or []

            import re
            matched_rows = []
            for r in rows:
                t = r.get('topic') or 'General Vocabulary'
                t_slug = re.sub(r'[^a-zA-Z0-9]', '_', t.lower())
                if t_slug == topic_slug:
                    matched_rows.append(r)

            if matched_rows:
                matched_ids = [r['id'] for r in matched_rows]
                update_data = {}
                if 'is_published' in data:
                    update_data['is_published'] = data['is_published']
                if 'title' in data:
                    title = data['title']
                    title = re.sub(r'^CEFR\s+[A-Z0-9]+:\s*', '', title)
                    update_data['topic'] = title
                if 'level' in data:
                    update_data['level'] = data['level']

                if update_data:
                    db.table('cefr_flashcards').update(update_data).in_('id', matched_ids).execute()

                if 'flashcards' in data and data['flashcards'] is not None:
                    db.table('cefr_flashcards').delete().in_('id', matched_ids).execute()
                    new_topic = update_data.get('topic', matched_rows[0].get('topic'))
                    new_level = update_data.get('level', level)
                    for c in data['flashcards']:
                        card_payload = {
                            'level': new_level,
                            'topic': new_topic,
                            'front': c.get('front'),
                            'back': c.get('back'),
                            'explanation': c.get('explanation'),
                            'image_url': c.get('image_url'),
                            'is_published': data.get('is_published', matched_rows[0].get('is_published', False))
                        }
                        db.table('cefr_flashcards').insert(card_payload).execute()

                return {"success": True}
        return {"success": False, "error": "Invalid CEFR deck ID format"}

    payload = {
        'title': data.get('title'),
        'description': data.get('description'),
        'level': normalize_level(data.get('level')) if data.get('level') else None,
        'flashcards': data.get('flashcards'),
        'is_published': data.get('is_published')}
    payload = {k: v for k, v in payload.items() if v is not None}

    return db.table('modules').update(
        payload).eq('id', deck_id).execute()


@router.delete('/flashcards/{deck_id}')
async def delete_flashcard_deck(
        deck_id: str,
        service: ActivityService = Depends(),
        db: Client = Depends(get_db),
        user=Depends(require_staff)):
    """Exclui um deck de flashcards usando o ActivityService para tratar dependências."""
    if deck_id.startswith('cefr_fc_'):
        parts = deck_id.split('_')
        if len(parts) >= 4:
            level = parts[2].upper()
            topic_slug = "_".join(parts[3:])

            res = db.table('cefr_flashcards').select('*').eq('level', level).execute()
            rows = res.data or []

            import re
            matched_rows = []
            for r in rows:
                t = r.get('topic') or 'General Vocabulary'
                t_slug = re.sub(r'[^a-zA-Z0-9]', '_', t.lower())
                if t_slug == topic_slug:
                    matched_rows.append(r)

            if matched_rows:
                matched_ids = [r['id'] for r in matched_rows]
                db.table('cefr_flashcards').delete().in_('id', matched_ids).execute()
            return {"success": True}
        return {"success": False, "error": "Invalid CEFR deck ID format"}

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


class WeeklyChallengeModel(BaseModel):
    week: str
    words: list[dict]
    difficulty: str = 'mixed'


@router.post('/challenges')
async def create_or_update_challenge(
    body: WeeklyChallengeModel,
    user: dict = Depends(require_staff)
):
    from app.core.database import get_client
    from datetime import datetime, timezone
    db = get_client()
    data = {
        'week': body.week,
        'words': body.words,
        'difficulty': body.difficulty,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    try:
        res = db.table('weekly_challenges').upsert(data, on_conflict='week').execute()
        return {'success': True, 'data': res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar desafio: {e}")


@router.get('/challenges')
async def list_custom_challenges(
    user: dict = Depends(require_staff)
):
    from app.core.database import get_client
    db = get_client()
    try:
        res = db.table('weekly_challenges').select('*').order('week', descending=True).execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar desafios: {e}")


@router.delete('/challenges/{week}')
async def delete_challenge(
    week: str,
    user: dict = Depends(require_staff)
):
    from app.core.database import get_client
    db = get_client()
    try:
        db.table('weekly_challenges').delete().eq('week', week).execute()
        return {'success': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar desafio: {e}")


@router.get('/reports/sales-by-category')
async def get_sales_by_category(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user=Depends(require_staff)
):
    from app.core.database import get_client
    from datetime import datetime
    db = get_client()
    try:
        query = db.table('orders').select('*').eq('status', 'confirmed')
        orders_res = query.execute()
        orders = orders_res.data or []

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                orders = [o for o in orders if o.get('created_at') and datetime.fromisoformat(o['created_at'].replace('Z', '+00:00')) >= start_dt]
            except Exception:
                pass
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                orders = [o for o in orders if o.get('created_at') and datetime.fromisoformat(o['created_at'].replace('Z', '+00:00')) <= end_dt]
            except Exception:
                pass

        if not orders:
            return []

        order_ids = [o['id'] for o in orders]
        order_map = {o['id']: o for o in orders}

        items_res = db.table('order_items').select('*').in_('order_id', order_ids).execute()
        order_items = items_res.data or []

        content_res = db.table('premium_content').select('id, category, title').execute()
        contents = content_res.data or []
        content_map = {c['id']: c for c in contents}

        sales_by_category = {}
        order_items_map = {}
        for item in order_items:
            oid = item['order_id']
            order_items_map.setdefault(oid, []).append(item)

        for oid, items in order_items_map.items():
            order = order_map.get(oid)
            if not order:
                continue

            mp_discount_per_item = 0.05 / len(items)

            for item in items:
                content_id = item['content_id']
                content_info = content_map.get(content_id) or {}
                category = (content_info.get('category') or 'other').lower()

                price = float(item.get('price') or 0.0)
                net_revenue = max(0.0, price - mp_discount_per_item)

                if category not in sales_by_category:
                    sales_by_category[category] = {
                        'category': category,
                        'total_sales': 0,
                        'gross_revenue': 0.0,
                        'net_revenue': 0.0
                    }

                sales_by_category[category]['total_sales'] += 1
                sales_by_category[category]['gross_revenue'] += price
                sales_by_category[category]['net_revenue'] += net_revenue

        return list(sales_by_category.values())

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório de vendas: {e}")


@router.post('/dispatch-file')
async def dispatch_file(
    files: List[UploadFile] = File(...),
    student_usernames: str = Form(...),  # Comma-separated or JSON list
    user=Depends(require_staff)
):
    """Dispara múltiplos arquivos de estudo por e-mail e push no celular para os alunos selecionados."""
    import json
    import os
    import tempfile
    import shutil
    from app.core.database import get_client
    from app.shared.services.email import EmailSender
    from app.modules.notifications.services.push_notifications import send_push_to_user

    try:
        usernames = json.loads(student_usernames)
        if not isinstance(usernames, list):
            usernames = [str(usernames)]
    except Exception:
        usernames = [u.strip() for u in student_usernames.split(',') if u.strip()]

    if not usernames:
        raise HTTPException(status_code=400, detail="Nenhum aluno selecionado.")

    db = get_client()
    email_sender = EmailSender()
    success_count = 0

    # Busca os detalhes de e-mail e perfil dos alunos
    res = db.table('users').select('username, email, profile').in_('username', usernames).execute()
    students = res.data or []

    # Salva todos os arquivos temporariamente no servidor e envia ao Supabase Storage
    temp_dir = tempfile.gettempdir()
    saved_paths = []
    file_names = []
    storage_urls = []

    try:
        from app.modules.cefr.routes.admin import sanitize_filename
        
        # Garante que o bucket público do Supabase exista
        bucket_name = "study-materials"
        try:
            db.storage.create_bucket(bucket_name, options={"public": True})
        except Exception:
            pass

        for f in files:
            temp_path = os.path.join(temp_dir, f.filename)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            saved_paths.append(temp_path)
            
            # Sanitiza nome do arquivo para o Supabase
            safe_fname = sanitize_filename(f.filename)
            file_names.append(safe_fname)
            
            # Fazer upload para o Supabase Storage
            try:
                with open(temp_path, "rb") as f_bytes:
                    db.storage.from_(bucket_name).upload(
                        path=safe_fname,
                        file=f_bytes.read(),
                        file_options={"cache-control": "3600", "upsert": "true"}
                    )
                url_storage = db.storage.from_(bucket_name).get_public_url(safe_fname)
                storage_urls.append(url_storage if url_storage else "")
            except Exception as st_err:
                import logging
                logging.exception(f"Erro ao subir arquivo {f.filename} para o Supabase Storage: {st_err}")
                storage_urls.append("")

        from datetime import datetime, timezone

        for student in students:
            email = student.get('email')
            username = student.get('username')
            profile = student.get('profile') or {}
            name = profile.get('name') or username

            # Salva no histórico de materiais de estudo do aluno no profile
            study_mats = profile.get("study_materials") or []
            if not isinstance(study_mats, list):
                study_mats = []
                
            for fname, furl in zip(file_names, storage_urls):
                if furl:
                    study_mats.append({
                        "filename": fname,
                        "url": furl,
                        "date_received": datetime.now(timezone.utc).isoformat()
                    })
            
            profile["study_materials"] = study_mats
            try:
                db.table('users').update({'profile': profile}).eq('username', username).execute()
            except Exception as pe_err:
                import logging
                logging.error(f"[Dispatch] Erro ao atualizar profile para {username}: {pe_err}")

            email_sent = False
            if email:
                try:
                    email_sent = email_sender.send_dispatched_files_email(
                        to_email=email,
                        name=name,
                        file_names=file_names,
                        file_paths=saved_paths
                    )
                except Exception as e:
                    import logging
                    logging.exception(f"Error sending dispatched files email to {email}: {e}")
                    email_sent = False

            if not email_sent:
                import logging
                logging.warning(f"Email dispatch failed or was skipped for {username} ({email}), proceeding with push notification.")

            # Always increment success count and trigger push notification
            success_count += 1
            files_str = ", ".join(file_names)
            
            # Cria notificação no banco de dados para aparecer no topo da tela do aluno
            try:
                from app.modules.notifications.services.notifications import create_notification
                create_notification(
                    username=username,
                    category='nudge',
                    title="Novo Material de Estudo! 📚",
                    message=f"Teacher Tati te enviou o(s) material(is) '{files_str}'. Acesse a aba de materiais ou seu e-mail para baixar!",
                    send_push=False
                )
            except Exception as ne:
                import logging
                logging.exception(f"Failed to create notification for file dispatch: {ne}")

            try:
                send_push_to_user(
                    username=username,
                    title="Novo Material de Estudo! 📚",
                    body=f"Teacher Tati te enviou o(s) material(is) '{files_str}'. Acesse no app!",
                    url="/chat"
                )
            except Exception as e:
                import logging
                logging.exception(f"Failed to send push notification to user {username}: {e}")

            # Envia via WhatsApp (se habilitado) enviando os arquivos reais!
            try:
                from app.modules.notifications.services.waha_service import WahaService
                for fname, furl in zip(file_names, storage_urls):
                    if furl:
                        title = f"Material de Estudo: {fname} 📚"
                        caption = f"Hi {name}! Here is the study material '{fname}' sent by Teacher Tati."
                        await WahaService.send_file(
                            recipient_username=username,
                            file_url=furl,
                            filename=fname,
                            caption=caption,
                            sender_username=user['username'],
                            db=db
                        )
                    else:
                        title = "Novo Material de Estudo! 📚"
                        body = f"Teacher Tati te enviou o(s) material(is) '{fname}'. O arquivo foi enviado ao seu e-mail!"
                        whatsapp_text = f"*{title}*\n\n{body}\n\nAccess in the app: https://tati-ai.vercel.app/chat"
                        await WahaService.send_message(
                            recipient_username=username,
                            text=whatsapp_text,
                            sender_username=user['username'],
                            db=db
                        )
            except Exception as we:
                import logging
                logging.warning(f"Failed to send WhatsApp notification to user {username}: {we}")
    finally:
        # Garante a limpeza de todos os arquivos temporários
        for temp_path in saved_paths:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    return {"success": True, "dispatched_to": success_count}


@router.post('/dispatch-quiz')
async def dispatch_quiz(
    body: DispatchQuizRequest,
    user=Depends(require_staff)
):
    """Dispara uma notificação de e-mail e push celular alertando sobre um quiz pendente para os alunos selecionados."""
    from app.core.database import get_client
    from app.shared.services.email import EmailSender
    from app.modules.notifications.services.push_notifications import send_push_to_user

    if not body.student_usernames:
        raise HTTPException(status_code=400, detail="Nenhum aluno selecionado.")

    db = get_client()

    # Busca o título do quiz para a mensagem
    quiz_res = db.table('quizzes').select('title').eq('id', body.quiz_id).limit(1).execute()
    if not quiz_res.data:
        raise HTTPException(status_code=404, detail="Quiz não encontrado.")
    quiz_title = quiz_res.data[0].get('title') or "Novo Quiz"

    # Busca os detalhes de e-mail e perfil dos alunos
    res = db.table('users').select('username, email, profile').in_('username', body.student_usernames).execute()
    students = res.data or []

    email_sender = EmailSender()
    success_count = 0

    for student in students:
        email = student.get('email')
        username = student.get('username')
        profile = student.get('profile') or {}
        name = profile.get('name') or username

        email_sent = False
        if email:
            try:
                email_sent = email_sender.send_dispatched_quiz_email(
                    to_email=email,
                    name=name,
                    quiz_title=quiz_title
                )
            except Exception as e:
                import logging
                logging.exception(f"Error sending dispatched quiz email to {email}: {e}")
                email_sent = False

        if not email_sent:
            import logging
            logging.warning(f"Email dispatch failed or was skipped for quiz to {username} ({email}), proceeding with push notification.")

        # Always increment success count and trigger push notification
        success_count += 1
        
        # Cria notificação no banco de dados para aparecer no topo da tela do aluno
        try:
            from app.modules.notifications.services.notifications import create_notification
            create_notification(
                username=username,
                category='nudge',
                title="Novo Quiz Disponível! 📝",
                message=f"Teacher Tati liberou o quiz '{quiz_title}' para você. Acesse suas atividades!",
                send_push=False
            )
        except Exception as ne:
            import logging
            logging.exception(f"Failed to create notification for quiz dispatch: {ne}")

        try:
            send_push_to_user(
                username=username,
                title="Novo Quiz Disponível! 📝",
                body=f"Teacher Tati liberou o quiz '{quiz_title}' para você. Acesse suas atividades!",
                url="/activities"
            )
        except Exception as e:
            import logging
            logging.exception(f"Failed to send push notification to user {username}: {e}")

        # Envia via WhatsApp (se habilitado)
        try:
            from app.modules.notifications.services.waha_service import WahaService
            title = "Novo Quiz Disponível! 📝"
            body = f"Teacher Tati liberou o quiz '{quiz_title}' para você. Acesse suas atividades!"
            whatsapp_text = f"*{title}*\n\n{body}\n\nAccess in the app: https://tati-ai.vercel.app/activities"
            await WahaService.send_message(
                recipient_username=username,
                text=whatsapp_text,
                sender_username=user['username'],
                db=db
            )
        except Exception as we:
            import logging
            logging.warning(f"Failed to send WhatsApp notification to user {username}: {we}")

    return {"success": True, "dispatched_to": success_count}


@router.get('/quizzes')
async def get_quizzes_admin(
    user=Depends(require_staff)
):
    """Lista todos os quizzes cadastrados no sistema."""
    from app.core.database import get_client
    db = get_client()
    try:
        res = db.table('quizzes').select('id, title, modules(level)').execute()
        quizzes = []
        for q in (res.data or []):
            module = q.get('modules') or {}
            quizzes.append({
                "id": q.get("id"),
                "title": q.get("title"),
                "level": module.get("level") if module else None
            })
        return quizzes
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar quizzes: {e}")


@router.post('/generate-quiz-ai')
async def generate_quiz_ai(
    body: GenerateQuizAIRequest,
    user=Depends(require_staff)
):
    """Gera um quiz pedagógico via IA (Groq) com base em um tema, nível e número de questões."""
    from app.modules.chat.services.llm import groq_chat_json
    from app.core.database import get_client

    db = get_client()

    # Prompt de geração do Quiz
    prompt = (
        f"You are an expert English teacher. Generate a high-quality pedagogical quiz about the topic: '{body.topic}' "
        f"for an English learner at CEFR level: '{body.level}'.\n"
        f"Number of questions to generate: {body.num_questions}.\n"
        "All questions and options must be in English. The quiz should test grammatical accuracy, reading comprehension, or vocabulary related to the topic.\n\n"
        "STRICT RULES:\n"
        "1. Do NOT include question numbers or prefix the question text (e.g., write 'What is...' instead of '1. What is...').\n"
        "2. Do NOT use labels like 'A)', 'B)', 'a)', 'b)' in the options (e.g., write 'apple' instead of 'A) apple').\n"
        "3. Provide exactly 4 options per question.\n"
        "4. Set 'correct_index' as a 0-indexed integer (0, 1, 2, or 3) indicating which option is correct.\n"
        "5. Write a helpful explanation in English for the correct answer.\n"
        "6. Return ONLY a valid JSON object matching the schema below. Do not include markdown codeblocks like ```json.\n\n"
        "JSON SCHEMA:\n"
        "{\n"
        '  "title": "A short engaging title for the quiz",\n'
        '  "description": "A brief description explaining what this quiz covers",\n'
        '  "exercises": [\n'
        '    {\n'
        '      "question": "The question text",\n'
        '      "options": ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"],\n'
        '      "correct_index": 0,\n'
        '      "explanation": "Explanation why this is correct."\n'
        '    }\n'
        '  ]\n'
        "}"
    )

    try:
        data = await groq_chat_json(
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=2000,
            temperature=0.3,
        )

        if not data or 'exercises' not in data or not data['exercises']:
            raise HTTPException(
                status_code=500,
                detail="Erro ao gerar questões via IA: a resposta do LLM está vazia ou mal formatada."
            )

        quiz_title = data.get('title') or f"{body.topic} Quiz"
        quiz_description = data.get('description') or f"AI-generated quiz about {body.topic} at level {body.level}."

        PERSONALIZED_MODULE_ID = "00000000-0000-0000-0000-000000000001"

        quiz_res = db.table('quizzes').insert({
            'module_id': PERSONALIZED_MODULE_ID,
            'title': quiz_title,
            'description': quiz_description,
        }).execute()

        if not quiz_res.data:
            raise HTTPException(status_code=500, detail="Erro ao inserir o quiz no banco de dados.")

        quiz_id = quiz_res.data[0]['id']

        # Insere as questões na tabela quiz_questions
        for i, q in enumerate(data.get('exercises', [])):
            options = q.get('options', [])
            if not options or len(options) < 2:
                continue

            correct_index = q.get('correct_index', 0)
            if not (0 <= correct_index < len(options)):
                correct_index = 0

            db.table('quiz_questions').insert({
                'quiz_id': quiz_id,
                'question': q.get('question', 'Question'),
                'options': options,
                'correct_index': correct_index,
                'explanation': q.get('explanation', ''),
                'order': i
            }).execute()

        return {"success": True, "quiz_id": quiz_id, "title": quiz_title}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Erro no processamento da IA ou inserção no banco: {e}"
        )


@router.get('/celery/health')
async def check_celery_health(user=Depends(require_staff)):
    """Verifica a saúde do Celery, retornando workers ativos, agendamentos e status da fila."""
    from app.core.celery_app import celery_app
    import logging
    import os

    try:
        inspect = celery_app.control.inspect(timeout=1.0)
        active_workers = None
        ping_res = None
        registered_tasks = None

        if inspect:
            active_workers = inspect.active()
            ping_res = inspect.ping()
            registered_tasks = inspect.registered()

        workers_status = []
        if ping_res:
            for worker, status in ping_res.items():
                active_count = len(active_workers.get(worker, [])) if active_workers else 0
                tasks = registered_tasks.get(worker, []) if registered_tasks else []
                workers_status.append({
                    "worker": worker,
                    "status": "online" if status == {"ok": "pong"} else "offline",
                    "active_tasks": active_count,
                    "registered_tasks_count": len(tasks)
                })

        if not workers_status:
            from app.core.celery_app import USE_CELERY
            workers_status.append({
                "worker": "celery_main_worker",
                "status": "offline",
                "active_tasks": 0,
                "registered_tasks_count": 0,
                "msg": f"Nenhum worker respondendo. USE_CELERY={USE_CELERY}"
            })

        return {
            "status": "healthy" if any(w["status"] == "online" for w in workers_status) else "unhealthy",
            "use_celery": os.getenv("USE_CELERY", "false").lower() == "true",
            "workers": workers_status
        }
    except Exception as e:
        logging.error(f"Erro ao inspecionar Celery: {e}")
        return {
            "status": "error",
            "error": str(e),
            "workers": []
        }


@router.get('/waha/sessions')
async def get_waha_sessions(user=Depends(require_staff)):
    """Returns all WAHA sessions and their status."""
    from app.modules.notifications.services.waha_service import WahaService
    return await WahaService.get_sessions()


@router.post('/waha/session/start')
async def start_waha_session(user=Depends(require_staff)):
    """Starts the WAHA session for the logged-in user (e.g. 'professor' or 'programador')."""
    from app.modules.notifications.services.waha_service import WahaService
    session_name = user['username']
    return await WahaService.start_session(session_name)


@router.post('/waha/session/stop')
async def stop_waha_session(user=Depends(require_staff)):
    """Stops the WAHA session for the logged-in user."""
    from app.modules.notifications.services.waha_service import WahaService
    session_name = user['username']
    return await WahaService.stop_session(session_name)


@router.get('/waha/session/qr')
async def get_waha_session_qr(session: Optional[str] = None, user=Depends(require_staff)):
    """Proxy to return the session QR code as an image."""
    from app.modules.notifications.services.waha_service import WahaService
    from fastapi import Response
    
    session_name = session or user['username']
    image_bytes = await WahaService.get_qr_code_image(session_name)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="QR code not available or session is already connected.")
        
    return Response(content=image_bytes, media_type="image/png")


@router.get('/waha/session/screenshot')
async def get_waha_session_screenshot(session: Optional[str] = None, user=Depends(require_staff)):
    """Proxy para retornar o screenshot atual da sessão do WhatsApp Web."""
    from app.modules.notifications.services.waha_service import WahaService
    from fastapi import Response
    
    session_name = session or user['username']
    image_bytes = await WahaService.get_screenshot_image(session_name)
    if not image_bytes:
        raise HTTPException(status_code=404, detail="Screenshot not available.")
        
    return Response(content=image_bytes, media_type="image/png")


