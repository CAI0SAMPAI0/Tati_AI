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
    Função pura de validação de flashcards visuais (frente = palavra/frase; verso = apenas imagem).
    Regras:
    1. front deve ser string não-vazia (>= 2 caracteres), sem URLs nem placeholders.
    2. Campos obsoletos de texto/múltipla escolha ('back' preenchido ou 'options' não-vazio) são rejeitados.
    3. Deve conter referência/entrada visual válida ('image_url' HTTP(S) real sem domínios fake/placeholder
       OU 'image_search_query' >= 3 caracteres e/ou 'image_prompt' >= 10 caracteres para resolução real).
    """
    import re
    from urllib.parse import urlparse

    errors: list[str] = []
    if not isinstance(card, dict):
        return False, ["Card payload must be a dictionary."]

    front = card.get("front")
    back = card.get("back")
    raw_options = card.get("options")
    image_url = card.get("image_url")
    search_query = card.get("image_search_query")
    image_prompt = card.get("image_prompt")

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

    if not isinstance(front, str) or len(front.strip()) < 2:
        errors.append("Field 'front' must be a non-empty string with at least 2 characters.")
    else:
        clean_front = front.strip()
        if re.match(r"^https?://", clean_front, re.IGNORECASE):
            errors.append("Field 'front' must be a word or phrase, not a URL.")
        for pat in filler_patterns:
            if pat.match(clean_front):
                errors.append(f"Field 'front' ('{clean_front}') cannot be a placeholder.")
                break

    if isinstance(back, str) and back.strip():
        errors.append("Field 'back' text definition/translation is not allowed; back must be image-only.")

    if raw_options is not None and (not isinstance(raw_options, list) or len(raw_options) > 0):
        errors.append("Field 'options' is not allowed; flashcards are word/phrase-to-image only.")

    fake_host_tokens = ("example.com", "example.org", "placeholder", "dummyimage", "fake", "localhost", "loremflickr")
    has_valid_url = False
    if image_url is not None and str(image_url).strip() != "":
        if not isinstance(image_url, str):
            errors.append("Field 'image_url' must be a valid HTTP(S) URL string.")
        else:
            raw_url = image_url.strip()
            parsed = urlparse(raw_url)
            host = (parsed.netloc or "").lower()
            if parsed.scheme not in ("http", "https") or not host or "." not in host:
                errors.append("Field 'image_url' must be a real HTTP(S) URL, not plain text.")
            elif any(tok in host for tok in fake_host_tokens):
                errors.append(f"Field 'image_url' host '{host}' is a placeholder/fake domain.")
            else:
                has_valid_url = True

    has_search_query = isinstance(search_query, str) and len(search_query.strip()) >= 3
    has_image_prompt = isinstance(image_prompt, str) and len(image_prompt.strip()) >= 10

    if has_search_query and re.match(r"^https?://", search_query.strip(), re.IGNORECASE):
        errors.append("Field 'image_search_query' must be descriptive keywords, not a URL.")
        has_search_query = False

    if has_image_prompt and re.match(r"^https?://", image_prompt.strip(), re.IGNORECASE):
        errors.append("Field 'image_prompt' must be a visual description, not a URL.")
        has_image_prompt = False

    if not has_valid_url and not has_search_query and not has_image_prompt:
        errors.append(
            "Flashcard must provide a valid 'image_url' or visual generation inputs ('image_search_query' / 'image_prompt')."
        )

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

        # Sanitiza eventuais campos legados caso o LLM os inclua por engano antes da validação
        sanitized_raw_cards = []
        for raw_item in cards_data:
            if isinstance(raw_item, dict):
                sanitized_raw_cards.append(
                    {
                        "front": raw_item.get("front"),
                        "image_search_query": raw_item.get("image_search_query"),
                        "image_prompt": raw_item.get("image_prompt"),
                    }
                )
        cards_data = sanitized_raw_cards

        # Fallback caso a chave de IA não esteja configurada ou retorne menos itens que o solicitado
        if not cards_data or len(cards_data) < count:
            existing_fronts = {str(c.get("front", "")).strip().lower() for c in cards_data}
            if topic_context and isinstance(topic_context.get("items"), list):
                seed_terms = [str(it).strip() for it in topic_context["items"] if str(it).strip()]
            else:
                seed_terms = []
            default_visual_terms = seed_terms + [
                f"{topic.strip()}",
                f"Asking for help in {topic.lower()}",
                f"Checking details in {topic.lower()}",
                f"Everyday conversation about {topic.lower()}",
                f"Planning ahead for {topic.lower()}",
            ]
            for candidate_front in default_visual_terms:
                if len(cards_data) >= count:
                    break
                front_val = candidate_front.strip()
                if len(front_val) < 2 or front_val.lower() in existing_fronts:
                    continue
                existing_fronts.add(front_val.lower())
                cards_data.append(
                    {
                        "front": front_val,
                        "image_search_query": f"{topic.lower()} {front_val.lower()} real scene",
                        "image_prompt": (
                            f"Realistic documentary photograph illustrating {front_val} in the context of {topic.lower()}, "
                            f"natural lighting, no text, no letters, no watermark"
                        ),
                    }
                )

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
A word-to-image flashcard generated for CEFR level {lvl} on topic "{topic}" failed validation with the following errors:
{json.dumps(errors)}

Here is the invalid card data:
{json.dumps(c)}

Fix this flashcard according to these STRICT RULES:
1. "front": English target word or short phrase (1-4 words, >= 2 characters). Never a URL or placeholder.
2. DO NOT include "back", "options", or "explanation". Flashcards are strictly front (word/phrase) -> back (image only).
3. "image_search_query": 2-5 concrete, physical English words depicting the visual subject of "front" (never a URL, never trophies/shrines/puzzles).
4. "image_prompt": Realistic photographic description depicting "front" with natural lighting, strictly no text, no letters, no signage, no watermark (never a URL).

Return ONLY a JSON object:
{{
  "front": "...",
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
                search_query = (c.get("image_search_query") or "").strip() or None
                visual_prompt = (c.get("image_prompt") or "").strip() or None

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
                        "back": "",
                        "explanation": "",
                        "image_url": img_url,
                        "options": [],
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
            prompt = PromptManager.get_prompt(
                "cefr_activity_generator",
                section="Simulation Generator",
                lvl=lvl,
                sim_topic=sim_topic,
                notes_str=notes_str,
            )
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
            settings, "GROQ_MODEL", os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
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

            # 2. Se não houver chunks, busca primeiro no volume local e depois via storage_url
            if not text_found:
                try:
                    import io, requests, pypdf
                    raw_bytes = None

                    # 2.1 Verifica se o arquivo existe salvo no volume local
                    cefr_dir = os.path.join(settings.MEDIA_ROOT, "cefr_references")
                    candidate_local = [
                        os.path.join(cefr_dir, f"{ref.id}_{ref.filename}"),
                        os.path.join(cefr_dir, ref.filename),
                    ]
                    for loc_path in candidate_local:
                        if os.path.exists(loc_path) and os.path.getsize(loc_path) > 0:
                            with open(loc_path, "rb") as lf:
                                raw_bytes = lf.read()
                            logger.info(f"[CEFR Generator] Lendo arquivo CEFR direto do volume local: {loc_path}")
                            break

                    # 2.2 Se não estiver local, baixa da URL
                    if not raw_bytes and ref.storage_url:
                        logger.info(
                            f"[CEFR Generator] Baixando e extraindo texto para {ref.filename} de {ref.storage_url[:50]}..."
                        )
                        resp = requests.get(ref.storage_url, timeout=20)
                        if resp.status_code == 200:
                            raw_bytes = resp.content
                            # Salva no volume para consultas futuras
                            try:
                                os.makedirs(cefr_dir, exist_ok=True)
                                with open(candidate_local[0], "wb") as sf:
                                    sf.write(raw_bytes)
                            except Exception:
                                pass

                    if raw_bytes:
                        if ref.filename.lower().endswith(".pdf"):
                            reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
                            pages_text = [p.extract_text() or "" for p in reader.pages]
                            full_pdf_text = "\n".join(pages_text).strip()
                        else:
                            full_pdf_text = raw_bytes.decode("utf-8", errors="ignore").strip()

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
                for candidate_model in [groq_model, "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]:
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

