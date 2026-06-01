from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_temp_password,
    hash_password,
    verify_password,
)
from app.shared.services.email import EmailSender
from app.modules.users.repositories.user_repository import UserRepository
from supabase import Client
from app.core.exceptions import UserNotFoundError, BusinessLogicError, AuthenticationRequiredError


class AuthService:
    @staticmethod
    async def build_token_response(user: Dict[str, Any]) -> Dict[str, Any]:
        token_payload = {
            'sub': user['username'],
            'role': user.get('role', 'student'),
            'level': user.get('level', 'Beginner'),
        }
        token = create_access_token(token_payload)

        # Ativa assinatura automática para usuários especiais
        from app.modules.payments.services.subscription_manager import SPECIAL_USERS, activate_special_user

        username = user['username']
        if username in SPECIAL_USERS:
            try:
                # Pode bloquear, então jogamos na threadpool
                await run_in_threadpool(activate_special_user, username, 'full')
            except Exception as e:
                print(f'[Auth] Erro ao ativar subscription para {username}: {e}')

        sanitized_user = {k: v for k, v in user.items() if k != 'password'}
        profile = sanitized_user.get('profile')
        if not sanitized_user.get('avatar_url') and isinstance(profile, dict):
            sanitized_user['avatar_url'] = profile.get('avatar_url')

        return {
            'access_token': token,
            'token_type': 'bearer',
            'user': sanitized_user,
        }

    @staticmethod
    async def authenticate_user(db: Client, username: str, password: str) -> Dict[str, Any]:
        user = await UserRepository.find_by_identifier(db, username)
        if not user:
            raise AuthenticationRequiredError(detail='Usuário ou senha incorretos')

        password_ok = verify_password(password, user['password'])
        temp_ok = user.get('temp_password') and verify_password(
            password, user['temp_password']
        )

        if not password_ok and not temp_ok:
            raise AuthenticationRequiredError(detail='Usuário ou senha incorretos')

        if temp_ok:
            await UserRepository.update_user(db, user['username'], {'temp_password': None})

        return await AuthService.build_token_response(user)

    @staticmethod
    async def register_student(db: Client, body: Any) -> Dict[str, Any]:
        if len(body.password) < 6:
            raise BusinessLogicError('Senha deve ter pelo menos 6 caracteres')

        username = body.username.strip().lower()
        email = body.email.strip().lower()
        is_hub_only = getattr(body, 'is_hub_only', False)

        exists = await UserRepository.check_exists_by_username_or_email(db, username, email)
        if exists:
            raise HTTPException(
                status_code=409, detail='Username ou e-mail já cadastrado'
            )

        new_user = {
            'username': username,
            'name': body.name.strip(),
            'email': email,
            'password': hash_password(body.password),
            'role': 'buyer' if is_hub_only else 'student',
            'level': body.level,
            'focus': 'General Conversation',
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(db, new_user)
        return {'ok': True, 'message': 'Conta criada com sucesso'}

    @staticmethod
    async def google_login(db: Client, credential: str, is_hub_only: bool = False) -> Dict[str, Any]:
        if not settings.google_client_id:
            raise HTTPException(status_code=503, detail='Google OAuth not configured')

        try:
            info = await run_in_threadpool(
                id_token.verify_oauth2_token,
                credential,
                google_requests.Request(),
                settings.google_client_id,
                clock_skew_in_seconds=60,
            )
        except Exception as exc:
            raise AuthenticationRequiredError(detail=f'Token Google inválido: {exc}')

        email = info.get('email', '').lower()
        name = info.get('name', email.split('@')[0])
        base_username = email.split('@')[0].replace('.', '_').lower()

        existing_user = await UserRepository.find_by_email(db, email)
        if existing_user:
            return await AuthService.build_token_response(existing_user)

        # Garante username único
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
            'role': 'buyer' if is_hub_only else 'student',
            'level': 'Beginner',
            'focus': 'General Conversation',
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(db, new_user)

        return await AuthService.build_token_response(
            {k: v for k, v in new_user.items() if k != 'password'}
            | {'username': username}
        )

    @staticmethod
    async def process_forgot_password(db: Client, identifier: str) -> Dict[str, Any]:
        user = await UserRepository.find_by_identifier(
            db, identifier, 'username, name, email, password'
        )
        if not user:
            return {
                'ok': True,
                'message': 'Se o usuário existir, um e-mail será enviado.',
            }

        if user['password'] == 'google_authenticated':
            return {
                'ok': True,
                'message': 'Se o usuário existir, um e-mail será enviado.',
            }

        temp_password = generate_temp_password()
        await UserRepository.update_user(
            db, user['username'], {'temp_password': hash_password(temp_password)}
        )

        email_sender = EmailSender()
        email_sent = await run_in_threadpool(
            email_sender.send_reset_email,
            user['email'],
            user.get('name') or user['username'],
            temp_password,
        )

        if not email_sent and not settings.smtp_user:
            return {
                'ok': True,
                'dev_mode': True,
                'message': f'SMTP não configurado. Senha temporária (apenas em dev): {temp_password}',
                'temp_password': temp_password,
            }
        if not email_sent:
            raise HTTPException(
                status_code=500, detail='Erro ao enviar e-mail. Tente novamente.'
            )

        return {
            'ok': True,
            'message': 'E-mail enviado! Verifique sua caixa de entrada.',
        }

    @staticmethod
    async def change_password(
        db: Client, current_user: Dict[str, Any], body: Any
    ) -> Dict[str, Any]:
        user = await UserRepository.find_by_username(
            db, current_user['username'], 'password'
        )
        if not user:
            raise UserNotFoundError()

        stored = user['password']
        if stored == 'google_authenticated':
            raise BusinessLogicError(detail='Conta Google não usa senha local')

        if not verify_password(body.current_password, stored):
            raise AuthenticationRequiredError(detail='Senha atual incorreta')

        if len(body.new_password) < 6:
            raise BusinessLogicError('Nova senha deve ter pelo menos 6 caracteres')

        await UserRepository.update_user(
            db, current_user['username'], {'password': hash_password(body.new_password)}
        )
        return {'ok': True}
