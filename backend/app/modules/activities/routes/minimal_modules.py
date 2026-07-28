"""Endpoint mínimo para acesso a módulos (flashcards) — substitui o modules.py deletado."""

import logging

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from fastapi import APIRouter, Depends

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{module_id}")
async def get_module(module_id: str, user=Depends(get_current_user)):
    db = get_client()
    try:
        res = db.table("modules").select("*").eq("id", module_id).execute()
        data = res.data
        if data:
            return data[0]
        return {"error": "not_found", "detail": "Module not found"}
    except Exception as e:
        logger.warning(f"[MinimalModules] Error fetching module {module_id}: {e}")
        return {"error": "db_error", "detail": str(e)}
