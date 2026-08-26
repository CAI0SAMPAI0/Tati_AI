import logging
from typing import Tuple, Optional
from django.contrib.auth import get_user_model
from django.conf import settings
from ninja.errors import HttpError
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from .models import UserRole, CEFRLevel
from .schemas import RegisterInput, LoginInput, TokenResponse, UserOut
from .security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    hash_password,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class AuthService:
    @staticmethod
    def _build_user_out(user: User) -> UserOut:
        prof = user.profile if isinstance(user.profile, dict) else {}
        focus = prof.get("focus") or getattr(user, "focus", None) or "General Conversation"
        occupation = prof.get("occupation") or getattr(user, "occupation", None) or ""
        return UserOut(
            id=str(user.username),
            username=user.username,
            email=user.email or "",
            name=user.name or user.username,
            nickname=getattr(user, "nickname", "") or user.name or user.username,
            role=user.role or "student",
            level=user.level or "A1",
            avatar_url=user.avatar_url,
            native_language=user.native_language,
            timezone=user.timezone,
            focus=focus,
            occupation=occupation,
            profile=prof,
            streak_count=user.streak_count,
            total_xp=user.total_xp,
            is_special_access=user.is_special_access,
            is_hub_only=user.is_hub_only,
        )

    @classmethod
    def build_token_response(cls, user: User) -> TokenResponse:
        token_payload = {
            "sub": user.username,
            "role": user.role,
            "level": user.level,
            "user_id": str(user.id),
        }
        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token({"sub": user.username})

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
            user=cls._build_user_out(user),
        )

    @classmethod
    def authenticate_user(cls, login_data: LoginInput) -> TokenResponse:
        identifier = (login_data.username or login_data.email or login_data.identifier or "").strip()
        password = login_data.password

        if not identifier or not password:
            raise HttpError(422, "Identificador e senha são obrigatórios.")

        print(f"[Auth] Tentativa de login para identifier='{identifier}'")

        # Busca por username ou email (case-insensitive)
        user = User.objects.filter(username__iexact=identifier).first() or User.objects.filter(email__iexact=identifier).first()

        if not user:
            print(f"[Auth] Usuario nao encontrado no banco: '{identifier}'")
            logger.info(f"[Auth] Usuário não encontrado: {identifier}")
            raise HttpError(401, "Usuário ou senha incorretos.")

        print(f"[Auth] Usuario encontrado: '{user.username}' (role={user.role})")

        # Valida senha principal ou senha temporária
        password_ok = verify_password(password, user.password)
        temp_ok = user.temp_password and verify_password(password, user.temp_password)

        print(f"[Auth] Validacao de senha: password_ok={password_ok}, temp_ok={bool(temp_ok)}")

        if not password_ok and not temp_ok:
            print(f"[Auth] Senha invalida para: '{user.username}'")
            logger.info(f"[Auth] Senha inválida para: {user.username}")
            raise HttpError(401, "Usuário ou senha incorretos.")

        if temp_ok:
            user.temp_password = None
            user.save(update_fields=['temp_password'])

        # Auto-promove para programador se configurado em SUPERADMIN_EMAILS
        superadmins = getattr(settings, 'SUPERADMIN_EMAILS', [])
        programmers = getattr(settings, 'PROGRAMMER_USERNAMES', [])
        if user.email.lower() in superadmins or user.username.lower() in programmers:
            if user.role != UserRole.PROGRAMADOR:
                user.role = UserRole.PROGRAMADOR
                user.is_staff = True
                user.is_superuser = True
                user.save(update_fields=['role', 'is_staff', 'is_superuser'])

        return cls.build_token_response(user)

    @classmethod
    def process_forgot_password(cls, identifier: str) -> dict:
        import os
        import secrets
        from datetime import datetime, timedelta, timezone

        identifier = (identifier or "").strip().lower()
        user = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(username__iexact=identifier).first()
        if not user:
            return {"ok": True, "message": "Se o e-mail existir, você receberá instruções de redefinição."}

        reset_token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()

        prof = user.profile if isinstance(user.profile, dict) else {}
        prof["reset_token"] = reset_token
        prof["reset_token_expires"] = expires_at
        user.profile = prof
        user.save(update_fields=["profile"])

        from apps.notifications.services import BrevoEmailService
        site_url = os.getenv("FRONTEND_URL") or os.getenv("NEXT_PUBLIC_APP_URL") or "http://localhost:3000"
        reset_link = f"{site_url.rstrip('/')}/reset-password?token={reset_token}"

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; padding: 20px;">
            <h2 style="color: #6366f1;">Redefinição de Senha — Teacher Tati</h2>
            <p>Olá, <strong>{user.name or user.username}</strong>!</p>
            <p>Você solicitou a redefinição de senha para sua conta na Teacher Tati.</p>
            <p style="margin: 24px 0;">
                <a href="{reset_link}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Redefinir Minha Senha
                </a>
            </p>
            <p style="font-size: 13px; color: #666;">Ou copie o link: <a href="{reset_link}" style="color: #6366f1;">{reset_link}</a></p>
            <p style="font-size: 12px; color: #999;">Este link expira em 30 minutos. Se você não solicitou, pode ignorar esta mensagem.</p>
        </div>
        """
        BrevoEmailService.send_email(
            to_email=user.email or identifier,
            subject="Teacher Tati — Redefinição de Senha",
            html_content=html_content,
            recipient_name=user.name or user.username,
        )

        return {
            "ok": True,
            "message": "Se o e-mail existir, você receberá instruções de redefinição.",
            "reset_token": reset_token,
        }

    @classmethod
    def reset_password_with_token(cls, token: str, new_password: str) -> dict:
        from datetime import datetime, timezone

        if not token or len(new_password) < 6:
            raise HttpError(400, "Senha inválida ou token ausente. Mínimo de 6 caracteres.")

        users = User.objects.all()
        target_user = None
        for u in users:
            prof = u.profile if isinstance(u.profile, dict) else {}
            if prof.get("reset_token") == token:
                expires_str = prof.get("reset_token_expires")
                if expires_str:
                    try:
                        exp = datetime.fromisoformat(expires_str)
                        if datetime.now(timezone.utc) > exp:
                            raise HttpError(400, "Token expirado. Solicite uma nova redefinição.")
                    except (ValueError, TypeError):
                        pass
                target_user = u
                break

        if not target_user:
            raise HttpError(400, "Token inválido ou expirado.")

        target_user.set_password(new_password)
        prof = target_user.profile if isinstance(target_user.profile, dict) else {}
        prof.pop("reset_token", None)
        prof.pop("reset_token_expires", None)
        target_user.profile = prof
        target_user.save()

        return {"ok": True, "message": "Senha redefinida com sucesso."}

    @classmethod
    def register_student(cls, data: RegisterInput) -> TokenResponse:
        username = data.username.strip().lower()
        email = data.email.strip().lower()

        if User.objects.filter(username=username).exists():
            raise HttpError(400, "Este nome de usuário já está em uso.")

        if User.objects.filter(email=email).exists():
            raise HttpError(400, "Este e-mail já está cadastrado.")

        # Define papel inicial
        superadmins = getattr(settings, 'SUPERADMIN_EMAILS', [])
        role = UserRole.PROGRAMADOR if email in superadmins else UserRole.STUDENT
        is_staff = role == UserRole.PROGRAMADOR
        is_superuser = role == UserRole.PROGRAMADOR

        user = User.objects.create(
            username=username,
            email=email,
            name=data.name.strip(),
            password=hash_password(data.password),
            role=role,
            level=data.level.upper() if data.level.upper() in CEFRLevel.values else CEFRLevel.A1,
            is_hub_only=data.is_hub_only,
            is_staff=is_staff,
            is_superuser=is_superuser,
        )

        logger.info(f"[Auth] Novo usuário registrado com sucesso: {username} ({role})")
        return cls.build_token_response(user)

    @classmethod
    def google_login(cls, credential: str, is_hub_only: bool = False) -> TokenResponse:
        try:
            google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
            id_info = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                audience=google_client_id if google_client_id else None,
            )
        except Exception as e:
            logger.warning(f"[Auth] Validação do Google OAuth falhou: {e}")
            raise HttpError(401, "Token do Google inválido ou expirado.")

        email = id_info.get("email", "").strip().lower()
        name = id_info.get("name", "").strip()
        picture = id_info.get("picture", "")

        if not email:
            raise HttpError(400, "O token do Google não forneceu um e-mail válido.")

        user = User.objects.filter(email=email).first()
        if not user:
            # Cria username a partir do email
            base_username = email.split("@")[0].lower()
            candidate = base_username
            counter = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f"{base_username}{counter}"
                counter += 1

            superadmins = getattr(settings, 'SUPERADMIN_EMAILS', [])
            role = UserRole.PROGRAMADOR if email in superadmins else UserRole.STUDENT

            user = User.objects.create(
                username=candidate,
                email=email,
                name=name or candidate,
                avatar_url=picture,
                role=role,
                is_hub_only=is_hub_only,
                is_staff=(role == UserRole.PROGRAMADOR),
                is_superuser=(role == UserRole.PROGRAMADOR),
            )
            user.set_unusable_password()
            user.save()
            logger.info(f"[Auth] Novo usuário Google criado: {user.username}")
        else:
            # Atualiza avatar se não tiver
            if picture and not user.avatar_url:
                user.avatar_url = picture
                user.save(update_fields=['avatar_url'])

        return cls.build_token_response(user)

    @classmethod
    def refresh_access_token(cls, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HttpError(401, "Refresh token inválido ou expirado.")

        username = payload.get("sub")
        user = User.objects.filter(username=username).first()
        if not user:
            raise HttpError(401, "Usuário não encontrado.")

        return cls.build_token_response(user)
