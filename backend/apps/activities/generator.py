import os
import json
import logging
import uuid
import datetime
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional

from groq import Groq
from django.db import transaction
from django.conf import settings
from shared.prompt_manager import PromptManager

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


def validate_flashcard_data(card: dict) -> tuple[bool, list[str]]:
    """
    Função pura de validação de dados de flashcards pedagógicos CEFR.
    Regras:
    1. options deve conter exatamente 4 alternativas.
    2. As 4 alternativas devem ser únicas (case-insensitive).
    3. O valor de front deve estar presente em options exatamente uma vez (case-insensitive).
    4. Nenhuma opção pode ser placeholder/filler:
       - 'Alternative N', 'Option A', 'None of the above', 'All of the above', etc.
       - Strings vazias ou apenas espaços.
    5. front, back, explanation devem ser strings não-vazias e ter tamanhos mínimos:
       - len(front.strip()) >= 2
       - len(back.strip()) >= 5
       - len(explanation.strip()) >= 5
    """
    import re

    errors: list[str] = []
    if not isinstance(card, dict):
        return False, ["Card payload must be a dictionary."]

    front = card.get("front")
    back = card.get("back")
    explanation = card.get("explanation")
    raw_options = card.get("options")

    if not isinstance(front, str) or len(front.strip()) < 2:
        errors.append("Field 'front' must be a non-empty string with at least 2 characters.")
    if not isinstance(back, str) or len(back.strip()) < 5:
        errors.append("Field 'back' must be a non-empty string with at least 5 characters.")
    if not isinstance(explanation, str) or len(explanation.strip()) < 5:
        errors.append("Field 'explanation' must be a non-empty string with at least 5 characters.")

    if not isinstance(raw_options, list):
        errors.append("Field 'options' must be a list of 4 strings.")
        return False, errors

    cleaned_options = [str(o).strip() for o in raw_options]

    if len(cleaned_options) != 4:
        errors.append(f"Options must contain exactly 4 items, found {len(cleaned_options)}.")

    filler_patterns = [
        re.compile(r"^alternative\s*\d*$", re.IGNORECASE),
        re.compile(r"^option\s*[a-d\d]*$", re.IGNORECASE),
        re.compile(r"^choice\s*[a-d\d]*$", re.IGNORECASE),
        re.compile(r"^item\s*\d*$", re.IGNORECASE),
        re.compile(r"^none\s+of\s+the\s+above$", re.IGNORECASE),
        re.compile(r"^all\s+of\s+the\s+above$", re.IGNORECASE),
        re.compile(r"^n/?a$", re.IGNORECASE),
        re.compile(r"^-$"),
    ]

    for idx, opt in enumerate(cleaned_options):
        if not opt:
            errors.append(f"Option {idx + 1} is empty.")
            continue
        for pat in filler_patterns:
            if pat.match(opt):
                errors.append(f"Option '{opt}' is a placeholder/filler.")
                break

    lower_options = [o.lower() for o in cleaned_options if o]
    if len(set(lower_options)) != len(cleaned_options):
        errors.append("Options must be unique (case-insensitive duplicate detected).")

    if isinstance(front, str) and front.strip():
        front_lower = front.strip().lower()
        matches = [o for o in lower_options if o == front_lower]
        if len(matches) == 0:
            errors.append(f"Target word/phrase ('{front.strip()}') must be present in options.")
        elif len(matches) > 1:
            errors.append(f"Target word/phrase ('{front.strip()}') appears multiple times in options.")

    return (len(errors) == 0, errors)


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
        count: int = 10,
        title: Optional[str] = None,
        reference_ids: Optional[str] = None,
        topic_context: Optional[Dict[str, Any]] = None,
    ) -> List[Flashcard]:
        """
        Gera flashcards pedagógicos reais utilizando LLM e salva na tabela cefr_flashcards.
        Valida rigorosamente os dados gerados e executa retry com LLM se necessário.
        """
        if topic_context and topic_context.get("topic"):
            topic = topic_context["topic"]

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

        if topic_context:
            context_notes = []
            if topic_context.get("items"):
                items_str = ", ".join(str(it) for it in topic_context["items"] if str(it).strip())
                if items_str:
                    context_notes.append(f"Target vocabulary / expressions: {items_str}")
            if topic_context.get("communicative_goal"):
                context_notes.append(f"Communicative goal: {topic_context['communicative_goal']}")
            if context_notes:
                ref_context += "\n" + "\n".join(context_notes)

        client = cls._get_groq_client()
        configured_model = getattr(
            settings, "GROQ_MODEL", os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        )
        candidate_models = [
            configured_model,
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
        ]
        groq_model = candidate_models[0]

        cards_data = []
        if client:
            prompt = PromptManager.get_prompt(
                "cefr_activity_generator",
                section="Flashcards Generator",
                count=count,
                lvl=lvl,
                topic=topic,
                ref_context=ref_context,
            )
            for m_candidate in candidate_models:
                try:
                    res = client.chat.completions.create(
                        model=m_candidate,
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                    )
                    parsed = json.loads(res.choices[0].message.content)
                    items = parsed.get("flashcards", [])
                    if items:
                        cards_data = items
                        groq_model = m_candidate
                        break
                except Exception as e:
                    logger.warning(f"[CEFR Generator] Erro ao chamar Groq com modelo {m_candidate}: {e}")

        # Fallback se a IA não retornar o total solicitado
        if not cards_data or len(cards_data) < count:
            existing_fronts = {str(c.get("front", "")).strip().lower() for c in cards_data}
            base_templates = [
                ("Essential vocabulary for {topic}", "A core word or phrase frequently used in real-world discussions about {topic}.", "Understanding this concept is fundamental for daily conversations."),
                ("To practice {topic}", "To perform activities or speaking drills regularly to enhance your fluency in {topic}.", "I practice talking about {topic} every week to gain confidence."),
                ("Key expression for {topic}", "A highly useful idiomatic or communicative phrase when discussing {topic}.", "Native speakers use this expression frequently when engaging in {topic}."),
                ("Ask about {topic}", "To request information, guidance or clarification regarding {topic}.", "Excuse me, could you give me more details about {topic}?"),
                ("Describing {topic}", "To explain the main characteristics, details or opinions about {topic}.", "She gave a vivid description of {topic} during the group discussion."),
                ("Action plan for {topic}", "A practical strategy or organized steps taken to handle {topic}.", "We created a practical action plan to master {topic} step by step."),
                ("Common situation in {topic}", "A typical everyday scenario that learners encounter regarding {topic}.", "This is a very common situation when you deal with {topic} abroad."),
                ("Solving issues with {topic}", "How to communicate solutions, overcome challenges and handle doubts in {topic}.", "Good communication helps in solving most issues related to {topic}."),
                ("Useful phrases for {topic}", "Practical phrases that help you speak more naturally about {topic}.", "Reviewing these useful phrases makes talking about {topic} effortless."),
                ("Review and mastery of {topic}", "Consolidating your vocabulary and communicative skills in {topic}.", "Consistent review leads to complete mastery of {topic}.")
            ]
            for f_tmpl, b_tmpl, exp_tmpl in base_templates:
                if len(cards_data) >= count:
                    break
                front_val = f_tmpl.format(topic=topic.lower()).strip()
                if front_val.lower() in existing_fronts:
                    continue
                existing_fronts.add(front_val.lower())
                cards_data.append({
                    "front": front_val,
                    "back": b_tmpl.format(topic=topic.lower()).strip(),
                    "options": [
                        front_val,
                        f"Unrelated phrase for {topic.lower()}",
                        f"Grammar mistake in {topic.lower()}",
                        f"Opposite meaning in {topic.lower()}"
                    ],
                    "explanation": exp_tmpl.format(topic=topic.lower()).strip(),
                    "image_search_query": f"{topic.lower()} discussion communication",
                    "image_prompt": f"Realistic educational photo representing {topic.lower()} with natural lighting and no text",
                })

        # Validação estrita e retry com LLM para cada card
        validated_cards = []
        for raw_c in cards_data:
            c = dict(raw_c)
            is_valid, errors = validate_flashcard_data(c)
            retry_count = 0

            while not is_valid and retry_count < 2 and client:
                retry_count += 1
                logger.info(
                    f"[CEFR Generator] Card inválido (tentativa {retry_count}/2). Erros: {errors}. Executando retry..."
                )
                retry_prompt = f"""You are Teacher Tatiana Duarte, expert ESL teacher.
A flashcard generated for CEFR level {lvl} on topic "{topic}" failed validation with the following errors:
{json.dumps(errors)}

Here is the invalid card data:
{json.dumps(c)}

Fix this flashcard according to these STRICT RULES:
1. "front": English target word/expression (>= 2 characters).
2. "back": Clear English definition suited for CEFR Level {lvl} (>= 5 characters).
3. "options": EXACTLY 4 distinct English options. "front" MUST appear in "options" exactly once. The other 3 options MUST be plausible, realistic English words/expressions in the same lexical field. NEVER use "Alternative N", "Option A", "None of the above", or placeholders.
4. "explanation": Example sentence in English demonstrating natural context (>= 5 characters).
5. "image_search_query": 2-4 concrete English visual search terms with no spoilers.
6. "image_prompt": Photographic visual prompt with no text, letters or logos.

Return ONLY a JSON object:
{{
  "front": "...",
  "back": "...",
  "options": ["...", "...", "...", "..."],
  "explanation": "...",
  "image_search_query": "...",
  "image_prompt": "..."
}}"""
                try:
                    retry_res = client.chat.completions.create(
                        model=groq_model,
                        messages=[{"role": "user", "content": retry_prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                    )
                    fixed_c = json.loads(retry_res.choices[0].message.content)
                    is_valid, errors = validate_flashcard_data(fixed_c)
                    if is_valid:
                        c = fixed_c
                        break
                except Exception as e:
                    logger.warning(f"[CEFR Generator] Falha no retry do flashcard: {e}")

            if not is_valid:
                logger.warning(
                    f"[CEFR Generator] Descartando flashcard inválido após retries: {c}. Erros: {errors}"
                )
                continue

            validated_cards.append(c)

        from .image_service import ImageResolverService

        # Deduplicação rigorosa por front
        unique_cards = []
        seen_fronts = set()
        for c in validated_cards:
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
                front = (c.get("front") or "").strip()
                back = (c.get("back") or "").strip()
                explanation = (c.get("explanation") or "").strip()
                search_query = (c.get("image_search_query") or "").strip() or None
                visual_prompt = (c.get("image_prompt") or "").strip() or None
                raw_options = c.get("options") or []
                cleaned_opts = [str(o).strip() for o in raw_options if str(o).strip()]

                img_url = ImageResolverService.resolve_image(
                    term=front,
                    topic=deck_title,
                    search_query=search_query,
                    visual_prompt=visual_prompt,
                    explanation=explanation,
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
        topic_context: Optional[Dict[str, Any]] = None,
    ) -> List[CEFRSimulation]:
        """
        Gera simulações comunicativas interativas reais utilizando LLM e salva na tabela cefr_simulations.
        """
        if topic_context and topic_context.get("topic"):
            topic = topic_context["topic"]

        sim_topic = (title or topic).strip()
        lvl = (level or "A1").strip().upper()
        client = cls._get_groq_client()

        context_notes = []
        if topic_context:
            if topic_context.get("items"):
                items_str = ", ".join(str(it) for it in topic_context["items"] if str(it).strip())
                if items_str:
                    context_notes.append(f"Target vocabulary / expressions: {items_str}")
            if topic_context.get("communicative_goal"):
                context_notes.append(f"Communicative goal: {topic_context['communicative_goal']}")

        notes_str = ("\n" + "\n".join(context_notes)) if context_notes else ""

        sim_data = None
        if client:
            prompt = f"""You are Teacher Tatiana Duarte, an expert ESL teacher.
Generate 1 interactive conversational simulation for CEFR Level {lvl} on the topic: "{sim_topic}".{notes_str}

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
            configured_model = getattr(
                settings, "GROQ_MODEL", os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
            )
            candidate_models = [
                configured_model,
                "openai/gpt-oss-120b",
                "openai/gpt-oss-20b",
                "qwen/qwen3.8-27b",
            ]
            for m_candidate in candidate_models:
                try:
                    res = client.chat.completions.create(
                        model=m_candidate,
                        messages=[{"role": "user", "content": prompt}],
                        response_format={"type": "json_object"},
                        temperature=0.3,
                    )
                    parsed = json.loads(res.choices[0].message.content)
                    if parsed and parsed.get("scenario"):
                        sim_data = parsed
                        break
                except Exception as e:
                    logger.warning(f"[CEFR Generator] Erro ao gerar simulação com Groq ({m_candidate}): {e}")

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
        cls, reference_ids: List[str], fallback_level: str = "A1"
    ) -> Dict[str, Any]:
        """
        Extrai tópicos reais a partir do conteúdo textual de TODOS os arquivos de referência selecionados.
        Garante que:
        1. Cada arquivo contribui com múltiplos tópicos pedagógicos relevantes (não limitando a 1 por arquivo).
        2. A origem de cada tópico (source_file, reference_id) é preservada na consolidação.
        3. Se os textos não estiverem no banco, extrai texto do PDF e divide em chunks.
        """
        from .models import CEFRReference
        from django.db import connection
        from psycopg2.extras import Json
        import uuid
        import json

        cleaned_ids = [str(r).strip() for r in reference_ids if str(r).strip()]
        refs = list(CEFRReference.objects.filter(id__in=cleaned_ids))
        level = (
            refs[0].cefr_level.upper()
            if (refs and refs[0].cefr_level)
            else (fallback_level.upper() if fallback_level else "A1")
        )

        all_consolidated_topics: List[Dict[str, Any]] = []
        client = cls._get_groq_client()
        groq_model = getattr(
            settings, "GROQ_MODEL", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        )

        for ref in refs:
            ref_level = (ref.cefr_level or level).strip().upper()
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
                logger.warning(
                    f"[CEFR Generator] Erro ao consultar cefr_documents para {ref.filename}: {e}"
                )

            # 2. Se não houver chunks e storage_url existir, faz download e extrai
            if not text_found and ref.storage_url:
                try:
                    import io, requests, pypdf

                    logger.info(
                        f"[CEFR Generator] Baixando e extraindo texto para {ref.filename} de {ref.storage_url[:50]}..."
                    )
                    resp = requests.get(ref.storage_url, timeout=20)
                    if resp.status_code == 200:
                        reader = pypdf.PdfReader(io.BytesIO(resp.content))
                        pages_text = [p.extract_text() or "" for p in reader.pages]
                        full_pdf_text = "\n".join(pages_text).strip()
                        if full_pdf_text:
                            text_found = full_pdf_text
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
                                            ref_level,
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
                    logger.warning(
                        f"[CEFR Generator] Falha ao extrair PDF para {ref.filename}: {e}"
                    )

            # 3. Extrai múltiplos tópicos específicos deste arquivo de referência
            ref_topics: List[Dict[str, Any]] = []
            if client and text_found:
                prompt = f"""You are an expert ESL curriculum designer.
Analyze the following pedagogical text from reference file '{ref.filename}' (CEFR Level {ref_level}):
---
{text_found[:5000]}
---
Extract ALL distinct real-world topics, communicative functions, grammar points, or vocabulary themes directly present in this specific document.
DO NOT limit to a single topic: provide 2 to 5 distinct, practical topics covered in this material.
For each topic:
1. "topic": A clear pedagogical title representing this topic or communicative goal.
2. "items": 4 to 8 target vocabulary words, expressions or practice phrases from this section.
3. "count": Number of items in the list.

Format strictly as JSON:
{{
  "topics": [
    {{
      "topic": "Topic Name",
      "items": ["word1", "word2", "word3", "word4"],
      "count": 4
    }}
  ]
}}"""
                for candidate_model in [groq_model, "llama-3.3-70b-versatile", "openai/gpt-oss-120b"]:
                    try:
                        res = client.chat.completions.create(
                            model=candidate_model,
                            messages=[{"role": "user", "content": prompt}],
                            response_format={"type": "json_object"},
                            temperature=0.2,
                        )
                        parsed = json.loads(res.choices[0].message.content)
                        if parsed and parsed.get("topics"):
                            ref_topics = parsed.get("topics", [])
                            break
                    except Exception as exc:
                        logger.warning(
                            f"[CEFR Generator] Falha ao extrair tópicos de {ref.filename} com {candidate_model}: {exc}"
                        )

            # Fallback por arquivo caso o LLM não responda ou não haja texto
            if not ref_topics:
                clean_name = (
                    ref.filename.replace(".pdf", "")
                    .replace(".docx", "")
                    .replace(".txt", "")
                    .replace("_", " ")
                    .replace("-", " ")
                    .title()
                )
                if ref_level in ["B1", "B2"]:
                    ref_topics = [
                        {
                            "topic": f"{clean_name} - Practical Communication",
                            "items": ["dialogue practice", "vocabulary in context", "key structures", "speaking prompts"],
                            "count": 4,
                        },
                        {
                            "topic": f"{clean_name} - Grammar & Applied Usage",
                            "items": ["sentence building", "error correction", "functional phrasing", "fluency drills"],
                            "count": 4,
                        },
                    ]
                else:
                    ref_topics = [
                        {
                            "topic": f"{clean_name} - Core Vocabulary",
                            "items": ["everyday words", "common expressions", "pronunciation drills", "visual flashcards"],
                            "count": 4,
                        },
                        {
                            "topic": f"{clean_name} - Guided Practice",
                            "items": ["short questions", "daily answers", "matching pairs", "roleplay simulation"],
                            "count": 4,
                        },
                    ]

            # Enriquece cada tópico com a origem do arquivo de referência
            for t in ref_topics:
                enriched = {
                    "topic": t.get("topic", "General Topic").strip(),
                    "items": t.get("items", []),
                    "count": len(t.get("items", [])),
                    "source_file": ref.filename,
                    "reference_id": str(ref.id),
                    "level": ref_level,
                }
                all_consolidated_topics.append(enriched)

        # 4. Fallback se nenhuma referência foi passada
        if not all_consolidated_topics:
            if level in ["B1", "B2"]:
                all_consolidated_topics = [
                    {"topic": "Airport, Boarding and Flight Procedures", "items": ["boarding pass", "security checkpoint", "customs declaration", "carry-on luggage", "gate change", "departure lounge"], "count": 6, "source_file": "Curriculum Standard", "reference_id": None, "level": "B1"},
                    {"topic": "Job Interviews and Professional Career", "items": ["work experience", "strengths and weaknesses", "career goals", "leadership skills", "salary expectations"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "B1"},
                    {"topic": "Housing, Rent and Utilities", "items": ["lease agreement", "security deposit", "monthly rent", "utilities included", "landlord obligations"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "B2"},
                    {"topic": "Technology and Digital Communication", "items": ["cloud storage", "data privacy", "software development", "cybersecurity", "remote collaboration"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "B2"},
                ]
            elif level in ["C1", "C2"]:
                all_consolidated_topics = [
                    {"topic": "Diplomatic Negotiations and Global Trade", "items": ["bilateral agreements", "tariff exemptions", "geopolitical diplomacy", "economic sanctions", "multilateral treaties"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "C1"},
                    {"topic": "Advanced Academic Rhetoric and Research", "items": ["empirical methodology", "paradigm shift", "statistical validity", "peer review process", "hypothesis testing"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "C1"},
                    {"topic": "Ethics in Artificial Intelligence", "items": ["algorithmic bias", "autonomous systems", "moral accountability", "data governance", "machine learning safety"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "C2"},
                ]
            else:
                all_consolidated_topics = [
                    {"topic": "Family and Daily Relationships", "items": ["father", "mother", "sister", "brother", "cousin", "grandparents"], "count": 6, "source_file": "Curriculum Standard", "reference_id": None, "level": "A1"},
                    {"topic": "Hobbies, Sports and Free Time", "items": ["reading", "cycling", "cooking", "traveling", "listening to music"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "A1"},
                    {"topic": "Work, Jobs and Occupations", "items": ["teacher", "engineer", "doctor", "lawyer", "nurse", "pilot"], "count": 6, "source_file": "Curriculum Standard", "reference_id": None, "level": "A2"},
                    {"topic": "Daily Routine and Habits", "items": ["wake up", "take a shower", "have breakfast", "go to work", "exercise"], "count": 5, "source_file": "Curriculum Standard", "reference_id": None, "level": "A2"},
                ]

        return {"success": True, "level": level, "topics": all_consolidated_topics}

    @classmethod
    def run_single_schedule(cls, sched: CEFRSchedule) -> Dict[str, Any]:
        """
        Executa um agendamento individual gerando flashcards e/ou simulações
        baseados no topic_plan (ciclo de 4 semanas) e arquivos de referência selecionados.
        """
        from .models import CEFRReference
        from collections import defaultdict
        import random

        types = sched.selected_types or ["flashcards", "simulations"]
        count = sched.materials_per_execution or 10
        sched_ref_ids = sched.reference_ids if isinstance(sched.reference_ids, list) else []

        # Calcula a semana corrente do ciclo de 4 semanas
        created_date = sched.created_at.date() if sched.created_at else datetime.date.today()
        today = datetime.date.today()
        current_week = ((today - created_date).days // 7) % 4 + 1

        # Filtra tópicos do topic_plan onde weeks[str(current_week)] > 0
        topic_plan = sched.topic_plan if isinstance(sched.topic_plan, list) else []
        active_plan_topics = []
        for tp in topic_plan:
            if not isinstance(tp, dict):
                continue
            weeks = tp.get("weeks", {})
            if isinstance(weeks, dict):
                w_count = weeks.get(str(current_week), 0)
                try:
                    w_count_int = int(w_count)
                except (ValueError, TypeError):
                    w_count_int = 0
                if w_count_int > 0:
                    active_plan_topics.append({
                        "topic": tp.get("topic", "General"),
                        "items": tp.get("items", []),
                        "count": w_count_int,
                        "communicative_goal": tp.get("communicative_goal", ""),
                    })

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

            if active_plan_topics:
                # Executa com base nos tópicos ativos do topic_plan desta semana
                for plan_topic in active_plan_topics:
                    topic_ctx = {
                        "topic": plan_topic["topic"],
                        "items": plan_topic.get("items", []),
                        "communicative_goal": plan_topic.get("communicative_goal", ""),
                    }
                    # A quantidade de cards por baralho vem do agendamento configurado (materials_per_execution / count)
                    target_count = count if count > 0 else (plan_topic.get("count") or 10)

                    if "flashcards" in types:
                        cards = cls.generate_flashcards(
                            level=lvl,
                            topic=plan_topic["topic"],
                            count=target_count,
                            reference_ids=ref_ids_str,
                            topic_context=topic_ctx,
                        )
                        total_flashcards += len(cards)

                    if "simulations" in types:
                        sims = cls.generate_simulations(
                            level=lvl,
                            topic=plan_topic["topic"],
                            count=1,
                            topic_context=topic_ctx,
                        )
                        total_sims += len(sims)
            else:
                # Fallback sem topic_plan: extrai tópicos das referências ou usa EVERYDAY_TOPICS
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
            f"[CEFR Scheduler] Agendamento {sched.id} (Semana {current_week}/4) concluído para níveis [{levels_str}]: "
            f"{total_flashcards} flashcards e {total_sims} simulações geradas."
        )
        return {
            "success": True,
            "levels": executed_levels,
            "current_week": current_week,
            "flashcards_generated": total_flashcards,
            "simulations_generated": total_sims,
            "message": f"Agendamento executado (Semana {current_week}/4) para os níveis [{levels_str}]: {total_flashcards} flashcards e {total_sims} simulações gerados.",
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

