"""
Serviço de Streaks (dias consecutivos de estudo).
Gerencia o acompanhamento de dias consecutivos que o aluno praticou.
"""
from datetime import date, datetime, timedelta, timezone
from services.database import get_client


def _today() -> date:
    return date.today()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _calculate_current_streak(streak_data: dict, today: date) -> int:
    """Helper puramente lógico para testes de streak."""
    study_dates = streak_data.get("study_dates", [])
    if not study_dates:
        return 0
    
    # Ordena datas decrescente (garante que a mais recente é a primeira)
    sorted_dates = sorted([date.fromisoformat(d) for d in study_dates], reverse=True)
    
    last_study_date = sorted_dates[0]
    days_since_last = (today - last_study_date).days
    
    if days_since_last > 1:
        return 0 if days_since_last > 1 else 1 # Se passou mais de 1 dia, streak é 0
        # Na verdade, se today for hoje e a última atividade foi anteontem, o streak é 0.
        # Se a última atividade foi ontem, o streak é mantido.
    
    # Se a última atividade foi há mais de 1 dia do "today", o streak acabou.
    if (today - last_study_date).days > 1:
        return 0
        
    streak = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i-1] - sorted_dates[i]).days == 1:
            streak += 1
        else:
            break
    return streak


def get_streak(username: str) -> dict:
    """
    Retorna o streak atual do usuário baseado em ATIVIDADE REAL.
    Se não houve atividade hoje nem ontem, o streak atual é 0.
    """
    db = get_client()
    
    try:
        row = (
            db.table("users")
            .select("streak_data")
            .eq("username", username)
            .single()
            .execute()
            .data
        )
        
        streak_data = row.get("streak_data") if row else None
        
        if streak_data:
            # Verifica se o streak ainda é válido (não passou mais de 1 dia sem atividade)
            last_date_str = streak_data.get("last_study_date")
            if last_date_str:
                try:
                    last_date = date.fromisoformat(last_date_str)
                    today = date.today()
                    days_since_last = (today - last_date).days
                    
                    if days_since_last > 1:
                        # Streak quebrado - reseta apenas o current_streak para exibição
                        # mas mantém o histórico e longest_streak no banco
                        streak_data["current_streak"] = 0
                except:
                    pass
            
            # Remove campos legados se existirem
            streak_data.pop("streak_frozen", None)
            return streak_data
        
        # Se não tem dados, retorna vazio
        return _empty_streak()
    except Exception as e:
        print(f"[Streak] Erro ao buscar streak para {username}: {e}")
        return _empty_streak()


def _calculate_from_activity(username: str, db) -> dict:
    """Calcula streak baseado em dias reais de atividade."""
    try:
        # Busca todas as datas únicas onde o usuário teve atividade
        # Mensagens
        msg_rows = db.table("messages").select("date").eq("username", username).eq("role", "user").execute().data
        
        active_dates = set()
        for m in msg_rows:
            d = m.get("date")
            if d: active_dates.add(d)
        
        if not active_dates:
            return _empty_streak()
        
        # Ordena datas decrescente
        sorted_dates = sorted(list(active_dates), reverse=True)
        
        today = date.today()
        last_study_date = date.fromisoformat(sorted_dates[0])
        days_since_last = (today - last_study_date).days
        
        if days_since_last > 1:
            return {
                "current_streak": 0,
                "longest_streak": 0, # Simplificado para o cálculo inicial
                "last_study_date": sorted_dates[0],
                "total_study_days": len(active_dates),
                "study_dates": sorted_dates[:90],
            }
        
        # Conta dias consecutivos
        streak = 1
        for i in range(1, len(sorted_dates)):
            prev = date.fromisoformat(sorted_dates[i-1])
            curr = date.fromisoformat(sorted_dates[i])
            if (prev - curr).days == 1:
                streak += 1
            else:
                break
        
        return {
            "current_streak": streak,
            "longest_streak": streak,
            "last_study_date": sorted_dates[0],
            "total_study_days": len(active_dates),
            "study_dates": sorted_dates[:90],
        }
    except Exception as e:
        print(f"[Streak] Erro: {e}")
        return _empty_streak()


