from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.core.dependencies.db import get_db
from supabase import Client
from app.modules.auth.services.auth_service import AuthService

router = APIRouter()


#  Models 


class RegisterBody(BaseModel):
    """Dados para criação de conta."""

    name: str
    email: str
    username: str
    password: str
    level: str = 'A1'
    is_hub_only: bool = False


class GoogleBody(BaseModel):
    """Google OAuth credential token."""

    credential: str
    is_hub_only: bool = False


class ForgotPasswordBody(BaseModel):
    """Identificador para recuperação de senha."""

    identifier: str
    base_url: str = ''
    is_app: bool = False


class ResetPasswordBody(BaseModel):
    """Dados para redefinição de senha via token."""

    token: str
    new_password: str


class ChangePasswordBody(BaseModel):
    """Dados para troca de senha autenticada."""

    current_password: str
    new_password: str


#  Login ─


@router.post('/login')
@router.post('/login_form')
async def login(
    request: Request,
    db: Client = Depends(get_db),
) -> dict:
    """Autentica via form-data (OAuth2) ou JSON.

    Retorno imediato: validação bcrypt + JWT. Pré-carregamento de podcasts
    deve ser disparado pelo cliente via GET /activities/podcasts/warmup.
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
            username = json_data.get(
                'username') or json_data.get('identifier')
            password = json_data.get('password')
        except Exception:
            pass

    if not username or not password:
        raise HTTPException(
            status_code=422,
            detail='Credenciais não fornecidas ou formato inválido.',
        )

    return await AuthService.authenticate_user(db, username, password)


#  Register 


@router.post('/register', status_code=status.HTTP_201_CREATED)
async def register(
        body: RegisterBody,
        db: Client = Depends(get_db)) -> dict:
    """Cria nova conta de estudante."""
    return await AuthService.register_student(db, body)


#  Google OAuth 


@router.post('/google')
async def google_login(
        request: Request,
        db: Client = Depends(get_db)) -> dict:
    """Authenticates via Google OAuth2. Creates account if needed.
    Handles both JSON body (web popup) and form-data (redirect callback)."""
    credential = None
    is_hub_only = False

    # Try form-data (redirect callback from Google)
    try:
        form_data = await request.form()
        credential = form_data.get('credential')
        is_hub_only = form_data.get('is_hub_only', 'false') == 'true'
    except Exception:
        pass

    # Fallback: JSON body (web popup)
    if not credential:
        try:
            json_data = await request.json()
            credential = json_data.get('credential')
            is_hub_only = json_data.get('is_hub_only', False)
        except Exception:
            pass

    if not credential:
        raise HTTPException(
            status_code=422,
            detail='Google credential not provided.',
        )

    return await AuthService.google_login(db, credential, is_hub_only)


#  Forgot password ─


@router.post('/forgot-password')
async def forgot_password(
        body: ForgotPasswordBody,
        db: Client = Depends(get_db)) -> dict:
    """Envia link de redefinição de senha por e-mail."""
    return await AuthService.process_forgot_password(db, body.identifier, body.base_url, body.is_app)


@router.post('/reset-password')
async def reset_password(
        body: ResetPasswordBody,
        db: Client = Depends(get_db)) -> dict:
    """Redefine a senha usando token recebido por e-mail."""
    return await AuthService.reset_password_with_token(db, body.token, body.new_password)


#  Change password (autenticado) ─


@router.put('/password')
async def change_password(
    body: ChangePasswordBody,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_db)
) -> dict:
    """Troca a senha do usuário autenticado."""
    return await AuthService.change_password(db, current_user, body)
