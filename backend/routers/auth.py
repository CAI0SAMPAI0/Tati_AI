from fastapi import APIRouter, HTTPException, status, Depends
from jose import jwt
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import authenticate_user
import datetime as dt
import os

router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"


class LoginRequest(BaseModel):
    username: str
    password: str


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
        "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=8),
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "user": user}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"username": current_user["username"]}