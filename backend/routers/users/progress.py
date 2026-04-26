"""
Router de Relatórios de Progresso.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.progress_report import get_weekly_report, get_monthly_report
from services.database import get_client
from services.upstash import cache_get, cache_set

router = APIRouter()


@router.get("/reports/weekly")
async def get_weekly(current_user: dict = Depends(get_current_user)):
    """Relatório semanal de progresso."""
    username = current_user["username"]
    cache_key = f"report:weekly:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = get_weekly_report(username)
    await cache_set(cache_key, result, ttl=1800)  # 30 minutos
    return result


@router.get("/reports/monthly")
async def get_monthly(current_user: dict = Depends(get_current_user)):
    """Relatório mensal de progresso."""
    username = current_user["username"]
    cache_key = f"report:monthly:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached
    result = get_monthly_report(username)
    await cache_set(cache_key, result, ttl=3600)  # 1 hora
    return result


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
    username = current_user["username"]
    cache_key = f"trophies_all:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()

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

    result = {
        "earned": len(earned_ids),
        "total":  len(all_trophies),
        "medals": medals,
    }
    await cache_set(cache_key, result, ttl=300) # 5 minutos
    return result


@router.get("/ranking/position")
async def get_user_ranking_position(current_user: dict = Depends(get_current_user)):
    """Posição do usuário no ranking."""
    username = current_user["username"]
    cache_key = f"ranking:position:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rankings = _calculate_rankings(db, month_start)

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

    result = {
        "position": user_pos,
        "name": user_entry.get("name", username),
        "score": user_entry.get("score", 0),
        "messages": user_entry.get("messages", 0),
        "quizzes": user_entry.get("quizzes", 0),
        "flashcards": user_entry.get("flashcards", 0),
        "exercises": user_entry.get("exercises", 0),
    }
    await cache_set(cache_key, result, ttl=300)  # 5 minutos
    return result


@router.get("/ranking/top15")
async def get_top_15_ranking(current_user: dict = Depends(get_current_user)):
    """Top 15 do ranking do mês."""
    cache_key = "ranking:top15"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rankings = _calculate_rankings(db, month_start)
    top_15 = [
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
        for r in rankings[:15]
    ]
    await cache_set(cache_key, top_15, ttl=300)  # 5 minutos
    return top_15


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
    
    # Formata mês anterior (ex: 03/2024)
    month_label = f"{last_month_start.month:02d}/{last_month_start.year}"

    return {
        "month": month_label,
        "winners": [
            {
                "username": r["username"],
                "name": r.get("name", r["username"]),
                "score": r.get("score", 0),
                "position": i + 1
            }
            for i, r in enumerate(rankings[:3])
        ]
    }


def _calculate_rankings(db, start_date, end_date=None):
    """Calcula o ranking de engajamento para um período usando study_sessions."""
    iso_start = start_date.isoformat()
    
    # Filtro opcional de fim de período (para winners do mês anterior)
    query_sessions = db.table("study_sessions").select("username, activity_type").gte("created_at", iso_start)
    query_messages = db.table("messages").select("username").eq("role", "user").gte("created_at", iso_start)
    
    if end_date:
        iso_end = end_date.isoformat()
        query_sessions = query_sessions.lte("created_at", iso_end)
        query_messages = query_messages.lte("created_at", iso_end)

    # Filtrar usuários staff para não aparecer no ranking
    try:
        from core.config import settings
        staff_usernames = set(settings.staff_roles)
        # Adiciona os do banco por garantia
        access = db.table("student_access").select("username, role").execute().data or []
        for a in access:
            if a.get("role") in ("professor", "professora", "programador", "admin"):
                staff_usernames.add(a["username"])
    except Exception as e:
        print(f"[Ranking] Erro ao buscar staff: {e}")
        staff_usernames = set()

    sessions_data = query_sessions.execute().data or []
    
    points_map = {
        "quiz": 7,
        "flashcard": 3,
        "exercise": 5,
        "simulation": 10,
    }

    user_scores = {}

    for s in sessions_data:
        u = s.get("username")
        if not u or u in staff_usernames:
            continue
        atype = s.get("activity_type", "")
        if u not in user_scores:
            user_scores[u] = {"username": u, "score": 0, "messages": 0, "quizzes": 0, "flashcards": 0, "exercises": 0, "tokens": 0, "simulations": 0}
        
        pts = points_map.get(atype, 0)
        user_scores[u]["score"] += pts
        
        if atype == "quiz":
            user_scores[u]["quizzes"] += 1
        elif atype == "flashcard":
            user_scores[u]["flashcards"] += 1
        elif atype == "exercise":
            user_scores[u]["exercises"] += 1
        elif atype == "simulation":
            user_scores[u]["simulations"] += 1

    messages_data = query_messages.execute().data or []
    for m in messages_data:
        u = m.get("username")
        if not u or u in staff_usernames:
            continue
        if u not in user_scores:
            user_scores[u] = {"username": u, "score": 0, "messages": 0, "quizzes": 0, "flashcards": 0, "exercises": 0, "tokens": 0, "simulations": 0}
        user_scores[u]["score"] += 8  # message points = 8
        user_scores[u]["messages"] += 1

    usernames = list(user_scores.keys())
    if usernames:
        try:
            # Tenta buscar nomes reais
            users = db.table("users").select("username, name").in_("username", usernames).execute().data or []
            for u_info in users:
                uname = u_info.get("username")
                if uname in user_scores:
                    user_scores[uname]["name"] = u_info.get("name") or uname
        except Exception as e:
            print(f"[Ranking] Erro ao buscar nomes: {e}")

    # Garante que todos tenham um 'name'
    for u in user_scores.values():
        if not u.get("name"):
            u["name"] = u["username"]

    rankings = sorted(user_scores.values(), key=lambda x: (-x["score"], -x["messages"]))
    return rankings


# ─── Plano de Estudos Semanal ───────────────────────────────────────────────

from services.weekly_plan import (
    get_or_generate_weekly_plan,
    check_plan_progress,
    generate_transition_exercises,
)


@router.get("/weekly-plan")
async def get_weekly_plan(user: dict = Depends(get_current_user)):
    """Retorna o plano da semana atual com status de progresso por tópico."""
    plan = await get_or_generate_weekly_plan(
        username=user["username"],
        level=user.get("level", "Intermediate"),
        focus=user.get("focus", "General Conversation"),
    )
    return plan


@router.get("/weekly-plan/progress")
async def get_plan_progress(user: dict = Depends(get_current_user)):
    """
    Verifica e retorna o progresso real do aluno nos tópicos do plano desta semana.
    Analisa o histórico de mensagens para cada tópico.
    """
    progress = await check_plan_progress(username=user["username"])
    return {"progress": progress}


@router.post("/weekly-plan/transition")
async def start_plan_transition(user: dict = Depends(get_current_user)):
    """
    Inicia a transição de plano:
      1. Verifica progresso final da semana
      2. Gera exercícios de revisão com RAG (5-10 questões, tipo aleatório)
      3. Invalida o plano atual para que um novo seja gerado na próxima consulta
    Retorna os exercícios para o modal de transição no frontend.
    """
    username = user["username"]

    # Atualiza progresso antes de transicionar
    await check_plan_progress(username=username)

    # Gera exercícios de transição com RAG
    result = await generate_transition_exercises(username=username)

    if not result:
        return {"error": "Não foi possível gerar os exercícios. Tente novamente."}, 500

    return result
