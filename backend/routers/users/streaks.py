"""
Router de Streaks (dias consecutivos de estudo).
Endpoints para consultar e gerenciar streaks de alunos.
"""
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.streaks import get_streak, record_study_day, get_streak_milestones
from services.database import get_client
from services.upstash import cache_get, cache_set, cache_delete

router = APIRouter()


@router.get("/streak")
async def get_user_streak(current_user: dict = Depends(get_current_user)):
    """Retorna o streak atual do usuário (usado no header)."""
    username = current_user["username"]
    cache_key = f"streak:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    data = get_streak(username)

    try:
        from services.trophy_service import check_all_trophies
        check_all_trophies(username)
    except Exception as e:
        print(f"[Retro Trophy] Erro: {e}")

    db = get_client()
    try:
        earned = db.table("user_trophies").select("id").eq("username", username).execute().data
        trophies_earned = len(earned) if earned else 0
    except:
        trophies_earned = 0

    result = {
        "current_streak": data.get("current_streak", 0),
        "longest_streak": data.get("longest_streak", 0),
        "trophies_earned": trophies_earned,
    }
    await cache_set(cache_key, result, ttl=180)  # 3 minutos
    return result


@router.get("/streaks/detail")
async def get_streak_detail(current_user: dict = Depends(get_current_user)):
    """Detalhes completos da ofensiva do usuário."""
    username = current_user["username"]
    data = get_streak(username)

    # Calcular horas economizadas (estimativa: 15 min por mensagem)
    db = get_client()
    try:
        msg_count = db.table("messages").select("id", count="exact").eq("username", username).eq("role", "user").execute()
        total_messages = msg_count.count if hasattr(msg_count, 'count') and msg_count.count else 0
    except:
        total_messages = 0

    hours_saved = round((total_messages * 15) / 60, 1)  # 15 min por mensagem

    # Total de perguntas (quizzes + flashcards + exercises)
    try:
        quizzes = db.table("user_progress").select("correct_q").eq("username", username).execute().data
        total_questions = sum(q.get("correct_q", 0) for q in quizzes) if quizzes else 0
    except:
        total_questions = 0

    return {
        "current_streak": data.get("current_streak", 0),
        "longest_streak": data.get("longest_streak", 0),
        "total_questions": total_questions,
        "hours_saved": hours_saved,
    }


@router.post("/streak/record")
async def record_study(current_user: dict = Depends(get_current_user)):
    """Registra um dia de estudo e atualiza o streak."""
    username = current_user["username"]
    await cache_delete(f"streak:{username}")  # invalida ao registrar estudo
    return record_study_day(username)


@router.get("/streak/milestones")
async def get_user_milestones(current_user: dict = Depends(get_current_user)):
    """Retorna os marcos de streak do usuário."""
    username = current_user["username"]
    return get_streak_milestones(username)
