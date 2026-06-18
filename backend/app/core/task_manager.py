import uuid
import logging
from typing import Callable, Any, Dict
from fastapi import BackgroundTasks
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
    """
    Dispatches a task. If Celery is enabled, it uses celery_app.
    Otherwise, it runs using FastAPI's BackgroundTasks.
    Returns the task_id.
    """
    use_celery = settings.use_celery
    
    if use_celery:
        task = task_func.delay(*args, **kwargs)
        return task.id
    else:
        task_id = f"local_{uuid.uuid4()}"
        local_tasks_status[task_id] = {"status": "processing", "result": None}
        
        def wrapper():
            try:
                logging.info(f"[TaskManager] Running local background task {task_id}")
                result = task_func(*args, **kwargs)
                set_local_task_status(task_id, "success", result=result)
                logging.info(f"[TaskManager] Local background task {task_id} succeeded")
            except Exception as e:
                logging.error(f"[TaskManager] Local background task {task_id} failed: {e}", exc_info=True)
                set_local_task_status(task_id, "failed", error=str(e))
                
        background_tasks.add_task(wrapper)
        return task_id
