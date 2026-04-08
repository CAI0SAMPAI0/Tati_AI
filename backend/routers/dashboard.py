# painel professor / programador -> insights, erros gramaticais, recomendações, relatórios.

from __future__ import annotations

import json
import re
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.llm import GroqKeyError, groq_chat

router = APIRouter()

LANG_INSTRUCTION = {
    "pt-BR": "Respond entirely in Brazilian Portuguese (pt-BR).",
    "en-US": "Respond entirely in English (US).",
    "en-UK": "Respond entirely in English (UK).",
}
DEFAULT_LANG = "pt-BR"


# ── Models ────────────────────────────────────────────────────────────────────


class StudentUpdate(BaseModel):
    level: str | None = None
    custom_prompt: str | None = None


class GrammarError(BaseModel):
    category: str
    count: int
    example: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _lang_instruction(lang: str) -> str:
    return LANG_INSTRUCTION.get(lang, LANG_INSTRUCTION[DEFAULT_LANG])


def _clean_json(text: str) -> str:
    return text.replace("```json", "").replace("```", "").strip()


def _student_messages(username: str, limit: int = 40) -> list[dict]:
    return (
        get_client()
        .table("messages")
        .select("role, content, date")
        .eq("username", username)
        .order("id", desc=False)
        .limit(limit)
        .execute()
        .data
    )


