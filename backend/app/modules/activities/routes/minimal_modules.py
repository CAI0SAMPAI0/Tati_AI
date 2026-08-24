import logging

from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.activity_service import ActivityService
from fastapi import APIRouter, Depends

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{module_id}")
async def get_module(module_id: str, user=Depends(get_current_user)):
    try:
        service = ActivityService()
        data = await service.get_module_details(module_id)
        if data:
            return data
        return {"error": "not_found", "detail": "Module not found"}
    except Exception as e:
        logger.warning(f"[MinimalModules] Error fetching module {module_id}: {e}")
        return {"error": "db_error", "detail": str(e)}
