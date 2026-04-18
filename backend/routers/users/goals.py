"""
Router de Metas de Estudo Personalizadas.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.study_goals import get_goals, create_goal, update_goal_progress, delete_goal

router = APIRouter()


class GoalCreate(BaseModel):
    type: str
    target: int
    period: str = "daily"


@router.get("/goals")
async def get_user_goals(current_user: dict = Depends(get_current_user)):
    """Retorna metas do usuário."""
    return get_goals(current_user["username"])


@router.post("/goals")
async def create_user_goal(body: GoalCreate, current_user: dict = Depends(get_current_user)):
    """Cria nova meta."""
    return create_goal(current_user["username"], body.dict())


@router.post("/goals/{goal_id}/progress")
async def update_progress(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Incrementa progresso de uma meta."""
    return update_goal_progress(current_user["username"], goal_id)


@router.delete("/goals/{goal_id}")
async def remove_goal(goal_id: str, current_user: dict = Depends(get_current_user)):
    """Remove uma meta."""
    return delete_goal(current_user["username"], goal_id)
