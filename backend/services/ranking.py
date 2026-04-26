"""
Serviço de Ranking de Alunos.
"""
from datetime import datetime, timezone, timedelta
from services.database import get_client

# REGRAS DE PONTUAÇÃO EXATAS
ACTION_POINTS = {
    "quiz": 7,
    "flashcard": 3,
    "message": 8,
    "exercise": 5,
    "simulation": 10,
}

def _empty_stats(username: str, user_map: dict) -> dict:
    return {
        "username": username,
        "name": user_map.get(username, {}).get("name") or username,
        "avatar_url": None,
        "score": 0,
        "messages": 0,
        "quizzes": 0,
        "flashcards": 0,
        "exercises": 0,
        "simulations": 0
    }

def get_ranking_data(username: str) -> dict:
    db = get_client()
    now = datetime.now(timezone.utc)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        from core.config import settings
        staff_usernames = set(settings.staff_roles)
        access = db.table("student_access").select("username, role").execute().data or []
        for a in access:
            if a.get("role") in ("professor", "professora", "programador", "admin"):
                staff_usernames.add(a["username"])
        
        # Busca dados de sessões e mensagens
        actions = db.table("study_sessions").select("username, activity_type").gte("created_at", start_month.isoformat()).execute().data or []
        messages = db.table("messages").select("username").eq("role", "user").gte("created_at", start_month.isoformat()).execute().data or []

        stats = {}
        
        for a in actions:
            u = a.get("username")
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {})
            
            atype = a.get("activity_type")
            if atype in ACTION_POINTS:
                stats[u]["score"] += ACTION_POINTS[atype]
                if atype in ["quiz", "flashcard", "exercise", "message", "simulation"]:
                    stats[u][f"{atype}s"] += 1
        
        for m in messages:
            u = m.get("username")
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {})
            stats[u]["score"] += ACTION_POINTS["message"]
            stats[u]["messages"] += 1

        # Tenta buscar nomes reais para todos no stats
        if stats:
            usernames = list(stats.keys())
            users = db.table("users").select("username, name").in_("username", usernames).execute().data or []
            for u_info in users:
                uname = u_info.get("username")
                if uname in stats:
                    stats[uname]["name"] = u_info.get("name") or uname

        ranking = sorted(stats.values(), key=lambda x: x["score"], reverse=True)
        
        # Mês anterior para winners
        last_month_end = start_month - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Nota: Como get_ranking_data é usado principalmente para o ranking atual, 
        # os winners podem ser calculados separadamente se necessário, 
        # mas aqui vamos apenas garantir que top15 esteja correto.
        
        return {
            "top15": ranking[:15], 
            "my_position": next((i+1 for i, x in enumerate(ranking) if x["username"] == username), 0),
            "winners": [] # Winners são carregados via endpoint específico no frontend
        }
    except Exception as e:
        print(f"[Ranking] Erro: {e}")
        return {"top15": [], "my_position": 0, "winners": []}
