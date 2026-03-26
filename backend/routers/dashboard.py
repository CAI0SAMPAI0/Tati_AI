from fastapi import APIRouter, Depends, HTTPException
from routers.deps import get_current_user
from services.database import get_client
from pydantic import BaseModel
from dotenv import load_dotenv
import os
from services.llm import stream_llm, LLM_PROVIDER

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
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

@router.get("/students/{username}/insight")
async def get_student_insight(username: str, current_user: dict = Depends(_require_staff)):
    # Alterado para buscar a chave da Anthropic
    anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente."
        )

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
        .order("id", desc=True)
        .limit(40)
        .execute()
        .data
    )
    messages.reverse()

    if not messages:
        return {
            "insight": "Este aluno ainda não enviou nenhuma mensagem. Não há dados suficientes para gerar um insight."
        }

    history_text = ""
    for m in messages:
        role_label = "Student" if m["role"] == "user" else "Teacher Tati"
        history_text += f"{role_label}: {m['content']}\n\n"

    # O Prompt continua o mesmo, a lógica pedagógica é idêntica
    prompt = f"""You are an expert English language pedagogy assistant... (seu prompt aqui)"""

    from groq import Groq, AsyncGroq

    # Inicializa o cliente da groq
    client = AsyncGroq(api_key=GROQ_API_KEY)

    last_error = None

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=1500,
            temperature=0.4,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return {"insight": response.choices[0].message.content}

    except Exception as e:
        error_str = str(e).lower()
        last_error = str(e)
        print(f"[Insight] falhou: {last_error[:150]}")

        # Erro de autenticação
        if "authentication" in error_str or "401" in error_str:
            raise HTTPException(
                status_code=401,
                detail="Chave da API Anthropic inválida."
            )

        # Erro de cota ou sobrecarga
        if "429" in error_str or "rate_limit" in error_str or "overloaded" in error_str:
            import asyncio
            await asyncio.sleep(2)
        

    if last_error and ("429" in last_error.lower() or "rate_limit" in last_error.lower()):
        raise HTTPException(
            status_code=429,
            detail="Cota da Anthropic esgotada ou servidor instável. Tente novamente em instantes."
        )

    raise HTTPException(
        status_code=500,
        detail=f"Erro ao gerar insight via Anthropic: {last_error}"
    )


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
