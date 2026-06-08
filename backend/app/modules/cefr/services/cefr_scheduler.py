import logging
import random
from typing import List
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.database import get_client
from app.modules.cefr.services.generator import CEFRGeneratorService

# List of everyday topics for autonomous generation
EVERYDAY_TOPICS = [
    "At the supermarket",
    "Ordering food at a restaurant",
    "Asking for directions",
    "Job interview",
    "Booking a hotel room",
    "At the airport",
    "Talking about daily routine",
    "Going to the doctor",
    "Shopping for clothes",
    "Talking about hobbies and free time",
    "Making a phone call",
    "Renting an apartment",
    "Talking about the weather",
    "Planning a trip",
    "At the bank"
]


class CEFRScheduler:
    def __init__(self, apscheduler: AsyncIOScheduler = None):
        self.scheduler = apscheduler
        self.client = get_client()

    def start(self):
        """
        Kept for compatibility if initialized at app startup.
        No longer registers static weekly cron job since it's managed dynamically via Celery Beat.
        """
        logging.info("[CEFR Scheduler] Initialized. Dynamic scheduling managed via Celery Beat.")

    async def check_and_run_schedules(self):
        """
        Fetches active schedules from database, checks if any should run now
        (current weekday and hour in America/Sao_Paulo timezone) and executes generation.
        """
        import datetime
        import zoneinfo

        try:
            res = self.client.table("cefr_schedules").select("*").eq("active", True).execute()
            if not res.data:
                logging.info("[CEFR Scheduler] No active schedules found.")
                return

            tz = zoneinfo.ZoneInfo("America/Sao_Paulo")
            now = datetime.datetime.now(tz)

            weekday_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
            current_weekday = weekday_map[now.weekday()]
            current_hour = now.hour

            logging.info(f"[CEFR Scheduler] Checking {len(res.data)} active schedule(s). Day: {current_weekday}, Hour: {current_hour}")

            for schedule in res.data:
                weekdays = schedule.get("weekdays") or []
                exec_time_val = schedule.get("execution_time")

                # Normalize weekdays to lowercase
                weekdays = [w.lower() for w in weekdays]

                # Parse execution hour and minute
                exec_hour = None
                exec_minute = None
                try:
                    if isinstance(exec_time_val, str):
                        parts = exec_time_val.split(":")
                        exec_hour = int(parts[0])
                        exec_minute = int(parts[1]) if len(parts) > 1 else 0
                    elif exec_time_val:
                        exec_hour = exec_time_val.hour
                        exec_minute = exec_time_val.minute
                except Exception as parse_err:
                    logging.error(f"[CEFR Scheduler] Error parsing execution time {exec_time_val}: {parse_err}")
                    continue

                if current_weekday in weekdays and current_hour == exec_hour and now.minute == exec_minute:
                    logging.info(f"[CEFR Scheduler] Schedule {schedule['id']} matches current time. Running generation...")
                    limit = schedule.get("materials_per_execution", 5)
                    selected_types = schedule.get("selected_types") or ["flashcards", "exercises", "simulations"]
                    await self.run_generation_with_limit(limit, selected_types)

        except Exception as e:
            logging.error(f"[CEFR Scheduler] Error checking schedules: {e}")

    async def run_generation_with_limit(self, limit: int, selected_types: List[str] = None):
        """
        Generates flashcards, exercises, and simulations automatically for each available level, up to the level limit.
        """
        if not selected_types:
            selected_types = ["flashcards", "exercises", "simulations"]
        
        types = [t.lower() for t in selected_types]
        logging.info(f"[CEFR Scheduler] Starting autonomous generation (level limit: {limit}, types: {types})...")

        try:
            # 1. Discover which levels have indexed materials
            res = self.client.table('cefr_documents').select('level').execute()
            if not res.data:
                logging.info("[CEFR Scheduler] No CEFR materials indexed. Aborting generation.")
                return

            # Extract unique levels (A1, A2, etc)
            available_levels = list(set([doc['level'] for doc in res.data if doc.get('level')]))
            logging.info(f"[CEFR Scheduler] Levels found: {available_levels}")

            # Limit levels to process
            selected_levels = available_levels[:limit]
            logging.info(f"[CEFR Scheduler] Levels selected for this run: {selected_levels}")

            for level in selected_levels:
                topic = random.choice(EVERYDAY_TOPICS)
                logging.info(f"[CEFR Scheduler] Generating content for {level} on topic '{topic}'...")

                # Generate Flashcards (10)
                if "flashcards" in types:
                    flashcards = await CEFRGeneratorService.generate_flashcards(level=level, topic=topic, count=10)
                    if flashcards:
                        saved_cards = []
                        for card in flashcards:
                            data = {
                                "level": level,
                                "front": card.get("front"),
                                "back": card.get("back"),
                                "explanation": card.get("explanation"),
                                "topic": topic,
                                "is_published": False
                            }
                            insert_res = self.client.table("cefr_flashcards").insert(data).execute()
                            if insert_res.data:
                                saved_cards.extend(insert_res.data)
                        logging.info(f"[CEFR Scheduler] Saved {len(saved_cards)} flashcards for {level}.")

                # Generate Exercises (10)
                if "exercises" in types:
                    exercises = await CEFRGeneratorService.generate_exercises(level=level, topic=topic, count=10)
                    if exercises:
                        saved_exercises = []
                        for ex in exercises:
                            data = {
                                "level": level,
                                "type": "multiple_choice",
                                "question": ex.get("question"),
                                "options": ex.get("options"),
                                "correct_index": ex.get("correct_index"),
                                "explanation": ex.get("explanation"),
                                "topic": topic,
                                "is_published": False
                            }
                            insert_res = self.client.table("cefr_exercises").insert(data).execute()
                            if insert_res.data:
                                saved_exercises.extend(insert_res.data)
                        logging.info(f"[CEFR Scheduler] Saved {len(saved_exercises)} exercises for {level}.")

                # Generate Simulations (1)
                if "simulations" in types:
                    simulations = await CEFRGeneratorService.generate_simulations(level=level, topic=topic, count=1)
                    if simulations:
                        saved_simulations = []
                        for sim in simulations:
                            data = {
                                "level": level,
                                "topic": topic,
                                "scenario": sim.get("scenario"),
                                "roles": sim.get("roles"),
                                "goal": sim.get("goal"),
                                "is_published": False
                            }
                            insert_res = self.client.table("cefr_simulations").insert(data).execute()
                            if insert_res.data:
                                saved_simulations.extend(insert_res.data)
                        logging.info(f"[CEFR Scheduler] Saved {len(saved_simulations)} simulations for {level}.")

            logging.info("[CEFR Scheduler] Autonomous generation finished successfully!")

        except Exception as e:
            logging.error(f"[CEFR Scheduler] Error during autonomous generation: {e}")

    async def job_generate_weekly_content(self):
        """
        Kept for compatibility if triggered manually / legacy.
        """
        await self.run_generation_with_limit(6, ["flashcards", "exercises", "simulations"])
