import os
import json
import logging
import uuid
import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional

from groq import Groq
from django.db import transaction

from .models import Flashcard, CEFRSchedule
from apps.chat.models import CEFRSimulation

logger = logging.getLogger(__name__)

EVERYDAY_TOPICS = [
    "At the supermarket and talking to a cashier",
    "Ordering food at a restaurant",
    "Asking for directions in the city",
    "Job interview questions and answers",
    "Booking a hotel room and checking in",
    "At the airport: passport control and luggage",
    "Talking about daily routine and habits",
    "Going to the doctor and describing symptoms",
    "Shopping for clothes: sizes, colors and prices",
    "Talking about hobbies, sports and free time",
    "Making a phone call and leaving a message",
    "Renting an apartment and talking to a landlord",
    "Talking about the weather and seasons",
    "Planning a trip and discussing vacation destinations",
    "At the bank: opening an account and exchanging currency",
]


class CEFRGeneratorService:
    @staticmethod
    def _get_groq_client() -> Optional[Groq]:
        key = (
            os.environ.get("GROQ_API_KEY")
            or os.environ.get("GROQ_API_KEY_1")
            or os.environ.get("GROQ_API_KEY_2")
        )
        if key:
            return Groq(api_key=key)
        return None

    @classmethod
    def generate_flashcards(
        cls,
        level: str = "A1",
        topic: str = "General",
        count: int = 5,
        title: Optional[str] = None,
        reference_ids: Optional[str] = None,
    ) -> List[Flashcard]:
        """
        Gera flashcards pedagógicos reais utilizando LLM e salva na tabela cefr_flashcards.
        """
        deck_title = (title or topic).strip()
        lvl = (level or "A1").strip().upper()

        ref_context = ""
        if reference_ids:
            from .models import CEFRReference
            ref_id_list = [r.strip() for r in reference_ids.split(",") if r.strip()]
            refs = list(CEFRReference.objects.filter(id__in=ref_id_list))
            if refs:
                ref_levels = [r.cefr_level for r in refs if r.cefr_level]
                if ref_levels and (not level or level == "A1"):
                    lvl = ref_levels[0].upper()
                ref_names = ", ".join([r.filename for r in refs])
                ref_context = f"\nContext from selected reference files ({lvl}): {ref_names}."

        client = cls._get_groq_client()

        cards_data = []
        if client:
            prompt = f"""You are Teacher Tatiana Duarte, an expert ESL teacher.
Generate {count} UNIQUE and DISTINCT educational flashcards for CEFR Level {lvl} on the topic: "{topic}".{ref_context}

CRITICAL RULES:
1. EVERYTHING MUST BE IN 100% ENGLISH. NEVER USE PORTUGUESE OR ANY OTHER LANGUAGE.
2. "front": A UNIQUE English target word, expression or short phrase (1-4 words). NEVER repeat words or phrases.
3. "back": A simple, clear definition or clue/hint in ENGLISH strictly suited for CEFR Level {lvl} (e.g. for Level A1/A2 use simple vocabulary; for B1/B2/C1 use appropriate level complexity).
4. "explanation": A natural example sentence in English demonstrating real-world usage in context.
5. All items must be completely distinct from one another.

Return ONLY a JSON object in this exact format:
{{
  "flashcards": [
    {{
      "front": "target word in English",
      "back": "simple definition or clue in English",
      "explanation": "natural example sentence in English"
    }}
  ]
}}"""
            try:
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                parsed = json.loads(res.choices[0].message.content)
                cards_data = parsed.get("flashcards", [])
            except Exception as e:
                logger.error(f"[CEFR Generator] Erro ao chamar Groq: {e}")

        # Fallback se a IA não retornar o total solicitado
        if not cards_data:
            cards_data = [
                {
                    "front": f"To practice {topic.lower()}",
                    "back": f"To do an activity regularly to improve your skill in {topic.lower()}.",
                    "explanation": f"I practice talking about {topic.lower()} every day.",
                },
                {
                    "front": f"Key expression for {topic.lower()}",
                    "back": f"A helpful phrase you use when discussing {topic.lower()}.",
                    "explanation": f"This is an important expression for everyday communication.",
                },
                {
                    "front": f"Ask about {topic.lower()}",
                    "back": f"To request information or help regarding {topic.lower()}.",
                    "explanation": f"Can I ask you a question about {topic.lower()}?",
                },
            ]

        from .image_service import ImageResolverService

        # Deduplicação rigorosa
        unique_cards = []
        seen_fronts = set()
        for c in cards_data:
            front = (c.get("front") or "").strip()
            if not front:
                continue
            key = front.lower()
            if key not in seen_fronts:
                seen_fronts.add(key)
                unique_cards.append(c)

        created = []
        with transaction.atomic():
            for c in unique_cards[:count]:
                front = (c.get("front") or "Vocabulary").strip()
                back = (c.get("back") or "").strip()
                explanation = (c.get("explanation") or "").strip()

                img_url = ImageResolverService.resolve_image(front)
                fc, created_flag = Flashcard.objects.update_or_create(
                    level=lvl,
                    topic=deck_title,
                    front=front,
                    defaults={
                        "back": back,
                        "explanation": explanation,
                        "image_url": img_url,
                        "is_published": False,
                    }
                )
                created.append(fc)

        logger.info(f"[CEFR Generator] Criados/Atualizados {len(created)} flashcards únicos para o baralho '{deck_title}' ({lvl}).")
        return created

    @classmethod
    def generate_simulations(
        cls,
        level: str = "A1",
        topic: str = "General",
        count: int = 1,
        title: Optional[str] = None,
    ) -> List[CEFRSimulation]:
        """
        Gera simulações comunicativas interativas reais utilizando LLM e salva na tabela cefr_simulations.
        """
        sim_topic = (title or topic).strip()
        lvl = (level or "A1").strip().upper()
        client = cls._get_groq_client()

        sim_data = None
        if client:
            prompt = f"""You are Teacher Tatiana Duarte, an expert ESL teacher.
Generate 1 interactive conversational simulation for CEFR Level {lvl} on the topic: "{sim_topic}".

Return ONLY a JSON object in this exact format:
{{
  "topic": "{sim_topic}",
  "scenario": "A descriptive 2-3 sentence context setting the scene for the student.",
  "roles": {{
    "student": "The student's role (e.g. Customer, Tourist, Job Candidate)",
    "ai": "Teacher Tatiana or the conversational partner (e.g. Cashier, Hotel Clerk, Interviewer)"
  }},
  "goal": "The communicative mission the student must achieve (e.g. Ask for the price, order a meal, answer questions)."
}}"""
            try:
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                sim_data = json.loads(res.choices[0].message.content)
            except Exception as e:
                logger.error(f"[CEFR Generator] Erro ao gerar simulação com Groq: {e}")

        if not sim_data:
            sim_data = {
                "topic": sim_topic,
                "scenario": f"You are in a realistic setting practicing communicative English about {sim_topic} at CEFR level {lvl}.",
                "roles": {"student": "Student", "ai": "Teacher Tatiana"},
                "goal": f"Engage in conversation, ask relevant questions, and complete your goal regarding {sim_topic}.",
            }

        created = []
        with transaction.atomic():
            cs = CEFRSimulation.objects.create(
                id=uuid.uuid4(),
                level=lvl,
                topic=sim_data.get("topic", sim_topic),
                scenario=sim_data.get("scenario", ""),
                roles=sim_data.get("roles", {"student": "Student", "ai": "Teacher Tatiana"}),
                goal=sim_data.get("goal", ""),
                is_published=False,
            )
            created.append(cs)

        logger.info(f"[CEFR Generator] Criada simulação '{sim_topic}' ({lvl}).")
        return created

    @classmethod
    def check_and_run_schedules(cls, force: bool = False) -> Dict[str, Any]:
        """
        Executa os agendamentos ativos na tabela cefr_schedules gerando novos flashcards e simulações.
        """
        tz = ZoneInfo("America/Sao_Paulo")
        now = datetime.datetime.now(tz)
        weekday_map = {0: "mon", 1: "tue", 2: "wed", 3: "thu", 4: "fri", 5: "sat", 6: "sun"}
        current_weekday = weekday_map[now.weekday()]

        schedules = list(CEFRSchedule.objects.filter(active=True))
        if not schedules:
            logger.info("[CEFR Scheduler] Nenhum agendamento ativo.")
            return {"success": True, "generated": 0, "message": "Nenhum agendamento ativo."}

        generated_flashcards = 0
        generated_sims = 0

        for sched in schedules:
            weekdays = sched.weekdays if isinstance(sched.weekdays, list) else []
            weekdays_lower = [str(w).lower().strip() for w in weekdays]

            # Se 'force' for True, executa independente do dia
            should_run = force or (current_weekday in weekdays_lower) or (len(weekdays_lower) == 0)
            if not should_run:
                continue

            types = sched.selected_types or ["flashcards", "simulations"]
            count = sched.materials_per_execution or 5

            import random
            topic = random.choice(EVERYDAY_TOPICS)

            if "flashcards" in types:
                cards = cls.generate_flashcards(level="A1", topic=topic, count=count)
                generated_flashcards += len(cards)

            if "simulations" in types:
                sims = cls.generate_simulations(level="A1", topic=topic, count=1)
                generated_sims += len(sims)

        return {
            "success": True,
            "flashcards_generated": generated_flashcards,
            "simulations_generated": generated_sims,
            "message": f"Agendamentos executados com sucesso: {generated_flashcards} flashcards e {generated_sims} simulações geradas.",
        }
