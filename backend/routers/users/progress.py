"""
Router de Relatórios de Progresso.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.progress_report import get_weekly_report, get_monthly_report
from services.database import get_client

router = APIRouter()


@router.get("/reports/weekly")
async def get_weekly(current_user: dict = Depends(get_current_user)):
    """Relatório semanal de progresso."""
    return get_weekly_report(current_user["username"])


@router.get("/reports/monthly")
async def get_monthly(current_user: dict = Depends(get_current_user)):
    """Relatório mensal de progresso."""
    return get_monthly_report(current_user["username"])


@router.get("/progress/study-time")
async def get_study_time(current_user: dict = Depends(get_current_user)):
    """Tempo de estudo do usuário por período."""
    db = get_client()
    username = current_user["username"]
    now = datetime.now(timezone.utc)

    # Calcular períodos
    week_ago = now - timedelta(days=7)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = month_start - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    three_months_ago = now - timedelta(days=90)

    # Buscar sessões de estudo do usuário
    sessions = db.table("study_sessions").select("*").eq("username", username).execute().data

    this_week = 0
    this_month = 0
    last_month = 0
    last_3_months = 0

    for session in sessions:
        session_time = session.get("duration_minutes", 0)
        created = session.get("created_at")
        if not created:
            continue

        # Parse date (handle both string and datetime)
        if isinstance(created, str):
            try:
                created = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except:
                continue

        if created >= week_ago:
            this_week += session_time
        if created >= month_start:
            this_month += session_time
        if last_month_start <= created <= last_month_end:
            last_month += session_time
        if created >= three_months_ago:
            last_3_months += session_time

    return {
        "this_week": this_week,
        "this_month": this_month,
        "last_month": last_month,
        "last_3_months": last_3_months,
    }


@router.get("/trophies/all")
async def get_all_trophies(current_user: dict = Depends(get_current_user)):
    """Todas as medalhas/troféus com progresso do usuário."""
    db = get_client()
    username = current_user["username"]

    # Troféus conquistados
    earned = db.table("user_trophies").select("*").eq("username", username).execute().data
    earned_ids = {e["trophy_id"] for e in earned}

    # Dados reais do usuário para calcular progresso
    try:
        quiz_count   = len(db.table("user_progress").select("id").eq("username", username).execute().data or [])
        try:
            streak_data = db.table("users").select("current_streak, longest_streak").eq("username", username).single().execute().data or {}
            streak_val  = streak_data.get("current_streak") or 0
        except:
            streak_val = 0
        msg_count    = len(db.table("messages").select("id").eq("username", username).eq("role", "user").execute().data or [])
    except Exception as e:
        print(f"[Trophies] Erro ao buscar dados: {e}")
        quiz_count, streak_val, msg_count = 0, 0, 0

    def _current_val(category, req_val):
        if category == "questions": return quiz_count
        if category == "streak":    return streak_val
        if category == "social":    return msg_count
        if category == "milestones": return quiz_count  # usa quiz como proxy
        if category == "time":      return quiz_count   # usa quiz como proxy
        if category == "credits":   return 0            # sem dados ainda
        return 0

    # Todos os troféus disponíveis
    all_trophies = db.table("trophies").select("*").execute().data

    medals = []
    for trophy in all_trophies:
        unlocked  = trophy["id"] in earned_ids
        category  = trophy.get("category", "all")
        req_val   = trophy.get("requirement_value") or 1
        cur_val   = req_val if unlocked else _current_val(category, req_val)
        cur_val   = min(cur_val, req_val)  # não passa do máximo

        medals.append({
            "id":            trophy["id"],
            "name":          trophy.get("name", ""),
            "description":   trophy.get("description", ""),
            "icon":          trophy.get("icon", "🏆"),
            "category":      category,
            "unlocked":      unlocked,
            "progress":      trophy.get("requirement_text", ""),
            "current_val":   cur_val,
            "required_val":  req_val,
            "progress_pct":  round((cur_val / req_val) * 100) if req_val else 0,
        })

    return {
        "earned": len(earned_ids),
        "total":  len(all_trophies),
        "medals": medals,
    }


@router.get("/ranking/position")
async def get_user_ranking_position(current_user: dict = Depends(get_current_user)):
    """Posição do usuário no ranking."""
    db = get_client()
    username = current_user["username"]

    # Calcular scores de todos os usuários do mês atual
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rankings = _calculate_rankings(db, month_start)

    # Encontrar posição do usuário
    user_pos = None
    user_entry = None
    for i, entry in enumerate(rankings):
        if entry["username"] == username:
            user_pos = i + 1
            user_entry = entry
            break

    if not user_entry:
        return {
            "position": len(rankings) + 1,
            "name": current_user.get("name", username),
            "score": 0,
            "messages": 0,
            "quizzes": 0,
            "flashcards": 0,
            "exercises": 0,
        }

    return {
        "position": user_pos,
        "name": user_entry.get("name", username),
        "score": user_entry.get("score", 0),
        "messages": user_entry.get("messages", 0),
        "quizzes": user_entry.get("quizzes", 0),
        "flashcards": user_entry.get("flashcards", 0),
        "exercises": user_entry.get("exercises", 0),
    }


@router.get("/ranking/top15")
async def get_top_15_ranking(current_user: dict = Depends(get_current_user)):
    """Top 15 do ranking do mês."""
    db = get_client()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rankings = _calculate_rankings(db, month_start)
    top_15 = rankings[:15]

    return [
        {
            "username": r["username"],
            "name": r.get("name", r["username"]),
            "score": r.get("score", 0),
            "messages": r.get("messages", 0),
            "quizzes": r.get("quizzes", 0),
            "flashcards": r.get("flashcards", 0),
            "exercises": r.get("exercises", 0),
            "tokens": r.get("tokens", 0),
        }
        for r in top_15
    ]


@router.get("/ranking/winners")
async def get_previous_month_winners(current_user: dict = Depends(get_current_user)):
    """Vencedores do mês anterior."""
    db = get_client()
    now = datetime.now(timezone.utc)

    # Primeiro dia do mês atual
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    # Último dia do mês anterior
    last_month_end = month_start - timedelta(days=1)
    # Primeiro dia do mês anterior
    last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rankings = _calculate_rankings(db, last_month_start, last_month_end)
    winners = rankings[:3]

    return [
        {
            "username": r["username"],
            "name": r.get("name", r["username"]),
            "score": r.get("score", 0),
        }
        for r in winners
    ]


def _calculate_rankings(db, start_date, end_date=None):
    """Calcula o ranking de engajamento para um período usando study_sessions."""
    iso_start = start_date.isoformat()

    # Filtrar usuários staff para não aparecer no ranking
    try:
        access = db.table("student_access").select("username, role").execute().data or []
        staff_usernames = {a["username"] for a in access if a.get("role") in ("professor", "professora", "programador", "admin")}
    except:
        staff_usernames = set()

    sessions = db.table("study_sessions").select("username, activity_type").gte("created_at", iso_start).execute().data

    points_map = {
        "quiz": 7,
        "flashcard": 3,
        "exercise": 5,
    }

    user_scores = {}

    for s in sessions:
        u = s["username"]
        if u in staff_usernames:
            continue
        atype = s.get("activity_type", "")
        if u not in user_scores:
            user_scores[u] = {"username": u, "score": 0, "messages": 0, "quizzes": 0, "flashcards": 0, "exercises": 0, "tokens": 0}
        pts = points_map.get(atype, 0)
        user_scores[u]["score"] += pts
        if atype == "quiz":
            user_scores[u]["quizzes"] += 1
        elif atype == "flashcard":
            user_scores[u]["flashcards"] += 1
        elif atype == "exercise":
            user_scores[u]["exercises"] += 1

    messages = db.table("messages").select("username").eq("role", "user").gte("created_at", iso_start).execute().data
    for m in messages:
        u = m["username"]
        if u in staff_usernames:
            continue
        if u not in user_scores:
            user_scores[u] = {"username": u, "score": 0, "messages": 0, "quizzes": 0, "flashcards": 0, "exercises": 0, "tokens": 0}
        user_scores[u]["score"] += 8  # message points = 8
        user_scores[u]["messages"] += 1

    usernames = list(user_scores.keys())
    if usernames:
        users = db.table("users").select("username, name").in_("username", usernames).execute().data
        for u in users:
            if u["username"] in user_scores:
                user_scores[u["username"]]["name"] = u.get("name") or u["username"]

    rankings = sorted(user_scores.values(), key=lambda x: (-x["score"], -x["messages"]))
    return rankings