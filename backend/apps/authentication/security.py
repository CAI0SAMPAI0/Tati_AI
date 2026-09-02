import os
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
from jose import jwt, JWTError
from ninja.security import HttpBearer
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

User = get_user_model()

JWT_SECRET_KEY = getattr(settings, "SECRET_KEY", "default-jwt-secret-key-2026")
JWT_ALGORITHM = getattr(settings, "JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 129600)
)  # 90 dias (3 meses)


# ── CRIPTO & HASH DE SENHA ────────────────────────────────────────────


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica a senha suportando bcrypt (FastAPI legado), PBKDF2/Django e SHA256 legado.
    """
    if not hashed_password or not plain_password:
        return False

    if hashed_password == "google_authenticated":
        return False

    # 1. Suporte para bcrypt nativo ($2b$, $2a$, $2y$, $2)
    if hashed_password.startswith(("$2b$", "$2a$", "$2y$", "$2")):
        try:
            if bcrypt.checkpw(
                plain_password.encode("utf-8"), hashed_password.encode("utf-8")
            ):
                return True
        except Exception:
            pass

    # 2. Suporte para hashers do Django (pbkdf2_sha256, argon2, etc.)
    try:
        from django.contrib.auth.hashers import check_password

        if check_password(plain_password, hashed_password):
            return True
    except Exception:
        pass

    # 3. Fallback SHA256 legado
    try:
        import hashlib

        if (
            hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
            == hashed_password
        ):
            return True
    except Exception:
        pass

    return False


def hash_password(password: str) -> str:
    """
    Gera hash seguro com bcrypt compatível com o legado do FastAPI e Django.
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


# ── JWT TOKENS ────────────────────────────────────────────────────────


def create_access_token(
    data: Dict[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Gera JWT com payload padronizado compatível com o frontend.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Gera token de atualização (Refresh Token) de longa duração (90 dias).
    """
    expire = datetime.now(timezone.utc) + timedelta(days=90)
    to_encode = data.copy()
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodifica e valida assinatura e expiração do JWT.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


# ── AUTENTICAÇÃO NINJA (HTTPBEARER) ───────────────────────────────────


class AuthBearer(HttpBearer):
    """
    Autenticador Bearer Token para endpoints Django-Ninja.
    Injeta o objeto User autenticado em request.auth.
    """

    def authenticate(self, request, token: str) -> Optional[Any]:
        payload = decode_token(token)
        if not payload:
            return None

        username = payload.get("sub")
        if not username:
            return None

        try:
            user = User.objects.filter(username=username).first()
            if not user:
                return None

            # Anexa o usuário também ao request.user para compatibilidade geral
            request.user = user
            return user
        except Exception:
            return None


class OptionalAuthBearer:
    """
    Bearer opcional que nunca rejeita a requisição, permitindo acesso anônimo.
    Injeta o usuário em request.auth se o token for válido, ou True se ausente/inválido.
    """

    def __call__(self, request):
        auth_header = (
            request.headers.get("authorization")
            or request.headers.get("Authorization")
            or request.META.get("HTTP_AUTHORIZATION")
        )
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
                payload = decode_token(token)
                if payload and payload.get("sub"):
                    user = User.objects.filter(username=payload["sub"]).first()
                    if user:
                        request.user = user
                        return user
        return True


# Instâncias para injeção de dependência nos routers
auth_required = AuthBearer()
auth_optional = OptionalAuthBearer()


def require_programmer(user: User):
    """Garante que o usuário é um programador/superadmin."""
    if not user or not user.is_programmer:
        raise HttpError(403, "Acesso restrito apenas ao programador / superadmin.")


def require_teacher(user: User):
    """Garante que o usuário é a professora Tatiana ou o programador."""
    if not user or not user.is_teacher:
        raise HttpError(
            403, "Acesso restrito apenas à professora ou equipe administrativa."
        )
