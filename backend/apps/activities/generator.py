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
                ref_context = (
                    f"\nContext from selected reference files ({lvl}): {ref_names}."
                )

        client = cls._get_groq_client()

        cards_data = []
        if client:
            prompt = f"""You are Teacher Tatiana Duarte, an expert ESL teacher.
Generate {count} UNIQUE and DISTINCT educational flashcards for CEFR Level {lvl} on the topic: "{topic}".{ref_context}

CRITICAL RULES:
1. EVERYTHING MUST BE IN 100% ENGLISH. NEVER USE PORTUGUESE OR ANY OTHER LANGUAGE.
2. "front": A UNIQUE English target word, expression or short phrase (1-4 words). NEVER repeat words or phrases.
3. "back": A simple, clear definition or clue/hint in ENGLISH strictly suited for CEFR Level {lvl} (e.g. for Level A1/A2 use simple vocabulary; for B1/B2/C1 use appropriate level complexity).
4. "options": A list of EXACTLY 4 distinct English choices suitable for Level {lvl}: exactly 1 correct answer (matching "front") and 3 plausible, realistic incorrect distractors from the same lexical category/theme.
5. "explanation": A natural example sentence in English demonstrating real-world usage in context.
6. "image_search_query": 2 to 4 concrete English keywords to search for a photo representing the situation, action or concept WITHOUT spoiling the answer and WITHOUT showing written words or labels (e.g., if front is 'Boarding pass', search for 'airport departure terminal gate' NOT 'boarding pass paper'; if front is 'Coffee', search for 'ceramic mug on wooden table' NOT 'coffee shop sign'; if front is an abstract phrase like 'In my opinion', search for 'colleagues discussing idea meeting').
7. "image_prompt": A vivid photographic scene prompt for AI image generation illustrating the real-world action or concept. Strictly specify: realistic photography, bright natural lighting, highly pedagogical, strictly NO visible text, NO words, NO letters, NO labels, NO logos.
8. All items must be completely distinct from one another.

Return ONLY a JSON object in this exact format:
{{
  "flashcards": [
    {{
      "front": "target word in English",
      "back": "simple definition or clue in English",
      "options": ["target word in English", "distractor 1", "distractor 2", "distractor 3"],
      "explanation": "natural example sentence in English",
      "image_search_query": "contextual visual search terms with no spoilers",
      "image_prompt": "clear visual scene prompt with no text or labels"
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
                    "options": [
                        f"To practice {topic.lower()}",
                        f"To ignore {topic.lower()}",
                        f"To finish {topic.lower()}",
                        f"To forget {topic.lower()}",
                    ],
                    "explanation": f"I practice talking about {topic.lower()} every day.",
                    "image_search_query": f"{topic.lower()} student learning book",
                    "image_prompt": f"A dedicated student studying {topic.lower()} at a tidy desk, realistic photo, no text",
                },
                {
                    "front": f"Key expression for {topic.lower()}",
                    "back": f"A helpful phrase you use when discussing {topic.lower()}.",
                    "options": [
                        f"Key expression for {topic.lower()}",
                        f"Grammar mistake in {topic.lower()}",
                        f"Silent break during {topic.lower()}",
                        f"Random question about {topic.lower()}",
                    ],
                    "explanation": f"This is an important expression for everyday communication.",
                    "image_search_query": f"two friends talking smiling outdoors",
                    "image_prompt": f"Two friends smiling and having a pleasant conversation, realistic photo, no text",
                },
                {
                    "front": f"Ask about {topic.lower()}",
                    "back": f"To request information or help regarding {topic.lower()}.",
                    "options": [
                        f"Ask about {topic.lower()}",
                        f"Refuse to answer about {topic.lower()}",
                        f"Write letters about {topic.lower()}",
                        f"Whisper quietly about {topic.lower()}",
                    ],
                    "explanation": f"Can I ask you a question about {topic.lower()}?",
                    "image_search_query": f"person asking friendly question",
                    "image_prompt": f"A person raising their hand politely in an interactive workshop, realistic photo, no text",
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
                search_query = (c.get("image_search_query") or "").strip() or None
                visual_prompt = (c.get("image_prompt") or "").strip() or None
                raw_options = c.get("options") or []
                if not isinstance(raw_options, list):
                    raw_options = []
                cleaned_opts = [str(o).strip() for o in raw_options if str(o).strip()]
                # Garante que o termo correto esteja presente
                if front not in cleaned_opts:
                    cleaned_opts.insert(0, front)
                # Garante 4 opções únicas
                cleaned_opts = list(dict.fromkeys(cleaned_opts))
                while len(cleaned_opts) < 4:
                    cleaned_opts.append(f"Alternative {len(cleaned_opts)}")

                img_url = ImageResolverService.resolve_image(
                    term=front,
                    topic=deck_title,
                    search_query=search_query,
                    visual_prompt=visual_prompt,
                )
                fc, created_flag = Flashcard.objects.update_or_create(
                    level=lvl,
                    topic=deck_title,
                    front=front,
                    defaults={
                        "back": back,
                        "explanation": explanation,
                        "image_url": img_url,
                        "options": cleaned_opts[:4],
                        "is_published": False,
                    },
                )
                created.append(fc)

        logger.info(
            f"[CEFR Generator] Criados/Atualizados {len(created)} flashcards únicos para o baralho '{deck_title}' ({lvl})."
        )
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
                roles=sim_data.get(
                    "roles", {"student": "Student", "ai": "Teacher Tatiana"}
                ),
                goal=sim_data.get("goal", ""),
                is_published=False,
            )
            created.append(cs)

        logger.info(f"[CEFR Generator] Criada simulação '{sim_topic}' ({lvl}).")
        return created

    @classmethod
    def extract_topics_from_references(
        cls, reference_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Extrai tópicos reais a partir do conteúdo textual das referências didáticas selecionadas (CEFR).
        Se os textos não estiverem indexados no banco, faz o download do arquivo via storage_url,
        extrai o texto com pypdf, divide em chunks e salva em cefr_documents.
        """
        from .models import CEFRReference
        from django.db import connection
        from psycopg2.extras import Json

        cleaned_ids = [str(r).strip() for r in reference_ids if str(r).strip()]
        refs = list(CEFRReference.objects.filter(id__in=cleaned_ids))
        if not refs:
            return {"success": False, "topics": [], "level": "A1"}

        level = refs[0].cefr_level.upper() if refs[0].cefr_level else "A1"
        collected_texts = []
        ref_names = []

        for ref in refs:
            ref_names.append(ref.filename)
            text_found = ""

            # 1. Busca em cefr_documents
            try:
                with connection.cursor() as cur:
                    cur.execute(
                        """
                        SELECT content FROM cefr_documents
                        WHERE metadata->>'original_name' = %s
                           OR source_file ILIKE %s
                           OR metadata->>'reference_id' = %s
                        ORDER BY id;
                        """,
                        (ref.filename, f"%{ref.filename[:20]}%", str(ref.id)),
                    )
                    rows = cur.fetchall()
                    if rows:
                        text_found = "\n".join(r[0] for r in rows if r[0])
            except Exception as e:
                logger.warning(f"[CEFR Generator] Erro ao consultar cefr_documents para {ref.filename}: {e}")

            # 2. Se não houver chunks e storage_url existir, faz download e extrai
            if not text_found and ref.storage_url:
                try:
                    import io, requests, pypdf

                    logger.info(f"[CEFR Generator] Baixando e extraindo texto para {ref.filename} de {ref.storage_url[:50]}...")
                    resp = requests.get(ref.storage_url, timeout=20)
                    if resp.status_code == 200:
                        reader = pypdf.PdfReader(io.BytesIO(resp.content))
                        pages_text = [p.extract_text() or "" for p in reader.pages]
                        full_pdf_text = "\n".join(pages_text).strip()
                        if full_pdf_text:
                            text_found = full_pdf_text
                            # Salva os chunks no banco para próximas requisições
                            chunk_size = 1200
                            chunks = [
                                full_pdf_text[i : i + chunk_size]
                                for i in range(0, len(full_pdf_text), chunk_size)
                                if full_pdf_text[i : i + chunk_size].strip()
                            ]
                            with connection.cursor() as cur:
                                for idx, chunk in enumerate(chunks):
                                    cur.execute(
                                        """
                                        INSERT INTO cefr_documents (id, level, source_file, content, metadata, created_at)
                                        VALUES (%s, %s, %s, %s, %s, now());
                                        """,
                                        (
                                            str(uuid.uuid4()),
                                            ref.cefr_level,
                                            ref.filename,
                                            chunk,
                                            Json(
                                                {
                                                    "original_name": ref.filename,
                                                    "reference_id": str(ref.id),
                                                    "chunk_index": idx,
                                                }
                                            ),
                                        ),
                                    )
                            ref.chunks_indexed = len(chunks)
                            ref.save(update_fields=["chunks_indexed"])
                except Exception as e:
                    logger.warning(f"[CEFR Generator] Falha ao extrair PDF em tempo real para {ref.filename}: {e}")

            if text_found:
                collected_texts.append(f"--- Document: {ref.filename} ({ref.cefr_level}) ---\n{text_found}")

        combined_text = "\n\n".join(collected_texts).strip()

        # 3. Chama LLM com o texto real do material
        client = cls._get_groq_client()
        topics = []

        if client and combined_text:
            prompt = f"""You are an expert curriculum designer and ESL teacher.
Analyze the following pedagogical material from the reference files '{', '.join(ref_names)}' (CEFR Level {level}):
---
{combined_text[:7500]}
---
Extract the REAL, SPECIFIC pedagogical topics, communicative functions, question types, and vocabulary themes present directly in this material.
For each topic:
1. "topic": A clear, descriptive topic name representing a real situation, communicative goal, or grammar/vocabulary theme from this material.
2. "items": A list of 4 to 8 specific subtopics, target questions, key vocabulary words, or communicative expressions directly from this section of the text.
3. "count": Number of items in the list.

Return 4 to 8 distinct topics covering the content.
Format ONLY as JSON:
{{
  "topics": [
    {{
      "topic": "Topic Name",
      "items": ["Item 1", "Item 2"],
      "count": 2
    }}
  ]
}}"""
            try:
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                )
                parsed = json.loads(res.choices[0].message.content)
                topics = parsed.get("topics", [])
            except Exception as e:
                logger.error(f"[CEFR Generator] Erro na extração com Groq: {e}")

        # Fallback inteligente se a IA falhar ou não houver texto
        if not topics:
            if level in ["B1", "B2"]:
                topics = [
                    {"topic": "Airport, Boarding and Flight Procedures", "items": ["boarding pass", "security checkpoint", "customs declaration", "carry-on luggage", "gate change", "departure lounge"], "count": 6},
                    {"topic": "Job Interviews and Professional Career", "items": ["work experience", "strengths and weaknesses", "career goals", "leadership skills", "salary expectations"], "count": 5},
                    {"topic": "Housing, Rent and Utilities", "items": ["lease agreement", "security deposit", "monthly rent", "utilities included", "landlord obligations"], "count": 5},
                    {"topic": "Technology and Digital Communication", "items": ["cloud storage", "data privacy", "software development", "cybersecurity", "remote collaboration"], "count": 5},
                ]
            elif level in ["C1", "C2"]:
                topics = [
                    {"topic": "Diplomatic Negotiations and Global Trade", "items": ["bilateral agreements", "tariff exemptions", "geopolitical diplomacy", "economic sanctions", "multilateral treaties"], "count": 5},
                    {"topic": "Advanced Academic Rhetoric and Research", "items": ["empirical methodology", "paradigm shift", "statistical validity", "peer review process", "hypothesis testing"], "count": 5},
                    {"topic": "Ethics in Artificial Intelligence", "items": ["algorithmic bias", "autonomous systems", "moral accountability", "data governance", "machine learning safety"], "count": 5},
                ]
            else:
                topics = [
                    {"topic": "Family and Daily Relationships", "items": ["father", "mother", "sister", "brother", "cousin", "grandparents"], "count": 6},
                    {"topic": "Hobbies, Sports and Free Time", "items": ["reading", "cycling", "cooking", "traveling", "listening to music"], "count": 5},
                    {"topic": "Work, Jobs and Occupations", "items": ["teacher", "engineer", "doctor", "lawyer", "nurse", "pilot"], "count": 6},
                    {"topic": "Daily Routine and Habits", "items": ["wake up", "take a shower", "have breakfast", "go to work", "exercise"], "count": 5},
                ]

        return {"success": True, "level": level, "topics": topics}

    @classmethod
    def run_single_schedule(cls, sched: CEFRSchedule) -> Dict[str, Any]:
        """
        Executa um agendamento individual gerando flashcards e/ou simulações
        baseados nos arquivos de referência selecionados e seus respectivos níveis CEFR.
        """
        from .models import CEFRReference
        from collections import defaultdict
        import random

        types = sched.selected_types or ["flashcards", "simulations"]
        count = sched.materials_per_execution or 5
        sched_ref_ids = sched.reference_ids if isinstance(sched.reference_ids, list) else []

        selected_refs = []
        if sched_ref_ids:
            selected_refs = list(CEFRReference.objects.filter(id__in=sched_ref_ids))

        # Agrupa os arquivos selecionados por nível CEFR
        refs_by_level = defaultdict(list)
        if selected_refs:
            for r in selected_refs:
                lvl = (r.cefr_level or "A1").strip().upper()
                refs_by_level[lvl].append(r)
        else:
            # Fallback se nenhum arquivo foi explicitamente associado
            all_refs = list(CEFRReference.objects.all()[:3])
            if all_refs:
                for r in all_refs:
                    lvl = (r.cefr_level or "A1").strip().upper()
                    refs_by_level[lvl].append(r)
            else:
                refs_by_level["A1"] = []

        total_flashcards = 0
        total_sims = 0
        executed_levels = []

        for lvl, level_refs in refs_by_level.items():
            executed_levels.append(lvl)
            ref_ids_str = ",".join(str(r.id) for r in level_refs) if level_refs else None

            topic = None
            if level_refs:
                res_topics = cls.extract_topics_from_references([str(r.id) for r in level_refs])
                extracted = res_topics.get("topics", [])
                if extracted:
                    chosen = random.choice(extracted)
                    topic = chosen.get("topic")

            if not topic:
                topic = random.choice(EVERYDAY_TOPICS)

            if "flashcards" in types:
                cards = cls.generate_flashcards(
                    level=lvl, topic=topic, count=count, reference_ids=ref_ids_str
                )
                total_flashcards += len(cards)

            if "simulations" in types:
                sims = cls.generate_simulations(level=lvl, topic=topic, count=1)
                total_sims += len(sims)

        # 2. Atualiza timestamp de execução
        try:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            sched.updated_at = now_utc
            sched.save(update_fields=["updated_at"])
        except Exception as e:
            logger.warning(f"[CEFR Scheduler] Aviso ao atualizar agendamento {sched.id}: {e}")

        levels_str = ", ".join(executed_levels)
        logger.info(
            f"[CEFR Scheduler] Agendamento {sched.id} concluído para níveis [{levels_str}]: "
            f"{total_flashcards} flashcards e {total_sims} simulações geradas."
        )
        return {
            "success": True,
            "levels": executed_levels,
            "flashcards_generated": total_flashcards,
            "simulations_generated": total_sims,
            "message": f"Agendamento executado para os níveis [{levels_str}]: {total_flashcards} flashcards e {total_sims} simulação gerados a partir dos arquivos selecionados.",
        }

    @classmethod
    def check_and_run_schedules(cls, force: bool = False) -> Dict[str, Any]:
        """
        Executa os agendamentos ativos na tabela cefr_schedules gerando novos flashcards e simulações.
        Garante idempotência através de lock diário por agendamento.
        """
        from django.core.cache import cache

        tz = ZoneInfo("America/Sao_Paulo")
        now = datetime.datetime.now(tz)
        weekday_map = {
            0: "mon",
            1: "tue",
            2: "wed",
            3: "thu",
            4: "fri",
            5: "sat",
            6: "sun",
        }
        current_weekday = weekday_map[now.weekday()]

        schedules = list(CEFRSchedule.objects.filter(active=True))
        if not schedules:
            logger.info("[CEFR Scheduler] Nenhum agendamento ativo.")
            return {
                "success": True,
                "generated": 0,
                "message": "Nenhum agendamento ativo.",
            }

        generated_flashcards = 0
        generated_sims = 0
        executed_count = 0

        for sched in schedules:
            weekdays = sched.weekdays if isinstance(sched.weekdays, list) else []
            weekdays_lower = [str(w).lower().strip() for w in weekdays]

            if not force:
                # 1. Verifica dia da semana
                if weekdays_lower and (current_weekday not in weekdays_lower):
                    continue

                # 2. Verifica hora de execução (se configurada)
                if sched.execution_time:
                    if now.hour != sched.execution_time.hour:
                        continue

                # 3. Lock atômico diário para garantir execução única por agendamento
                lock_key = f"cefr_sched_lock_{sched.id}_{now.date().isoformat()}"
                if not cache.add(lock_key, "running", timeout=86400):
                    logger.debug(
                        f"[CEFR Scheduler] Agendamento {sched.id} já executado hoje ({now.date()}). Pulando."
                    )
                    continue

            res = cls.run_single_schedule(sched)
            generated_flashcards += res.get("flashcards_generated", 0)
            generated_sims += res.get("simulations_generated", 0)
            executed_count += 1

        return {
            "success": True,
            "schedules_executed": executed_count,
            "flashcards_generated": generated_flashcards,
            "simulations_generated": generated_sims,
            "message": f"Agendamentos executados ({executed_count}): {generated_flashcards} flashcards e {generated_sims} simulações geradas.",
        }

