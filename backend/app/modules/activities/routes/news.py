"""
Router de News — listagem para alunos.
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


@router.get("/news")
async def list_news(
    user: dict = Depends(get_current_user),
) -> list:
    """Lista notícias publicadas filtradas pelo nível do aluno."""
    from app.core.database import get_client

    user_level = (user.get("level") or "").upper()
    username = user.get("username", "unknown")

    def _fetch() -> list:
        db = get_client()
        try:
            res = (
                db.table("news")
                .select("*")
                .eq("is_published", True)
                .order("created_at", desc=True)
                .execute()
            )
            items = res.data or []
            logging.info(
                f"[News] user={username} level={user_level} fetched={len(items)}"
            )

            if not user_level or user_level in ("ALL", "ADMIN", ""):
                return items

            filtered = []
            for item in items:
                item_levels = _parse_levels(item.get("levels"))
                if "ALL" in item_levels or user_level in item_levels:
                    filtered.append(item)
            logging.info(f"[News] user={username} filtered={len(filtered)}")
            return filtered
        except Exception as e:
            logging.error(f"[News] Error: {e}", exc_info=True)
            return []

    return await run_in_threadpool(_fetch)
