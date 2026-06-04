from app.core.celery_app import celery_app


@celery_app.task(name="app.core.tasks.keepalive")
def keepalive():
    import asyncio
    from app.core.database import keep_alive_ping
    asyncio.run(keep_alive_ping())