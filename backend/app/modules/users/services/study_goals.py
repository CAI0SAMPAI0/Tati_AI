"""
Serviço de Metas de Estudo Personalizadas.
Gerencia metas diárias e semanais dos alunos.
"""

from datetime import datetime, timezone

from app.core.database import get_client


def get_goals(username: str) -> dict:
    """Retorna todas as metas do usuário com progresso recalculado dinamicamente."""
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

    goals_list = goals_data.get("goals", [])
    if not goals_list:
        return goals_data

    # Recalcula as metas
    from datetime import datetime, timedelta, timezone

    goal_types = {g.get("type") for g in goals_list}

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seven_days_ago_dt = datetime.now(timezone.utc) - timedelta(days=7)
    seven_days_ago_str = seven_days_ago_dt.isoformat()

    daily_minutes = 0
    daily_messages = 0
    weekly_conversations = 0
    weekly_words = 0

    # Calculate daily_minutes
    if "daily_minutes" in goal_types:
        try:
            sessions = (
                db.table("study_sessions")
                .select("duration_minutes, created_at")
                .eq("username", username)
                .execute()
                .data
                or []
            )
            today_date = datetime.now(timezone.utc).date()
            for s in sessions:
                created = s.get("created_at")
                if created:
                    try:
                        dt_date = datetime.fromisoformat(
                            created.replace("Z", "+00:00")
                        ).date()
                        if dt_date == today_date:
                            daily_minutes += s.get("duration_minutes", 0)
                    except ValueError:
                        pass
        except Exception:
            pass

    # Calculate daily_messages
    if "daily_messages" in goal_types:
        try:
            res = (
                db.table("messages")
                .select("id", count="exact")
                .eq("username", username)
                .eq("role", "user")
                .eq("date", today_str)
                .execute()
            )
            daily_messages = (
                res.count
                if res.count is not None
                else (len(res.data) if res.data else 0)
            )
        except Exception:
            pass

    # Calculate weekly_conversations
    if "weekly_conversations" in goal_types or "weekly_conversations" in [
        g.get("type") for g in goals_list
    ]:
        try:
            res = (
                db.table("conversations")
                .select("id")
                .eq("username", username)
                .gte("created_at", seven_days_ago_str)
                .execute()
            )
            weekly_conversations = len(res.data) if res.data else 0
        except Exception:
            pass

    # Calculate weekly_words
    if "weekly_words" in goal_types or "weekly_words" in [
        g.get("type") for g in goals_list
    ]:
        try:
            res = (
                db.table("user_vocabulary")
                .select("id")
                .eq("username", username)
                .gte("created_at", seven_days_ago_str)
                .execute()
            )
            weekly_words = len(res.data) if res.data else 0
        except Exception:
            pass

    changed = False
    updated_goals = []

    for goal in goals_list:
        g_type = goal.get("type")
        target = goal.get("target", 1)
        old_current = goal.get("current", 0)
        old_achieved = goal.get("achieved", False)

        new_current = old_current
        if g_type == "daily_minutes":
            new_current = daily_minutes
        elif g_type == "daily_messages":
            new_current = daily_messages
        elif g_type == "weekly_conversations":
            new_current = weekly_conversations
        elif g_type == "weekly_words":
            new_current = weekly_words

        new_achieved = new_current >= target

        if new_current != old_current or new_achieved != old_achieved:
            changed = True

        goal["current"] = new_current
        goal["achieved"] = new_achieved
        if new_achieved and not old_achieved:
            goal["achieved_at"] = datetime.now(timezone.utc).isoformat()
            goal["achieved_count"] = goal.get("achieved_count", 0) + 1
        elif not new_achieved:
            goal.pop("achieved_at", None)

        updated_goals.append(goal)

    if changed:
        goals_data["goals"] = updated_goals
        try:
            db.table("users").update({"study_goals": goals_data}).eq(
                "username", username
            ).execute()
        except Exception:
            pass

    return goals_data


def create_goal(username: str, goal_data: dict) -> dict:
    """Cria uma nova meta para o usuário."""
    db = get_client()

    goal = {
        "id": f"goal_{int(datetime.now(timezone.utc).timestamp())}",
        # daily_minutes, daily_messages, weekly_words
        "type": goal_data.get("type"),
        "target": goal_data.get("target"),
        "current": 0,
        "period": goal_data.get("period", "daily"),  # daily, weekly
        "created_at": datetime.now(timezone.utc).isoformat(),
        "achieved": False,
        "achieved_count": 0,
    }

    goals_data = get_goals(username)
    goals_data["goals"].append(goal)

    db.table("users").update({"study_goals": goals_data}).eq(
        "username", username
    ).execute()

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

    db.table("users").update({"study_goals": goals_data}).eq(
        "username", username
    ).execute()

    return goals_data


def delete_goal(username: str, goal_id: str) -> dict:
    """Remove uma meta."""
    db = get_client()
    goals_data = get_goals(username)

    goals_data["goals"] = [g for g in goals_data["goals"] if g["id"] != goal_id]

    db.table("users").update({"study_goals": goals_data}).eq(
        "username", username
    ).execute()

    return goals_data
