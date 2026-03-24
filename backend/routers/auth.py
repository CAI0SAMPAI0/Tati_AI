from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt
from pydantic import BaseModel
from routers.deps import get_current_user, RoleChecker
from services.database import authenticate_user, get_client
from google.oauth2 import id_token
from google.auth.transport import requests
import datetime as dt
import os
import hashlib
import bcrypt

router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
admin_required = RoleChecker(["admin"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str
    level: str = "Beginner"
    focus: str = "General Conversation"


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class GoogleToken(BaseModel):
    token: str


def _make_jwt(user: dict) -> str:
    payload = {
        "sub": user["username"],
        "role": user.get("role", "student"),
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)


@router.post("/google")
async def google_login(body: GoogleToken):
    try:
        # Valida o token vindo do frontend
        idinfo = id_token.verify_oauth2_token(
            body.token, requests.Request(), os.getenv("GOOGLE_CLIENT_ID")
        )
        email = idinfo.get("email", "").lower()
        name = idinfo.get("name", "User")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Token Google não contém email",
            )

        db = get_client()

        # 1. Busca pelo username == email (conta criada via Google)
        user_query = (
            db.table("users").select("*").eq("username", email).execute()
        )
        user_data = user_query.data

        # 2. Se não achou pelo username, busca pelo campo email
        #    (conta criada manualmente com esse email)
        if not user_data:
            user_query2 = (
                db.table("users").select("*").eq("email", email).execute()
            )
            user_data = user_query2.data

        if user_data:
            user = user_data[0]

            # Se a conta manual não tem o email como username,
            # marcamos que ela pode usar Google também (sem alterar username)
            # Basta retornar o JWT normalmente.
        else:
            # Cria nova conta vinculada ao Google
            new_user = {
                "username": email,
                "name": name,
                "email": email,
                "password": "google_authenticated",  # senha dummy
                "role": "student",
                "level": "Beginner",
                "focus": "General Conversation",
                "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
                "profile": {},
            }
            result = db.table("users").insert(new_user).execute()
            user = result.data[0] if result.data else new_user

        token = _make_jwt(user)

        # Remove senha antes de retornar
        safe_user = {k: v for k, v in user.items() if k != "password"}

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": safe_user,
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token do Google inválido: {str(e)}",
        )


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _make_jwt(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    db = get_client()

    # Checa se username já existe
    existing = (
        db.table("users")
        .select("username")
        .eq("username", body.username.lower())
        .execute()
        .data
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário já existe",
        )

    if len(body.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos 6 caracteres",
        )

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12)).decode()
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    db.table("users").insert(
        {
            "username": body.username.lower(),
            "name": body.name,
            "password": hashed,
            "role": "student",
            "level": body.level,
            "focus": body.focus,
            "created_at": now,
            "profile": {},
        }
    ).execute()

    return {"message": "Usuário registrado com sucesso"}


@router.put("/password")
async def change_password(
    body: PasswordUpdate, current_user: dict = Depends(get_current_user)
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado",
        )

    stored = rows[0]["password"]

    if stored == "google_authenticated":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conta Google não possui senha local. Use o login com Google.",
        )

    if stored.startswith("$2"):
        valid = bcrypt.checkpw(body.current_password.encode(), stored.encode())
    else:
        valid = hashlib.sha256(body.current_password.encode()).hexdigest() == stored

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )

    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ter pelo menos 6 caracteres",
        )

    new_hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    db.table("users").update({"password": new_hashed}).eq("username", username).execute()

    return {"ok": True}


@router.get("/config-do-sistema")
async def get_system_config(current_user: dict = Depends(admin_required)):
    return {
        "message": f"Bem-vindo ao painel de controle, {current_user['username']}!"
    }


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"]}