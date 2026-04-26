"""
Plano de estudos semanal com detecção de progresso real do aluno.

Fluxo:
  1. get_or_generate_weekly_plan  → retorna plano atual (cache 7 dias)
  2. check_plan_progress          → analisa histórico e marca tópicos praticados
  3. generate_transition_exercises → RAG + LLM geram exercícios de transição (5-10 q)
  4. get_or_generate_weekly_plan  → chamada seguinte já gera novo plano (cache expirado)
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from typing import Literal

from services.llm import groq_chat
from services.database import get_client
from services.upstash import cache_get, cache_set, cache_delete

# ─────────────────────────────────────────────
# Helpers internos
# ─────────────────────────────────────────────

def _week_number() -> int:
    return date.today().isocalendar()[1]

def _week_key(username: str) -> str:
    return f"weekly_plan:{username}:{_week_number()}"

def _transition_done_key(username: str) -> str:
    return f"weekly_plan_transition_done:{username}:{_week_number()}"

def _progress_key(username: str) -> str:
    return f"weekly_plan_progress:{username}:{_week_number()}"


# ─────────────────────────────────────────────
# 1. GERAR / RETORNAR PLANO DA SEMANA
# ─────────────────────────────────────────────

async def get_or_generate_weekly_plan(username: str, level: str, focus: str) -> dict:
    """Retorna o plano da semana — do cache se existir, senão gera novo."""
    cache_key = _week_key(username)

    cached = await cache_get(cache_key)
    if cached:
        # Injeta status de progresso no retorno sem regerar o plano
        progress = await cache_get(_progress_key(username)) or {}
        if isinstance(cached, dict):
            cached["progress"] = progress
            # Sinaliza se a transição desta semana já foi feita
            transition_done = await cache_get(_transition_done_key(username))
            cached["transition_done"] = bool(transition_done)
        return cached

    plan = await _generate_plan(username, level, focus)
    await cache_set(cache_key, plan, ttl=60 * 60 * 24 * 7)  # 7 dias
    plan["progress"] = {}
    plan["transition_done"] = False
    return plan


# ─────────────────────────────────────────────
# 2. VERIFICAR PROGRESSO REAL DO ALUNO
# ─────────────────────────────────────────────

async def check_plan_progress(username: str) -> dict:
    """
    Analisa o histórico de mensagens desta semana e verifica quais tópicos
    do plano o aluno realmente praticou.

    Retorna:
        {
          "topic_name": "done" | "partial" | "not_started",
          ...
          "overall": "done" | "partial" | "not_started"
        }
    """
    plan_cached = await cache_get(_week_key(username))
    if not plan_cached or not plan_cached.get("focuses"):
        return {}

    focuses = plan_cached["focuses"]
    topics = [f["topic"] for f in focuses]

    # Busca mensagens do aluno nesta semana
    db = get_client()
    week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    try:
        convs = (
            db.table("conversations")
            .select("id")
            .eq("username", username)
            .gte("updated_at", week_start)
            .order("updated_at", desc=True)
            .limit(20)
            .execute()
            .data
        )
        history = ""
        for c in convs:
            msgs = (
                db.table("messages")
                .select("content, role")
                .eq("session_id", c["id"])
                .eq("role", "user")
                .order("created_at", desc=True)
                .limit(30)
                .execute()
                .data
            )
            history += "\n".join(m["content"] for m in msgs) + "\n"
    except Exception as e:
        print(f"[WeeklyPlan] Erro ao buscar histórico para progresso: {e}")
        return {}

    if not history.strip():
        progress = {t: "not_started" for t in topics}
        progress["overall"] = "not_started"
        await cache_set(_progress_key(username), progress, ttl=60 * 60 * 24 * 7)
        return progress

    topics_json = json.dumps(topics)
    prompt = f"""You are an English teacher reviewing a student's practice this week.

Weekly plan topics: {topics_json}

Student messages this week:
{history[:4000]}

For each topic, evaluate if the student actually practiced it in their messages.
Return ONLY valid JSON, no markdown:
{{
  "results": [
    {{"topic": "Topic name", "status": "done|partial|not_started", "evidence": "brief evidence or reason"}}
  ]
}}

