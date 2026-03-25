from fastapi import APIRouter, Depends, HTTPException
from routers.deps import get_current_user
from services.database import get_client
from pydantic import BaseModel
import anthropic
import os

router = APIRouter()

ALLOWED_ROLES = ("professor", "professora", "programador", "Tatiana", "Tati")


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


@router.get("/students/{username}/insight")
async def get_student_insight(username: str, current_user: dict = Depends(_require_staff)):
    db = get_client()

    # Busca dados do aluno
    user_rows = db.table("users").select("name, level, focus, created_at").eq("username", username).limit(1).execute().data
    if not user_rows:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    student = user_rows[0]

    # Busca as últimas 40 mensagens do aluno (somente as do usuário, não as da IA)
    messages = (
        db.table("messages")
        .select("role, content, date")
        .eq("username", username)
        .order("id", desc=True)
        .limit(40)
        .execute()
        .data
    )
    messages.reverse()  # ordem cronológica

    if not messages:
        return {"insight": "Este aluno ainda não enviou nenhuma mensagem. Não há dados suficientes para gerar um insight."}

    # Monta o histórico para a IA
    history_text = ""
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher Tati"
        history_text += f"{role_label}: {m['content']}\n\n"

    prompt = f"""You are an expert English language pedagogy assistant helping a teacher understand a student's progress.

Student profile:
- Name: {student.get('name', username)}
- Current level: {student.get('level', 'Unknown')}
- Learning focus: {student.get('focus', 'General')}
- Member since: {student.get('created_at', 'Unknown')}

Recent conversation history ({len(messages)} messages):
---
{history_text}
---

Please provide a concise pedagogical report in Portuguese for the teacher, covering:

1. **Pontos Fortes** — What the student does well (grammar, vocabulary, fluency, engagement)
2. **Principais Dificuldades** — Recurring grammar or vocabulary mistakes you noticed
3. **Nível Real Estimado** — Based on the messages, what level does the student actually seem to be?
4. **Recomendações para a Professora** — 3 to 5 specific, actionable suggestions the teacher can use in the next sessions
5. **Motivação e Engajamento** — How engaged does the student seem? Any notes on their learning style?

Be specific and cite examples from the conversation when possible. Keep the tone professional but warm."""

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    return {"insight": response.content[0].text}