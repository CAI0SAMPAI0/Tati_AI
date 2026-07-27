import asyncio

from app.core.celery_app import celery_app


@celery_app.task(name="app.modules.activities.tasks.generate_flashcards_task")
def generate_flashcards_task(
    theme: str, level: str, module_id: str = None, username: str = None
):
    from app.modules.activities.services.activity_service import ActivityService

    async def _run():
        service = ActivityService()
        res = await service.generate_flashcards(
            theme=theme, level=level, module_id=module_id
        )
        if res.get("ok") and username:
            from app.modules.notifications.services.notifications import (
                notify_ai_generation,
            )

            notify_ai_generation(
                username=username,
                title="✨ Flashcards Gerados",
                message=f"Flashcards sobre '{theme}' estão prontos.",
                url="/admin",
            )
        return res

    return asyncio.run(_run())


@celery_app.task(name="app.modules.activities.tasks.generate_simulation_task")
def generate_simulation_task(
    topic: str, level: str, instructions: str, username: str = None
):
    from app.modules.admin.services.dashboard_service import DashboardService

    async def _run():
        service = DashboardService()
        res = await service.generate_simulation(
            topic=topic, level=level, instructions=instructions
        )
        if res and "error" not in res and username:
            from app.modules.notifications.services.notifications import (
                notify_ai_generation,
            )

            notify_ai_generation(
                username=username,
                title="✨ Simulação Gerada",
                message=f"A simulação sobre '{topic}' foi gerada com sucesso pela IA.",
                url="/admin",
            )
        return res

    return asyncio.run(_run())
