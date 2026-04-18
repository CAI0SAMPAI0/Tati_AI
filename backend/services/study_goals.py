"""
Serviço de Metas de Estudo Personalizadas.
Gerencia metas diárias e semanais dos alunos.
"""
from datetime import datetime, timezone
from services.database import get_client


def get_goals(username: str) -> dict:
    """Retorna todas as metas do usuário."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("study_goals")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        goals_data = row.get("study_goals", {"goals": []}) if row else {"goals": []}
    except Exception:
        goals_data = {"goals": []}
    
    return goals_data


def create_goal(username: str, goal_data: dict) -> dict:
    """Cria uma nova meta para o usuário."""
    db = get_client()
    
    goal = {
        "id": f"goal_{int(datetime.now(timezone.utc).timestamp())}",
        "type": goal_data.get("type"),  # daily_minutes, daily_messages, weekly_words
        "target": goal_data.get("target"),
        "current": 0,
        "period": goal_data.get("period", "daily"),  # daily, weekly
        "created_at": datetime.now(timezone.utc).isoformat(),
        "achieved": False,
        "achieved_count": 0,
    }
    
    goals_data = get_goals(username)
    goals_data["goals"].append(goal)
    
    db.table("users").update({
        "study_goals": goals_data
    }).eq("username", username).execute()
    
    return goal


def update_goal_progress(username: str, goal_id: str, increment: int = 1) -> dict:
    """Atualiza o progresso de uma meta."""
    db = get_client()
    goals_data = get_goals(username)
    
    for goal in goals_data["goals"]:
        if goal["id"] == goal_id:
            goal["current"] = goal.get("current", 0) + increment
            
            # Verifica se atingiu a meta
            if goal["current"] >= goal["target"] and not goal.get("achieved"):
                goal["achieved"] = True
                goal["achieved_at"] = datetime.now(timezone.utc).isoformat()
                goal["achieved_count"] = goal.get("achieved_count", 0) + 1
            
            break
    
    db.table("users").update({
        "study_goals": goals_data
    }).eq("username", username).execute()
    
    return goals_data


def delete_goal(username: str, goal_id: str) -> dict:
    """Remove uma meta."""
    db = get_client()
    goals_data = get_goals(username)
    
    goals_data["goals"] = [g for g in goals_data["goals"] if g["id"] != goal_id]
    
    db.table("users").update({
        "study_goals": goals_data
    }).eq("username", username).execute()
    
    return goals_data
