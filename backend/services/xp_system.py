"""
Serviço de XP e Níveis Granulares (A1-C2).
Sistema de gamificação para motivar alunos.
"""
from datetime import datetime, timezone
from services.database import get_client

# Configuração de níveis (CEFR - Common European Framework)
LEVELS = {
    "A1": {"min": 0, "max": 500, "label": "Beginner", "label_pt": "Iniciante"},
    "A2": {"min": 500, "max": 1200, "label": "Elementary", "label_pt": "Elementar"},
    "B1": {"min": 1200, "max": 2500, "label": "Intermediate", "label_pt": "Intermediário"},
    "B2": {"min": 2500, "max": 4000, "label": "Upper Intermediate", "label_pt": "Intermediário Superior"},
    "C1": {"min": 4000, "max": 6000, "label": "Advanced", "label_pt": "Avançado"},
    "C2": {"min": 6000, "max": 999999, "label": "Mastery", "label_pt": "Domínio Total"},
}

# Recompensas de XP
XP_REWARDS = {
    "message_sent": 10,
    "correct_answer": 25,
    "streak_day": 5,
    "new_word": 15,
    "simulation_complete": 50,
    "goal_achieved": 30,
    "first_login": 100,
}


def get_xp_data(username: str) -> dict:
    """Retorna dados de XP do usuário."""
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("xp_data")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        if row and row.get("xp_data"):
            return row["xp_data"]
    except Exception:
        pass
    
    # Dados padrão
    return {
        "xp": 0,
        "level": "A1",
        "level_progress": 0,
        "xp_to_next": 500,
        "milestones": [],
        "total_xp_earned": 0,
    }


def award_xp(username: str, amount: int, reason: str = "") -> dict:
    """Adiciona XP ao usuário."""
    db = get_client()
    xp_data = get_xp_data(username)
    
    # Adiciona XP
    xp_data["xp"] = xp_data.get("xp", 0) + amount
    xp_data["total_xp_earned"] = xp_data.get("total_xp_earned", 0) + amount
    
    # Verifica se subiu de nível
    old_level = xp_data.get("level", "A1")
    new_level = calculate_level(xp_data["xp"])
    
    if new_level != old_level:
        xp_data["level"] = new_level
        xp_data["level_up"] = True
        xp_data["level_up_at"] = datetime.now(timezone.utc).isoformat()
        xp_data["level_up_from"] = old_level
        xp_data["level_up_to"] = new_level
    
    # Atualiza progresso
    level_config = LEVELS.get(new_level, LEVELS["A1"])
    xp_in_level = xp_data["xp"] - level_config["min"]
    xp_needed = level_config["max"] - level_config["min"]
    xp_data["level_progress"] = min(100, int((xp_in_level / xp_needed) * 100))
    xp_data["xp_to_next"] = level_config["max"] - xp_data["xp"]
    
    # Adiciona milestone se for primeira vez
    if amount >= 100 and "big_earner" not in xp_data.get("milestones", []):
        if "milestones" not in xp_data:
            xp_data["milestones"] = []
        xp_data["milestones"].append("big_earner")
    
    # Salva
    db.table("users").update({
        "xp_data": xp_data
    }).eq("username", username).execute()
    
    return xp_data


def calculate_level(xp: int) -> str:
    """Calcula o nível baseado no XP."""
    for level, config in LEVELS.items():
        if config["min"] <= xp < config["max"]:
            return level
    return "C2"


def get_leaderboard(limit: int = 50) -> list[dict]:
    """Retorna ranking de alunos por XP."""
    db = get_client()
    
    try:
        users = (
            db.table("users")
            .select("username, name, xp_data, level, profile")
            .order("xp_data->xp", desc=True)
            .limit(limit)
            .execute()
            .data
        )
        
        leaderboard = []
        for i, user in enumerate(users):
            xp_data = user.get("xp_data", {})
            leaderboard.append({
                "rank": i + 1,
                "username": user.get("username"),
                "name": user.get("name") or user.get("username"),
                "xp": xp_data.get("xp", 0),
                "level": xp_data.get("level", "A1"),
                "avatar": user.get("profile", {}).get("avatar_url"),
            })
        
        return leaderboard
    except Exception:
        return []


def get_user_rank(username: str) -> dict:
    """Retorna a posição do usuário no ranking."""
    db = get_client()
    
    try:
        xp_data = get_xp_data(username)
        
        # Conta quantos usuários têm mais XP
        users = (
            db.table("users")
            .select("username, xp_data")
            .execute()
            .data
        )
        
        rank = 1
        for user in users:
            user_xp = user.get("xp_data", {}).get("xp", 0)
            if user_xp > xp_data.get("xp", 0):
                rank += 1
        
        return {
            "rank": rank,
            "xp": xp_data.get("xp", 0),
            "level": xp_data.get("level", "A1"),
        }
    except Exception:
        return {"rank": 0, "xp": 0, "level": "A1"}
