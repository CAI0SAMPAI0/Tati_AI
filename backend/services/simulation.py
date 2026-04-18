"""
Serviço de Simulação de Conversas Reais.
Agora totalmente integrado ao Banco de Dados (Supabase).
"""
from typing import Optional
from services.database import get_client

def get_all_scenarios() -> list[dict]:
    """Busca todos os cenários ativos no banco de dados."""
    db = get_client()
    try:
        res = db.table("simulations").select("*").order("name").execute()
        return res.data or []
    except Exception as e:
        print(f"[Simulation Service] Erro ao buscar cenários: {e}")
        return []

def get_scenario(scenario_id: str) -> Optional[dict]:
    """Busca um cenário específico por UUID."""
    db = get_client()
    try:
        res = db.table("simulations").select("*").eq("id", scenario_id).single().execute()
        return res.data
    except Exception as e:
        print(f"[Simulation Service] Erro ao buscar cenário {scenario_id}: {e}")
        return None

def get_scenario_prompt(scenario_id: str) -> Optional[str]:
    """Retorna o system_prompt de um cenário."""
    scenario = get_scenario(scenario_id)
    if scenario:
        return scenario.get("system_prompt")
    return None

def evaluate_simulation(messages: list[dict]) -> dict:
    """
    Avalia a performance do aluno na simulação.
    """
    user_messages = [m for m in messages if m.get("role") == "user"]
    total_user_msgs = len(user_messages)
    
    if total_user_msgs == 0:
        return {
            "score": 0,
            "feedback": "Você não participou da conversa.",
            "feedback_en": "You didn't participate in the conversation."
        }
    
    total_length = sum(len(m.get("content", "")) for m in user_messages)
    avg_length = total_length / total_user_msgs
    
    # Score simplificado
    score = min(100, (total_user_msgs * 15) + (avg_length // 2))
    
    if score >= 80:
        feedback = "Excelente! Você manteve o diálogo com naturalidade."
        feedback_en = "Excellent! You kept the dialogue naturally."
    elif score >= 50:
        feedback = "Bom trabalho. Tente elaborar frases mais longas na próxima."
        feedback_en = "Good job. Try to use longer sentences next time."
    else:
        feedback = "Continue praticando para ganhar confiança na fala."
        feedback_en = "Keep practicing to gain confidence in speaking."
    
    return {
        "score": int(score),
        "feedback": feedback,
        "feedback_en": feedback_en
    }
