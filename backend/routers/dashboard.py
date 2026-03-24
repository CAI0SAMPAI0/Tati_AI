from fastapi import APIRouter, Depends, HTTPException
from routers.deps import get_current_user
from services.database import get_client

router = APIRouter()

ALLOWED_ROLES = ("professor", "professora", "programador", 'Tatiana', 'Tati')

def _require_staff(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ALLOWED_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return current_user

@router.get("/stats")
async def get_stats(current_user: dict = Depends(_require_staff)):
    db = get_client()

    # total de usuários
    students = (
        db.table("users")
        .select("username")
        .eq("role", "student")
        .execute()
    )

    # Total de mensagens
    messages = (
        db.table("messages")
        .select("id")
        .eq("role", "user")
        .execute()
    )

    # alunos ativos (último login nos últimos 30 dias)
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
        .select("username, name, level, focus, created_at")
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
            "total_messages": msgs.count or 0,
            "last_active":    last[0]["date"] if last else "---",
        })

    return result