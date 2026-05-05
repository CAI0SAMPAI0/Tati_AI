"""
services/user_repository.py
Repositório para gerenciar acesso a dados da tabela 'users'.
"""

from typing import Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from services.database import get_client


class UserRepository:
    @staticmethod
    async def find_by_identifier(
        identifier: str,
        fields: str = 'username, name, email, password, role, level, focus',
    ) -> Optional[Dict[str, Any]]:
        def _fetch():
            db = get_client()
            ident = identifier.strip().lower()
            for column in ('username', 'email'):
                rows = (
                    db.table('users')
                    .select(fields)
                    .eq(column, ident)
                    .limit(1)
                    .execute()
                    .data
                )
                if rows:
                    return rows[0]
            return None

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def find_by_username(
        username: str, fields: str = 'username'
    ) -> Optional[Dict[str, Any]]:
        def _fetch():
            db = get_client()
            rows = (
                db.table('users')
                .select(fields)
                .eq('username', username)
                .limit(1)
                .execute()
                .data
            )
            return rows[0] if rows else None

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def find_by_email(
        email: str, fields: str = 'username, name, email, role, level, focus'
    ) -> Optional[Dict[str, Any]]:
        def _fetch():
            db = get_client()
            rows = (
                db.table('users')
                .select(fields)
                .eq('email', email)
                .limit(1)
                .execute()
                .data
            )
            return rows[0] if rows else None

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def check_exists_by_username_or_email(username: str, email: str) -> bool:
        def _fetch():
            db = get_client()
            rows = (
                db.table('users')
                .select('username')
                .or_(f'username.eq.{username},email.eq.{email}')
                .execute()
                .data
            )
            return bool(rows)

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def insert_user(user_data: Dict[str, Any]) -> None:
        def _insert():
            db = get_client()
            db.table('users').insert(user_data).execute()

        await run_in_threadpool(_insert)

    @staticmethod
    async def update_user(username: str, update_data: Dict[str, Any]) -> None:
        def _update():
            db = get_client()
            db.table('users').update(update_data).eq('username', username).execute()

        await run_in_threadpool(_update)
