import json
from urllib.parse import parse_qs
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from .schemas import (
    RegisterInput,
    LoginInput,
    GoogleAuthInput,
    RefreshTokenInput,
    ForgotPasswordInput,
    ResetPasswordInput,
    TokenResponse,
    UserOut,
    ProfileUpdateInput,
)
from .services import AuthService
from .security import auth_required

User = get_user_model()

auth_router = Router(tags=["Auth"])
profile_router = Router(tags=["Profile"])


# ── AUTH ENDPOINTS ───────────────────────────────────────────────────


@auth_router.post("/login", response=TokenResponse)
@auth_router.post("/login/", response=TokenResponse)
@auth_router.post("/login_form", response=TokenResponse)
@auth_router.post("/login_form/", response=TokenResponse)
def login(request: HttpRequest):
    """
    Autentica aceitando tanto JSON (application/json) quanto Form URL-Encoded (apiPostForm).
    """
    username = None
    password = None

    # 1. Tenta POST form data nativo do Django
    if request.POST:
        username = request.POST.get("username") or request.POST.get("identifier")
        password = request.POST.get("password")

    # 2. Tenta decodificar body (JSON ou URL-Encoded)
    if not username or not password:
        try:
            body_bytes = request.body
            if body_bytes:
                body_str = body_bytes.decode("utf-8", errors="ignore").strip()
                if body_str.startswith("{"):
                    data = json.loads(body_str)
                    if isinstance(data, dict):
                        username = (
                            data.get("username")
                            or data.get("identifier")
                            or data.get("email")
                        )
                        password = data.get("password")
                else:
                    parsed = parse_qs(body_str)
                    u_list = (
                        parsed.get("username")
                        or parsed.get("identifier")
                        or parsed.get("email")
                    )
                    p_list = parsed.get("password")
                    if u_list:
                        username = u_list[0]
                    if p_list:
                        password = p_list[0]
        except Exception:
            pass

    if not username or not password:
        print(
            f"[Auth API] Credenciais incompletas recebidas: username={username}, has_password={bool(password)}"
        )
        raise HttpError(422, "Credenciais não fornecidas ou formato inválido.")

    print(f"[Auth API] Processando login para '{username}'")
    payload = LoginInput(username=username, password=password)
    return AuthService.authenticate_user(payload)


@auth_router.post("/register", response={201: TokenResponse})
def register(request: HttpRequest, payload: RegisterInput):
    """
    Registro de nova conta de estudante da Teacher Tati.
    """
    res = AuthService.register_student(payload)
    return 201, res


@auth_router.post("/google", response=TokenResponse)
def google_auth(request: HttpRequest, payload: GoogleAuthInput):
    """
    Autenticação social via Google OAuth2 (Web popup ou mobile com id_token).
    """
    return AuthService.google_login(payload.credential, payload.is_hub_only)


def _get_google_redirect_uri(request: HttpRequest) -> str:
    from django.conf import settings
    import os

    backend_base = getattr(settings, "BACKEND_BASE_URL", "") or os.getenv(
        "BACKEND_BASE_URL", ""
    )
    if backend_base:
        return f"{backend_base.rstrip('/')}/auth/google/callback"
    host = request.headers.get("X-Forwarded-Host") or request.get_host()
    proto = (
        "https"
        if request.is_secure()
        or request.headers.get("X-Forwarded-Proto") == "https"
        or "hf.space" in host
        else "http"
    )
    return f"{proto}://{host}/auth/google/callback"


