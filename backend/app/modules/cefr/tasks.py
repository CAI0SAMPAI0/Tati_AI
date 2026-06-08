from app.core.celery_app import celery_app
import asyncio


@celery_app.task(name="app.modules.cefr.tasks.cefr_weekly_gen")
def cefr_weekly_gen():
    from app.modules.cefr.services.cefr_scheduler import CEFRScheduler
    scheduler = CEFRScheduler(None)
    asyncio.run(scheduler.check_and_run_schedules())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_flashcards_task")
def generate_cefr_flashcards_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None, reference_ids: list[str] = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client
    from app.modules.chat.services.llm import search_image_on_internet

    async def _run():
        flashcards = await CEFRGeneratorService.generate_flashcards(level=level, topic=topic, count=count, reference_ids=reference_ids)
        if not flashcards:
            return {"success": False, "error": "Could not generate flashcards"}

        # Fetch images in parallel
        async def _add_image(card):
            term = card.get('front', '')
            if term:
                try:
                    img_url = await search_image_on_internet(term)
                    if img_url:
                        card['image_url'] = img_url
                except Exception:
                    pass

        await asyncio.gather(*[_add_image(c) for c in flashcards])

        client = get_client()
        display_title = custom_title if custom_title else topic
        saved_cards = []
        for card in flashcards:
            data = {
                "level": level,
                "front": card.get("front"),
                "back": card.get("back"),
                "explanation": card.get("explanation"),
                "image_url": card.get("image_url"),
                "topic": display_title,
                "is_published": False
            }
            insert_res = client.table("cefr_flashcards").insert(data).execute()
            if insert_res.data:
                saved_cards.extend(insert_res.data)
        
        if username and saved_cards:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Flashcards Generated",
                message=f"Generated {len(saved_cards)} flashcards for '{display_title}'.",
                url="/admin"
            )
            
        return {"success": True, "generated": len(saved_cards), "data": saved_cards}

    return asyncio.run(_run())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_exercises_task")
def generate_cefr_exercises_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None, reference_ids: list[str] = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client

    async def _run():
        exercises = await CEFRGeneratorService.generate_exercises(level=level, topic=topic, count=count, reference_ids=reference_ids)
        if not exercises:
            return {"success": False, "error": "Could not generate exercises"}

        client = get_client()
        display_title = custom_title if custom_title else topic
        saved_exercises = []
        for ex in exercises:
            data = {
                "level": level,
                "type": "multiple_choice",
                "question": ex.get("question"),
                "options": ex.get("options"),
                "correct_index": ex.get("correct_index"),
                "explanation": ex.get("explanation"),
                "topic": display_title,
                "is_published": False
            }
            insert_res = client.table("cefr_exercises").insert(data).execute()
            if insert_res.data:
                saved_exercises.extend(insert_res.data)

        if username and saved_exercises:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Quiz Generated",
                message=f"Quiz about '{display_title}' with {len(saved_exercises)} questions is ready.",
                url="/admin"
            )

        return {"success": True, "generated": len(saved_exercises), "data": saved_exercises}

    return asyncio.run(_run())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_simulations_task")
def generate_cefr_simulations_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None, reference_ids: list[str] = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client

    async def _run():
        simulations = await CEFRGeneratorService.generate_simulations(level=level, topic=topic, count=count, reference_ids=reference_ids)
        if not simulations:
            return {"success": False, "error": "Could not generate simulations"}

        client = get_client()
        saved_simulations = []
        display_title = custom_title if custom_title else topic
        for i, sim in enumerate(simulations):
            roles = sim.get("roles", {})
            data = {
                "level": level,
                "topic": display_title,
                "scenario": sim.get("scenario"),
                "roles": roles,
                "goal": sim.get("goal"),
                "is_published": False
            }
            res = client.table("cefr_simulations").insert(data).execute()
            if res.data:
                saved_simulations.extend(res.data)

        if username and saved_simulations:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Simulations Generated",
                message=f"{len(saved_simulations)} simulations about '{display_title}' are ready.",
                url="/admin"
            )

        return {"success": True, "generated": len(saved_simulations), "data": saved_simulations}

    return asyncio.run(_run())