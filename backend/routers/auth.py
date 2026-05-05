"""
routers/auth.py
Autenticação: login, registro, Google OAuth, recuperação e troca de senha.

Endpoints de gestão de alunos (stats, students) foram movidos para
``routers/admin/dashboard.py`` para separação de domínios.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from routers.deps import get_current_user
from services.auth_service import AuthService

router = APIRouter()


async def _warm_up_tavily(username: str, level: str) -> None:
    """Pré-carrega podcasts personalizados via Tavily em background após login."""
    try:
        from services.podcast_discovery import discover_personalized_podcasts
        await discover_personalized_podcasts(username, username, level)
    except Exception as exc:
        print(f'[Auth] Erro no pré-carregamento Tavily para {username}: {exc}')



# ── Models ────────────────────────────────────────────────────────────────────


class RegisterBody(BaseModel):
    """Dados para criação de conta."""

    name: str
    email: str
    username: str
    password: str
    level: str = 'Beginner'


class GoogleBody(BaseModel):
    """Google OAuth credential token."""

    credential: str


class ForgotPasswordBody(BaseModel):
    """Identificador para recuperação de senha."""

    identifier: str


class ChangePasswordBody(BaseModel):
    """Dados para troca de senha autenticada."""

    current_password: str
    new_password: str


# ── Login ─────────────────────────────────────────────────────────────────────


@router.post('/login')
@router.post('/login_form')
async def login(
    request: Request,
    background_tasks: BackgroundTasks,
    form: OAuth2PasswordRequestForm = Depends(lambda: None),
) -> dict:
    """Autentica via form-data (OAuth2) ou JSON.

    Após autenticação bem-sucedida, dispara em background o pré-carregamento
    de podcasts personalizados via Tavily para que a próxima visita
    às atividades já tenha conteúdo preparado.
    """
    username = None
    password = None

    # Tenta ler como form-data (OAuth2PasswordRequestForm)
    try:
        form_data = await request.form()
        username = form_data.get('username')
        password = form_data.get('password')
    except Exception:
        pass

    # Fallback: tenta JSON (suporte para apiPost do frontend)
    if not username or not password:
        try:
            json_data = await request.json()
            username = json_data.get('username') or json_data.get('identifier')
            password = json_data.get('password')
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=422,
            detail='Credenciais não fornecidas ou formato inválido.',
        )

    result = await AuthService.authenticate_user(username, password)

    # Warm-up Tavily em background sem bloquear o login
    user_level = result.get('level', 'Beginner') if isinstance(result, dict) else 'Beginner'
    background_tasks.add_task(_warm_up_tavily, str(username), str(user_level))

    return result



# ── Register ──────────────────────────────────────────────────────────────────


@router.post('/register', status_code=status.HTTP_201_CREATED)
async def register(body: RegisterBody) -> dict:
    """Cria nova conta de estudante."""
    return await AuthService.register_student(body)


# ── Google OAuth ──────────────────────────────────────────────────────────────


@router.post('/google')
async def google_login(body: GoogleBody) -> dict:
    """Authenticates via Google OAuth2. Creates account if needed."""
    return await AuthService.google_login(body.credential)


# ── Forgot password ──────────────────────────────────────────────────────────


@router.post('/forgot-password')
async def forgot_password(body: ForgotPasswordBody) -> dict:
    """Envia senha temporária por e-mail."""
    return await AuthService.process_forgot_password(body.identifier)


# ── Change password (autenticado) ─────────────────────────────────────────────


@router.put('/password')
async def change_password(
    body: ChangePasswordBody,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Troca a senha do usuário autenticado."""
    return await AuthService.change_password(current_user, body)
