"""
routers/feedback.py
Router para feedback, bug reports e sugestões dos alunos.

Extraído de ``routers/simulation.py`` para respeitar separação de domínios.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user

router = APIRouter()


class FeedbackRequest(BaseModel):
    """Dados do feedback/bug report enviado pelo aluno."""

    category: str  # bug, feature, feedback, other
    message: str
    title: str = ''
    page: str = ''


@router.post('/feedback/send')
async def send_feedback(
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Envia feedback/bug report do usuário para o administrador."""
    student_name = current_user.get(
        'name') or current_user.get('username')
    student_email = current_user.get('email', '')

    full_message = body.message
    if body.title:
        full_message = f'[{body.title}]\n\n{full_message}'
    if body.page:
        full_message += f'\n\nPágina: {body.page}'

    from app.shared.services.email import EmailSender
    success = EmailSender().send_feedback_notification(
        student_name=student_name,
        student_email=student_email,
        category=body.category,
        message=full_message,
    )

    if success:
        return {
            'success': True,
            'message': 'Feedback enviado com sucesso!'}
    return {
        'success': False,
        'message': 'Erro ao enviar feedback. Tente novamente.'}