Status guide:
- "done": student clearly practiced this topic multiple times
- "partial": student touched on it once or indirectly
- "not_started": no evidence of practice
"""
    try:
        res = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3,
        )
        start = res.find("{")
        end = res.rfind("}") + 1
        data = json.loads(res[start:end])

        progress: dict[str, str] = {}
        for item in data.get("results", []):
            progress[item["topic"]] = item.get("status", "not_started")

        # Calcula overall
        statuses = list(progress.values())
        if all(s == "done" for s in statuses):
            progress["overall"] = "done"
        elif all(s == "not_started" for s in statuses):
            progress["overall"] = "not_started"
        else:
            progress["overall"] = "partial"

        await cache_set(_progress_key(username), progress, ttl=60 * 60 * 24 * 7)
        return progress

    except Exception as e:
        print(f"[WeeklyPlan] Erro ao checar progresso: {e}")
        return {}


# ─────────────────────────────────────────────
# 3. EXERCÍCIOS DE TRANSIÇÃO (RAG)
# ─────────────────────────────────────────────

_EXERCISE_TYPES = ["quiz", "fill_in", "true_false", "reorder", "dialogue"]

_TYPE_PROMPTS = {
    "quiz": (
        "Generate {n} multiple-choice questions about the topics, using the reference material below.\n"
        "JSON: {{\"type\": \"quiz\", \"exercises\": ["
        "{{\"question\": \"...\", \"options\": [\"A\",\"B\",\"C\",\"D\"], \"correct_index\": 0, \"explanation\": \"...\"}}]}}"
    ),
    "fill_in": (
        "Create {n} fill-in-the-blank sentences about the topics, using examples from the reference material.\n"
        "JSON: {{\"type\": \"fill_in\", \"exercises\": ["
        "{{\"question\": \"She ___ to school every day.\", \"options\": [\"go\",\"goes\",\"going\",\"went\"], \"correct_index\": 1, \"explanation\": \"...\"}}]}}"
    ),
    "true_false": (
        "Write {n} true/false statements related to the topics and reference material.\n"
        "JSON: {{\"type\": \"true_false\", \"exercises\": ["
        "{{\"question\": \"Statement here.\", \"options\": [\"True\",\"False\"], \"correct_index\": 0, \"explanation\": \"...\"}}]}}"
    ),
    "reorder": (
        "Create {n} sentences where the words are scrambled. The student must choose the correct order.\n"
        "JSON: {{\"type\": \"reorder\", \"exercises\": ["
        "{{\"question\": \"Reorder: [went / she / yesterday / school / to]\", \"options\": [\"She went to school yesterday.\",\"She school went yesterday to.\",\"Yesterday she school to went.\",\"To school she went yesterday.\"], \"correct_index\": 0, \"explanation\": \"...\"}}]}}"
    ),
    "dialogue": (
        "Write {n} dialogue completion exercises using the topics and reference material.\n"
        "JSON: {{\"type\": \"dialogue\", \"exercises\": ["
        "{{\"question\": \"A: How long have you been here?\\nB: I ___ here for two hours.\", \"options\": [\"am\",\"was\",\"have been\",\"been\"], \"correct_index\": 2, \"explanation\": \"...\"}}]}}"
    ),
}


async def generate_transition_exercises(username: str) -> dict | None:
    """
    Gera 5-10 exercícios de transição de plano usando RAG (ChromaDB dos livros da Tati).
    Tipos e quantidade são aleatórios.
    Salva no banco como quiz e retorna os dados para o modal.
    Marca a transição como concluída no cache.
    """
    # Pega o plano atual
    plan_cached = await cache_get(_week_key(username))
    if not plan_cached or not plan_cached.get("focuses"):
        return None

    focuses = plan_cached["focuses"]
    topics = [f["topic"] for f in focuses]
    topics_str = ", ".join(topics)

    # Quantidade aleatória entre 5 e 10
    total_questions = random.randint(5, 10)

    # Tipo(s) aleatório(s) — pode misturar até 2 tipos
    chosen_types = random.sample(_EXERCISE_TYPES, k=random.choice([1, 1, 2]))  # favorece 1 tipo

    # Distribui questões entre os tipos
    counts: list[int] = []
    if len(chosen_types) == 1:
        counts = [total_questions]
    else:
        split = random.randint(2, total_questions - 2)
        counts = [split, total_questions - split]

    # Busca contexto RAG para os tópicos
    rag_context = _fetch_rag_context(topics_str)

    # Busca histórico recente do aluno para personalizar
    db = get_client()
    try:
        convs = (
            db.table("conversations")
            .select("id")
            .eq("username", username)
            .order("updated_at", desc=True)
            .limit(5)
            .execute()
            .data
        )
        student_history = ""
        for c in convs:
            msgs = (
                db.table("messages")
                .select("content, role")
                .eq("session_id", c["id"])
                .eq("role", "user")
                .order("created_at", desc=True)
                .limit(15)
                .execute()
                .data
            )
            student_history += "\n".join(m["content"] for m in msgs) + "\n"
    except Exception:
        student_history = ""

    # Gera exercícios para cada tipo
    all_exercises: list[dict] = []
    exercise_type_label = chosen_types[0]  # para título

    for ex_type, count in zip(chosen_types, counts):
        type_prompt = _TYPE_PROMPTS[ex_type].format(n=count)

        prompt = f"""You are an expert English teacher creating transition exercises for a student finishing their weekly study plan.

