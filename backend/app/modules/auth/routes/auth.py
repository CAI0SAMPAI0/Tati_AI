from __future__ import annotations
import os

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


#  Google OAuth via system browser (for Capacitor/Android)


@router.get('/google/url')
async def google_auth_url(request: Request):
    """Returns Google OAuth URL for system browser flow (Capacitor/Android)."""
    from app.core.config import settings
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail='Google OAuth not configured')

    # Use the backend's own URL as redirect target (never WORKER_API_URL for OAuth)
    backend_url = str(request.base_url).rstrip('/')
    redirect_uri = f'{backend_url}/auth/google/callback'
    scopes = 'openid email profile'
    url = (
        f'https://accounts.google.com/o/oauth2/v2/auth'
        f'?client_id={settings.google_client_id}'
        f'&redirect_uri={redirect_uri}'
        f'&response_type=code'
        f'&scope={scopes}'
        f'&access_type=offline'
        f'&prompt=consent'
    )
    return {'url': url}


from fastapi.responses import HTMLResponse


@router.get('/google/callback')
async def google_callback(request: Request, code: str = '', db: Client = Depends(get_db)):
    """Handles Google OAuth callback, exchanges code for tokens, returns JWT via deep link."""
    from app.core.config import settings
    from app.core.security import create_access_token
    from app.core.enums import normalize_level

    if not code:
        return HTMLResponse('<html><body><h2>Authentication failed</h2><p>No code received.</p></body></html>', status_code=400)

    if not settings.google_client_secret:
        return HTMLResponse('<html><body><h2>Server error</h2><p>Google OAuth not configured.</p></body></html>', status_code=500)

    # Exchange authorization code for tokens
    import httpx
    backend_url = str(request.base_url).rstrip('/')
    redirect_uri = f'{backend_url}/auth/google/callback'
    token_data = {
        'code': code,
        'client_id': settings.google_client_id,
        'client_secret': settings.google_client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }

    async with httpx.AsyncClient() as client:
        token_resp = await client.post('https://oauth2.googleapis.com/token', data=token_data, timeout=15)

    if token_resp.status_code != 200:
        return HTMLResponse('<html><body><h2>Authentication failed</h2><p>Could not exchange code for tokens.</p></body></html>', status_code=400)

    tokens = token_resp.json()
    id_token_str = tokens.get('id_token')

    if not id_token_str:
        return HTMLResponse('<html><body><h2>Authentication failed</h2><p>No ID token received.</p></body></html>', status_code=400)

    # Verify ID token
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
        info = id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), settings.google_client_id, clock_skew_in_seconds=60
        )
    except Exception:
        return HTMLResponse('<html><body><h2>Authentication failed</h2><p>Invalid Google token.</p></body></html>', status_code=400)

    email = info.get('email', '').lower()
    name = info.get('name', email.split('@')[0])
    base_username = email.split('@')[0].replace('.', '_').lower()

    # Find or create user
    from app.modules.users.repositories.user_repository import UserRepository
    existing_user = await UserRepository.find_by_email(db, email)
    if existing_user:
        user = existing_user
    else:
        username = base_username
        suffix = 1
        while await UserRepository.find_by_username(db, username):
            username = f'{base_username}{suffix}'
            suffix += 1

        new_user = {
            'username': username,
            'name': name,
            'email': email,
            'password': 'google_authenticated',
            'role': 'student',
            'level': 'A1',
            'focus': 'General Conversation',
        }
        await UserRepository.insert_user(db, new_user)
        user = new_user

    # Build JWT
    token_payload = {
        'sub': user['username'],
        'role': user.get('role', 'student'),
        'level': normalize_level(user.get('level')),
    }
    jwt_token = create_access_token(token_payload)

    # Return HTML that redirects to app via deep link
    return HTMLResponse(f'''<!DOCTYPE html>
<html>
<head><title>Login successful</title></head>
<body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui;margin:0;background:#0a0a0c;color:#fff;">
<div style="text-align:center;">
<h2>Login successful!</h2>
<p>Redirecting to app...</p>
<script>
(function() {{
  var jwt = "{jwt_token}";
  var user = {user};
  // Store for web fallback
  localStorage.setItem("token", jwt);
  localStorage.setItem("user", JSON.stringify(user));
  // Redirect to app via deep link
  window.location.href = "com.tati.ai://auth?jwt=" + encodeURIComponent(jwt);
  // Fallback: if deep link doesn't work, show message
  setTimeout(function() {{
    document.body.innerHTML = '<div style="text-align:center;"><h2>Login successful!</h2><p>Close this page and open the Tati AI app.</p></div>';
  }}, 3000);
}})();
</script>
</div>
</body>
</html>''')


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
