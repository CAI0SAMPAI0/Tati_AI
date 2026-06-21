import logging
from typing import Optional
from app.core.database import get_client
from app.core.utils.level_utils import matches_level

DEFAULT_SIMULATIONS = [{'id': 'sim-default-1',
                        'name': 'Airport Check-in',
                        'slug': 'airport_checkin',
                        'description': 'Practice checking in for your flight and handling luggage.',
                        'icon': '✈️',
                        'emoji': '✈️',
                        'difficulty': 'A1',
                        'system_prompt': 'You are Tati, a friendly airport check-in agent at JFK Airport. Help the student check in for their flight. Ask for their passport and ticket. Ask if they have bags to check. Keep sentences simple and natural. Be patient and encouraging.',
                        'greeting': 'Good morning! I am Tati. Welcome to JFK Airport. May I see your passport and ticket, please?'},
                       {'id': 'sim-default-2',
                        'name': 'Job Interview',
                        'slug': 'job_interview',
                        'description': 'Prepare for a professional job interview in English.',
                        'icon': '💼',
                        'emoji': '💼',
                        'difficulty': 'B1',
                        'system_prompt': 'You are Tati, a hiring manager conducting a job interview. Ask the student about their background, strengths, weaknesses, and why they want this position. Challenge them with follow-up questions. Be professional but friendly.',
                        'greeting': "Good morning! I'm Tati. Thanks for coming in. Tell me a bit about yourself."},
                       {'id': 'sim-default-3',
                        'name': 'Shopping',
                        'slug': 'shopping',
                        'description': 'Practice interacting with sales assistants and buying items.',
                        'icon': '🛍️',
                        'emoji': '🛍️',
                        'difficulty': 'A1',
                        'system_prompt': 'You are Tati, a helpful sales assistant at a clothing store. Greet the student and ask if they need help finding anything. Suggest items on sale. Offer to help with sizes. Keep conversation light and friendly.',
                        'greeting': "Hi! I'm Tati. Welcome to our store. Looking for anything specific?"},
                       {'id': 'sim-default-4',
                        'name': 'At the Hotel',
                        'slug': 'at_hotel',
                        'description': 'Practice check-in, asking about amenities, and requests.',
                        'icon': '🏨',
                        'emoji': '🏨',
                        'difficulty': 'A1',
                        'system_prompt': 'You are Tati, a receptionist at the Oceanview Hotel. Help the student check in. Ask for their reservation name. Offer breakfast options. Provide information about hotel amenities. Be welcoming and professional.',
                        'greeting': "Good afternoon! I'm Tati. Welcome to the Oceanview Hotel. Checking in?"},
                       {'id': 'sim-default-5',
                        'name': 'At the Doctor',
                        'slug': 'at_doctor',
                        'description': 'Explain your symptoms and understand medical advice.',
                        'icon': '🏥',
                        'emoji': '🏥',
                        'difficulty': 'B1',
                        'system_prompt': 'You are Dr. Tatiana (Tati), a general practitioner. Ask the student about their symptoms. Ask follow-up questions about duration, severity, and other health factors. Provide reassurance and advice. Use clear, simple medical terms.',
                        'greeting': "Hi, I'm Dr. Tatiana, but you can call me Tati. What brings you in today?"},
                       {'id': 'sim-default-6',
                        'name': 'At the Restaurant',
                        'slug': 'at_restaurant',
                        'description': 'Practice ordering food and interacting with the waiter.',
                        'icon': '🍽️',
                        'emoji': '🍽️',
                        'difficulty': 'A1',
                        'system_prompt': "You are Tati, a friendly waiter at Mario's Italian Restaurant. Greet the student and ask if they want to see the menu. Take their order for drinks and food. Suggest specials. Keep conversation natural and simple.",
                        'greeting': "Good evening! I'm Tati. Welcome to Mario's Restaurant. Can I get you started with something to drink?"},
                       ]


