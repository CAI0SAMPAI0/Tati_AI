"""
Serviço de Relatórios de Progresso do Aluno.
Gera relatórios semanais e mensais com métricas de estudo.
"""
from datetime import date, datetime, timedelta
from services.database import get_client
from services.streaks import get_streak


def _get_date_range(days_back: int) -> tuple[str, str]:
    """Retorna data início e fim em formato ISO."""
    end = date.today()
    start = end - timedelta(days=days_back)
    return start.isoformat(), end.isoformat()


def _get_study_days(db, username: str, start: str, end: str) -> set:
    """
    Coleta dias de estudo de mensagens E de study_sessions.
    Garante que o primeiro dia (e dias com voz/simulação) seja contado.
    """
    day_set = set()

    # 1. Dias via mensagens (campo 'date')
    try:
        msgs = (
            db.table("messages")
            .select("date")
            .eq("username", username)
            .gte("date", start)
            .lte("date", end)
            .execute()
            .data
        )
        for m in msgs:
            d = m.get("date")
            if d:
                day_set.add(str(d)[:10])
    except Exception:
        pass

    # 2. Dias via study_sessions (cobre chat, voz, simulação, etc.)
    try:
        sessions = (
            db.table("study_sessions")
            .select("created_at")
            .eq("username", username)
            .gte("created_at", start)
            .lte("created_at", end + "T23:59:59")
            .execute()
            .data
        )
        for s in sessions:
            ca = s.get("created_at", "")
            if ca:
                try:
                    day_str = datetime.fromisoformat(
                        ca.replace("Z", "+00:00")
                    ).strftime("%Y-%m-%d")
                    day_set.add(day_str)
                except Exception:
                    pass
    except Exception:
        pass

    return day_set


def get_weekly_report(username: str) -> dict:
    """Relatório semanal do aluno."""
    db = get_client()
    start, end = _get_date_range(7)

    # Busca conversas da semana
    try:
        convs = (
            db.table("conversations")
            .select("id, title, created_at, updated_at")
            .eq("username", username)
            .gte("created_at", start)
            .lte("created_at", end)
            .execute()
            .data
        )
    except Exception:
        convs = []

    # Busca mensagens da semana
    try:
        messages = (
            db.table("messages")
            .select("role, content, date")
            .eq("username", username)
            .gte("date", start)
            .lte("date", end)
            .execute()
            .data
        )
    except Exception:
        messages = []

    # Calcula métricas
    total_messages = len([m for m in messages if m.get("role") == "user"])
    total_assistant = len([m for m in messages if m.get("role") == "assistant"])

    # Dias de estudo: união de mensagens + study_sessions
    study_day_set = _get_study_days(db, username, start, end)
    study_days = len(study_day_set)

    # Analisa vocabulário (palavras únicas nas mensagens do aluno)
    user_content = " ".join([m.get("content", "") for m in messages if m.get("role") == "user"])
    words = set(user_content.lower().split())
    unique_words = len([w for w in words if len(w) > 3])

    # Busca streak
    streak_data = get_streak(username)

    # Distribuição por dia da semana
    days_of_week = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    messages_by_day = [0] * 7

    for d in study_day_set:
        try:
            day_idx = datetime.fromisoformat(d).weekday()
            messages_by_day[day_idx] += 1
        except Exception:
            pass

    return {
        "period": "weekly",
        "start_date": start,
        "end_date": end,
        "total_conversations": len(convs),
        "total_messages": total_messages,
        "total_responses": total_assistant,
        "study_days": study_days,
        "unique_words_used": unique_words,
        "current_streak": streak_data.get("current_streak", 0),
        "messages_by_day": messages_by_day,
        "days_of_week": days_of_week,
    }


def get_monthly_report(username: str) -> dict:
    """Relatório mensal do aluno."""
    db = get_client()
    start, end = _get_date_range(30)

    # Busca conversas do mês
    try:
        convs = (
            db.table("conversations")
            .select("id, title, created_at")
            .eq("username", username)
            .gte("created_at", start)
            .lte("created_at", end)
            .execute()
            .data
        )
    except Exception:
        convs = []

    # Busca mensagens do mês
    try:
        messages = (
            db.table("messages")
            .select("role, content, date")
            .eq("username", username)
            .gte("date", start)
            .lte("date", end)
            .execute()
            .data
        )
    except Exception:
        messages = []

    # Métricas
    total_messages = len([m for m in messages if m.get("role") == "user"])

    # Dias de estudo: união de mensagens + study_sessions
    study_day_set = _get_study_days(db, username, start, end)
    study_days = len(study_day_set)

    # Vocabulário
    user_content = " ".join([m.get("content", "") for m in messages if m.get("role") == "user"])
    words = set(user_content.lower().split())
    unique_words = len([w for w in words if len(w) > 3])

    # Streak
    streak_data = get_streak(username)

    # Mensagens por semana (últimas 4 semanas)
    weekly_counts = []
    for week in range(4):
        week_start = date.today() - timedelta(days=7 * (week + 1))
        week_end = date.today() - timedelta(days=7 * week)
        count = len([m for m in messages
                     if m.get("role") == "user" and m.get("date")
                     and week_start.isoformat() <= m.get("date", "") <= week_end.isoformat()])
        weekly_counts.append(count)

    return {
        "period": "monthly",
        "start_date": start,
        "end_date": end,
        "total_conversations": len(convs),
        "total_messages": total_messages,
        "study_days": study_days,
        "unique_words_used": unique_words,
        "current_streak": streak_data.get("current_streak", 0),
        "longest_streak": streak_data.get("longest_streak", 0),
        "messages_by_week": list(reversed(weekly_counts)),
    }
