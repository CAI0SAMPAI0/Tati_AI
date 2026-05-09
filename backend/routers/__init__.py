"""
routers — Registro centralizado de todos os routers da aplicação.

Organização por domínio:
    auth        → Login, registro, OAuth, recuperação de senha
    admin       → Dashboard, gestão de alunos, simulações (staff-only)
    users       → Perfil, permissões, streaks, progresso, vocabulário, metas, XP
    activities  → Módulos, quizzes, podcasts, troféus, submissions, ranking
    ai          → Chat (WebSocket), avatar
    payments    → Asaas (assinatura, webhook, planos)
    simulation  → Cenários de roleplay
    notifications → Push, listagem, leitura
    validation  → Documentos, geolocalização
    feedback    → Bug reports e sugestões dos alunos
    challenges  → Challenge semanal de pronúncia
"""

from fastapi import FastAPI


def register_all_routers(app: FastAPI) -> None:
    """Registra todos os routers na aplicação FastAPI.

    Mantém as URLs exatamente como o frontend espera — nenhuma
    rota pública é alterada.
    """
    # ── Auth ──────────────────────────────────────────────────
    from routers.auth import router as auth_router

    app.include_router(auth_router, prefix='/auth', tags=['auth'])

    # ── Users ─────────────────────────────────────────────────
    from routers.users.profile import router as profile_router
    from routers.users.permissions import router as permissions_router
    from routers.users.streaks import router as streaks_router
    from routers.users.progress import router as progress_router
    from routers.users.vocabulary import router as vocab_router
    from routers.users.goals import router as goals_router
    from routers.users.xp import router as xp_router
    from routers.users.onboarding import router as onboarding_router
    from routers.users.daily_summary import router as daily_summary_router

    app.include_router(profile_router, prefix='/profile', tags=['users'])
    app.include_router(
        permissions_router,
        prefix='/users/permissions',
        tags=['users'],
    )
    app.include_router(streaks_router, prefix='/users/streaks', tags=['users'])
    app.include_router(streaks_router, prefix='/users/streak', tags=['users'])
    app.include_router(progress_router, prefix='/users/progress', tags=['users'])
    from routers.activities.vocabulary import router as vocabulary_router
    app.include_router(vocabulary_router, prefix='/users/vocabulary', tags=['users'])
    app.include_router(goals_router, prefix='/users/goals', tags=['users'])
    app.include_router(xp_router, prefix='/users/xp', tags=['users'])
    app.include_router(onboarding_router, prefix='/users/onboarding', tags=['users'])
    app.include_router(daily_summary_router, prefix='/users/summary', tags=['users'])
    app.include_router(progress_router, prefix='/users', tags=['users']) # Fallback para /users/weekly-plan

    # ── Admin ─────────────────────────────────────────────────
    from routers.admin.dashboard import router as dashboard_router
    from routers.admin.premium import router as admin_premium_router

    app.include_router(dashboard_router, prefix='/dashboard', tags=['admin'])
    app.include_router(
        admin_premium_router, prefix='/admin/premium', tags=['admin']
    )

    # ── AI ────────────────────────────────────────────────────
    from routers.ai.chat import router as chat_router
    from routers.ai.avatar import router as avatar_router

    app.include_router(chat_router, prefix='/chat', tags=['ai'])
    app.include_router(chat_router, prefix='/voice', tags=['ai'])
    app.include_router(avatar_router, prefix='/avatar', tags=['ai'])

    # ── Challenges ────────────────────────────────────────────
    from routers.challenges import router as challenges_router

    app.include_router(challenges_router, tags=['challenges'])

    # ── Simulation ────────────────────────────────────────────
    from routers.simulation import router as simulation_router

    app.include_router(simulation_router, tags=['simulation'])

    # ── Feedback ──────────────────────────────────────────────
    from routers.feedback import router as feedback_router

    app.include_router(feedback_router, tags=['feedback'])

    # ── Activities ────────────────────────────────────────────
    from routers.activities.modules import router as modules_router
    from routers.activities.quizzes import router as quizzes_router
    from routers.activities.podcasts import router as podcasts_router
    from routers.activities.trophies import router as trophies_router
    from routers.activities.submissions import router as submissions_router
    from routers.activities.ranking import router as ranking_router
    from routers.activities.flashcards import router as flashcards_router
    from routers.activities.achievements import router as achievements_router
    from routers.activities.premium import router as student_premium_router

    app.include_router(
        modules_router,
        prefix='/activities/modules',
        tags=['activities'],
    )
    app.include_router(
        quizzes_router,
        prefix='/activities/quizzes',
        tags=['activities'],
    )
    app.include_router(
        podcasts_router,
        prefix='/activities/podcasts',
        tags=['activities'],
    )
    app.include_router(
        trophies_router, prefix='/users/trophies', tags=['trophies']
    )
    app.include_router(
        submissions_router,
        prefix='/activities/submissions',
        tags=['activities'],
    )
    app.include_router(
        ranking_router,
        prefix='/activities/ranking',
        tags=['activities'],
    )
    app.include_router(
        flashcards_router,
        prefix='/activities/flashcards',
        tags=['activities'],
    )
    app.include_router(
        achievements_router,
        prefix='/activities/achievements',
        tags=['activities'],
    )
    app.include_router(
        student_premium_router,
        prefix='/activities/premium',
        tags=['activities'],
    )

    # ── Payments ──────────────────────────────────────────────
    from routers.payments import asaas_router as payments_router

    app.include_router(payments_router, prefix='/payments', tags=['payments'])

    # ── Notifications ─────────────────────────────────────────
    from routers.notifications import router as notifications_router

    app.include_router(
        notifications_router,
        prefix='/notifications',
        tags=['notifications'],
    )

    # ── Validation ────────────────────────────────────────────
    from routers.validation import router as validation_router

    app.include_router(
        validation_router,
        prefix='/validation',
        tags=['validation'],
    )

    # ── Bootstrap (Performance) ───────────────────────────────
    from routers.users.bootstrap import router as bootstrap_router

    app.include_router(bootstrap_router, prefix='/users', tags=['users'])
