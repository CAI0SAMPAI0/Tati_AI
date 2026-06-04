from app.core.celery_app import celery_app


@celery_app.task(name="app.modules.cefr.tasks.cefr_weekly_gen")
def cefr_weekly_gen():
    import asyncio
    from app.modules.cefr.services.cefr_scheduler import CEFRScheduler


    scheduler = CEFRScheduler(None)
    asyncio.run(scheduler.job_generate_weekly_content())