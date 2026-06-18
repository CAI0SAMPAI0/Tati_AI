import logging
from typing import Optional, List
from app.modules.cefr.services.generator import CEFRGeneratorService
import re
import unicodedata
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, BackgroundTasks, Request
from app.core.task_manager import run_task_in_background, delegate_to_worker_if_needed
from pydantic import BaseModel
from typing import Any

from app.core.database import get_client
from app.modules.cefr.services.cefr_service import CEFRService
from app.core.dependencies.auth import require_staff, Depends

router = APIRouter(prefix="/cefr/admin", tags=["CEFR Admin"])


def sanitize_filename(filename: str) -> str:
    """
    Removes accents, spaces, and special characters from the filename
    to prevent errors in Supabase Storage.
    """
    # Remove accents
    nfkd_form = unicodedata.normalize('NFKD', filename)
    filename_no_accents = u"".join(
        [c for c in nfkd_form if not unicodedata.combining(c)])

    # Replace spaces with underscores and remove non-alphanumeric characters (except dot and dash)
    filename_clean = re.sub(
        r'[^a-zA-Z0-9.\-_]',
        '_',
        filename_no_accents)

    # Remove duplicate underscores
    filename_clean = re.sub(r'_+', '_', filename_clean)

    return filename_clean.lower()


@router.post("/upload-material")
async def upload_cefr_material(
    files: List[UploadFile] = File(...),
    level: Optional[str] = None,
    user=Depends(require_staff)
):
    """
    Uploads multiple pedagogical materials (PDF, DOCX, TXT),
    auto-detects or uses the provided level, extracts text, indexes chunks,
    and saves details to the cefr_references table.
    """
    from app.core.config import settings
    client = get_client()
    bucket_name = "cefr-materials"
    results = []

    for file in files:
        ext = file.filename.split('.')[-1].lower()
        if ext not in ['pdf', 'docx', 'txt']:
            results.append({
                "filename": file.filename,
                "success": False,
                "detail": f"Format .{ext} is not supported. Only PDF, DOCX and TXT are allowed."
            })
            continue

        try:
            detected_level = None
            filename = file.filename
            match = re.search(r'(?i)\b(a1|a2|b1|b2|c1|c2)\b', filename)
            if match:
                detected_level = match.group(1).upper()
            else:
                match = re.search(r'(?i)(?:^|[_.\-\s])(a1|a2|b1|b2|c1|c2)(?:$|[_.\-\s])', filename)
                if match:
                    detected_level = match.group(1).upper()

            storage_level = detected_level or level or 'A1'
            safe_filename = sanitize_filename(file.filename)
            file_path = f"{storage_level.lower()}/{safe_filename}"

            file_content = await file.read()
            file_size = len(file_content)

            content_type = "application/octet-stream"
            if ext == 'pdf':
                content_type = "application/pdf"
            elif ext == 'docx':
                content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            elif ext == 'txt':
                content_type = "text/plain"

            client.storage.from_(bucket_name).upload(
                file_path,
                file_content,
                {"content-type": content_type, "upsert": "true"}
            )

            chunks_indexed, final_level = await CEFRService.process_and_index_file(
                bucket_name=bucket_name,
                file_path=file_path,
                file_type=ext,
                level=detected_level or level,
                metadata={"original_name": file.filename}
            )

            storage_url = f"{settings.supabase_url}/storage/v1/object/public/{bucket_name}/{file_path}"

            ref_data = {
                "filename": file.filename,
                "storage_url": storage_url,
                "cefr_level": final_level,
                "file_type": ext,
                "file_size": file_size,
                "chunks_indexed": chunks_indexed
            }
            client.table("cefr_references").insert(ref_data).execute()

            results.append({
                "filename": file.filename,
                "success": True,
                "chunks_indexed": chunks_indexed,
                "cefr_level": final_level,
                "path": file_path
            })

        except Exception as e:
            logging.error(f"[AdminRoute] Error uploading/processing {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "detail": str(e)
            })

    return {"success": True, "results": results}


@router.get("/references")
async def list_references(user=Depends(require_staff)):
    """
    Lists all reference materials in the cefr_references table.
    """
    client = get_client()
    try:
        res = client.table("cefr_references").select("*").order("created_at", desc=True).execute()
        return {"success": True, "references": res.data or []}
    except Exception as e:
        logging.error(f"[AdminRoute] Error listing references: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/references/{reference_id}")