def get_all_scenarios(level: Optional[str] = None) -> list[dict]:
    """Busca todos os cenários ativos no banco de dados e mistura com os padrões fixos."""
    db = get_client()
    try:
        # Busca TODOS os cenários no banco de dados
        res = db.table('simulations').select(
            '*').eq('is_active', True).execute()
        db_data = res.data or []

        # Mapeia por slug para evitar duplicatas
        scenarios_by_slug = {s['slug']: s for s in DEFAULT_SIMULATIONS}

        # Adiciona/Sobrescreve com dados do banco (permitindo que o
        # admin edite no banco)
        for s in db_data:
            scenarios_by_slug[s['slug']] = s

        merged = list(scenarios_by_slug.values())

        # Fetch published CEFR simulations
        try:
            cefr_res = db.table('cefr_simulations').select('*').eq('is_published', True).execute()
            cefr_data = cefr_res.data or []
            for cs in cefr_data:
                slug = f"cefr_sim_{cs['id']}"
                merged.append({
                    'id': cs['id'],
                    'name': f"CEFR {cs.get('level', 'A1')}: {cs.get('topic')}",
                    'slug': slug,
                    'description': cs.get('goal', 'Practice your English conversation skills.'),
                    'difficulty': cs.get('level', 'A1'),
                    'system_prompt': cs.get('scenario'),
                    'greeting': f"Hello! Let's practice about: {cs.get('topic')}. {cs.get('scenario')[:100]}...",
                    'icon': '🎭',
                    'emoji': '🎭'
                })
        except Exception as cefr_err:
            logging.info(f'[Simulation Service] Erro ao buscar cefr_simulations: {cefr_err}')

        # Filtra usando a lógica unificada
        filtered = [s for s in merged if matches_level(
            level, s.get('difficulty'))]
        return filtered
    except Exception as e:
        logging.info(
            f'[Simulation Service] Erro ao buscar cenários: {e}')
        # Fallback para os padrões se o banco falhar
        return [
            s for s in DEFAULT_SIMULATIONS if matches_level(
                level, s.get('difficulty'))]


def get_scenario(scenario_id: str) -> Optional[dict]:
    """Busca um cenário específico por UUID ou ID fixo."""
    # Tenta primeiro nos padrões fixos
    fixed = next(
        (s for s in DEFAULT_SIMULATIONS if s['id'] == scenario_id or s['slug'] == scenario_id),
        None)
    if fixed:
        res = fixed.copy()
        res['objectives'] = get_scenario_objectives(res.get('slug'))
        return res

    db = get_client()
    try:
        res = (
            db.table('simulations').select(
                '*').eq('id', scenario_id).single().execute()
        )
        if res.data:
            s_data = res.data.copy()
            s_data['objectives'] = get_scenario_objectives(s_data.get('slug') or scenario_id)
            return s_data
    except Exception as e:
        # Tenta buscar na tabela cefr_simulations
        try:
            cefr_res = db.table('cefr_simulations').select('*').eq('id', scenario_id).single().execute()
            if cefr_res.data:
                cs = cefr_res.data
                return {
                    'id': cs['id'],
                    'name': f"CEFR {cs.get('level', 'A1')}: {cs.get('topic')}",
                    'slug': f"cefr_sim_{cs['id']}",
                    'description': cs.get('goal', 'Practice your English conversation skills.'),
                    'difficulty': cs.get('level', 'A1'),
                    'system_prompt': cs.get('scenario'),
                    'greeting': f"Hello! Let's practice about: {cs.get('topic')}. {cs.get('scenario')[:100]}...",
                    'icon': '🎭',
                    'emoji': '🎭',
                    'objectives': get_scenario_objectives(f"cefr_sim_{cs['id']}")
                }
        except Exception:
            logging.info(
                f'[Simulation Service] Erro ao buscar cenário {scenario_id} no db e cefr_db: {e}')

    # Fallback final por slug se o ID parecer um slug
    fixed_slug = next(
        (s for s in DEFAULT_SIMULATIONS if s['slug'] == scenario_id),
        None)
    if fixed_slug:
        res = fixed_slug.copy()
        res['objectives'] = get_scenario_objectives(res.get('slug'))
        return res
    return None


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

    return {
        'score': int(score),
        'feedback': feedback,
        'feedback_en': feedback_en}


