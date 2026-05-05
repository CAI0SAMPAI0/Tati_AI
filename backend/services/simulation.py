from typing import Optional
from services.database import get_client
from core.level_utils import matches_level

DEFAULT_SIMULATIONS = [
    {
        'id': 'sim-default-1',
        'name': 'Coffee Shop Order',
        'description': 'Order a drink and snack politely.',
        'difficulty': 'Beginner',
        'system_prompt': 'You are Tati, a barista. Roleplay a coffee shop. Keep it practical and friendly.',
    },
    {
        'id': 'sim-default-2',
        'name': 'Hotel Check-in',
        'description': 'Check in, ask about breakfast and Wi‑Fi.',
        'difficulty': 'Pre-Intermediate',
        'system_prompt': 'You are Tati at a hotel front desk. Ask simple check-in questions and answer naturally.',
    },
    {
        'id': 'sim-default-3',
        'name': 'Job Interview Basics',
        'description': 'Practice common interview questions.',
        'difficulty': 'Intermediate',
        'system_prompt': 'You are Tati, an interviewer. Ask one interview question at a time and give short follow-ups.',
    },
    {
        'id': 'sim-default-4',
        'name': 'Airport Immigration',
        'description': 'Answer travel and document questions.',
        'difficulty': 'Intermediate',
        'system_prompt': 'You are Tati, an immigration officer. Ask clear travel questions and react realistically.',
    },
    {
        'id': 'sim-default-5',
        'name': 'Client Meeting',
        'description': 'Discuss project status and priorities.',
        'difficulty': 'Advanced',
        'system_prompt': 'You are Tati in a professional meeting. Encourage clear explanations and negotiation language.',
    },
    {
        'id': 'sim-default-6',
        'name': 'Debate a News Topic',
        'description': 'Discuss opinions with arguments and examples.',
        'difficulty': 'Advanced',
        'system_prompt': 'You are Tati moderating a discussion. Ask for opinions, reasons, examples and counterpoints.',
    },
]


def get_all_scenarios(level: Optional[str] = None) -> list[dict]:
    """Busca todos os cenários ativos no banco de dados e filtra por nível em memória."""
    db = get_client()
    try:
        # Busca TODOS os cenários no banco de dados
        res = db.table('simulations').select('*').execute()
        data = res.data or []
        
        # Filtra usando a lógica unificada
        merged = data if data else DEFAULT_SIMULATIONS
        filtered = [s for s in merged if matches_level(level, s.get('difficulty'))]
        return filtered
    except Exception as e:
        print(f'[Simulation Service] Erro ao buscar cenários: {e}')
        return []


def get_scenario(scenario_id: str) -> Optional[dict]:
    """Busca um cenário específico por UUID."""
    db = get_client()
    try:
        res = (
            db.table('simulations').select('*').eq('id', scenario_id).single().execute()
        )
        return res.data
    except Exception as e:
        print(f'[Simulation Service] Erro ao buscar cenário {scenario_id}: {e}')
        return next((s for s in DEFAULT_SIMULATIONS if s['id'] == scenario_id), None)


def get_scenario_prompt(scenario_id: str) -> Optional[str]:
    """Retorna o system_prompt de um cenário."""
    scenario = get_scenario(scenario_id)
    if scenario:
        return scenario.get('system_prompt')
    return None


def evaluate_simulation(messages: list[dict]) -> dict:
    """
    Avalia a performance do aluno na simulação.
    """
    user_messages = [m for m in messages if m.get('role') == 'user']
    total_user_msgs = len(user_messages)

    if total_user_msgs == 0:
        return {
            'score': 0,
            'feedback': 'Você não participou da conversa.',
            'feedback_en': "You didn't participate in the conversation.",
        }

    total_length = sum(len(m.get('content', '')) for m in user_messages)
    avg_length = total_length / total_user_msgs

    # Score simplificado
    score = min(100, (total_user_msgs * 15) + (avg_length // 2))

    if score >= 80:
        feedback = 'Excelente! Você manteve o diálogo com naturalidade.'
        feedback_en = 'Excellent! You kept the dialogue naturally.'
    elif score >= 50:
        feedback = 'Bom trabalho. Tente elaborar frases mais longas na próxima.'
        feedback_en = 'Good job. Try to use longer sentences next time.'
    else:
        feedback = 'Continue praticando para ganhar confiança na fala.'
        feedback_en = 'Keep practicing to gain confidence in speaking.'

    return {'score': int(score), 'feedback': feedback, 'feedback_en': feedback_en}