def _build_google_auth_data(request: HttpRequest) -> tuple[str, str]:
    import os
    import uuid
    from urllib.parse import urlencode
    from django.conf import settings
    from django.core.cache import cache

    client_id = (
        getattr(settings, "GOOGLE_CLIENT_ID", "")
        or os.getenv("GOOGLE_CLIENT_ID", "")
        or os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
    )
    if not client_id:
        raise HttpError(
            503, "Google OAuth não configurado no servidor. Configure GOOGLE_CLIENT_ID."
        )

    state = str(uuid.uuid4())
    origin = (
        request.GET.get("origin", "").strip()
        or request.headers.get("Origin", "").strip()
        or request.headers.get("Referer", "").strip()
    )
    access = request.GET.get("access", "").strip()
    cache.set(f"google_oauth_state_{state}", {"ready": False}, timeout=600)
    cache.set(
        f"google_oauth_origin_{state}",
        {"origin": origin, "access": access},
        timeout=600,
    )

    redirect_uri = _get_google_redirect_uri(request)
    params = {
        "client_id": client_id,
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": redirect_uri,
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return auth_url, state


@auth_router.get("/google/url")
def get_google_auth_url(request: HttpRequest):
    """
    Retorna a URL de autorização do Google OAuth e o token de estado para login mobile / popup.
    Se for acessado diretamente pelo navegador/WebView (navegação), redireciona (302) automaticamente para o Google.
    Se for chamado via AJAX/API (Accept: application/json), retorna JSON {url, state}.
    """
    from django.shortcuts import redirect

    auth_url, state = _build_google_auth_data(request)

    accept = request.headers.get("Accept", "").lower()
    sec_dest = request.headers.get("Sec-Fetch-Dest", "").lower()

    # Se a requisição veio de uma navegação direta do WebView/Navegador
    if (
        "text/html" in accept
        or sec_dest == "document"
        or "application/json" not in accept
    ):
        return redirect(auth_url)

    return {"url": auth_url, "state": state}


@auth_router.get("/google/login")
def redirect_to_google_login(request: HttpRequest):
    """
    Redireciona diretamente o navegador/app (HTTP 302) para a tela de login do Google OAuth.
    """
    from django.shortcuts import redirect

    auth_url, _ = _build_google_auth_data(request)
    return redirect(auth_url)


@auth_router.get("/google/callback")
def google_oauth_callback(
    request: HttpRequest, code: str = None, state: str = None, error: str = None
):
    """
    Callback para o redirecionamento do Google OAuth2.
    Suporta reutilização de state caso o usuário recarregue a página ou ocorra dupla requisição.
    """
    import os
    import requests
    from django.conf import settings
    from django.core.cache import cache
    from django.http import HttpResponse

    if error or not state:
        return HttpResponse(
            "<h3>Erro na autenticação com o Google. Pode fechar esta janela.</h3>",
            status=400,
        )

    # 1. Verifica se esta sessão/state já foi processada com sucesso anteriormente
    cached_state = cache.get(f"google_oauth_state_{state}")
    if cached_state and cached_state.get("ready") and cached_state.get("jwt"):
        jwt_token = cached_state["jwt"]
        user_dict = cached_state["user"]
    else:
        if not code:
            return HttpResponse(
                "<h3>Código de autorização não fornecido pelo Google.</h3>",
                status=400,
            )

        client_id = (
            getattr(settings, "GOOGLE_CLIENT_ID", "")
            or os.getenv("GOOGLE_CLIENT_ID", "")
            or os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "")
        )
        client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "") or os.getenv(
            "GOOGLE_CLIENT_SECRET", ""
        )

        redirect_uri = _get_google_redirect_uri(request)

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        resp = requests.post(token_url, data=data, timeout=10)
        if not resp.ok:
            # Segunda chance de leitura do cache caso tenha ocorrido corrida de requisições
            retry_cache = cache.get(f"google_oauth_state_{state}")
            if retry_cache and retry_cache.get("ready") and retry_cache.get("jwt"):
                jwt_token = retry_cache["jwt"]
                user_dict = retry_cache["user"]
            else:
                return HttpResponse(
                    "<h3>Falha ao trocar código com o Google. Pode fechar esta janela ou tentar novamente.</h3>",
                    status=400,
                )
        else:
            tokens = resp.json()
            id_token_str = tokens.get("id_token")
            if not id_token_str:
                return HttpResponse(
                    "<h3>Token de identidade não retornado pelo Google. Pode fechar esta janela.</h3>",
                    status=400,
                )

            token_res = AuthService.google_login(id_token_str)
            user_dict = (
                token_res.user.dict()
                if hasattr(token_res.user, "dict")
                else token_res.user.model_dump()
                if hasattr(token_res.user, "model_dump")
                else token_res.user
            )
            jwt_token = token_res.access_token

            cache.set(
                f"google_oauth_state_{state}",
                {
                    "ready": True,
                    "jwt": jwt_token,
                    "user": user_dict,
                },
                timeout=600,
            )

    import json
    from urllib.parse import quote

    origin_meta = cache.get(f"google_oauth_origin_{state}") or {}
    frontend_origin = origin_meta.get("origin")
    is_hub = origin_meta.get("access") == "hub"

    if not frontend_origin or "accounts.google.com" in frontend_origin or "google.com" in frontend_origin:
        frontend_origin = (
            getattr(settings, "FRONTEND_URL", "")
            or os.getenv("FRONTEND_URL", "")
            or "https://stunning-tranquility-production-4c54.up.railway.app"
        )

    user_json = json.dumps(user_dict)
    hub_param = "&access=hub" if is_hub else ""
    redirect_target = (
        f"{frontend_origin.rstrip('/')}/login?token={jwt_token}&user={quote(user_json)}{hub_param}"
    )

    username_val = user_dict.get("username", "") if isinstance(user_dict, dict) else ""

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Autenticado com sucesso</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #0f1015;
                color: #ffffff;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                padding: 16px;
                box-sizing: border-box;
                text-align: center;
            }}
            .spinner {{
                border: 3px solid rgba(139, 92, 246, 0.2);
                border-top-color: #8b5cf6;
                border-radius: 50%;
                width: 42px;
                height: 42px;
                animation: spin 0.8s linear infinite;
                margin-bottom: 20px;
            }}
            @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
            .btn {{
                display: inline-block;
                margin-top: 18px;
                padding: 12px 24px;
                background-color: #8b5cf6;
                color: #ffffff;
                text-decoration: none;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);
                transition: transform 0.1s ease;
            }}
            .btn:active {{
                transform: scale(0.97);
            }}
        </style>
    </head>
    <body>
        <div class="spinner"></div>
        <h2 style="margin: 0 0 8px 0;">Autenticado com sucesso!</h2>
        <p style="color: #9ca3af; margin: 0 0 12px 0;">Redirecionando para o aplicativo...</p>
        <a class="btn" href="{redirect_target}">Entrar Agora</a>
        <script>
            // 1. Salva credenciais imediatamente no localStorage e cookie
            try {{
                localStorage.setItem('token', '{jwt_token}');
                localStorage.setItem('user', '{user_json}');
                document.cookie = 'token={jwt_token}; path=/; max-age=2592000; SameSite=Lax';
            }} catch(e) {{}}

            // 2. Notifica o app Flutter nativo caso esteja embutido no InAppWebView
            try {{
                if (window.flutter_inappwebview) {{
                    window.flutter_inappwebview.callHandler('onUserLogin', {{
                        username: '{username_val}',
                        token: '{jwt_token}'
                    }});
                }}
            }} catch(e) {{}}

            // 3. Notifica janela pai caso seja popup Web
            try {{
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'GOOGLE_AUTH_SUCCESS', token: '{jwt_token}', user: {user_json} }}, '*');
                    window.close();
                }}
            }} catch(e) {{}}

            // 4. Redireciona imediatamente substituindo o histórico para evitar reenvio de código
            setTimeout(function() {{
                window.location.replace('{redirect_target}');
            }}, 50);
        </script>
    </body>
    </html>
    """
    return HttpResponse(html, content_type="text/html")


@auth_router.get("/google/poll/{state}")
def poll_google_login(request: HttpRequest, state: str):
    """
    Polling para o app mobile verificar se o login social do Google foi concluído.
    """
    from django.core.cache import cache

    data = cache.get(f"google_oauth_state_{state}")
    if not data:
        return {"ready": False}
    return data


@auth_router.post("/refresh", response=TokenResponse)
def refresh_token(request: HttpRequest, payload: RefreshTokenInput):
    """
    Renova o Access Token utilizando um Refresh Token válido.
    """
    return AuthService.refresh_access_token(payload.refresh_token)


from pydantic import BaseModel


class PasswordResetProfileInput(BaseModel):
    new_password: str


@auth_router.post("/forgot-password")
def forgot_password(request: HttpRequest, payload: ForgotPasswordInput):
    """
    Solicitação de recuperação de senha com envio de e-mail e token.
    """
    return AuthService.process_forgot_password(payload.identifier)


@auth_router.post("/reset-password")
def reset_password(request: HttpRequest, payload: ResetPasswordInput):
    """
    Redefinição de senha com token seguro.
    """
    return AuthService.reset_password_with_token(payload.token, payload.new_password)


@auth_router.post("/password-reset-profile", auth=auth_required)
def reset_password_profile(request: HttpRequest, payload: PasswordResetProfileInput):
    """
    Atualiza a senha do usuário logado diretamente na página de perfil.
    """
    user: User = request.auth
    if not payload.new_password or len(payload.new_password) < 6:
        raise HttpError(400, "A senha deve conter no mínimo 6 caracteres.")
    user.set_password(payload.new_password)
    user.save()
    return {
        "ok": True,
        "message": "Senha atualizada com sucesso.",
        "detail": "Senha alterada.",
    }


@auth_router.get("/me", response=UserOut, auth=auth_required)
def get_me(request: HttpRequest):
    """
    Retorna os dados do usuário autenticado no token.
    """
    user: User = request.auth
    return AuthService._build_user_out(user)


# ── PROFILE ENDPOINTS ─────────────────────────────────────────────────


@profile_router.get("", response=UserOut, auth=auth_required)
@profile_router.get("/", response=UserOut, auth=auth_required)
def get_profile(request: HttpRequest):
    """
    Retorna o perfil do usuário logado (usado no bootstrap do frontend).
    """
    user: User = request.auth
    return AuthService._build_user_out(user)


@profile_router.put("", response=UserOut, auth=auth_required)
@profile_router.put("/", response=UserOut, auth=auth_required)
@profile_router.patch("", response=UserOut, auth=auth_required)
@profile_router.patch("/", response=UserOut, auth=auth_required)
def update_profile(request: HttpRequest, payload: ProfileUpdateInput):
    """
    Atualiza campos do perfil do usuário autenticado (PUT/PATCH).
    """
    user: User = request.auth
    update_data = payload.dict(exclude_unset=True)
    profile_dict = user.profile if isinstance(user.profile, dict) else {}

    # Campos que residem dentro do JSON de perfil
    for subfield in [
        "responsible_email",
        "whatsapp_number",
        "allow_whatsapp_notifications",
        "occupation",
        "focus",
        "preferred_accent",
        "accent",
    ]:
        if subfield in update_data and update_data[subfield] is not None:
            profile_dict[subfield] = update_data[subfield]
            if subfield == "accent":
                profile_dict["preferred_accent"] = update_data[subfield]

    if "profile" in update_data and isinstance(update_data["profile"], dict):
        profile_dict.update(update_data["profile"])

    user.profile = profile_dict

    # Campos diretos no modelo
    for field in [
        "name",
        "nickname",
        "email",
        "level",
        "avatar_url",
        "native_language",
        "timezone",
    ]:
        if field in update_data and update_data[field] is not None:
            if hasattr(user, field):
                setattr(user, field, update_data[field])

    user.save()
    return AuthService._build_user_out(user)