Weekly topics studied: {topics_str}

Reference material from Tati's books (use this to create authentic, contextual exercises):
{rag_context}

Student's recent messages (use to personalize difficulty and style):
{student_history[:2000] if student_history else "No history available."}

Task: {type_prompt}

IMPORTANT:
- Base exercises on the reference material when possible
- Match difficulty to the student's apparent level from their messages
- Make questions clearly about the weekly topics
- Return ONLY valid JSON, no markdown, no extra text
"""
        try:
            res = await groq_chat(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1800,
                temperature=0.65,
            )
            start = res.find("{")
            end = res.rfind("}") + 1
            data = json.loads(res[start:end])
            exercises = data.get("exercises", [])
            for ex in exercises:
                ex["_type"] = ex_type
            all_exercises.extend(exercises)
        except Exception as e:
            print(f"[WeeklyPlan] Erro ao gerar exercícios tipo {ex_type}: {e}")

    if not all_exercises:
        return None

    # Shuffle para misturar os tipos
    random.shuffle(all_exercises)

    # Monta título
    type_labels = {
        "quiz": "Multiple Choice",
        "fill_in": "Fill in the Blanks",
        "true_false": "True or False",
        "reorder": "Reorder",
        "dialogue": "Dialogue",
    }
    type_name = type_labels.get(exercise_type_label, "Practice")
    title = f"Weekly Review — {topics_str[:50]}"
    description = f"Complete this review before starting your new weekly plan. Topics: {topics_str}"

    # Salva no banco como quiz (igual ao exercise_generator.py)
    quiz_id = await _save_as_quiz(db, username, title, description, all_exercises)

    # Marca transição como feita
    await cache_set(_transition_done_key(username), True, ttl=60 * 60 * 24 * 7)

    # Invalida cache do plano para forçar geração novo na próxima chamada
    await cache_delete(_week_key(username))

    return {
        "quiz_id": quiz_id,
        "title": title,
        "description": description,
        "topics": topics,
        "total_questions": len(all_exercises),
        "exercises": all_exercises,
    }


def _fetch_rag_context(query: str) -> str:
    """Busca contexto no ChromaDB (livros/PDFs da Tati)."""
    try:
        from services.rag_search import obter_contexto_rag
        result = obter_contexto_rag(query)
        return result.contexto or "No reference material found for these topics."
    except Exception as e:
        print(f"[WeeklyPlan] RAG error: {e}")
        return "No reference material available."


async def _save_as_quiz(db, username: str, title: str, description: str, exercises: list[dict]) -> str | None:
    """Salva os exercícios como quiz no banco (reutiliza estrutura do exercise_generator)."""
    PERSONALIZED_MODULE_ID = "00000000-0000-0000-0000-000000000001"
    try:
        mod_check = db.table("modules").select("id").eq("id", PERSONALIZED_MODULE_ID).execute()
        if not mod_check.data:
            db.table("modules").insert({
                "id": PERSONALIZED_MODULE_ID,
                "title": "Personalized Practice",
                "description": "Exercises generated by Tati based on your chat history.",
                "level": "All",
                "is_published": True,
            }).execute()
    except Exception as e:
        print(f"[WeeklyPlan] Aviso módulo: {e}")

    try:
        quiz_res = db.table("quizzes").insert({
            "module_id": PERSONALIZED_MODULE_ID,
            "username": username,
            "title": title,
            "description": description,
        }).execute()

        if not quiz_res.data:
            return None

        quiz_id = quiz_res.data[0]["id"]

        for i, q in enumerate(exercises):
            db.table("quiz_questions").insert({
                "quiz_id": quiz_id,
                "question": q.get("question", ""),
                "options": q.get("options", []),
                "correct_index": q.get("correct_index", 0),
                "explanation": q.get("explanation", ""),
                "order": i,
            }).execute()

        # Invalida cache de módulos do aluno
        try:
            from services.upstash import cache_delete
            await cache_delete(f"modules:list:{username}")
        except Exception:
            pass

        print(f"[WeeklyPlan] Quiz de transição gerado: {quiz_id} para {username}")
        return quiz_id

    except Exception as e:
        print(f"[WeeklyPlan] Erro ao salvar quiz: {e}")
        return None


# ─────────────────────────────────────────────
# 4. GERAÇÃO DO PLANO (interno)
# ─────────────────────────────────────────────

async def _generate_plan(username: str, level: str, focus: str) -> dict:
    db = get_client()

    # Busca histórico recente
    try:
        convs = (
            db.table("conversations")
            .select("id")
            .eq("username", username)
            .order("updated_at", desc=True)
            .limit(10)
            .execute()
            .data
        )
        history = ""
        for c in convs:
            msgs = (
                db.table("messages")
                .select("content, role")
                .eq("session_id", c["id"])
                .eq("role", "user")
                .order("created_at", desc=True)
                .limit(20)
                .execute()
                .data
            )
            history += "\n".join(m["content"] for m in msgs) + "\n"
    except Exception as e:
        print(f"[WeeklyPlan] Erro ao buscar histórico: {e}")
        history = ""

    # Busca progresso da semana anterior para adaptar o novo plano
    prev_week_key = f"weekly_plan_progress:{username}:{_week_number() - 1}"
    prev_progress = await cache_get(prev_week_key) or {}

    not_done = [topic for topic, status in prev_progress.items()
                if topic != "overall" and status in ("not_started", "partial")]

    prev_context = ""
    if not_done:
        prev_context = f"\nTopics the student did NOT fully practice last week (prioritize these): {', '.join(not_done)}"

    week_start = date.today() - timedelta(days=date.today().weekday())
    week_end = week_start + timedelta(days=6)

    prompt = f"""You are an expert English teacher. Analyze this student's recent messages and generate a focused weekly study plan.