def _empty_streak() -> dict:
    return {
        "current_streak": 0,
        "longest_streak": 0,
        "last_study_date": None,
        "total_study_days": 0,
        "study_dates": [],
    }


def record_study_day(username: str) -> dict:
    """
    Registra atividade hoje e atualiza o streak.
    Regra: O dia só conta se houver pelo menos 3 mensagens do usuário.
    """
    db = get_client()
    today = date.today()
    today_str = today.isoformat()
    
    try:
        # 1. Conta mensagens do usuário HOJE (Chat e Voice)
        res = db.table("messages").select("id", count="exact").eq("username", username).eq("date", today_str).eq("role", "user").execute()
        msg_count = res.count or 0
        
        # 2. Busca dados atuais do streak
        row = db.table("users").select("streak_data").eq("username", username).single().execute().data
        streak_data = row.get("streak_data") if row else None
        
        if not streak_data:
            streak_data = _empty_streak()
        
        # Armazena contagem de hoje para feedback no front se necessário
        streak_data["today_messages"] = msg_count
        
        last_date_str = streak_data.get("last_study_date")
        study_dates = streak_data.get("study_dates", [])
        
        # Se já atingiu a meta hoje, não faz nada
        if last_date_str == today_str:
            return streak_data
            
        # 3. Verifica se atingiu a meta de 3 mensagens HOJE
        if msg_count < 3:
            # Ainda não atingiu a meta do dia, mas salvamos o count
            db.table("users").update({"streak_data": streak_data}).eq("username", username).execute()
            return streak_data

        # 4. Atingiu a meta! Atualiza o streak
        if last_date_str:
            last_date = date.fromisoformat(last_date_str)
            days_since_last = (today - last_date).days
            
            if days_since_last == 1:
                # Continuou ontem
                streak_data["current_streak"] += 1
            else:
                # Quebrou ou é a primeira atividade após muito tempo
                streak_data["current_streak"] = 1
        else:
            # Primeira atividade da vida
            streak_data["current_streak"] = 1
            
        # Atualiza recorde
        if streak_data["current_streak"] > streak_data.get("longest_streak", 0):
            streak_data["longest_streak"] = streak_data["current_streak"]
            
        # Adiciona data
        if today_str not in study_dates:
            study_dates.insert(0, today_str)
            streak_data["study_dates"] = study_dates[:90]
            streak_data["total_study_days"] = streak_data.get("total_study_days", 0) + 1
            
        streak_data["last_study_date"] = today_str
        
        # Salva
        db.table("users").update({
            "streak_data": streak_data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("username", username).execute()
        
        # Verifica troféus de streak
        try:
            from services.trophy_service import check_streak_trophies
            check_streak_trophies(username, streak_data.get("longest_streak", 0))
        except Exception as e:
            print(f"[Streak Trophy] Erro: {e}")
            
        return streak_data
    except Exception as e:
        print(f"[Streak] Erro ao gravar: {e}")
        return _empty_streak()


def get_streak_milestones(username: str) -> list[dict]:
    """
    Retorna os marcos de streak do usuário.
    Badges especiais: 7 dias 🔥, 30 dias 🌟, 100 dias 💎
    """
    streak_data = get_streak(username)
    current = streak_data["current_streak"]
    longest = streak_data["longest_streak"]
    
    milestones = [
        {"days": 1, "badge": "🔥", "label": "First Day", "achieved": longest >= 1},
        {"days": 3, "badge": "⭐", "label": "3 Day Streak", "achieved": longest >= 3},
        {"days": 7, "badge": "🔥", "label": "Week Warrior", "achieved": longest >= 7},
        {"days": 14, "badge": "💪", "label": "2 Week Streak", "achieved": longest >= 14},
        {"days": 30, "badge": "🌟", "label": "Monthly Master", "achieved": longest >= 30},
        {"days": 60, "badge": "🚀", "label": "2 Month Streak", "achieved": longest >= 60},
        {"days": 100, "badge": "💎", "label": "Diamond Learner", "achieved": longest >= 100},
        {"days": 365, "badge": "👑", "label": "Year Champion", "achieved": longest >= 365},
    ]
    
    return milestones
