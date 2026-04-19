"""
Serviço de Ranking de Alunos.
"""
from datetime import datetime, timezone
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
        # 1. Filtra usuários NÃO staff
        access = db.table("student_access").select("username, name, role").execute().data or []
        staff_usernames = {u["username"] for u in access if u["role"] in ["programador", "professor", "professora"]}
        user_map = {u["username"]: u for u in access}
        
        # 2. Busca dados de sessões e mensagens
        actions = db.table("study_sessions").select("username, activity_type").gte("created_at", start_month.isoformat()).execute().data or []
        messages = db.table("messages").select("username").eq("role", "user").gte("created_at", start_month.isoformat()).execute().data or []

        stats = {}
        # Inicializa stats apenas para usuários válidos
        for u_data in access:
            if u_data["username"] not in staff_usernames:
                stats[u_data["username"]] = _empty_stats(u_data["username"], user_map)

        # Pontuação
        for a in actions:
            u = a["username"]
            if u in stats and a["activity_type"] in ACTION_POINTS:
                stats[u]["score"] += ACTION_POINTS[a["activity_type"]]
                atype = a["activity_type"]
                if atype in ["quiz", "flashcard", "exercise", "message", "simulation"]:
                    stats[u][f"{atype}s"] += 1
        
        for m in messages:
            u = m["username"]
            if u in stats:
                stats[u]["score"] += ACTION_POINTS["message"]
                stats[u]["messages"] += 1

        ranking = sorted(stats.values(), key=lambda x: x["score"], reverse=True)
        return {
            "top15": ranking[:15], 
            "my_position": next((i+1 for i, x in enumerate(ranking) if x["username"] == username), 0),
            "winners": []
        }
    except Exception as e:
        print(f"[Ranking] Erro: {e}")
        return {"top15": [], "my_position": 0, "winners": []}
