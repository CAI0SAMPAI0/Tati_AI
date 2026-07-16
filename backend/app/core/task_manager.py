import uuid
import logging
import asyncio
import httpx
from typing import Callable, Any, Dict
from fastapi import BackgroundTasks, Request, HTTPException
from app.core.config import settings

# In-memory store for local task statuses
# Format: {task_id: {"status": "processing" | "success" | "failed", "result": Any, "error": str}}
local_tasks_status: Dict[str, Dict[str, Any]] = {}

def get_local_task_status(task_id: str) -> Dict[str, Any]:
    if task_id in local_tasks_status:
        return local_tasks_status[task_id]
    return {"status": "processing", "result": None}

def set_local_task_status(task_id: str, status: str, result: Any = None, error: str = None):
    local_tasks_status[task_id] = {
        "status": status,
        "result": result,
        "error": error
    }

def run_task_in_background(
    background_tasks: BackgroundTasks,
    task_func: Callable,
    *args,
    **kwargs
) -> str:
    if settings.use_celery:
        try:
            task = task_func.delay(*args, **kwargs)
            return task.id
        except Exception as celery_err:
            logging.error(f"[TaskManager] Celery delay failed, falling back to local execution: {celery_err}")
            
    task_id = f"local_{uuid.uuid4()}"
    local_tasks_status[task_id] = {"status": "processing", "result": None}
    
    async def async_wrapper():
        try:
            logging.info(f"[TaskManager] Running local background task {task_id}")
            # Use to_thread so sync Celery tasks (which call asyncio.run())
            # can create their own event loop without conflicting
            result = await asyncio.to_thread(task_func, *args, **kwargs)
            set_local_task_status(task_id, "success", result=result)
            logging.info(f"[TaskManager] Local background task {task_id} succeeded")
        except Exception as e:
            logging.error(f"[TaskManager] Local background task {task_id} failed: {e}", exc_info=True)
            set_local_task_status(task_id, "failed", error=str(e))
            
    background_tasks.add_task(async_wrapper)
    return task_id


async def delegate_to_worker_if_needed(request: Request):
    if settings.worker_api_url and not settings.is_heavy_worker:
        url = f"{settings.worker_api_url.rstrip('/')}{request.url.path}"
        if request.url.query:
            url = f"{url}?{request.url.query}"
            
        headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
        method = request.method
        content = await request.body()
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    content=content
                )
                if resp.status_code >= 400:
                    raise HTTPException(status_code=resp.status_code, detail=resp.text)
                return resp.json()
        except httpx.RequestError as exc:
            logging.error(f"Error forwarding request to worker: {exc}")
            raise HTTPException(status_code=502, detail=f"Worker API is currently unavailable: {exc}")
    return None
