from fastapi import APIRouter, HTTPException, status, Depends
from jose import jwt
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import authenticate_user, get_client
import datetime as dt
import os
import hashlib
import bcrypt


router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"


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

@router.post("/login")
async def login(body: LoginRequest):
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos"
        )

    payload = {
        "sub": user["username"],
        "role": user["role"],
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=24),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "user": user}

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    db = get_client()
    # Checa se o usuário já existe
    existing_user = (
        db.table("users")
        .select("username")
        .eq("username", body.username.lower())
        .execute()
        .data
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário já existe"
        )
    # comprimento da senha
    if len(body.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos 6 caracteres"
        )
    # Hash da password
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt(rounds=12)).decode()
    now = dt.datetime.now(dt.timezone.utc).isoformat()

    db.table("users").insert({
        "username": body.username.lower(),
        "name": body.name,
        "password": hashed,
        "role": "student",
        "level": body.level,
        "focus": body.focus,
        "created_at": now,
        "profile": {},
    }).execute()
    return {"message": "Usuário registrado com sucesso"}

@router.put("/password")
async def change_password(body: PasswordUpdate, current_user: dict = Depends(get_current_user)):
    db = get_client()
    username = current_user["username"]
    # buscando a senha atual do usuário
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
            detail="Senha atual incorreta"
        )
    stored = rows[0]["password"]
    #valida a senha atual
    if stored.startswith("$2"):
        valid = bcrypt.checkpw(body.current_password.encode(), stored.encode())
    else:
        valid = hashlib.sha256(body.current_password.encode()).hexdigest() == stored

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta"
        )
    
    if len(body.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ter pelo menos 6 caracteres"
        )

    new_hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt(rounds=12)).decode()
    db.table("users").update({"password": new_hashed}).eq("username", username).execute()

    return {"ok": True}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"]}