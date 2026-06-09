import os
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from app.core.celery_app import celery_app
from app.core.dependencies.auth import get_current_user

router = APIRouter(tags=["Tasks"])


async def verify_cron_token(
    x_cron_token: str = Header(None, alias="X-Cron-Token"),
    token: str = Query(None)
):
    cron_token = os.getenv("CRON_TOKEN")
    if not cron_token:
        # Em desenvolvimento, se não estiver configurado, podemos dar bypass para testar fácil
        # Mas em produção deve ser obrigatório.
        return True
    if x_cron_token != cron_token and token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid CRON_TOKEN.")
    return True


@router.get("/status/{task_id}")
async def get_task_status(task_id: str, current_user: dict = Depends(get_current_user)):
    """
    Rota para o front-end monitorar o progresso de PDFs ou Relatorios pesados.
    """
    task_result = celery_app.AsyncResult(task_id)
    
    if task_result.state == "PENDING":
        return {"status": "processing", "result": None}
        
    elif task_result.state == "SUCCESS":
        # Retorna o valor de retorno da sua funcao do celery (ex: a URL do PDF no Supabase Storage)
        return {"status": "success", "result": task_result.result}
        
    elif task_result.state == "FAILURE":
        return {"status": "failed", "error": str(task_result.info)}
        
    return {"status": task_result.state.lower(), "result": None}


@router.post("/trigger/{task_name}")
async def trigger_task(
    task_name: str,
    verified: bool = Depends(verify_cron_token)
):
    """
    Triggers a background Celery task securely. Used to support sleep mode on Railway by delegating cron schedules.
    """
    if task_name == "streak_reminders":
        from app.modules.notifications.tasks import streak_reminders
        task = streak_reminders.delay()
    elif task_name == "broken_streaks":
        from app.modules.notifications.tasks import broken_streaks
        task = broken_streaks.delay()
    elif task_name == "check_inactivity":
        from app.modules.notifications.tasks import check_inactivity
        task = check_inactivity.delay()
    elif task_name == "weekly_reports":
        from app.modules.notifications.tasks import weekly_reports
        task = weekly_reports.delay()
    elif task_name == "cefr_weekly_gen":
        from app.modules.cefr.tasks import cefr_weekly_gen
        task = cefr_weekly_gen.delay()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown cron task: {task_name}")
        
    return {
        "success": True, 
        "message": f"Task '{task_name}' triggered in background.", 
        "task_id": task.id
    }

