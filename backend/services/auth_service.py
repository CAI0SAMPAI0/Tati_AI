"""
services/auth_service.py
Regras de negócio para autenticação.
"""

from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from core.config import settings
from core.security import (
    create_access_token,
    generate_temp_password,
    hash_password,
    verify_password,
)
from services.email import EmailSender
from services.user_repository import UserRepository


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
        from services.subscription_manager import SPECIAL_USERS, activate_special_user

        username = user['username']
        if username in SPECIAL_USERS:
            try:
                # Pode bloquear, então jogamos na threadpool
                await run_in_threadpool(activate_special_user, username, 'full')
            except Exception as e:
                print(f'[Auth] Erro ao ativar subscription para {username}: {e}')

        return {
            'access_token': token,
            'token_type': 'bearer',
            'user': {k: v for k, v in user.items() if k != 'password'},
        }

    @staticmethod
    async def authenticate_user(username: str, password: str) -> Dict[str, Any]:
        user = await UserRepository.find_by_identifier(username)
        if not user:
            raise HTTPException(status_code=401, detail='Usuário ou senha incorretos')

        password_ok = verify_password(password, user['password'])
        temp_ok = user.get('temp_password') and verify_password(
            password, user['temp_password']
        )

        if not password_ok and not temp_ok:
            raise HTTPException(status_code=401, detail='Usuário ou senha incorretos')

        if temp_ok:
            await UserRepository.update_user(user['username'], {'temp_password': None})

        return await AuthService.build_token_response(user)

    @staticmethod
    async def register_student(body: Any) -> Dict[str, Any]:
        if len(body.password) < 6:
            raise HTTPException(
                status_code=400, detail='Senha deve ter pelo menos 6 caracteres'
            )

        username = body.username.strip().lower()
        email = body.email.strip().lower()

        exists = await UserRepository.check_exists_by_username_or_email(username, email)
        if exists:
            raise HTTPException(
                status_code=409, detail='Username ou e-mail já cadastrado'
            )

        new_user = {
            'username': username,
            'name': body.name.strip(),
            'email': email,
            'password': hash_password(body.password),
            'role': 'student',
            'level': body.level,
            'focus': 'General Conversation',
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(new_user)
        return {'ok': True, 'message': 'Conta criada com sucesso'}

    @staticmethod
    async def google_login(credential: str) -> Dict[str, Any]:
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
            raise HTTPException(status_code=401, detail=f'Token Google inválido: {exc}')

        email = info.get('email', '').lower()
        name = info.get('name', email.split('@')[0])
        base_username = email.split('@')[0].replace('.', '_').lower()

        existing_user = await UserRepository.find_by_email(email)
        if existing_user:
            return await AuthService.build_token_response(existing_user)

        # Garante username único
        username = base_username
        suffix = 1
        while await UserRepository.find_by_username(username):
            username = f'{base_username}{suffix}'
            suffix += 1

        new_user = {
            'username': username,
            'name': name,
            'email': email,
            'password': 'google_authenticated',
            'role': 'student',
            'level': 'Beginner',
            'focus': 'General Conversation',
            'created_at': datetime.now(timezone.utc).isoformat(),
        }
        await UserRepository.insert_user(new_user)

        return await AuthService.build_token_response(
            {k: v for k, v in new_user.items() if k != 'password'}
            | {'username': username}
        )

    @staticmethod
    async def process_forgot_password(identifier: str) -> Dict[str, Any]:
        user = await UserRepository.find_by_identifier(
            identifier, 'username, name, email, password'
        )
        if not user:
            return {
                'ok': True,
                'message': 'Se o usuário existir, um e-mail será enviado.',
            }

        if user['password'] == 'google_authenticated':
            return {'ok': False, 'message': 'Esta conta usa login pelo Google.'}

        temp_password = generate_temp_password()
        await UserRepository.update_user(
            user['username'], {'temp_password': hash_password(temp_password)}
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
        current_user: Dict[str, Any], body: Any
    ) -> Dict[str, Any]:
        user = await UserRepository.find_by_username(
            current_user['username'], 'password'
        )
        if not user:
            raise HTTPException(status_code=404, detail='Usuário não encontrado')

        stored = user['password']
        if stored == 'google_authenticated':
            raise HTTPException(
                status_code=400, detail='Conta Google não usa senha local'
            )

        if not verify_password(body.current_password, stored):
            raise HTTPException(status_code=401, detail='Senha atual incorreta')

        if len(body.new_password) < 6:
            raise HTTPException(
                status_code=400, detail='Nova senha deve ter pelo menos 6 caracteres'
            )

        await UserRepository.update_user(
            current_user['username'], {'password': hash_password(body.new_password)}
        )
        return {'ok': True}
