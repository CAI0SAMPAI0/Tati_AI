# Router de autenticação: login, registro, Google OAuth, recuperação de senha.
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel

from core.config import settings
from core.security import (
    create_access_token,
    generate_temp_password,
    hash_password,
    verify_password,
)
from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.email import send_reset_email

router = APIRouter()


# ── Models 


class RegisterBody(BaseModel):
    name: str
    email: str
    username: str
    password: str
    level: str = "Beginner"


class GoogleBody(BaseModel):
    token: str


class ForgotPasswordBody(BaseModel):
    identifier: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


class StudentUpdate(BaseModel):
    level: str | None = None
    custom_prompt: str | None = None


# ── Helpers 


def _find_user(identifier: str, fields: str = "username, name, email, password, role, level, focus") -> dict | None:
    db = get_client()
    ident = identifier.strip().lower()
    for column in ("username", "email"):
        rows = db.table("users").select(fields).eq(column, ident).limit(1).execute().data
        if rows:
            return rows[0]
    return None


def _build_token_response(user: dict) -> dict:
    token = create_access_token({"sub": user["username"], "role": user.get("role", "student")})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: v for k, v in user.items() if k != "password"},
    }


# ── Login ─


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    user = _find_user(form.username)
    if not user or not verify_password(form.password, user["password"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
    return _build_token_response(user)


# ── Register 


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 6 caracteres")

    db = get_client()
    username = body.username.strip().lower()
    email = body.email.strip().lower()

    existing = (
        db.table("users")
        .select("username")
        .or_(f"username.eq.{username},email.eq.{email}")
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username ou e-mail já cadastrado")

    db.table("users").insert({
        "username": username,
        "name": body.name.strip(),
        "email": email,
        "password": hash_password(body.password),
        "role": "student",
        "level": body.level,
        "focus": "General Conversation",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    return {"ok": True, "message": "Conta criada com sucesso"}


# ── Google OAuth 


@router.post("/google")
async def google_login(body: GoogleBody):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth não configurado")

    try:
        info = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            settings.google_client_id,
            clock_skew_in_seconds=60,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Token Google inválido: {exc}")

    email = info.get("email", "").lower()
    name = info.get("name", email.split("@")[0])
    base_username = email.split("@")[0].replace(".", "_").lower()

    db = get_client()
    rows = db.table("users").select("username, name, email, role, level, focus").eq("email", email).limit(1).execute().data

    if rows:
        return _build_token_response(rows[0])

    # Garante username único
    username = base_username
    suffix = 1
    while db.table("users").select("username").eq("username", username).execute().data:
        username = f"{base_username}{suffix}"
        suffix += 1

    new_user = {
        "username": username,
        "name": name,
        "email": email,
        "password": "google_authenticated",
        "role": "student",
        "level": "Beginner",
        "focus": "General Conversation",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    db.table("users").insert(new_user).execute()

    return _build_token_response({k: v for k, v in new_user.items() if k != "password"} | {"username": username})


# ── Forgot password 


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    user = _find_user(body.identifier, "username, name, email, password")
    if not user:
        return {"ok": True, "message": "Se o usuário existir, um e-mail será enviado."}

    if user["password"] == "google_authenticated":
        return {"ok": False, "message": "Esta conta usa login pelo Google."}

    temp_password = generate_temp_password()
    get_client().table("users").update({"password": hash_password(temp_password)}).eq("username", user["username"]).execute()

    email_sent = send_reset_email(user["email"], user.get("name") or user["username"], temp_password)

    if not email_sent and not settings.smtp_user:
        return {
            "ok": True,
            "dev_mode": True,
            "message": f"SMTP não configurado. Senha temporária (apenas em dev): {temp_password}",
            "temp_password": temp_password,
        }
    if not email_sent:
        raise HTTPException(status_code=500, detail="Erro ao enviar e-mail. Tente novamente.")

    return {"ok": True, "message": "E-mail enviado! Verifique sua caixa de entrada."}


# ── Change password (autenticado) 


@router.put("/password")
async def change_password(body: ChangePasswordBody, current_user: dict = Depends(get_current_user)):
    db = get_client()
    rows = db.table("users").select("password").eq("username", current_user["username"]).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    stored = rows[0]["password"]
    if stored == "google_authenticated":
        raise HTTPException(status_code=400, detail="Conta Google não usa senha local")
    if not verify_password(body.current_password, stored):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 6 caracteres")

    db.table("users").update({"password": hash_password(body.new_password)}).eq("username", current_user["username"]).execute()
    return {"ok": True}


# ── Staff endpoints 


@router.get("/stats")
async def get_stats(current_user: dict = Depends(require_staff)):
    from datetime import date
    db = get_client()
    students = db.table("users").select("username").eq("role", "student").execute()
    messages = db.table("messages").select("id").eq("role", "user").execute()
    today_msgs = db.table("messages").select("username").eq("role", "user").eq("date", date.today().isoformat()).execute()
    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today": len({m["username"] for m in today_msgs.data}),
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


@router.delete("/students/{username}", status_code=204)
async def delete_student(username: str, current_user: dict = Depends(require_staff)):
    db = get_client()
    if not db.table("users").select("username").eq("username", username).execute().data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.table("messages").delete().eq("username", username).execute()
    db.table("conversations").delete().eq("username", username).execute()
    db.table("users").delete().eq("username", username).execute()


@router.put("/students/{username}")
async def update_student(username: str, body: StudentUpdate, current_user: dict = Depends(require_staff)):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    get_client().table("users").update(update_data).eq("username", username).execute()
    return {"ok": True}