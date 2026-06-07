from fastapi import APIRouter, Depends
from app.core.celery_app import celery_app
from app.core.dependencies.auth import get_current_user

router = APIRouter(tags=["Tasks"])

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