Student level: {level}
Learning focus: {focus}
Week: {week_start.strftime('%b %d')} - {week_end.strftime('%b %d, %Y')}
{prev_context}

Recent student messages:
{history[:3000] if history else "No history yet — generate a plan based on level and focus."}

Generate a weekly study plan with exactly 3 focus areas for this week.
Return ONLY valid JSON, no markdown:
{{
  "week": "{week_start.strftime('%b %d')} - {week_end.strftime('%b %d')}",
  "greeting": "Short motivational sentence (max 10 words)",
  "focuses": [
    {{"topic": "Topic name", "why": "One sentence why this matters", "tip": "One practical tip"}},
    {{"topic": "Topic name", "why": "One sentence why this matters", "tip": "One practical tip"}},
    {{"topic": "Topic name", "why": "One sentence why this matters", "tip": "One practical tip"}}
  ]
}}"""

    try:
        res = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=600,
            temperature=0.7,
        )
        start = res.find("{")
        end = res.rfind("}") + 1
        return json.loads(res[start:end])
    except Exception as e:
        print(f"[WeeklyPlan] Erro ao gerar: {e}")
        return _fallback_plan(level, week_start, week_end)


def _fallback_plan(level: str, week_start: date, week_end: date) -> dict:
    return {
        "week": f"{week_start.strftime('%b %d')} - {week_end.strftime('%b %d')}",
        "greeting": "Keep practicing — consistency is key!",
        "focuses": [
            {"topic": "Conversation Practice", "why": "Build confidence speaking naturally.", "tip": "Try to write 5 sentences today without stopping."},
            {"topic": "Vocabulary Expansion", "why": "More words = more expression.", "tip": "Learn 3 new words and use them in chat."},
            {"topic": "Grammar Review", "why": "Solid grammar makes you sound fluent.", "tip": "Focus on verb tenses in your messages."},
        ]
    }