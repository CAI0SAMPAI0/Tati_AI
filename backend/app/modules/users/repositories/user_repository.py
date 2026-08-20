"""
services/user_repository.py
Repositório para gerenciar acesso a dados da tabela 'users'.
"""

from typing import Any

from fastapi.concurrency import run_in_threadpool
from supabase import Client


class UserRepository:
    @staticmethod
    def _strip_avatar_fields(fields: str) -> str:
        cleaned = [part.strip() for part in fields.split(",") if part.strip()]
        cleaned = [
            part for part in cleaned if part not in {"avatar_url", "profile.avatar_url"}
        ]
        # Mantemos profile para compatibilidade legada de avatar em
        # profile.avatar_url.
        return ", ".join(cleaned)

    @staticmethod
    async def find_by_identifier(
        db: Client,
        identifier: str,
        fields: str = "username, name, email, password, role, level, focus, avatar_url, profile",
    ) -> dict[str, Any] | None:
        def _fetch():
            ident = identifier.strip().lower()
            for column in ("username", "email"):
                try:
                    rows = (
                        db.table("users")
                        .select(fields)
                        .eq(column, ident)
                        .limit(1)
                        .execute()
                        .data
                    )
                except Exception:
                    fallback_fields = UserRepository._strip_avatar_fields(fields)
                    rows = (
                        db.table("users")
                        .select(fallback_fields)
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
        db: Client, username: str, fields: str = "username"
    ) -> dict[str, Any] | None:
        def _fetch():
            rows = (
                db.table("users")
                .select(fields)
                .eq("username", username)
                .limit(1)
                .execute()
                .data
            )
            return rows[0] if rows else None

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def find_by_email(
        db: Client,
        email: str,
        fields: str = "username, name, email, role, level, focus, avatar_url, profile",
    ) -> dict[str, Any] | None:
        def _fetch():
            try:
                rows = (
                    db.table("users")
                    .select(fields)
                    .ilike("email", email)
                    .limit(1)
                    .execute()
                    .data
                )
            except Exception:
                fallback_fields = UserRepository._strip_avatar_fields(fields)
                rows = (
                    db.table("users")
                    .select(fallback_fields)
                    .ilike("email", email)
                    .limit(1)
                    .execute()
                    .data
                )
            return rows[0] if rows else None

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def check_exists_by_username_or_email(
        db: Client, username: str, email: str
    ) -> bool:
        def _fetch():
            rows = (
                db.table("users")
                .select("username")
                .or_(f"username.eq.{username},email.eq.{email}")
                .execute()
                .data
            )
            return bool(rows)

        return await run_in_threadpool(_fetch)

    @staticmethod
    async def insert_user(db: Client, user_data: dict[str, Any]) -> None:
        def _insert():
            db.table("users").insert(user_data).execute()

        await run_in_threadpool(_insert)

    @staticmethod
    async def update_user(
        db: Client, username: str, update_data: dict[str, Any]
    ) -> None:
        def _update():
            db.table("users").update(update_data).eq("username", username).execute()

        await run_in_threadpool(_update)

    @staticmethod
    async def find_by_reset_token(db: Client, token: str) -> dict[str, Any] | None:
        def _fetch():
            rows = (
                db.table("users")
                .select("username, name, email, reset_token_expires")
                .eq("reset_token", token)
                .limit(1)
                .execute()
                .data
            )
            return rows[0] if rows else None

        return await run_in_threadpool(_fetch)
