import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.enums import normalize_level
from app.core.exceptions import (
    AuthenticationRequiredError,
    BusinessLogicError,
    UserNotFoundError,
)
from app.core.security import (
    create_access_token,
    generate_reset_token,
    hash_password,
    verify_password,
)
from app.modules.users.repositories.user_repository import UserRepository
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from supabase import Client


class AuthService:
    @staticmethod
    async def build_token_response(user: dict[str, Any]) -> dict[str, Any]:
        token_payload = {
            "sub": user["username"],
            "role": user.get("role", "student"),
            "level": normalize_level(user.get("level")),
        }
        token = create_access_token(token_payload)

        # Ativa assinatura automática para usuários especiais
        from app.modules.payments.services.subscription_manager import (
            SPECIAL_USERS,
            activate_special_user,
        )

        username = user["username"]
        if username in SPECIAL_USERS:

            async def _activate_special() -> None:
                try:
                    await run_in_threadpool(activate_special_user, username, "full")
                except Exception as e:
                    logging.info(
                        f"[Auth] Erro ao ativar subscription para {username}: {e}"
                    )

            asyncio.create_task(_activate_special())

        sanitized_user = {k: v for k, v in user.items() if k != "password"}
        profile = sanitized_user.get("profile")
        if not sanitized_user.get("avatar_url") and isinstance(profile, dict):
            sanitized_user["avatar_url"] = profile.get("avatar_url")

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": sanitized_user,
        }

    @staticmethod
    async def authenticate_user(
        db: Client, username: str, password: str
    ) -> dict[str, Any]:
        user = await UserRepository.find_by_identifier(db, username)
        if not user:
            raise AuthenticationRequiredError(detail="Usuário ou senha incorretos")

        password_ok = verify_password(password, user["password"])
        temp_ok = user.get("temp_password") and verify_password(
            password, user["temp_password"]
        )

        if not password_ok and not temp_ok:
            raise AuthenticationRequiredError(detail="Usuário ou senha incorretos")

        if temp_ok:
            await UserRepository.update_user(
                db, user["username"], {"temp_password": None}
            )

        # Trigger study day streak renewal and update active date upon login
        try:
            from app.modules.users.services.streaks import record_study_day
            asyncio.create_task(record_study_day(user["username"], is_activity=False))
        except Exception:
            pass

        return await AuthService.build_token_response(user)

    @staticmethod
    async def register_student(db: Client, body: Any) -> dict[str, Any]:
        if len(body.password) < 6:
            raise BusinessLogicError("Senha deve ter pelo menos 6 caracteres")

        username = body.username.strip().lower()
        email = body.email.strip().lower()
        is_hub_only = getattr(body, "is_hub_only", False)

        exists = await UserRepository.check_exists_by_username_or_email(
            db, username, email
        )
        if exists:
            raise HTTPException(
                status_code=409, detail="Username ou e-mail já cadastrado"
            )

        new_user = {
            "username": username,
            "name": body.name.strip(),
            "email": email,
            "password": hash_password(body.password),
            "role": "buyer" if is_hub_only else "student",
            "level": normalize_level(body.level),
            "focus": "General Conversation",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(db, new_user)
        return {"ok": True, "message": "Conta criada com sucesso"}

    @staticmethod
    async def google_login(
        db: Client, credential: str, is_hub_only: bool = False
    ) -> dict[str, Any]:
        if not settings.google_client_id:
            raise HTTPException(status_code=503, detail="Google OAuth not configured")

        try:
            info = await run_in_threadpool(
                id_token.verify_oauth2_token,
                credential,
                google_requests.Request(),
                settings.google_client_id,
                clock_skew_in_seconds=60,
            )
        except Exception as exc:
            raise AuthenticationRequiredError(detail=f"Token Google inválido: {exc}")

        email = info.get("email", "").lower()
        name = info.get("name", email.split("@")[0])
        base_username = email.split("@")[0].replace(".", "_").lower()

        existing_user = await UserRepository.find_by_email(db, email)
        if existing_user:
            # Trigger study day streak renewal and update active date upon google login
            try:
                from app.modules.users.services.streaks import record_study_day
                asyncio.create_task(record_study_day(existing_user["username"], is_activity=False))
            except Exception:
                pass
            return await AuthService.build_token_response(existing_user)

        # Garante username único
        username = base_username
        suffix = 1
        while await UserRepository.find_by_username(db, username):
            username = f"{base_username}{suffix}"
            suffix += 1

        new_user = {
            "username": username,
            "name": name,
            "email": email,
            "password": "google_authenticated",
            "role": "buyer" if is_hub_only else "student",
            "level": "A1",
            "focus": "General Conversation",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(db, new_user)

        return await AuthService.build_token_response(
            {k: v for k, v in new_user.items() if k != "password"}
            | {"username": username}
        )

    @staticmethod
    async def process_forgot_password(
        db: Client, identifier: str, base_url: str = "", is_app: bool = False
    ) -> dict[str, Any]:
        user = await UserRepository.find_by_identifier(
            db, identifier, "username, name, email, password"
        )
        if not user:
            return {
                "ok": True,
                "message": "Se o usuário existir, um e-mail será enviado.",
            }

        if user["password"] == "google_authenticated":
            return {
                "ok": True,
                "message": "Se o usuário existir, um e-mail será enviado.",
            }

        reset_token = generate_reset_token()
        from datetime import datetime, timedelta, timezone

        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        await UserRepository.update_user(
            db,
            user["username"],
            {
                "reset_token": reset_token,
                "reset_token_expires": expires_at,
            },
        )

        return {
            "ok": True,
            "is_app": True,
            "message": "Informe sua nova senha abaixo.",
            "reset_token": reset_token,
        }

    @staticmethod
    async def reset_password_with_token(
        db: Client, token: str, new_password: str
    ) -> dict[str, Any]:
        from datetime import datetime, timezone

        user = await UserRepository.find_by_reset_token(db, token)
        if not user:
            raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

        expires_str = user.get("reset_token_expires")
        if expires_str:
            try:
                expires = datetime.fromisoformat(expires_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) > expires:
                    raise HTTPException(
                        status_code=400, detail="Token inválido ou expirado."
                    )
            except (ValueError, TypeError):
                pass

        if len(new_password) < 6:
            raise BusinessLogicError("Nova senha deve ter pelo menos 6 caracteres")

        await UserRepository.update_user(
            db,
            user["username"],
            {
                "password": hash_password(new_password),
                "reset_token": None,
                "reset_token_expires": None,
                "temp_password": None,
            },
        )
        return {"ok": True, "message": "Senha alterada com sucesso."}

    @staticmethod
    async def change_password(
        db: Client, current_user: dict[str, Any], body: Any
    ) -> dict[str, Any]:
        user = await UserRepository.find_by_username(
            db, current_user["username"], "password"
        )
        if not user:
            raise UserNotFoundError()

        stored = user["password"]
        if stored == "google_authenticated":
            raise BusinessLogicError(detail="Conta Google não usa senha local")

        if not verify_password(body.current_password, stored):
            raise AuthenticationRequiredError(detail="Senha atual incorreta")

        if len(body.new_password) < 6:
            raise BusinessLogicError("Nova senha deve ter pelo menos 6 caracteres")

        await UserRepository.update_user(
            db, current_user["username"], {"password": hash_password(body.new_password)}
        )
        return {"ok": True}
