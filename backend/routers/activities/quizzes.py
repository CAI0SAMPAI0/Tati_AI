"""
Router de Quizzes e Desafios.
Refatorado para usar QuizService e padrão async.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from routers.deps import get_current_user
from services.quiz_service import QuizService

router = APIRouter()


class QuizAnswer(BaseModel):
    question_id: str
    selected_index: int


class QuizSubmission(BaseModel):
    answers: List[QuizAnswer]


@router.get('/{quiz_id}')
async def get_quiz(quiz_id: str, service: QuizService = Depends()):
    """Busca um quiz pelo ID."""
    quiz = await service.get_quiz(quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail='Quiz não encontrado')
    return quiz


@router.post('/{quiz_id}/submit')
async def submit_quiz(
    quiz_id: str,
    body: QuizSubmission,
    user=Depends(get_current_user),
    service: QuizService = Depends(),
):
    """Envia as respostas de um quiz."""
    answers = [a.model_dump() for a in body.answers]
    return await service.evaluate_submission(user['username'], quiz_id, answers)


@router.post('/generate-dynamic')
async def generate_dynamic(
    topic: str, level: str = 'Intermediate', service: QuizService = Depends()
):
    """Gera um quiz dinâmico via IA."""
    return await service.generate_dynamic_quiz(topic, level)
