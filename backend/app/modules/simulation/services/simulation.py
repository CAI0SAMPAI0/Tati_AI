from typing import Optional
from app.core.database import get_client
from app.core.utils.level_utils import matches_level

DEFAULT_SIMULATIONS = [
    {
        'id': 'sim-default-1',
        'name': 'Airport Check-in',
        'slug': 'airport_checkin',
        'description': 'Practice checking in for your flight and handling luggage.',
        'icon': '✈️',
        'emoji': '✈️',
        'difficulty': 'Beginner',
        'system_prompt': 'You are Tati, a friendly airport check-in agent at JFK Airport. Help the student check in for their flight. Ask for their passport and ticket. Ask if they have bags to check. Keep sentences simple and natural. Be patient and encouraging.',
        'greeting': 'Good morning! I am Tati. Welcome to JFK Airport. May I see your passport and ticket, please?'
    },
    {
        'id': 'sim-default-2',
        'name': 'Job Interview',
        'slug': 'job_interview',
        'description': 'Prepare for a professional job interview in English.',
        'icon': '💼',
        'emoji': '💼',
        'difficulty': 'Intermediate',
        'system_prompt': 'You are Tati, a hiring manager conducting a job interview. Ask the student about their background, strengths, weaknesses, and why they want this position. Challenge them with follow-up questions. Be professional but friendly.',
        'greeting': "Good morning! I'm Tati. Thanks for coming in. Tell me a bit about yourself."
    },
    {
        'id': 'sim-default-3',
        'name': 'Shopping',
        'slug': 'shopping',
        'description': 'Practice interacting with sales assistants and buying items.',
        'icon': '🛍️',
        'emoji': '🛍️',
        'difficulty': 'Beginner',
        'system_prompt': 'You are Tati, a helpful sales assistant at a clothing store. Greet the student and ask if they need help finding anything. Suggest items on sale. Offer to help with sizes. Keep conversation light and friendly.',
        'greeting': "Hi! I'm Tati. Welcome to our store. Looking for anything specific?"
    },
    {
        'id': 'sim-default-4',
        'name': 'At the Hotel',
        'slug': 'at_hotel',
        'description': 'Practice check-in, asking about amenities, and requests.',
        'icon': '🏨',
        'emoji': '🏨',
        'difficulty': 'Beginner',
        'system_prompt': 'You are Tati, a receptionist at the Oceanview Hotel. Help the student check in. Ask for their reservation name. Offer breakfast options. Provide information about hotel amenities. Be welcoming and professional.',
        'greeting': "Good afternoon! I'm Tati. Welcome to the Oceanview Hotel. Checking in?"
    },
    {
        'id': 'sim-default-5',
        'name': 'At the Doctor',
        'slug': 'at_doctor',
        'description': 'Explain your symptoms and understand medical advice.',
        'icon': '🏥',
        'emoji': '🏥',
        'difficulty': 'Intermediate',
        'system_prompt': 'You are Dr. Tatiana (Tati), a general practitioner. Ask the student about their symptoms. Ask follow-up questions about duration, severity, and other health factors. Provide reassurance and advice. Use clear, simple medical terms.',
        'greeting': "Hi, I'm Dr. Tatiana, but you can call me Tati. What brings you in today?"
    },
    {
        'id': 'sim-default-6',
        'name': 'At the Restaurant',
        'slug': 'at_restaurant',
        'description': 'Practice ordering food and interacting with the waiter.',
        'icon': '🍽️',
        'emoji': '🍽️',
        'difficulty': 'Beginner',
        'system_prompt': "You are Tati, a friendly waiter at Mario's Italian Restaurant. Greet the student and ask if they want to see the menu. Take their order for drinks and food. Suggest specials. Keep conversation natural and simple.",
        'greeting': "Good evening! I'm Tati. Welcome to Mario's Restaurant. Can I get you started with something to drink?"
    },
]


def get_all_scenarios(level: Optional[str] = None) -> list[dict]:
    """Busca todos os cenários ativos no banco de dados e mistura com os padrões fixos."""
    db = get_client()
    try:
        # Busca TODOS os cenários no banco de dados
        res = db.table('simulations').select('*').eq('is_active', True).execute()
        db_data = res.data or []
        
        # Mapeia por slug para evitar duplicatas
        scenarios_by_slug = {s['slug']: s for s in DEFAULT_SIMULATIONS}
        
        # Adiciona/Sobrescreve com dados do banco (permitindo que o admin edite no banco)
        for s in db_data:
            scenarios_by_slug[s['slug']] = s
            
        merged = list(scenarios_by_slug.values())
        
        # Filtra usando a lógica unificada
        filtered = [s for s in merged if matches_level(level, s.get('difficulty'))]
        return filtered
    except Exception as e:
        print(f'[Simulation Service] Erro ao buscar cenários: {e}')
        # Fallback para os padrões se o banco falhar
        return [s for s in DEFAULT_SIMULATIONS if matches_level(level, s.get('difficulty'))]


def get_scenario(scenario_id: str) -> Optional[dict]:
    """Busca um cenário específico por UUID ou ID fixo."""
    # Tenta primeiro nos padrões fixos
    fixed = next((s for s in DEFAULT_SIMULATIONS if s['id'] == scenario_id or s['slug'] == scenario_id), None)
    if fixed:
        return fixed

    db = get_client()
    try:
        res = (
            db.table('simulations').select('*').eq('id', scenario_id).single().execute()
        )
        if res.data:
            return res.data
    except Exception as e:
        print(f'[Simulation Service] Erro ao buscar cenário {scenario_id}: {e}')
    
    # Fallback final por slug se o ID parecer um slug
    return next((s for s in DEFAULT_SIMULATIONS if s['slug'] == scenario_id), None)


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
