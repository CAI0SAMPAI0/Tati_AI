"""
routers/activities/submissions.py
Aluno: envia exercícios abertos.
Admin: lista, corrige manualmente ou via IA.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json

from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.llm import groq_chat

router = APIRouter()

class SubmissionIn(BaseModel):
    module_id: str
    activity_type: str = "exercise"
    student_answer: str

class CorrectionIn(BaseModel):
    teacher_feedback: Optional[str] = None
    score: Optional[int] = None

@router.post("/submit")
async def submit_activity(payload: SubmissionIn, user=Depends(get_current_user)):
    """Aluno envia uma atividade para correção."""
    db = get_client()
    res = db.table("activity_submissions").insert({
        "username": user["username"],
        "module_id": payload.module_id,
        "activity_type": payload.activity_type,
        "student_answer": payload.student_answer,
        "status": "pending"
    }).execute()
    
    if not res.data:
        raise HTTPException(500, "Erro ao salvar submissão")
        
    # Envia notificação
    from services.email import send_submission_notification
    send_submission_notification(user.get("name", user["username"]), "Nova Submissão de Atividade")

    # Registra para ranking
    try:
        db.table("study_sessions").insert({
            "username": user["username"],
            "activity_type": payload.activity_type or "exercise",
            "duration_minutes": 3
        }).execute()
    except Exception:
        pass
    
    return {"ok": True, "submission_id": res.data[0]["id"]}

@router.get("/my")
async def get_my_submissions(user=Depends(get_current_user)):
    """Aluno vê suas submissões e feedbacks."""
    db = get_client()
    res = db.table("activity_submissions").select("*, modules(title)").eq("username", user["username"]).order("created_at", desc=True).execute()
    return res.data or []

@router.get("/admin/submissions")
async def admin_list_submissions(status: Optional[str] = None, user=Depends(require_staff)):
    """Admin lista submissões de alunos."""
    db = get_client()
    query = db.table("activity_submissions").select("*, users(name), modules(title)").order("created_at", desc=True)
    if status:
        query = query.eq("status", status)
    res = query.execute()
    return res.data or []

@router.post("/admin/submissions/{sub_id}/correct")
async def admin_correct_manual(sub_id: str, payload: CorrectionIn, user=Depends(require_staff)):
    """Admin corrige manualmente uma submissão."""
    db = get_client()

    # Busca dados da submissão para notificação
    sub = db.table("activity_submissions").select("*, modules(title)").eq("id", sub_id).single().execute()
    if not sub.data:
        raise HTTPException(404, "Submissão não encontrada")

    student_username = sub.data["username"]
    module_title = sub.data["modules"]["title"]
    score = payload.score

    # Atualiza submissão
    res = db.table("activity_submissions").update({
        "teacher_feedback": payload.teacher_feedback,
        "score": score,
        "status": "corrected"
    }).eq("id", sub_id).execute()

    # Envia notificação para o aluno
    from services.email import send_correction_notification
    from routers.users.profile import get_user_by_username
    student = get_user_by_username(student_username)
    if student and student.get("email"):
        send_correction_notification(
            student_name=student.get("name", student_username),
            student_email=student["email"],
            activity_title=module_title,
            score=score,
            feedback=payload.teacher_feedback or ""
        )

    return {"ok": True}

@router.post("/admin/submissions/{sub_id}/ai-correct")
async def admin_correct_ai(sub_id: str, lang: str = "pt-BR", user=Depends(require_staff)):
    """Dispara a correção automática via IA (Teacher Tati)."""
    db = get_client()

    sub = db.table("activity_submissions").select("*, modules(title)").eq("id", sub_id).single().execute()
    if not sub.data:
        raise HTTPException(404, "Submissão não encontrada")

    answer = sub.data["student_answer"]
    mod_title = sub.data["modules"]["title"]
    student_username = sub.data["username"]

    lang_name = "English" if "en" in lang.lower() else "Portuguese"

    prompt = f"""You are Teacher Tati, a friendly and professional English teacher.
Analyze the student's answer for the lesson: "{mod_title}".

Student's Answer:
"{answer}"

Instructions:
1. Provide a short pedagogical feedback in {lang_name}.
2. Assign a score from 0 to 100.

Respond ONLY in JSON format:
{{
  "ai_feedback": "your feedback here...",
  "score": 85
}}"""

    try:
        content = await groq_chat([{"role": "user", "content": prompt}])
        content = content.replace("```json", "").replace("```", "").strip()
        result = json.loads(content)

        db.table("activity_submissions").update({
            "ai_feedback": result["ai_feedback"],
            "score": result["score"],
            "status": "corrected"
        }).eq("id", sub_id).execute()

        # Envia notificação para o aluno
        from services.email import send_correction_notification
        from routers.users.profile import get_user_by_username
        student = get_user_by_username(student_username)
        if student and student.get("email"):
            send_correction_notification(
                student_name=student.get("name", student_username),
                student_email=student["email"],
                activity_title=mod_title,
                score=result["score"],
                feedback=result["ai_feedback"]
            )

        return result
    except Exception as e:
        raise HTTPException(500, f"Erro na IA: {str(e)}")
