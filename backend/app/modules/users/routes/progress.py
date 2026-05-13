"""
Router de Relatórios de Progresso.
Refatorado para usar ProgressService e padrão async.
"""

from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies.auth import get_current_user
from app.modules.users.services.progress_service import ProgressService

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
        raise HTTPException(status_code=500, detail="Erro ao gerar arquivo PDF")

    return FileResponse(
        path=pdf_path,
        filename=f"TatiAI_Report_{datetime.now().strftime('%Y-%m-%d')}.pdf",
        media_type='application/pdf'
    )


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
    excluded_users = {'programador', 'professor', 'admin', 'caio', 'tati'}

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
            # Compatibilidade com bancos que ainda não têm coluna top-level avatar_url
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
                user_scores[uname]['level'] = row.get('level') or 'Beginner'
                user_scores[uname]['avatar_url'] = row.get('avatar_url') or (row.get('profile') or {}).get('avatar_url')
                
    rankings = sorted(user_scores.values(), key=lambda x: (-x['score'], -x['messages']))
    return rankings
