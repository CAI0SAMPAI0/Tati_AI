from app.core.celery_app import celery_app
from celery.result import AsyncResult
from fastapi import APIRouter

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """Retorna o status de uma task do Celery."""
    task_result = AsyncResult(task_id, app=celery_app)

    # Celery statuses: PENDING, STARTED, SUCCESS, FAILURE, RETRY, REVOKED
    if task_result.state == "SUCCESS":
        return {"status": "success", "result": task_result.result}
    elif task_result.state == "FAILURE":
        return {"status": "failed", "error": str(task_result.info)}
    elif task_result.state == "PENDING":
        return {"status": "pending"}
    else:
        return {"status": task_result.state.lower()}
