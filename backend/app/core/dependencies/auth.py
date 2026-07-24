"""
routers/deps.py
Dependências compartilhadas pelos app.routers_init da aplicação.

Contém:
    - ``get_current_user``: Decodifica JWT e retorna dados do usuário.
    - ``check_access``: Verifica acesso premium.
    - ``RoleChecker``: Classe para verificação de roles (PEP 8 compliant).
    - ``require_staff``: Instância pré-configurada para rotas administrativas.
"""

from __future__ import annotations

from app.core.database import get_client
from app.core.security import decode_token
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# Colunas necessárias para autenticação — evita SELECT * que puxa
# campos pesados como ``vocabulary`` (JSON potencialmente enorme).
_USER_AUTH_FIELDS = (
    "username, name, email, role, level, focus, "
    "is_exempt, is_premium_active, plan_type, "
    "free_messages_used, created_at, profile, "
    "preferred_due_day"
)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Decodifica o JWT e retorna os dados essenciais do usuário.

    Raises:
        HTTPException 401: Token inválido ou expirado.
        HTTPException 404: Usuário não encontrado no banco.
    """
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    username = payload["sub"]
    db = get_client()
    try:
        rows = (
            db.table("users")
            .select(_USER_AUTH_FIELDS)
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
    except Exception as e:
        import logging

        logging.warning(
            f"[Auth] Falha ao ler colunas completas do usuário: {e}. Tentando colunas básicas."
        )
        basic_fields = "username, name, email, role, level, focus, created_at"
        try:
            rows = (
                db.table("users")
                .select(basic_fields)
                .eq("username", username)
                .limit(1)
                .execute()
                .data
            )
        except Exception as e_inner:
            logging.error(f"[Auth] Falha crítica ao ler usuário básico: {e_inner}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erro de comunicação com o banco de dados",
            )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado",
        )

    user = rows[0]
    # Injeta valores padrão caso colunas tenham falhado na consulta
    default_values = {
        "is_exempt": False,
        "is_premium_active": False,
        "plan_type": None,
        "free_messages_used": 0,
        "profile": None,
        "preferred_due_day": None,
    }
    for k, v in default_values.items():
        if k not in user:
            user[k] = v

    from app.core.config import settings

    user["is_staff"] = user.get("role") in settings.staff_roles
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
) -> dict | None:
    """Retorna usuário autenticado quando token existe; caso contrário, None."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None

    username = payload.get("sub")
    if not username:
        return None

    db = get_client()
    try:
        rows = (
            db.table("users")
            .select(_USER_AUTH_FIELDS)
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
    except Exception as e:
        import logging

        logging.warning(
            f"[Auth] Falha no get_current_user_optional com colunas completas: {e}. Tentando colunas básicas."
        )
        basic_fields = "username, name, email, role, level, focus, created_at"
        try:
            rows = (
                db.table("users")
                .select(basic_fields)
                .eq("username", username)
                .limit(1)
                .execute()
                .data
            )
        except Exception:
            return None

    if not rows:
        return None

    user = rows[0]
    default_values = {
        "is_exempt": False,
        "is_premium_active": False,
        "plan_type": None,
        "free_messages_used": 0,
        "profile": None,
        "preferred_due_day": None,
    }
    for k, v in default_values.items():
        if k not in user:
            user[k] = v

    from app.core.config import settings

    user["is_staff"] = user.get("role") in settings.staff_roles
    return user


def check_access(user: dict = Depends(get_current_user)) -> dict:
    """Verifica se o usuário tem acesso premium ou é isento.

    Raises:
        HTTPException 403: Acesso premium necessário.
    """
    if user.get("is_exempt") or user.get("is_premium_active"):
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Acesso premium necessário. Escolha um plano em seu perfil.",
    )


class RoleChecker:
    """Dependência reutilizável para verificação de roles.

    Uso:
        require_admin = RoleChecker("admin", "programador")

        @router.get("/admin-only")
        async def endpoint(user: dict = Depends(require_admin)):
            ...
    """

    def __init__(self, *allowed_roles: str) -> None:
        self.allowed_roles = set(allowed_roles)

    def __call__(self, user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: permissão insuficiente",
            )
        return user


require_staff = RoleChecker(
    "professor",
    "professora",
    "programador",
    "Tatiana",
    "Tati",
    "Professora",
    "Programador",
    "admin",
    "Admin",
)
