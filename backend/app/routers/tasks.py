import os
from fastapi import APIRouter, Depends, HTTPException, Header, Query, BackgroundTasks, Request
from app.core.celery_app import celery_app
from app.core.dependencies.auth import get_current_user
from app.core.task_manager import run_task_in_background, get_local_task_status, local_tasks_status, delegate_to_worker_if_needed

router = APIRouter(tags=["Tasks"])


async def verify_cron_token(
    x_cron_token: str = Header(None, alias="X-Cron-Token"),
    token: str = Query(None)
):
    cron_token = os.getenv("CRON_TOKEN")
    if not cron_token:
        return True
    if x_cron_token != cron_token and token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid CRON_TOKEN.")
    return True


@router.get("/status/{task_id}")
async def get_task_status(task_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """
    Rota para o front-end monitorar o progresso de PDFs ou Relatorios pesados.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    if task_id.startswith("local_") or task_id in local_tasks_status:
        return get_local_task_status(task_id)

    task_result = celery_app.AsyncResult(task_id)
    
    if task_result.state == "PENDING":
        return {"status": "processing", "result": None}
        
    elif task_result.state == "SUCCESS":
        # Retorna o valor de retorno da sua funcao do celery (ex: a URL do PDF no Supabase Storage)
        return {"status": "success", "result": task_result.result}
        
    elif task_result.state == "FAILURE":
        return {"status": "failed", "error": str(task_result.info)}
        
    return {"status": task_result.state.lower(), "result": None}


@router.api_route("/trigger/{task_name}", methods=["GET", "POST"])
async def trigger_task(
    task_name: str,
    request: Request,
    background_tasks: BackgroundTasks,
    verified: bool = Depends(verify_cron_token)
):
    """
    Triggers a background Celery task securely. Used to support sleep mode on Railway by delegating cron schedules.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    if task_name == "streak_reminders":
        from app.modules.notifications.tasks import streak_reminders
        task_id = run_task_in_background(background_tasks, streak_reminders)
    elif task_name == "broken_streaks":
        from app.modules.notifications.tasks import broken_streaks
        task_id = run_task_in_background(background_tasks, broken_streaks)
    elif task_name == "check_inactivity":
        from app.modules.notifications.tasks import check_inactivity
        task_id = run_task_in_background(background_tasks, check_inactivity)
    elif task_name == "weekly_reports":
        from app.modules.notifications.tasks import weekly_reports
        task_id = run_task_in_background(background_tasks, weekly_reports)
    elif task_name == "cefr_weekly_gen":
        from app.modules.cefr.tasks import cefr_weekly_gen
        task_id = run_task_in_background(background_tasks, cefr_weekly_gen)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown cron task: {task_name}")
        
    return {
        "success": True, 
        "message": f"Task '{task_name}' triggered in background.", 
        "task_id": task_id
    }