SCENARIO_OBJECTIVES = {
    'airport_checkin': [
        {'id': 'airport_1', 'text': 'Present your passport or ticket', 'keywords': ['passport', 'ticket', 'here is', 'here\'s']},
        {'id': 'airport_2', 'text': 'Confirm your checked baggage count', 'keywords': ['bag', 'luggage', 'suitcase', 'check in', 'no bags']},
        {'id': 'airport_3', 'text': 'State your seat preference (window or aisle)', 'keywords': ['window', 'aisle', 'seat']}
    ],
    'job_interview': [
        {'id': 'job_1', 'text': 'Greet the interviewer politely', 'keywords': ['hello', 'hi ', 'good morning', 'nice to meet you', 'thank you for']},
        {'id': 'job_2', 'text': 'Mention your professional strengths or skills', 'keywords': ['strength', 'skill', 'experience', 'worked', 'good at', 'focus']},
        {'id': 'job_3', 'text': 'Ask a question about the role or company', 'keywords': ['question', 'salary', 'team', 'hours', 'benefits', 'culture']}
    ],
    'shopping': [
        {'id': 'shop_1', 'text': 'Ask for a clothing item', 'keywords': ['shirt', 'pants', 'jeans', 'dress', 'jacket', 't-shirt', 'looking for']},
        {'id': 'shop_2', 'text': 'Ask about sizes', 'keywords': ['size', 'medium', 'large', 'small', 'extra large', 'fit']},
        {'id': 'shop_3', 'text': 'Inquire about the price', 'keywords': ['price', 'how much', 'cost', 'expensive', 'cheap']}
    ],
    'at_hotel': [
        {'id': 'hotel_1', 'text': 'Provide your reservation name', 'keywords': ['name', 'reservation', 'book', 'key']},
        {'id': 'hotel_2', 'text': 'Ask about breakfast hours or options', 'keywords': ['breakfast', 'eat', 'morning']},
        {'id': 'hotel_3', 'text': 'Request the Wi-Fi password', 'keywords': ['wifi', 'wi-fi', 'internet', 'password', 'connection']}
    ],
    'at_doctor': [
        {'id': 'doctor_1', 'text': 'Describe your medical symptoms', 'keywords': ['pain', 'feel', 'cough', 'fever', 'cold', 'flu', 'sick', 'hurt', 'headache', 'stomach']},
        {'id': 'doctor_2', 'text': 'State how long you have felt sick', 'keywords': ['days', 'hours', 'since', 'week', 'yesterday']},
        {'id': 'doctor_3', 'text': 'Ask for a treatment or prescription', 'keywords': ['medicine', 'pill', 'prescription', 'remedy', 'doctor', 'help']}
    ],
    'at_restaurant': [
        {'id': 'rest_1', 'text': 'Order a drink', 'keywords': ['water', 'coke', 'juice', 'soda', 'drink', 'beer', 'wine']},
        {'id': 'rest_2', 'text': 'Order your main dish', 'keywords': ['pasta', 'pizza', 'salad', 'steak', 'chicken', 'burger', 'fish', 'order']},
        {'id': 'rest_3', 'text': 'Ask for the bill', 'keywords': ['bill', 'check', 'pay', 'credit card', 'cash']}
    ]
}

DEFAULT_OBJECTIVES = [
    {'id': 'gen_1', 'text': 'Introduce yourself clearly', 'keywords': ['name', 'hello', 'hi ', 'i am', 'introduce']},
    {'id': 'gen_2', 'text': 'Explain your request or query', 'keywords': ['need', 'want', 'please', 'help', 'ask']},
    {'id': 'gen_3', 'text': 'Close the conversation politely', 'keywords': ['thank you', 'thanks', 'goodbye', 'bye', 'see you']}
]


def get_scenario_objectives(scenario_id_or_slug: str) -> list[dict]:
    """Retorna os objetivos específicos de um cenário."""
    # Encontra por slug
    slug = scenario_id_or_slug
    if scenario_id_or_slug not in SCENARIO_OBJECTIVES:
        found = next((s['slug'] for s in DEFAULT_SIMULATIONS if s['id'] == scenario_id_or_slug), None)
        if found:
            slug = found
    return SCENARIO_OBJECTIVES.get(slug, DEFAULT_OBJECTIVES)


def check_objectives_completion(scenario_id_or_slug: str, user_messages: list[str]) -> list[str]:
    """Verifica quais objetivos foram concluídos analisando as falas do usuário."""
    objectives = get_scenario_objectives(scenario_id_or_slug)
    completed_ids = []

    combined_text = " ".join(user_messages).lower()

    for obj in objectives:
        if any(kw in combined_text for kw in obj['keywords']):
            completed_ids.append(obj['id'])

    return completed_ids
