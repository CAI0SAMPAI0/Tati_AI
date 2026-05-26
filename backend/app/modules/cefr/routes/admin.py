import os
import re
import unicodedata
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any

from app.core.database import get_client
from app.modules.cefr.services.cefr_service import CEFRService
# from app.modules.auth.dependencies import get_current_admin_user # Se houver autenticação de admin

router = APIRouter(prefix="/cefr/admin", tags=["CEFR Admin"])

def sanitize_filename(filename: str) -> str:
    """
    Remove acentos, espaços e caracteres especiais do nome do arquivo
    para evitar erros no Supabase Storage.
    """
    # Remove acentos
    nfkd_form = unicodedata.normalize('NFKD', filename)
    filename_no_accents = u"".join([c for c in nfkd_form if not unicodedata.combining(c)])
    
    # Substitui espaços por underscores e remove caracteres não alfanuméricos (exceto ponto e traço)
    filename_clean = re.sub(r'[^a-zA-Z0-9.\-_]', '_', filename_no_accents)
    
    # Remove underscores duplicados
    filename_clean = re.sub(r'_+', '_', filename_clean)
    
    return filename_clean.lower()

@router.post("/upload-material")
async def upload_cefr_material(
    file: UploadFile = File(...),
    level: str = "A1"
    # current_user = Depends(get_current_admin_user) # Descomente quando integrar auth
):
    """
    Faz upload de um PDF de material didático, extrai o texto,
    gera embeddings e salva no pgvector.
    """
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")

    client = get_client()
    bucket_name = "cefr-materials"
    
    # Sanitiza o nome do arquivo para o Supabase aceitar
    safe_filename = sanitize_filename(file.filename)
    file_path = f"{level.lower()}/{safe_filename}"
    
    try:
        # Lê o conteúdo do arquivo
        file_content = await file.read()
        
        # Faz o upload para o Supabase Storage
        # upsert=True sobrescreve se já existir
        res = client.storage.from_(bucket_name).upload(
            file_path, 
            file_content, 
            {"content-type": "application/pdf", "upsert": "true"}
        )
        
        # Chama o serviço orquestrador para processar o PDF recém-enviado
        chunks_indexed = CEFRService.process_and_index_pdf(
            bucket_name=bucket_name,
            file_path=file_path,
            level=level,
            metadata={"original_name": file.filename}
        )
        
        return {
            "success": True,
            "message": f"Arquivo {safe_filename} processado com sucesso.",
            "chunks_indexed": chunks_indexed,
            "path": file_path
        }
        
    except Exception as e:
        print(f"[AdminRoute] Erro no upload/processamento: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from app.modules.cefr.services.generator import CEFRGeneratorService

@router.post("/generate-flashcards")
async def generate_flashcards(level: str, topic: str, count: int = 5):
    """
    Gera flashcards a partir do material indexado usando RAG.
    """
    try:
        flashcards = await CEFRGeneratorService.generate_flashcards(level=level, topic=topic, count=count)
        
        if not flashcards:
            raise HTTPException(status_code=500, detail="Não foi possível gerar os flashcards.")
            
        client = get_client()
        saved_cards = []
        for card in flashcards:
            data = {
                "level": level,
                "front": card.get("front"),
                "back": card.get("back"),
                "explanation": card.get("explanation"),
                "topic": topic
            }
            res = client.table("cefr_flashcards").insert(data).execute()
            if res.data:
                saved_cards.extend(res.data)
                
        return {"success": True, "generated": len(saved_cards), "data": saved_cards}
        
    except Exception as e:
        print(f"[AdminRoute] Erro ao gerar flashcards: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-exercises")
async def generate_exercises(level: str, topic: str, count: int = 3):
    """
    Gera exercícios a partir do material indexado usando RAG.
    """
    try:
        exercises = await CEFRGeneratorService.generate_exercises(level=level, topic=topic, count=count)
        
        if not exercises:
            raise HTTPException(status_code=500, detail="Não foi possível gerar os exercícios.")
            
        client = get_client()
        saved_exercises = []
        for ex in exercises:
            data = {
                "level": level,
                "type": "multiple_choice",
                "question": ex.get("question"),
                "options": ex.get("options"),
                "correct_index": ex.get("correct_index"),
                "explanation": ex.get("explanation"),
                "topic": topic
            }
            res = client.table("cefr_exercises").insert(data).execute()
            if res.data:
                saved_exercises.extend(res.data)
                 
        return {"success": True, "generated": len(saved_exercises), "data": saved_exercises}
         
    except Exception as e:
        print(f"[AdminRoute] Erro ao gerar exercícios: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trigger-scheduler")
async def trigger_scheduler():
    """
    Gatilha manualmente a geração semanal do scheduler para testes.
    """
    from app.modules.cefr.services.cefr_scheduler import CEFRScheduler
    from app.modules.notifications.services.notification_scheduler import notification_scheduler
    
    scheduler_instance = CEFRScheduler(notification_scheduler.scheduler)
    try:
        import asyncio
        asyncio.create_task(scheduler_instance.job_generate_weekly_content())
        return {"success": True, "message": "Geração do scheduler iniciada em background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
from typing import Optional, List

class CEFRExerciseUpdate(BaseModel):
    level: Optional[str] = None
    question: Optional[str] = None
    options: Optional[List[str]] = None
    correct_index: Optional[int] = None
    explanation: Optional[str] = None
    topic: Optional[str] = None
    is_published: Optional[bool] = None

class CEFRFlashcardUpdate(BaseModel):
    level: Optional[str] = None
    front: Optional[str] = None
    back: Optional[str] = None
    explanation: Optional[str] = None
    topic: Optional[str] = None
    is_published: Optional[bool] = None

@router.get("/pending")
async def get_pending_content():
    """
    Retorna todo o conteúdo pendente de revisão (is_published = False).
    """
    client = get_client()
    try:
        # Busca flashcards pendentes
        fc_res = client.table("cefr_flashcards").select("*").eq("is_published", False).execute()
        flashcards = fc_res.data or []
        
        # Busca exercícios pendentes
        ex_res = client.table("cefr_exercises").select("*").eq("is_published", False).execute()
        exercises = ex_res.data or []
        
        return {
            "success": True,
            "flashcards": flashcards,
            "exercises": exercises
        }
    except Exception as e:
        print(f"[AdminRoute] Erro ao buscar pendentes: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/exercises/{exercise_id}")
async def update_cefr_exercise(exercise_id: str, body: CEFRExerciseUpdate):
    """
    Edita ou publica um exercício CEFR.
    """
    client = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    
    try:
        res = client.table("cefr_exercises").update(update_data).eq("id", exercise_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Exercício não encontrado")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        print(f"[AdminRoute] Erro ao atualizar exercício: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/exercises/{exercise_id}")
async def delete_cefr_exercise(exercise_id: str):
    """
    Exclui um exercício CEFR (rejeitado).
    """
    client = get_client()
    try:
        res = client.table("cefr_exercises").delete().eq("id", exercise_id).execute()
        return {"success": True, "message": "Exercício excluído com sucesso."}
    except Exception as e:
        print(f"[AdminRoute] Erro ao excluir exercício: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/flashcards/{flashcard_id}")
async def update_cefr_flashcard(flashcard_id: str, body: CEFRFlashcardUpdate):
    """
    Edita ou publica um flashcard CEFR.
    """
    client = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    
    try:
        res = client.table("cefr_flashcards").update(update_data).eq("id", flashcard_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Flashcard não encontrado")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        print(f"[AdminRoute] Erro ao atualizar flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/flashcards/{flashcard_id}")
async def delete_cefr_flashcard(flashcard_id: str):
    """
    Exclui um flashcard CEFR (rejeitado).
    """
    client = get_client()
    try:
        res = client.table("cefr_flashcards").delete().eq("id", flashcard_id).execute()
        return {"success": True, "message": "Flashcard excluído com sucesso."}
    except Exception as e:
        print(f"[AdminRoute] Erro ao excluir flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))

