"""
Router de Games — listagem para alunos.
"""

from __future__ import annotations

import json
import logging

from app.core.dependencies.auth import get_current_user
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

router = APIRouter()


def _parse_levels(raw) -> list[str]:
    """Normaliza o campo levels que pode vir como list, string JSON, ou string Supabase."""
    if isinstance(raw, list):
        result = [str(v).upper().strip() for v in raw]
        return result if result else ["ALL"]
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("{") or s.startswith("["):
            try:
                parsed = json.loads(s.replace("{", "[").replace("}", "]"))
                if isinstance(parsed, list):
                    result = [str(v).upper().strip() for v in parsed]
                    return result if result else ["ALL"]
            except (json.JSONDecodeError, ValueError):
                pass
        if "," in s:
            result = [v.strip().upper() for v in s.split(",") if v.strip()]
            return result if result else ["ALL"]
        if s:
            return [s.upper()]
    return ["ALL"]


@router.get("/games")
async def list_games(
    user: dict = Depends(get_current_user),
) -> list:
    """Lista games publicados filtrados pelo nível do aluno."""
    from app.core.database import get_client

    user_level = (user.get("level") or "").upper()
    username = user.get("username", "unknown")

    def _fetch() -> list:
        db = get_client()
        try:
            res = (
                db.table("games")
                .select("*")
                .eq("is_published", True)
                .order("created_at", desc=True)
                .execute()
            )
            games = res.data or []
            logging.info(
                f"[Games] user={username} level={user_level} "
                f"fetched={len(games)} raw_levels={[g.get('levels') for g in games]}"
            )

            if not user_level or user_level in ("ALL", "ADMIN", ""):
                return games

            filtered = []
            for g in games:
                g_levels = _parse_levels(g.get("levels"))
                logging.info(f"[Games] game={g.get('title')} g_levels={g_levels} user_level={user_level} match={'ALL' in g_levels or user_level in g_levels}")
                if "ALL" in g_levels or user_level in g_levels:
                    filtered.append(g)
            logging.info(f"[Games] user={username} filtered={len(filtered)}")
            return filtered
        except Exception as e:
            logging.error(f"[Games] Error: {e}", exc_info=True)
            return []

    return await run_in_threadpool(_fetch)