async def delete_reference(reference_id: str, user=Depends(require_staff)):
    """
    Deletes a material reference (cefr_references, cefr_documents and storage).
    """
    client = get_client()
    bucket_name = "cefr-materials"
    try:
        res = client.table("cefr_references").select("*").eq("id", reference_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Reference not found.")

        ref = res.data[0]
        storage_url = ref["storage_url"]

        prefix = f"public/{bucket_name}/"
        if prefix in storage_url:
            file_path = storage_url.split(prefix)[-1]
        else:
            file_path = storage_url

        try:
            client.storage.from_(bucket_name).remove([file_path])
        except Exception as st_err:
            logging.warning(f"[AdminRoute] Error removing from storage: {st_err}")

        try:
            client.table("cefr_documents").delete().eq("source_file", file_path).execute()
        except Exception as doc_err:
            logging.warning(f"[AdminRoute] Error removing indexed chunks: {doc_err}")

        client.table("cefr_references").delete().eq("id", reference_id).execute()

        return {"success": True, "message": f"Reference {ref['filename']} deleted successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        logging.error(f"[AdminRoute] Error deleting reference: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-flashcards")
async def generate_flashcards(
    level: str, 
    topic: str, 
    background_tasks: BackgroundTasks,
    request: Request,
    count: int = 5,
    title: Optional[str] = None,
    reference_ids: Optional[List[str]] = Query(None),
    user=Depends(require_staff)
):
    """
    Generates flashcards from indexed material using RAG in the background.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    try:
        from app.modules.cefr.tasks import generate_cefr_flashcards_task
        task_id = run_task_in_background(
            background_tasks,
            generate_cefr_flashcards_task,
            level, topic, count, username=user['username'], custom_title=title, reference_ids=reference_ids
        )
        return {
            "success": True,
            "task_id": task_id}
    except Exception as e:
        logging.info(f"[AdminRoute] Error triggering flashcard generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-exercises")
async def generate_exercises(
    level: str, 
    topic: str, 
    background_tasks: BackgroundTasks,
    request: Request,
    count: int = 3,
    title: Optional[str] = None,
    reference_ids: Optional[List[str]] = Query(None),
    user=Depends(require_staff)
):
    """
    Generates exercises from indexed material using RAG in the background.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    try:
        from app.modules.cefr.tasks import generate_cefr_exercises_task
        task_id = run_task_in_background(
            background_tasks,
            generate_cefr_exercises_task,
            level, topic, count, username=user['username'], custom_title=title, reference_ids=reference_ids
        )
        return {
            "success": True,
            "task_id": task_id}
    except Exception as e:
        logging.info(f"[AdminRoute] Error triggering exercises generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-simulations")
async def generate_simulations(
    level: str, 
    topic: str, 
    background_tasks: BackgroundTasks,
    request: Request,
    count: int = 2,
    title: Optional[str] = None,
    reference_ids: Optional[List[str]] = Query(None),
    user=Depends(require_staff)
):
    """
    Generates simulations from indexed material using RAG in the background.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    try:
        from app.modules.cefr.tasks import generate_cefr_simulations_task
        task_id = run_task_in_background(
            background_tasks,
            generate_cefr_simulations_task,
            level, topic, count, username=user['username'], custom_title=title, reference_ids=reference_ids
        )
        return {
            "success": True,
            "task_id": task_id}
    except Exception as e:
        logging.info(f"[AdminRoute] Error triggering simulations generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trigger-scheduler")
async def trigger_scheduler():
    """
    Manually triggers the weekly scheduler generation for testing.
    """
    from app.modules.cefr.services.cefr_scheduler import CEFRScheduler
    from app.modules.notifications.services.notification_scheduler import notification_scheduler

    scheduler_instance = CEFRScheduler(notification_scheduler.scheduler)
    try:
        import asyncio
        asyncio.create_task(
            scheduler_instance.job_generate_weekly_content())
        return {
            "success": True,
            "message": "Scheduler generation started in background."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


class CEFRSimulationUpdate(BaseModel):
    level: Optional[str] = None
    topic: Optional[str] = None
    scenario: Optional[str] = None
    roles: Optional[Any] = None
    goal: Optional[str] = None
    is_published: Optional[bool] = None


@router.get("/all")
async def get_all_content():
    """
    Returns all generated content (flashcards, exercises, simulations).
    """
    client = get_client()
    try:
        fc_res = client.table("cefr_flashcards").select("*").execute()
        flashcards = fc_res.data or []

        ex_res = client.table("cefr_exercises").select("*").execute()
        exercises = ex_res.data or []

        sim_res = client.table("cefr_simulations").select("*").execute()
        simulations = sim_res.data or []

        return {
            "success": True,
            "flashcards": flashcards,
            "exercises": exercises,
            "simulations": simulations
        }
    except Exception as e:
        logging.info(f"[AdminRoute] Error fetching content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/exercises/{exercise_id}")
async def update_cefr_exercise(
        exercise_id: str,
        body: CEFRExerciseUpdate):
    """
    Edits or publishes a CEFR exercise.
    """
    client = get_client()
    update_data = {
        k: v for k,
        v in body.model_dump().items() if v is not None}

    try:
        res = client.table("cefr_exercises").update(
            update_data).eq("id", exercise_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=404, detail="Exercise not found")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logging.info(f"[AdminRoute] Error updating exercise: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/exercises/{exercise_id}")
async def delete_cefr_exercise(exercise_id: str):
    """
    Deletes a CEFR exercise.
    """
    client = get_client()
    try:
        client.table("cefr_exercises").delete().eq(
            "id", exercise_id).execute()
        return {
            "success": True,
            "message": "Exercise deleted successfully."}
    except Exception as e:
        logging.info(f"[AdminRoute] Error deleting exercise: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/flashcards/{flashcard_id}")
async def update_cefr_flashcard(
        flashcard_id: str,
        body: CEFRFlashcardUpdate):
    """
    Edits or publishes a CEFR flashcard.
    """
    client = get_client()
    update_data = {
        k: v for k,
        v in body.model_dump().items() if v is not None}

    try:
        res = client.table("cefr_flashcards").update(
            update_data).eq("id", flashcard_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=404, detail="Flashcard not found")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logging.info(f"[AdminRoute] Error updating flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/flashcards/{flashcard_id}")
async def delete_cefr_flashcard(flashcard_id: str):
    """
    Deletes a CEFR flashcard.
    """
    client = get_client()
    try:
        client.table("cefr_flashcards").delete().eq(
            "id", flashcard_id).execute()
        return {
            "success": True,
            "message": "Flashcard deleted successfully."}
    except Exception as e:
        logging.info(f"[AdminRoute] Error deleting flashcard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/simulations/{simulation_id}")
async def update_cefr_simulation(
        simulation_id: str,
        body: CEFRSimulationUpdate):
    """
    Edits or publishes a CEFR simulation.
    """
    client = get_client()
    update_data = {
        k: v for k,
        v in body.model_dump().items() if v is not None}

    try:
        res = client.table("cefr_simulations").update(
            update_data).eq("id", simulation_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=404, detail="Simulation not found")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logging.info(f"[AdminRoute] Error updating simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/simulations/{simulation_id}")
async def delete_cefr_simulation(simulation_id: str):
    """
    Deletes a CEFR simulation.
    """
    client = get_client()
    try:
        client.table("cefr_simulations").delete().eq(
            "id", simulation_id).execute()
        return {
            "success": True,
            "message": "Simulation deleted successfully."}
    except Exception as e:
        logging.info(f"[AdminRoute] Error deleting simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CEFRScheduleCreate(BaseModel):
    active: bool = True
    weekdays: List[str]  # e.g., ["mon","wed","fri"]
    execution_time: str  # e.g., "03:00"
    weekly_frequency: Optional[int] = 1
    materials_per_execution: Optional[int] = 5


class CEFRScheduleUpdate(BaseModel):
    active: Optional[bool] = None
    weekdays: Optional[List[str]] = None
    execution_time: Optional[str] = None
    weekly_frequency: Optional[int] = None
    materials_per_execution: Optional[int] = None


@router.get("/schedules")
async def list_schedules(user=Depends(require_staff)):
    """
    Lists all CEFR scheduling configurations.
    """
    client = get_client()
    try:
        res = client.table("cefr_schedules").select("*").execute()
        return {"success": True, "schedules": res.data or []}
    except Exception as e:
        logging.error(f"[AdminRoute] Error listing schedules: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/schedules")
async def create_schedule(body: CEFRScheduleCreate, user=Depends(require_staff)):
    """
    Creates a new CEFR scheduling configuration.
    """
    client = get_client()
    try:
        data = body.model_dump()
        res = client.table("cefr_schedules").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=400, detail="Error creating schedule.")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logging.error(f"[AdminRoute] Error creating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, body: CEFRScheduleUpdate, user=Depends(require_staff)):
    """
    Updates a CEFR scheduling configuration.
    """
    client = get_client()
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    try:
        res = client.table("cefr_schedules").update(update_data).eq("id", schedule_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Schedule not found.")
        return {"success": True, "data": res.data[0]}
    except Exception as e:
        logging.error(f"[AdminRoute] Error updating schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user=Depends(require_staff)):
    """
    Deletes a scheduling configuration.
    """
    client = get_client()
    try:
        res = client.table("cefr_schedules").delete().eq("id", schedule_id).execute()
        return {"success": True, "message": "Schedule deleted successfully."}
    except Exception as e:
        logging.error(f"[AdminRoute] Error deleting schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CEFRFlashcardGroupSave(BaseModel):
    old_level: str
    old_topic: str
    new_level: str
    new_topic: str
    flashcards: List[dict]


class CEFRExerciseGroupSave(BaseModel):
    old_level: str
    old_topic: str
    new_level: str
    new_topic: str
    exercises: List[dict]


@router.put("/flashcards/group")
async def toggle_publish_flashcard_group(
    level: str,
    topic: str,
    is_published: bool,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        res = client.table("cefr_flashcards").update({"is_published": is_published}).eq("level", level).eq("topic", topic).execute()
        return {"success": True, "updated": len(res.data or [])}
    except Exception as e:
        logging.error(f"[AdminRoute] Error toggling flashcard group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/flashcards/group")
async def delete_flashcard_group(
    level: str,
    topic: str,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        client.table("cefr_flashcards").delete().eq("level", level).eq("topic", topic).execute()
        return {"success": True, "message": f"Deleted flashcards group '{topic}' for level '{level}'"}
    except Exception as e:
        logging.error(f"[AdminRoute] Error deleting flashcard group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/flashcards/group/save")
async def save_flashcard_group(
    body: CEFRFlashcardGroupSave,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        # Delete old
        client.table("cefr_flashcards").delete().eq("level", body.old_level).eq("topic", body.old_topic).execute()
        
        # Insert new
        inserted = []
        for card in body.flashcards:
            data = {
                "level": body.new_level,
                "topic": body.new_topic,
                "front": card.get("front"),
                "back": card.get("back"),
                "explanation": card.get("explanation"),
                "image_url": card.get("image_url"),
                "is_published": card.get("is_published", False)
            }
            res = client.table("cefr_flashcards").insert(data).execute()
            if res.data:
                inserted.extend(res.data)
        return {"success": True, "inserted": len(inserted)}
    except Exception as e:
        logging.error(f"[AdminRoute] Error saving flashcard group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/exercises/group")
async def toggle_publish_exercise_group(
    level: str,
    topic: str,
    is_published: bool,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        res = client.table("cefr_exercises").update({"is_published": is_published}).eq("level", level).eq("topic", topic).execute()
        return {"success": True, "updated": len(res.data or [])}
    except Exception as e:
        logging.error(f"[AdminRoute] Error toggling exercise group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/exercises/group")
async def delete_exercise_group(
    level: str,
    topic: str,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        client.table("cefr_exercises").delete().eq("level", level).eq("topic", topic).execute()
        return {"success": True, "message": f"Deleted exercise group '{topic}' for level '{level}'"}
    except Exception as e:
        logging.error(f"[AdminRoute] Error deleting exercise group: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exercises/group/save")
async def save_exercise_group(
    body: CEFRExerciseGroupSave,
    user=Depends(require_staff)
):
    client = get_client()
    try:
        # Delete old
        client.table("cefr_exercises").delete().eq("level", body.old_level).eq("topic", body.old_topic).execute()
        
        # Insert new
        inserted = []
        for ex in body.exercises:
            data = {
                "level": body.new_level,
                "topic": body.new_topic,
                "type": "multiple_choice",
                "question": ex.get("question"),
                "options": ex.get("options"),
                "correct_index": ex.get("correct_index"),
                "explanation": ex.get("explanation"),
                "is_published": ex.get("is_published", False)
            }
            res = client.table("cefr_exercises").insert(data).execute()
            if res.data:
                inserted.extend(res.data)
        return {"success": True, "inserted": len(inserted)}
    except Exception as e:
        logging.error(f"[AdminRoute] Error saving exercise group: {e}")
        raise HTTPException(status_code=500, detail=str(e))
