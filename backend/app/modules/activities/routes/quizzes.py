"""
Router de Quizzes e Desafios.
Refatorado para usar QuizService e padrão async.
"""

from fastapi import APIRouter, Depends
from app.core.exceptions import ContentNotFoundError
from pydantic import BaseModel
from typing import List

from app.core.dependencies.auth import get_current_user, get_current_user_optional
from app.modules.activities.services.quiz_service import QuizService

router = APIRouter()


def _normalize_lang(lang: str | None) -> str:
    """Normaliza short codes para formatos esperados nos quizzes.

    Ex.: 'en' -> 'en-US', fallback para 'pt-BR'.
    """
    if not lang:
        return 'pt-BR'
    v = str(lang).strip().lower()
    if v.startswith('en-gb') or v.startswith('en-uk'):
        return 'en-UK'
    if v.startswith('en'):
        return 'en-US'
    if v.startswith('pt'):
        return 'pt-BR'
    return 'pt-BR'


def ensure_explanation_language(
    explanation: str,
    question: str,
    options: list[str],
    correct_index: int,
    desired_lang: str,
) -> str:
    """Garante que a explicação esteja no idioma desejado.

    Implementação leve: usa detecção simples e templates determinísticos
    para tornar os testes determinísticos sem dependência de LLMs.
    """
    dl = _normalize_lang(desired_lang)

    # detect Portuguese markers
    expl_lower = (explanation or '').lower()
    has_pt = 'alternativa correta' in expl_lower or 'porque' in expl_lower
    has_en = 'correct answer' in expl_lower or "is the correct answer" in expl_lower

    if dl.startswith('en') and has_pt:
        return (
            f"The correct answer is '{
                options[correct_index]}' because it best completes the sentence '{question}'.")
    if dl.startswith('pt') and has_en:
        return (
            f"A alternativa correta é '{
                options[correct_index]}' porque ela completa melhor a frase '{question}'.")

    # Already in desired language or unable to detect: if desired !=
    # detected, prefer templated rewrite
    if dl.startswith('en') and not has_en:
        return (
            f"The correct answer is '{
                options[correct_index]}' because it best completes the sentence '{question}'.")
    if dl.startswith('pt') and not has_pt:
        return (
            f"A alternativa correta é '{
                options[correct_index]}' porque ela completa melhor a frase '{question}'.")

    return explanation


class QuizAnswer(BaseModel):
    question_id: str
    selected_index: int


class QuizSubmission(BaseModel):
    answers: List[QuizAnswer]


@router.get('/{quiz_id}')
async def get_quiz(
    quiz_id: str,
    user=Depends(get_current_user_optional),
    service: QuizService = Depends()
):
    """Busca um quiz pelo ID."""
    username = user['username'] if user else None
    quiz = await service.get_quiz(quiz_id, username=username)
    if not quiz:
        raise ContentNotFoundError(detail='Quiz não encontrado')
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
        topic: str,
        level: str = 'B1',
        service: QuizService = Depends()):
    """Gera um quiz dinâmico via IA."""
    return await service.generate_dynamic_quiz(topic, level)
