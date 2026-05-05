"""
routers/deps.py
Dependências compartilhadas pelos routers da aplicação.

Contém:
    - ``get_current_user``: Decodifica JWT e retorna dados do usuário.
    - ``check_access``: Verifica acesso premium.
    - ``RoleChecker``: Classe para verificação de roles (PEP 8 compliant).
    - ``require_staff``: Instância pré-configurada para rotas administrativas.
"""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from core.security import decode_token
from services.database import get_client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl='auth/login')

# Colunas necessárias para autenticação — evita SELECT * que puxa
# campos pesados como ``vocabulary`` (JSON potencialmente enorme).
_USER_AUTH_FIELDS = (
    'username, name, email, role, level, focus, '
    'is_exempt, is_premium_active, plan_type, '
    'free_messages_used, created_at, profile, '
    'preferred_due_day'
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
            detail='Token inválido ou expirado',
        )

    username = payload['sub']
    db = get_client()
    rows = (
        db.table('users')
        .select(_USER_AUTH_FIELDS)
        .eq('username', username)
        .limit(1)
        .execute()
        .data
    )

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Usuário não encontrado',
        )

    user = rows[0]
    from core.config import settings

    user['is_staff'] = user.get('role') in settings.staff_roles
    return user


def check_access(user: dict = Depends(get_current_user)) -> dict:
    """Verifica se o usuário tem acesso premium ou é isento.

    Raises:
        HTTPException 403: Acesso premium necessário.
    """
    if user.get('is_exempt') or user.get('is_premium_active'):
        return user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail='Acesso premium necessário. Escolha um plano em seu perfil.',
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
        if user['role'] not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='Acesso negado: permissão insuficiente',
            )
        return user


require_staff = RoleChecker(
    'professor',
    'professora',
    'programador',
    'Tatiana',
    'Tati',
    'Professora',
    'Programador',
    'admin',
    'Admin',
)
