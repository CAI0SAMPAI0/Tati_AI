from fastapi import APIRouter, Depends, HTTPException, Query
from routers.deps import get_current_user
from services.database import get_client
from services.llm import groq_chat, GroqKeyError, GROQ_KEYS
from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()
router = APIRouter()

ALLOWED_ROLES = ("professor", "professora", "programador", "Tatiana", "Tati")

# Mapeamento lang → instrução de idioma para o modelo
LANG_INSTRUCTION = {
    "pt-BR": "Respond entirely in Brazilian Portuguese (pt-BR).",
    "en-US": "Respond entirely in English (US).",
    "en-UK": "Respond entirely in English (UK).",
}
DEFAULT_LANG = "pt-BR"


class StudentUpdate(BaseModel):
    level: str | None = None
    custom_prompt: str | None = None


def _require_staff(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user


@router.get("/stats")
async def get_stats(current_user: dict = Depends(_require_staff)):
    db = get_client()

    students = (
        db.table("users")
        .select("username")
        .eq("role", "student")
        .execute()
    )
    messages = (
        db.table("messages")
        .select("id")
        .eq("role", "user")
        .execute()
    )

    from datetime import date
    today = date.today().isoformat()
    active_today = (
        db.table("messages")
        .select("username")
        .eq("role", "user")
        .eq("date", today)
        .execute()
    )
    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today":   len(set(m["username"] for m in active_today.data)),
    }


@router.get("/students")
async def get_students(current_user: dict = Depends(_require_staff)):
    db = get_client()
    students = (
        db.table("users")
        .select("username, name, level, focus, created_at, custom_prompt")
        .eq("role", "student")
        .order("created_at", desc=True)
        .execute()
        .data
    )
    result = []
    for u in students:
        msgs = (
            db.table("messages")
            .select("id")
            .eq("username", u["username"])
            .eq("role", "user")
            .execute()
        )
        last = (
            db.table("messages")
            .select("date")
            .eq("username", u["username"])
            .order("id", desc=True)
            .limit(1)
            .execute()
            .data
        )
        result.append({
            **u,
            "total_messages": len(msgs.data),
            "last_active":    last[0]["date"] if last else "---",
        })

    return result


@router.get("/students/{username}/insight")
async def get_student_insight(
    username: str,
    lang: str = Query(default=DEFAULT_LANG),
    current_user: dict = Depends(_require_staff),
):
    if not GROQ_KEYS:
        raise HTTPException(
            status_code=503,
            detail="Nenhuma GROQ_API_KEY configurada. Adicione ao .env e reinicie o servidor."
        )

    # Instrução de idioma — fallback para pt-BR se lang desconhecida
    lang_instruction = LANG_INSTRUCTION.get(lang, LANG_INSTRUCTION[DEFAULT_LANG])

    db = get_client()

    user_rows = (
        db.table("users")
        .select("name, level, focus, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    if not user_rows:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    student = user_rows[0]

    messages = (
        db.table("messages")
        .select("role, content, date")
        .eq("username", username)
        .order("id", desc=False)
        .limit(40)
        .execute()
        .data
    )

    if not messages:
        return {
            "insight": "Este aluno ainda não enviou nenhuma mensagem. Não há dados suficientes para gerar um insight."
        }

    history_text = ""
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher Tati"
        history_text += f"{role_label}: {m['content']}\n\n"

    prompt = f"""You are an expert English language pedagogy assistant helping a teacher understand a student's progress.

LANGUAGE RULE: {lang_instruction}

Student profile:
- Name: {student.get('name', username)}
- Current level: {student.get('level', 'Unknown')}
- Learning focus: {student.get('focus', 'General')}
- Member since: {student.get('created_at', 'Unknown')}

Recent conversation history ({len(messages)} messages):
---
{history_text}
---

Please provide a concise pedagogical report for the teacher, covering:

1. **Pontos Fortes / Strong Points** — What the student does well
2. **Principais Dificuldades / Main Difficulties** — Recurring grammar or vocabulary mistakes
3. **Nível Real Estimado / Estimated Real Level** — What level does the student actually seem to be?
4. **Recomendações / Recommendations** — 3 to 5 specific, actionable suggestions
5. **Motivação e Engajamento / Motivation & Engagement** — How engaged does the student seem?

Be specific and cite examples from the conversation. Keep the tone professional but warm.
Remember: {lang_instruction}"""

    try:
        result = await groq_chat(
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.4,
        )
        return {"insight": result}

    except GroqKeyError as e:
        err = str(e).lower()
        if "invalid_api_key" in err or "401" in err:
            raise HTTPException(
                status_code=401,
                detail="Chave(s) GROQ inválida(s). Verifique o .env e gere novas chaves em console.groq.com"
            )
        if "rate" in err or "429" in err:
            raise HTTPException(
                status_code=429,
                detail=f"Todas as {len(GROQ_KEYS)} chave(s) atingiram o limite. Aguarde e tente novamente."
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/students/{username}", status_code=204)
async def delete_student(username: str, current_user: dict = Depends(_require_staff)):
    db = get_client()
    user = db.table("users").select("username").eq("username", username).execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.table("messages").delete().eq("username", username).execute()
    db.table("conversations").delete().eq("username", username).execute()
    db.table("users").delete().eq("username", username).execute()


@router.put("/students/{username}")
async def update_student(
    username: str,
    body: StudentUpdate,
    current_user: dict = Depends(_require_staff)
):
    db = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    db.table("users").update(update_data).eq("username", username).execute()
    return {"ok": True}