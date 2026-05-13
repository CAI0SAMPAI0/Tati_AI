"""
Router de Metas de Estudo Personalizadas.
Refatorado para aspas simples e padrão async.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.dependencies.auth import get_current_user
from app.modules.users.services.study_goals import (
    get_goals,
    create_goal,
    update_goal_progress,
    delete_goal,
)

router = APIRouter()


class GoalCreate(BaseModel):
    type: str
    target: int
    period: str = 'daily'


@router.get('/')
@router.get('')
async def list_goals(user=Depends(get_current_user)):
    """Retorna metas do usuário."""
    return get_goals(user['username'])


@router.post('/')
async def add_goal(body: GoalCreate, user=Depends(get_current_user)):
    """Cria nova meta."""
    return create_goal(user['username'], body.model_dump())


@router.post('/{goal_id}/progress')
async def update_progress(goal_id: str, user=Depends(get_current_user)):
    """Incrementa progresso de uma meta."""
    return update_goal_progress(user['username'], goal_id)


@router.delete('/{goal_id}')
async def remove_goal(goal_id: str, user=Depends(get_current_user)):
    """Remove uma meta."""
    return delete_goal(user['username'], goal_id)
