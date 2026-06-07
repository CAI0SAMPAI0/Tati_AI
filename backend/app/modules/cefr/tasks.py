from app.core.celery_app import celery_app
import asyncio


@celery_app.task(name="app.modules.cefr.tasks.cefr_weekly_gen")
def cefr_weekly_gen():
    from app.modules.cefr.services.cefr_scheduler import CEFRScheduler
    scheduler = CEFRScheduler(None)
    asyncio.run(scheduler.job_generate_weekly_content())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_flashcards_task")
def generate_cefr_flashcards_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client
    from app.modules.chat.services.llm import search_image_on_internet

    async def _run():
        flashcards = await CEFRGeneratorService.generate_flashcards(level=level, topic=topic, count=count)
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
        deck_data = {
            "title": f"CEFR {level}: {display_title}",
            "description": f"AI generated flashcards from CEFR material for level {level} on the topic '{topic}'.",
            "level": level.lower(),
            "flashcards": flashcards,
            "is_published": True
        }
        res = client.table("modules").insert(deck_data).execute()
        
        if username and res.data:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Flashcards Gerados",
                message=f"Foram gerados {len(flashcards)} flashcards para '{display_title}'.",
                url="/admin"
            )
            
        return {"success": True, "generated": len(flashcards), "data": res.data}

    return asyncio.run(_run())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_exercises_task")
def generate_cefr_exercises_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client

    async def _run():
        exercises = await CEFRGeneratorService.generate_exercises(level=level, topic=topic, count=count)
        if not exercises:
            return {"success": False, "error": "Could not generate exercises"}

        client = get_client()
        display_title = custom_title if custom_title else topic
        module_data = {
            "title": f"CEFR Quiz {level}: {display_title}",
            "description": f"AI generated quiz from CEFR material for level {level} on the topic '{topic}'.",
            "level": level.lower(),
            "is_published": True
        }
        m_res = client.table("modules").insert(module_data).execute()
        if not m_res.data:
            return {"success": False, "error": "Could not create modules entry"}
        module_id = m_res.data[0]["id"]

        quiz_data = {
            "module_id": module_id,
            "title": f"CEFR Quiz {level}: {display_title}",
            "is_active": True
        }
        q_res = client.table("quizzes").insert(quiz_data).execute()
        if not q_res.data:
            return {"success": False, "error": "Could not create quizzes entry"}
        quiz_id = q_res.data[0]["id"]

        prepared_questions = []
        for i, q in enumerate(exercises):
            # Parse options
            options = q.get('options', [])
            if not options:
                continue
            
            correct_index = q.get('correct_index', 0)
            try:
                correct_index = int(correct_index)
            except Exception:
                correct_index = 0

            prepared_questions.append({
                "quiz_id": quiz_id,
                "question": q.get("question", "Question"),
                "options": options,
                "correct_index": correct_index,
                "explanation": q.get("explanation", ""),
                "order": i
            })
            
        if prepared_questions:
            client.table("quiz_questions").insert(prepared_questions).execute()

        if username:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Quiz Gerado",
                message=f"Quiz sobre '{display_title}' com {len(exercises)} questões está pronto.",
                url="/admin"
            )

        return {"success": True, "generated": len(exercises), "module_id": module_id}

    return asyncio.run(_run())


@celery_app.task(name="app.modules.cefr.tasks.generate_cefr_simulations_task")
def generate_cefr_simulations_task(level: str, topic: str, count: int, username: str = None, custom_title: str = None):
    from app.modules.cefr.services.generator import CEFRGeneratorService
    from app.core.database import get_client

    async def _run():
        simulations = await CEFRGeneratorService.generate_simulations(level=level, topic=topic, count=count)
        if not simulations:
            return {"success": False, "error": "Could not generate simulations"}

        client = get_client()
        saved_simulations = []
        display_title = custom_title if custom_title else topic
        for i, sim in enumerate(simulations):
            roles = sim.get("roles", {})
            student_role = roles.get("student", "")
            ai_role = roles.get("ai", "")
            sys_prompt = f"You are {ai_role}. The user is {student_role}. Goal: {
                sim.get('goal')}. Scenario: {
                sim.get('scenario')}"

            data = {
                "name": f"CEFR {level}: {display_title} #{i + 1}",
                "description": sim.get("scenario"),
                "difficulty": level.lower(),
                "system_prompt": sys_prompt,
                "is_active": True
            }
            res = client.table("simulations").insert(data).execute()
            if res.data:
                saved_simulations.extend(res.data)

        if username and saved_simulations:
            from app.modules.notifications.services.notifications import notify_ai_generation
            notify_ai_generation(
                username=username,
                title="✨ Simulações Geradas",
                message=f"{len(saved_simulations)} simulações sobre '{display_title}' estão prontas.",
                url="/admin"
            )

        return {"success": True, "generated": len(saved_simulations), "data": saved_simulations}

    return asyncio.run(_run())