def _get_student(username: str) -> dict | None:
    rows = (
        get_client()
        .table("users")
        .select("name, level, focus, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else None


def _extract_grammar_errors(data: dict) -> list[dict]:
    errors = data.get("errors")
    if not isinstance(errors, list):
        return []
    result = []
    for item in errors:
        if not isinstance(item, dict):
            continue
        try:
            count = max(0, int(item.get("count", 0)))
        except (TypeError, ValueError):
            count = 0
        example = item.get("example")
        result.append(GrammarError(
            category=str(item.get("category", "Unknown")).strip() or "Unknown",
            count=count,
            example=str(example).strip() if isinstance(example, str) else None,
        ).model_dump())
    return result


def _feedback_based_errors(messages: list[dict]) -> list[dict]:
    """Extrai erros diretamente do feedback da Tati nas mensagens assistant."""
    feedback_line = re.compile(
        r"^\s*-\s*['\"]?(?P<wrong>[^'\"]+?)['\"]?\s*[→>-]+\s*should be\s*['\"]?(?P<right>[^'\"]+?)['\"]?"
        r"(?:\s*\((?P<reason>.+)\))?\s*$",
        flags=re.IGNORECASE,
    )
    counts: dict[str, dict] = {}
    for msg in messages:
        if msg.get("role") != "assistant" or "feedback" not in (msg.get("content") or "").lower():
            continue
        for line in msg["content"].splitlines():
            match = feedback_line.match(line.strip())
            if not match:
                continue
            wrong = (match.group("wrong") or "").strip()
            right = (match.group("right") or "").strip()
            reason = (match.group("reason") or "").strip()
            category = reason.split(":")[0].strip() if reason else "Corrected by teacher feedback"
            example = f"{wrong} → {right}" if wrong and right else None
            if category not in counts:
                counts[category] = {"category": category, "count": 0, "example": example}
            counts[category]["count"] += 1
    return [GrammarError(**v).model_dump() for v in counts.values()]


async def _call_groq_safe(messages: list[dict], max_tokens: int = 1500, temperature: float = 0.4) -> str:
    from core.config import settings
    if not settings.groq_keys:
        raise HTTPException(status_code=503, detail="Nenhuma GROQ_API_KEY configurada no .env")
    try:
        return await groq_chat(messages, max_tokens=max_tokens, temperature=temperature)
    except GroqKeyError as exc:
        err = str(exc).lower()
        if "invalid_api_key" in err or "401" in err:
            raise HTTPException(status_code=401, detail="Chave(s) GROQ inválida(s)")
        if "rate" in err or "429" in err:
            raise HTTPException(status_code=429, detail="Cota esgotada. Aguarde e tente novamente.")
        raise HTTPException(status_code=500, detail=str(exc))


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_stats(current_user: dict = Depends(require_staff)):
    from datetime import date
    db = get_client()
    today = date.today().isoformat()
    students = db.table("users").select("username").eq("role", "student").execute()
    messages = db.table("messages").select("id").eq("role", "user").execute()
    active_today = db.table("messages").select("username").eq("role", "user").eq("date", today).execute()
    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today": len({m["username"] for m in active_today.data}),
    }


@router.get("/students")
async def get_students(current_user: dict = Depends(require_staff)):
    db = get_client()
    students = (
        db.table("users")
        .select("username, name, level, focus, created_at, custom_prompt")
        .eq("role", "student")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return [
        {
            **s,
            "total_messages": len(db.table("messages").select("id").eq("username", s["username"]).eq("role", "user").execute().data),
            "last_active": (db.table("messages").select("date").eq("username", s["username"]).order("id", desc=True).limit(1).execute().data or [{}])[0].get("date", "---"),
        }
        for s in students
    ]


@router.put("/students/{username}")
async def update_student(username: str, body: StudentUpdate, current_user: dict = Depends(require_staff)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    get_client().table("users").update(update_data).eq("username", username).execute()
    return {"ok": True}


@router.delete("/students/{username}", status_code=204)
async def delete_student(username: str, current_user: dict = Depends(require_staff)):
    db = get_client()
    if not db.table("users").select("username").eq("username", username).execute().data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.table("messages").delete().eq("username", username).execute()
    db.table("conversations").delete().eq("username", username).execute()
    db.table("users").delete().eq("username", username).execute()


@router.get("/students/{username}/insight")
async def get_student_insight(
    username: str,
    lang: str = Query(default=DEFAULT_LANG),
    current_user: dict = Depends(require_staff),
):
    student = _get_student(username)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    messages = _student_messages(username)
    if not messages:
        return {"insight": "Este aluno ainda não enviou mensagens."}

    history_text = "\n\n".join(
        f"{'Student' if m['role'] == 'user' else 'Teacher Tati'}: {m['content']}"
        for m in messages
    )
    prompt = (
        f"You are an expert English language pedagogy assistant.\n\n"
        f"LANGUAGE RULE: {_lang_instruction(lang)}\n\n"
        f"Student: {student.get('name', username)} | Level: {student.get('level')} | "
        f"Focus: {student.get('focus')} | Since: {student.get('created_at')}\n\n"
        f"Conversation ({len(messages)} messages):\n---\n{history_text}\n---\n\n"
        f"Provide a concise pedagogical report covering:\n"
        f"1. Strong Points\n2. Main Difficulties\n3. Estimated Real Level\n"
        f"4. 3-5 Actionable Recommendations\n5. Motivation & Engagement\n\n"
        f"Be specific, cite examples, professional but warm.\nRemember: {_lang_instruction(lang)}"
    )

    result = await _call_groq_safe([{"role": "user", "content": prompt}], max_tokens=1500, temperature=0.4)
    return {"insight": result}


@router.get("/students/{username}/grammar-errors")
async def get_grammar_errors(
    username: str,
    lang: str = Query(default=DEFAULT_LANG),
    current_user: dict = Depends(require_staff),
):
    student = _get_student(username)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    messages = _student_messages(username)
    user_text = "\n\n".join(m["content"] for m in messages if m["role"] == "user")

    prompt = (
        f"You are an expert English language pedagogy assistant.\n\n"
        f"LANGUAGE RULE: {_lang_instruction(lang)}\n\n"
        f"Student: {student.get('name', username)} | Level: {student.get('level')}\n\n"
        f"Student messages:\n---\n{user_text}\n---\n\n"
        f"Identify grammar/spelling mistakes. Include even single occurrences (count=1).\n\n"
        f'Return ONLY valid JSON: {{"errors": [{{"category": "...", "count": N, "example": "..."}}]}}\n'
        f"No markdown, no extra text."
    )

    result = await _call_groq_safe([{"role": "user", "content": prompt}], max_tokens=1200, temperature=0.2)

    try:
        data = json.loads(_clean_json(result))
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Formato inválido retornado pela IA.")

    errors = _extract_grammar_errors(data)
    if not errors:
        errors = _feedback_based_errors(messages)
    return {"errors": errors}


@router.get("/students/{username}/recommendations")
async def get_recommendations(
    username: str,
    lang: str = Query(default=DEFAULT_LANG),
    current_user: dict = Depends(require_staff),
):
    student = _get_student(username)
    if not student:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")

    messages = _student_messages(username)
    user_text = "\n\n".join(m["content"] for m in messages if m["role"] == "user")

    prompt = (
        f"You are an expert English language pedagogy assistant.\n\n"
        f"LANGUAGE RULE: {_lang_instruction(lang)}\n\n"
        f"Student: {student.get('name', username)} | Level: {student.get('level')} | Focus: {student.get('focus')}\n\n"
        f"Student messages:\n---\n{user_text}\n---\n\n"
        f"Analyze struggles, goals, and interests. Provide 3-5 actionable recommendations.\n\n"
        f'Return ONLY valid JSON: {{"recommendations": ["..."], "interests": ["..."]}}\n'
        f"No markdown, no extra text."
    )

    result = await _call_groq_safe([{"role": "user", "content": prompt}], max_tokens=1200, temperature=0.2)

    try:
        data = json.loads(_clean_json(result))
        recommendations = data.get("recommendations", [])
        interests = data.get("interests", [])
        if not isinstance(recommendations, list) or not isinstance(interests, list):
            raise ValueError("Campos inválidos")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"Formato inválido: {exc}")

    return {"recommendations": recommendations, "interests": interests}


# backend/routers/dashboard.py
# substitua o endpoint get_overview_report completo

@router.get("/reports/overview")
async def get_overview_report(current_user: dict = Depends(require_staff)):
    from datetime import date, timedelta
    from collections import defaultdict
    db = get_client()
    today = date.today()

    students = db.table("users").select("username, level").eq("role", "student").execute()
    messages = db.table("messages").select("id").eq("role", "user").execute()
    active_today_rows = db.table("messages").select("username").eq("role", "user").eq("date", today.isoformat()).execute()

    # ── Level distribution ────────────────────────────────────────
    level_map = {
        "beginner": "Beginner",
        "pre-intermediate": "Pre-Intermediate",
        "pre intermediate": "Pre-Intermediate",
        "intermediate": "Intermediate",
        "business english": "Business English",
        "business": "Business English",
        "advanced": "Advanced",
    }
    counts: Counter = Counter()
    for s in students.data:
        normalized = (s.get("level") or "").strip().lower()
        key = level_map.get(normalized, "Outros")
        counts[key] += 1

    level_distribution = {k: counts[k] for k in [
        "Beginner", "Pre-Intermediate", "Intermediate",
        "Business English", "Advanced", "Outros"
    ]}

    # ── Weekly activity (últimos 7 dias, Seg→Dom) ─────────────────
    weekly_counts = defaultdict(int)
    for i in range(7):
        day = today - timedelta(days=today.weekday()) + timedelta(days=i)  # Seg=0 → Dom=6
        weekly_counts[day.isoformat()] = 0

    last_7_start = (today - timedelta(days=today.weekday())).isoformat()  # segunda desta semana
    weekly_rows = (
        db.table("messages")
        .select("date")
        .eq("role", "user")
        .gte("date", last_7_start)
        .lte("date", today.isoformat())
        .execute()
    )
    for row in weekly_rows.data:
        d = row.get("date")
        if d in weekly_counts:
            weekly_counts[d] += 1

    # Ordena Seg→Dom
    monday = today - timedelta(days=today.weekday())
    weekly_activity = [
        weekly_counts.get((monday + timedelta(days=i)).isoformat(), 0)
        for i in range(7)
    ]

    # ── Heatmap (últimas 4 semanas, 28 dias, Seg→Dom) ─────────────
    heatmap_counts = {}
    start_4w = today - timedelta(days=today.weekday() + 21)  # 4 semanas atrás (segunda)
    heatmap_rows = (
        db.table("messages")
        .select("date")
        .eq("role", "user")
        .gte("date", start_4w.isoformat())
        .lte("date", today.isoformat())
        .execute()
    )
    for row in heatmap_rows.data:
        d = row.get("date")
        if d:
            heatmap_counts[d] = heatmap_counts.get(d, 0) + 1

    max_day = max(heatmap_counts.values(), default=1)

    heatmap = []
    for week in range(4):
        monday_w = start_4w + timedelta(weeks=week)
        for day_offset in range(7):
            d = (monday_w + timedelta(days=day_offset)).isoformat()
            raw = heatmap_counts.get(d, 0)
            # Normaliza para 0-4 (nível do heatmap)
            level = 0
            if raw > 0:
                level = min(4, max(1, round((raw / max_day) * 4)))
            heatmap.append(level)

    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today": len({m["username"] for m in active_today_rows.data}),
        "level_distribution": level_distribution,
        "weekly_activity": weekly_activity,
        "heatmap": heatmap,
    }


@router.get("/difficulties")
async def get_overview_difficulties(current_user: dict = Depends(require_staff)):
    try:
        db = get_client()
        rows = db.table("users").select("username, current_difficulty").eq("role", "student").execute()
        alerts = [
            r for r in rows.data
            if r.get("current_difficulty") and str(r["current_difficulty"]).strip().lower() != "null"
        ]
        return {"alerts": alerts[:10]}
    except Exception as exc:
        print(f"Erro ao buscar dificuldades: {exc}")
        return {"alerts": []}
    
