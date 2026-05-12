"""
Router do Weekly Goal — alimenta WeeklyPlan e WeeklyPlanHeader no frontend.

Endpoints:
  GET /users/progress/weekly-plan
    → created_at: str
    → topics: list[WeeklyTopic]
      - id: str
      - title: str
      - description: str
      - status: 'pending' | 'completed'
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.database import get_client
from services.upstash import cache_get, cache_set

router = APIRouter()

def _completed_exercise_ids(db, username: str) -> set[str]:
    """IDs concluídos via user_exercise_attempts (quizzes e ai_exercises) e activity_submissions."""
    try:
        # Check attempts
        rows = (
            db.table("user_exercise_attempts")
            .select("exercise_id")
            .eq("username", username)
            .eq("status", "success")
            .execute()
            .data
        )
        completed = {str(r["exercise_id"]) for r in rows if r.get("exercise_id")}
        
        # Check submissions (Novo)
        rows_sub = db.table("activity_submissions").select("metadata").eq("username", username).eq("activity_type", "quiz").execute().data or []
        for r in rows_sub:
            meta = r.get("metadata") or {}
            qid = meta.get("quiz_id")
            if qid: completed.add(str(qid))
            
        return completed
    except Exception:
        return set()

def _completed_podcasts_ids(db, username: str) -> set[str]:
    try:
        rows = db.table("podcast_completions").select("podcast_id").eq("username", username).execute().data or []
        return {str(r["podcast_id"]) for r in rows if r.get("podcast_id")}
    except Exception:
        return set()

def _completed_simulation_ids(db, username: str) -> set[str]:
    try:
        # Check both simulation_progress table and submissions
        rows = db.table("simulation_progress").select("scenario_id").eq("username", username).execute().data or []
        prog = {str(r["scenario_id"]) for r in rows if r.get("scenario_id")}
        
        # Fallback to submissions
        rows_sub = db.table("activity_submissions").select("metadata").eq("username", username).eq("activity_type", "simulation").execute().data or []
        for r in rows_sub:
            meta = r.get("metadata") or {}
            sid = meta.get("simulation_id") or meta.get("item_id")
            if sid: prog.add(str(sid))
        return prog
    except Exception:
        return set()


# ─────────────────────────────────────────────
# Builders de topics por categoria
# ─────────────────────────────────────────────

def _build_quiz_topics(db, username: str, completed_ids: set[str]) -> list[dict]:
    try:
        rows = (
            db.table("quizzes")
            .select("id, title, description, generated_from_patterns")
            .eq("username", username)
            .eq("is_active", True)
            .execute()
            .data
        )
        topics = []
        for row in rows:
            patterns = row.get("generated_from_patterns") or []
            if patterns:
                continue  # é ai_exercise, não quiz normal
            is_done = str(row["id"]) in completed_ids
            topics.append({
                "id": f"quiz-{row['id']}",
                "title": f"📝 {row.get('title') or 'Quiz'}",
                "description": row.get("description") or "Complete this quiz to progress.",
                "status": "completed" if is_done else "pending",
                "redirect_url": f"/quiz/{row['id']}",
            })
        return topics
    except Exception:
        return []


def _build_ai_exercise_topics(db, username: str, completed_ids: set[str]) -> list[dict]:
    try:
        rows = (
            db.table("quizzes")
            .select("id, title, description, generated_from_patterns")
            .eq("username", username)
            .eq("is_active", True)
            .execute()
            .data
        )
        topics = []
        for row in rows:
            patterns = row.get("generated_from_patterns") or []
            if not patterns:
                continue  # é quiz normal
            is_done = str(row["id"]) in completed_ids
            topics.append({
                "id": f"aiex-{row['id']}",
                "title": f"✨ {row.get('title') or 'AI Exercise'}",
                "description": row.get("description") or "AI-generated exercise based on your errors.",
                "status": "completed" if is_done else "pending",
                "redirect_url": f"/quiz/{row['id']}",
            })
        return topics
    except Exception:
        return []


def _build_simulation_topics(db, username: str, completed_ids: set[str]) -> list[dict]:
    try:
        # Simulations are global or user-owned? Usually global catalog.
        rows = (
            db.table("simulations")
            .select("id, name, description, emoji")
            .eq("is_active", True)
            .execute()
            .data
        )
        topics = []
        for row in rows:
            emoji = row.get("emoji") or "🎯"
            name = row.get("name") or "Simulation"
            is_done = str(row["id"]) in completed_ids
            topics.append({
                "id": f"sim-{row['id']}",
                "title": f"{emoji} {name}",
                "description": row.get("description") or "Practice with this simulation.",
                "status": "completed" if is_done else "pending",
                "redirect_url": f"/voice?simulation_id={row['id']}",
            })
        return topics
    except Exception:
        return []


def _build_podcast_topics(db, username: str, completed_ids: set[str]) -> list[dict]:
    try:
        # Podcasts of THIS user
        rows = (
            db.table("podcasts")
            .select("id, title, description, level, duration")
            .eq("user_id", username)
            .execute()
            .data
        )
        topics = []
        for row in rows:
            duration = row.get("duration") or ""
            level = row.get("level") or ""
            is_done = str(row["id"]) in completed_ids
            topics.append({
                "id": f"pod-{row['id']}",
                "title": f"🎙 {row.get('title') or 'Podcast'}",
                "description": (
                    row.get("description")
                    or f"Watch this {level} podcast ({duration})."
                ),
                "status": "completed" if is_done else "pending",
                "redirect_url": f"/podcasts/{row['id']}",
            })
        return topics
    except Exception:
        return []


# ─────────────────────────────────────────────
# Endpoint principal
# ─────────────────────────────────────────────

@router.get("/users/progress/weekly-plan")
async def get_weekly_plan(current_user: dict = Depends(get_current_user)):
    """
    Retorna o Weekly Goal do usuário com todos os pendentes e concluídos.
    """
    username = current_user["username"]
    db = get_client()

    # Busca IDs concluídos
    completed_exercises = _completed_exercise_ids(db, username)
    completed_simulations = _completed_simulation_ids(db, username)
    completed_podcasts = _completed_podcasts_ids(db, username)

    # Monta topics por categoria
    topics: list[dict] = []
    
    # 1. Quizzes e AI Exercises
    topics.extend(_build_quiz_topics(db, username, completed_exercises))
    topics.extend(_build_ai_exercise_topics(db, username, completed_exercises))
    
    # 2. Simulations
    topics.extend(_build_simulation_topics(db, username, completed_simulations))
    
    # 3. Podcasts
    topics.extend(_build_podcast_topics(db, username, completed_podcasts))

    # Ordenação: pendentes primeiro
    topics.sort(key=lambda x: 0 if x["status"] == "pending" else 1)

    result = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "topics": topics,
    }

    return result