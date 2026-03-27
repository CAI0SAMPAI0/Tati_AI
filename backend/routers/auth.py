import os
import hashlib
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from routers.deps import get_current_user
from services.database import get_client

router = APIRouter()

# ─── Config ───────────────────────────────────────────────────────────────────

JWT_SECRET_KEY   = os.getenv("JWT_SECRET_KEY", "changeme-insecure")
ALGORITHM        = "HS256"
ACCESS_TOKEN_EXP = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

# SMTP para e-mail de recuperação de senha
SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")       # seu e-mail remetente
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")   # senha de app Gmail
SMTP_FROM     = os.getenv("SMTP_FROM", SMTP_USER)

ALLOWED_ROLES = ("professor", "professora", "programador", "Tatiana", "Tati")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _create_token(data: dict, expires_minutes: int = ACCESS_TOKEN_EXP) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, stored: str) -> bool:
    if stored == "google_authenticated":
        return False
    if stored.startswith("$2"):
        return bcrypt.checkpw(password.encode(), stored.encode())
    # legado SHA-256
    return hashlib.sha256(password.encode()).hexdigest() == stored


def _generate_temp_password(length: int = 12) -> str:
    """Gera senha aleatória legível: letras + dígitos, sem caracteres ambíguos."""
    alphabet = string.ascii_letters + string.digits
    # Remove caracteres ambíguos (0/O, l/I/1)
    alphabet = alphabet.translate(str.maketrans("", "", "0OlI1"))
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _send_reset_email(to_email: str, name: str, temp_password: str) -> bool:
    """Envia e-mail com senha temporária. Retorna True se enviou, False se falhou."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[ResetPW] SMTP não configurado. Senha temporária para {to_email}: {temp_password}")
        return False

    subject = "Teacher Tati — Sua senha temporária"
    html_body = f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:2rem;
                background:#0f0a1e;color:#f1f0f5;border-radius:16px;">
      <h2 style="color:#7c3aed;margin-bottom:0.5rem;">🧑‍🏫 Teacher Tati</h2>
      <p style="color:#9ca3af;margin-bottom:1.5rem;">Recuperação de senha</p>

      <p>Olá, <strong>{name}</strong>!</p>
      <p>Recebemos um pedido de recuperação de senha para a sua conta.</p>

      <div style="background:#1e1535;border:1px solid rgba(124,58,237,0.3);
                  border-radius:12px;padding:1.25rem;margin:1.5rem 0;text-align:center;">
        <p style="color:#9ca3af;font-size:0.85rem;margin-bottom:0.5rem;">Sua senha temporária:</p>
        <code style="font-size:1.6rem;font-weight:700;color:#7c3aed;
                     letter-spacing:0.15em;">{temp_password}</code>
      </div>

      <p style="color:#f87171;font-size:0.85rem;">
        ⚠️ <strong>Importante:</strong> Esta senha é temporária. Assim que entrar no app,
        vá em <strong>Perfil → Segurança</strong> e crie uma nova senha que você consiga lembrar.
        Anote-a em um lugar seguro!
      </p>

      <p style="color:#9ca3af;font-size:0.8rem;margin-top:1.5rem;">
        Se você não solicitou a recuperação de senha, ignore este e-mail.
        Sua senha original permanece ativa.
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Teacher Tati <{SMTP_FROM}>"
    msg["To"]      = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[ResetPW] Erro ao enviar e-mail: {e}")
        return False


# ─── Models ───────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    name: str
    email: str
    username: str
    password: str
    level: str = "Beginner"


class GoogleBody(BaseModel):
    token: str


class ForgotPasswordBody(BaseModel):
    identifier: str  # username OU e-mail


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


# ─── Login ────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    db = get_client()
    identifier = form.username.strip().lower()

    # Busca por username
    rows = (
        db.table("users")
        .select("username, name, email, password, role, level, focus")
        .eq("username", identifier)
        .limit(1)
        .execute()
        .data
    )
    # Fallback: busca por e-mail
    if not rows:
        rows = (
            db.table("users")
            .select("username, name, email, password, role, level, focus")
            .eq("email", identifier)
            .limit(1)
            .execute()
            .data
        )

    if not rows:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")

    user = rows[0]

    if not _verify_password(form.password, user["password"]):
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")

    token = _create_token({"sub": user["username"], "role": user.get("role", "student")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: v for k, v in user.items() if k != "password"},
    }


# ─── Register ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody):
    db = get_client()

    username = body.username.strip().lower()
    email    = body.email.strip().lower()

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Senha deve ter pelo menos 6 caracteres")

    # Verifica duplicatas
    existing = (
        db.table("users")
        .select("username")
        .or_(f"username.eq.{username},email.eq.{email}")
        .execute()
        .data
    )
    if existing:
        raise HTTPException(status_code=409, detail="Username ou e-mail já cadastrado")

    now = datetime.now(timezone.utc).isoformat()
    db.table("users").insert({
        "username":   username,
        "name":       body.name.strip(),
        "email":      email,
        "password":   _hash_password(body.password),
        "role":       "student",
        "level":      body.level,
        "focus":      "General Conversation",
        "created_at": now,
    }).execute()

    return {"ok": True, "message": "Conta criada com sucesso"}


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@router.post("/google")
async def google_login(body: GoogleBody):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth não configurado no servidor")

    try:
        info = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token Google inválido: {str(e)}")

    email    = info.get("email", "").lower()
    name     = info.get("name", email.split("@")[0])
    username = email.split("@")[0].replace(".", "_").lower()

    db = get_client()

    # Verifica se já existe
    rows = (
        db.table("users")
        .select("username, name, email, role, level, focus")
        .eq("email", email)
        .limit(1)
        .execute()
        .data
    )

    if rows:
        user = rows[0]
    else:
        # Cria conta Google
        now = datetime.now(timezone.utc).isoformat()
        # Garante username único
        base_username = username
        suffix = 1
        while True:
            existing = (
                db.table("users").select("username").eq("username", username).execute().data
            )
            if not existing:
                break
            username = f"{base_username}{suffix}"
            suffix += 1

        db.table("users").insert({
            "username":   username,
            "name":       name,
            "email":      email,
            "password":   "google_authenticated",
            "role":       "student",
            "level":      "Beginner",
            "focus":      "General Conversation",
            "created_at": now,
        }).execute()

        user = {"username": username, "name": name, "email": email,
                "role": "student", "level": "Beginner", "focus": "General Conversation"}

    token = _create_token({"sub": user["username"], "role": user.get("role", "student")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


# ─── Esqueci minha senha ──────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordBody):
    db = get_client()
    identifier = body.identifier.strip().lower()

    # Busca por username ou e-mail
    rows = (
        db.table("users")
        .select("username, name, email, password")
        .eq("username", identifier)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        rows = (
            db.table("users")
            .select("username, name, email, password")
            .eq("email", identifier)
            .limit(1)
            .execute()
            .data
        )

    # Sempre retorna 200 para não vazar se o e-mail existe (segurança)
    if not rows:
        return {"ok": True, "message": "Se o usuário existir, um e-mail será enviado."}

    user = rows[0]

    if user["password"] == "google_authenticated":
        return {
            "ok": False,
            "message": "Esta conta usa login pelo Google. Acesse pelo botão 'Continuar com Google'."
        }

    temp_password = _generate_temp_password()
    hashed        = _hash_password(temp_password)

    # Salva a senha temporária no banco
    db.table("users").update({"password": hashed}).eq("username", user["username"]).execute()

    # Envia e-mail
    email_sent = _send_reset_email(
        to_email=user["email"],
        name=user["name"] or user["username"],
        temp_password=temp_password,
    )

    if not email_sent:
        # SMTP não configurado: retorna a senha na resposta (só para dev/teste)
        if not SMTP_USER:
            return {
                "ok": True,
                "dev_mode": True,
                "message": f"SMTP não configurado. Senha temporária (apenas em dev): {temp_password}",
                "temp_password": temp_password,
            }
        raise HTTPException(status_code=500, detail="Erro ao enviar e-mail. Tente novamente.")

    return {"ok": True, "message": "E-mail enviado! Verifique sua caixa de entrada."}


# ─── Trocar senha (autenticado) ───────────────────────────────────────────────

@router.put("/password")
async def change_password(
    body: ChangePasswordBody,
    current_user: dict = Depends(get_current_user),
):
    db = get_client()
    username = current_user["username"]

    rows = (
        db.table("users")
        .select("password")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    stored = rows[0]["password"]

    if stored == "google_authenticated":
        raise HTTPException(status_code=400, detail="Conta Google não usa senha local")

    if not _verify_password(body.current_password, stored):
        raise HTTPException(status_code=401, detail="Senha atual incorreta")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Nova senha deve ter pelo menos 6 caracteres")

    db.table("users").update(
        {"password": _hash_password(body.new_password)}
    ).eq("username", username).execute()

    return {"ok": True}


# ─── Rotas de staff (mantidas aqui para não quebrar o router existente) ───────

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
    students = db.table("users").select("username").eq("role", "student").execute()
    messages = db.table("messages").select("id").eq("role", "user").execute()
    from datetime import date
    today = date.today().isoformat()
    active_today = (
        db.table("messages").select("username").eq("role", "user").eq("date", today).execute()
    )
    return {
        "total_students": len(students.data),
        "total_messages": len(messages.data),
        "active_today": len(set(m["username"] for m in active_today.data)),
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
        msgs = db.table("messages").select("id").eq("username", u["username"]).eq("role", "user").execute()
        last = (
            db.table("messages").select("date").eq("username", u["username"])
            .order("id", desc=True).limit(1).execute().data
        )
        result.append({**u, "total_messages": len(msgs.data), "last_active": last[0]["date"] if last else "---"})
    return result


@router.get("/students/{username}/insight")
async def get_student_insight(username: str, current_user: dict = Depends(_require_staff)):
    raise HTTPException(status_code=308, detail="Use /dashboard/students/{username}/insight")


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
    current_user: dict = Depends(_require_staff),
):
    db = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    db.table("users").update(update_data).eq("username", username).execute()
    return {"ok": True}