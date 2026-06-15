from fastapi import FastAPI


def register_all_routers(app: FastAPI) -> None:
    """Registra todos os app.routers_init na aplicação FastAPI.

    Mantém as URLs exatamente como o frontend espera — nenhuma
    rota pública é alterada.
    """
    # ── Auth ──────────────────────────────────────────────────
    from app.modules.auth.routes.auth import router as auth_router

    app.include_router(auth_router, prefix='/auth', tags=['auth'])

    # ── Users ─────────────────────────────────────────────────
    from app.modules.users.routes.profile import router as profile_router
    from app.modules.users.routes.permissions import router as permissions_router
    from app.modules.users.routes.streaks import router as streaks_router
    from app.modules.users.routes.progress import router as progress_router
    from app.modules.users.routes.vocabulary import router as vocab_router
    from app.modules.users.routes.goals import router as goals_router
    from app.modules.users.routes.xp import router as xp_router
    from app.modules.users.routes.onboarding import router as onboarding_router
    from app.modules.users.routes.daily_summary import router as daily_summary_router
    from app.modules.activities.routes.weekly_plan import router as weekly_plan_router

    app.include_router(
        profile_router,
        prefix='/profile',
        tags=['users'])
    app.include_router(
        permissions_router,
        prefix='/users/permissions',
        tags=['users'],
    )
    app.include_router(
        streaks_router,
        prefix='/users/streaks',
        tags=['users'])
    app.include_router(
        streaks_router,
        prefix='/users/streak',
        tags=['users'])
    app.include_router(
        progress_router, prefix='/users/progress', tags=['users'])
    from app.modules.activities.routes.vocabulary import router as vocabulary_router
    app.include_router(vocabulary_router,
                       prefix='/users/vocabulary', tags=['users'])
    app.include_router(
        goals_router,
        prefix='/users/goals',
        tags=['users'])
    app.include_router(xp_router, prefix='/users/xp', tags=['users'])
    app.include_router(onboarding_router,
                       prefix='/users/onboarding', tags=['users'])

    # Esses dois app.routers_init já definem caminhos absolutos internamente.
    # Portanto, não usar prefix aqui para evitar duplicação de path.
    app.include_router(daily_summary_router, tags=['users'])
    app.include_router(weekly_plan_router, tags=['users'])

    # ── Admin ─────────────────────────────────────────────────
    from app.modules.admin.routes.dashboard import router as dashboard_router
    from app.modules.admin.routes.tasks import router as tasks_router
    from app.modules.admin.routes.premium import router as admin_premium_router

    app.include_router(
        dashboard_router,
        prefix='/dashboard',
        tags=['admin'])
    
    app.include_router(
        tasks_router,
        tags=['admin'],
    )
    
    app.include_router(
        admin_premium_router, prefix='/admin/premium', tags=['admin']
    )

    # CEFR Admin Router
    from app.modules.cefr.routes.admin import router as cefr_admin_router
    app.include_router(cefr_admin_router, tags=['admin'])

    # ── AI ────────────────────────────────────────────────────
    from app.modules.chat.routes.chat import router as chat_router
    from app.modules.simulation.routes.avatar import router as avatar_router

    app.include_router(chat_router, prefix='/chat', tags=['ai'])
    app.include_router(chat_router, prefix='/voice', tags=['ai'])
    app.include_router(avatar_router, prefix='/avatar', tags=['ai'])

    # ── Challenges ────────────────────────────────────────────
    from app.modules.activities.routes.challenges import router as challenges_router

    app.include_router(challenges_router, tags=['challenges'])

    # ── Simulation ────────────────────────────────────────────
    from app.modules.simulation.routes.simulation import router as simulation_router

    app.include_router(simulation_router, tags=['simulation'])

    # ── Feedback ──────────────────────────────────────────────
    from app.shared.routes.feedback import router as feedback_router

    app.include_router(feedback_router, tags=['feedback'])

    # ── Activities ────────────────────────────────────────────
    from app.modules.activities.routes.modules import router as modules_router
    from app.modules.activities.routes.quizzes import router as quizzes_router
    from app.modules.activities.routes.podcasts import router as podcasts_router
    from app.modules.activities.routes.trophies import router as trophies_router
    from app.modules.activities.routes.submissions import router as submissions_router
    from app.modules.activities.routes.ranking import router as ranking_router
    from app.modules.activities.routes.flashcards import router as flashcards_router
    from app.modules.activities.routes.achievements import router as achievements_router
    from app.modules.activities.routes.premium import router as student_premium_router
    from app.modules.activities.routes.assets import router as assets_router

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
        flashcards_router,
        prefix='/activities/flashcards',
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
        assets_router,
        prefix='/flashcard-assets',
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
    # ── Personalized Activities (AI generated) ──────────
    from app.modules.activities.routes.personalized import router as personalized_router
    from app.modules.activities.routes.hub import router as hub_router

    app.include_router(
        personalized_router,
        prefix='/admin/modules',
        tags=['activities'],
    )
    app.include_router(
        hub_router,
        prefix='/activities/hub',
        tags=['activities'],
    )



    # ── Payments ──────────────────────────────────────────────
    from app.modules.payments.routes.mercadopago import router as mp_payments_router

    app.include_router(
        mp_payments_router,
        prefix='/payments',
        tags=['payments'])

    # ── Notifications ─────────────────────────────────────────
    from app.modules.notifications.routes.notifications import router as notifications_router

    app.include_router(
        notifications_router,
        prefix='/notifications',
        tags=['notifications'],
    )

    # ── Validation ────────────────────────────────────────────
    from app.shared.routes.validation import router as validation_router

    app.include_router(
        validation_router,
        prefix='/validation',
        tags=['validation'],
    )

    # ── Bootstrap (Performance) ───────────────────────────────
    from app.modules.users.routes.bootstrap import router as bootstrap_router

    app.include_router(
        bootstrap_router,
        prefix='/users',
        tags=['users'])

    # ── Public ──────────────────────────────────────────────
    from app.modules.activities.routes.public import router as public_router

    app.include_router(
        public_router,
        prefix='/catalog',
        tags=['public'])

    # --- Tasks (Celery Polling) ---
    from app.routers.tasks import router as tasks_router

    app.include_router(
        tasks_router,
        prefix='/tasks',
        tags=['tasks'])
