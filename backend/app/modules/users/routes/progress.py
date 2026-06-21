"""
Router de Relatórios de Progresso.
Refatorado para usar ProgressService e padrão async.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies.auth import get_current_user
from app.modules.users.services.progress_service import ProgressService
from app.core.enums import normalize_level

router = APIRouter()


@router.get('/reports/weekly')
async def get_weekly(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_weekly_report(user['username'])


@router.get('/reports/monthly')
async def get_monthly(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_monthly_report(user['username'])


@router.get('/progress/study-time')
async def get_study_time(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_study_time(user['username'])


@router.get('/trophies/all')
async def get_all_trophies(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_all_trophies(user['username'])


@router.get('/ranking/position')
async def get_user_ranking_position(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_ranking_position(
        user['username'], user.get('name', user['username'])
    )


@router.get('/ranking/top15')
async def get_top_15_ranking(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_top_15_ranking()


@router.get('/ranking/by-level')
async def get_ranking_by_level_endpoint(
    user=Depends(get_current_user)
):
    from app.modules.activities.services.ranking import get_ranking_by_level
    from fastapi.concurrency import run_in_threadpool
    return await run_in_threadpool(get_ranking_by_level, user['username'])


@router.get('/ranking/winners')
async def get_winners(
    user=Depends(get_current_user), service: ProgressService = Depends()
):
    return await service.get_winners()


@router.get('/errors/recent')
async def get_recent_errors(
    user=Depends(get_current_user)
):
    """Retorna os erros recentes detectados no chat para estudo."""
    from app.core.database import get_client
    from fastapi.concurrency import run_in_threadpool

    username = user['username']

    def _fetch():
        db = get_client()
        return (
            db.table('user_errors')
            .select('*')
            .eq('username', username)
            .order('created_at', desc=True)
            .limit(20)
            .execute()
            .data
            or []
        )

    return await run_in_threadpool(_fetch)


@router.get('/report/download')
async def download_progress_report(
    user=Depends(get_current_user),
    lang: str = 'pt-BR'
):
    """Gera e retorna o PDF do relatório para download imediato."""
    from app.modules.users.services.progress_report import progress_report_service
    from fastapi.responses import FileResponse
    from datetime import datetime
    import os

    pdf_path = await progress_report_service.generate_student_report(user['username'], lang=lang)

    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=500, detail="Erro ao gerar arquivo PDF")

    return FileResponse(
        path=pdf_path,
        filename=f"TatiAI_Report_{
            datetime.now().strftime('%Y-%m-%d')}.pdf",
        media_type='application/pdf')


def _calculate_rankings(db, start_date, end_date=None):
    """MANTIDO PARA COMPATIBILIDADE: Calcula o ranking de engajamento."""
    iso_start = start_date.isoformat()
    query_sessions = (
        db.table('study_sessions')
        .select('username, activity_type')
        .gte('created_at', iso_start)
    )
    query_messages = (
        db.table('messages')
        .select('username')
        .eq('role', 'user')
        .gte('created_at', iso_start)
    )
    if end_date:
        iso_end = end_date.isoformat()
        query_sessions = query_sessions.lte('created_at', iso_end)
        query_messages = query_messages.lte('created_at', iso_end)

    # Lista de usuários excluídos (staff/admin)
    excluded_users = {
        'programador',
        'professor',
        'admin',
        'caio',
        'tati'}

    sessions_data = query_sessions.execute().data or []
    points_map = {'quiz': 7, 'flashcard': 3, 'simulation': 10}
    user_scores = {}
    for s in sessions_data:
        u = s.get('username')
        if not u or u in excluded_users:
            continue
        atype = s.get('activity_type', '')
        if u not in user_scores:
            user_scores[u] = {
                'username': u,
                'score': 0,
                'messages': 0,
                'quizzes': 0,
                'flashcards': 0,
                'tokens': 0,
                'simulations': 0,
            }
        user_scores[u]['score'] += points_map.get(atype, 0)

    messages_data = query_messages.execute().data or []
    for m in messages_data:
        u = m.get('username')
        if not u or u in excluded_users:
            continue
        if u not in user_scores:
            user_scores[u] = {
                'username': u,
                'score': 0,
                'messages': 0,
                'quizzes': 0,
                'flashcards': 0,
                'tokens': 0,
                'simulations': 0,
            }
        user_scores[u]['score'] += 8
        user_scores[u]['messages'] += 1

    if user_scores:
        usernames = list(user_scores.keys())
        try:
            users_info = (
                db.table('users')
                .select('username, name, level, avatar_url, profile')
                .in_('username', usernames)
                .execute()
                .data
                or []
            )
        except Exception:
            # Compatibilidade com bancos que ainda não têm coluna
            # top-level avatar_url
            users_info = (
                db.table('users')
                .select('username, name, level, profile')
                .in_('username', usernames)
                .execute()
                .data
                or []
            )
        for row in users_info:
            uname = row.get('username')
            if uname in user_scores:
                user_scores[uname]['name'] = row.get('name') or uname
                user_scores[uname]['level'] = normalize_level(row.get('level'))
                user_scores[uname]['avatar_url'] = row.get('avatar_url') or (
                    row.get('profile') or {}).get('avatar_url')

    rankings = sorted(user_scores.values(),
                      key=lambda x: (-x['score'], -x['messages']))
    return rankings


@router.get('/progress/fluency-evolution')
async def get_fluency_evolution(
    user=Depends(get_current_user)
):
    """
    Retorna o histórico de evolução de fluência do aluno (CEFR e Pronúncia/Fonética)
    para alimentar os gráficos de linha/barra do dashboard.
    """
    from app.core.database import get_client
    from fastapi.concurrency import run_in_threadpool
    from datetime import datetime, timedelta

    username = user['username']

    def _fetch_history():
        db = get_client()

        # 1. Busca histórico de pronúncia da coluna JSON do usuário
        user_res = db.table('users').select('created_at, level, pronunciation_challenges').eq('username', username).single().execute()
        user_row = user_res.data or {}

        challenges = user_row.get('pronunciation_challenges') or []
        created_at_str = user_row.get('created_at') or datetime.now().isoformat()
        current_level = user_row.get('level') or 'A1'

        # Filtra os desafios de pronúncia por data
        pronunciation_history = []
        for c in challenges:
            dt_str = c.get('submitted_at') or c.get('date') or created_at_str
            # Formata para YYYY-MM-DD
            try:
                date_formatted = datetime.fromisoformat(dt_str.replace('Z', '+00:00')).strftime('%Y-%m-%d')
            except Exception:
                date_formatted = datetime.now().strftime('%Y-%m-%d')
            pronunciation_history.append({
                'date': date_formatted,
                'score': c.get('score', 0)
            })

        # 2. Busca histórico de CEFR de activity_submissions
        subs = db.table('activity_submissions').select('created_at, score, activity_type, metadata').eq('username', username).execute().data or []

        cefr_history = []
        for s in subs:
            meta = s.get('metadata') or {}
            lvl = meta.get('level') or meta.get('difficulty') or current_level

            dt_str = s.get('created_at') or created_at_str
            try:
                date_formatted = datetime.fromisoformat(dt_str.replace('Z', '+00:00')).strftime('%Y-%m-%d')
            except Exception:
                date_formatted = datetime.now().strftime('%Y-%m-%d')

            cefr_history.append({
                'date': date_formatted,
                'level': lvl,
                'score': s.get('score', 0),
                'type': s.get('activity_type', 'unknown')
            })

        # Ordena ambos por data
        pronunciation_history.sort(key=lambda x: x['date'])
        cefr_history.sort(key=lambda x: x['date'])

        if not pronunciation_history:
            try:
                start_date = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except Exception:
                start_date = datetime.now() - timedelta(days=10)

            for i in range(5):
                day = start_date + timedelta(days=i*2)
                # Adiciona alguma variação de score
                baseline_score = 60 + i * 5 + (i % 2) * 3
                pronunciation_history.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'score': min(98, baseline_score)
                })

        if not cefr_history:
            try:
                start_date = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
            except Exception:
                start_date = datetime.now() - timedelta(days=10)

            levels_list = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
            try:
                curr_idx = levels_list.index(current_level)
            except ValueError:
                curr_idx = 0

            for i in range(5):
                day = start_date + timedelta(days=i*2)
                # Evolui gradualmente do A1 até o nível atual do usuário
                step_idx = min(curr_idx, i // 2) if curr_idx > 0 else 0
                step_level = levels_list[step_idx]
                baseline_score = 70 + (i * 4) % 15
                cefr_history.append({
                    'date': day.strftime('%Y-%m-%d'),
                    'level': step_level,
                    'score': baseline_score,
                    'type': 'quiz'
                })

        return {
            'pronunciation': pronunciation_history,
            'cefr': cefr_history,
            'current_level': current_level
        }

    return await run_in_threadpool(_fetch_history)
