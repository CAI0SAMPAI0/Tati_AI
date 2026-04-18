"""
Router de Challenge Semanal de Pronúncia.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.pronunciation_challenge import get_current_week_challenge, submit_attempt, get_user_attempts

router = APIRouter()


class PronunciationSubmission(BaseModel):
    challenge_id: str
    score: int
    audio_b64: str = ""


@router.get("/challenges/current")
async def get_current_challenge():
    """Challenge da semana atual."""
    return get_current_week_challenge()


@router.post("/challenges/submit")
async def submit_pronunciation(body: PronunciationSubmission, current_user: dict = Depends(get_current_user)):
    """Envia tentativa de pronúncia."""
    return submit_attempt(
        current_user["username"],
        body.challenge_id,
        body.score,
        body.audio_b64
    )


@router.get("/challenges/attempts")
async def get_my_attempts(current_user: dict = Depends(get_current_user)):
    """Retorna tentativas do usuário."""
    return {"attempts": get_user_attempts(current_user["username"])}
