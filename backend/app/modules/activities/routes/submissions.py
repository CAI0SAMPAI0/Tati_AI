"""
routers/activities/submissions.py
Router para submissões de atividades e correções.
"""

from __future__ import annotations

from typing import Any

from app.core.dependencies.auth import get_current_user, require_staff
from app.modules.activities.services.activity_service import ActivityService
from fastapi import APIRouter, Depends
from pydantic import BaseModel

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────


class SubmissionBody(BaseModel):
    """Dados de uma submissão de atividade."""

    activity_id: str
    activity_type: str
    score: int
    metadata: dict[str, Any] | None = None


class CorrectionBody(BaseModel):
    """Dados de correção manual pelo professor."""

    teacher_feedback: str
    score: int


# ── Aluno ─────────────────────────────────────────────────────────────


@router.post("/")
async def record_submission(
    body: SubmissionBody,
    user=Depends(get_current_user),
    service: ActivityService = Depends(),
) -> dict:
    """Registra uma submissão de atividade."""
    result = await service.record_submission(
        user["username"],
        body.activity_id,
        body.activity_type,
        body.score,
        body.metadata,
    )
    return result if result else {"success": True}


@router.get("/my")
async def list_my_submissions(
    user=Depends(get_current_user), service: ActivityService = Depends()
) -> list:
    """Lista submissões do usuário logado."""
    return await service.get_user_submissions(user["username"])


# ── Admin ─────────────────────────────────────────────────────────────


@router.get("/admin/submissions")
async def list_all_submissions(
    _user=Depends(require_staff), service: ActivityService = Depends()
) -> list:
    """Lista todas as submissões (apenas staff)."""
    return await service.get_all_submissions()


@router.post("/admin/submissions/{submission_id}/correct")
async def correct_submission(
    submission_id: str,
    body: CorrectionBody,
    _user=Depends(require_staff),
    service: ActivityService = Depends(),
) -> dict:
    """Salva correção manual do professor em uma submissão."""
    return await service.save_correction(
        submission_id, body.teacher_feedback, body.score
    )


@router.post("/admin/submissions/{submission_id}/ai-correct")
async def ai_correct_submission(
    submission_id: str,
    lang: str = "pt-BR",
    _user=Depends(require_staff),
    service: ActivityService = Depends(),
) -> dict:
    """Gera correção automática via IA para uma submissão."""
    return await service.ai_correct_submission(submission_id, lang)
