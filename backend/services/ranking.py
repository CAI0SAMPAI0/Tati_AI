"""
Serviço de Ranking de Alunos.
"""

from datetime import datetime, timezone, timedelta
from services.database import get_client

# REGRAS DE PONTUAÇÃO EXATAS
ACTION_POINTS = {
    'quiz': 7,
    'flashcard': 3,
    'message': 8,
    'simulation': 10,
}


def _empty_stats(username: str, user_map: dict) -> dict:
    return {
        'username': username,
        'name': user_map.get(username) or username,
        'avatar_url': None,
        'score': 0,
        'messages': 0,
        'quizzes': 0,
        'flashcards': 0,
        'simulations': 0,
    }


def get_ranking_data(username: str) -> dict:
    db = get_client()
    now = datetime.now(timezone.utc)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        from core.config import settings

        staff_usernames = set(settings.staff_roles)
        access = (
            db.table('student_access').select('username, role').execute().data or []
        )
        for a in access:
            if a.get('role') in ('professor', 'professora', 'programador', 'admin'):
                staff_usernames.add(a['username'])

        # Busca dados de sessões e mensagens
        actions = (
            db.table('study_sessions')
            .select('username, activity_type')
            .gte('created_at', start_month.isoformat())
            .execute()
            .data
            or []
        )
        messages = (
            db.table('messages')
            .select('username')
            .eq('role', 'user')
            .gte('created_at', start_month.isoformat())
            .execute()
            .data
            or []
        )

        stats = {}

        for a in actions:
            u = a.get('username')
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {})

            atype = a.get('activity_type')
            if atype in ACTION_POINTS:
                stats[u]['score'] += ACTION_POINTS[atype]
                if atype in ['quiz', 'flashcard', 'message', 'simulation']:
                    stats[u][f'{atype}s'] += 1

        for m in messages:
            u = m.get('username')
            if not u or u in staff_usernames:
                continue
            if u not in stats:
                stats[u] = _empty_stats(u, {})
            stats[u]['score'] += ACTION_POINTS['message']
            stats[u]['messages'] += 1

        # Tenta buscar nomes reais para todos no stats
        if stats:
            usernames = list(stats.keys())
            users = (
                db.table('users')
                .select('username, name')
                .in_('username', usernames)
                .execute()
                .data
                or []
            )
            for u_info in users:
                uname = u_info.get('username')
                if uname in stats:
                    stats[uname]['name'] = u_info.get('name') or uname

        ranking = sorted(stats.values(), key=lambda x: x['score'], reverse=True)

        return {
            'top15': ranking[:15],
            'my_position': next(
                (i + 1 for i, x in enumerate(ranking) if x['username'] == username), 0
            ),
            'winners': [],
        }
    except Exception as e:
        print(f'[Ranking] Erro: {e}')
        return {'top15': [], 'my_position': 0, 'winners': []}


def get_ranking_by_level(username: str) -> dict:
    """Retorna o ranking agrupado por níveis de proficiência."""
    db = get_client()
    now = datetime.now(timezone.utc)
    start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        # 1. Busca todos os usuários e seus níveis (excluindo admins conhecidos)
        excluded_admins = {'programador', 'professor', 'admin', 'tatiana', 'caio'}
        all_users = db.table('users').select('username, name, level').execute().data or []
        
        # Filtra a lista de usuários logo no início
        all_users = [u for u in all_users if u['username'].lower() not in excluded_admins]
        
        user_level_map = {u['username']: u.get('level', 'Beginner') for u in all_users}
        user_name_map = {u['username']: u.get('name') or u['username'] for u in all_users}

        # 2. Busca ações do mês
        actions = db.table('study_sessions').select('username, activity_type').gte('created_at', start_month.isoformat()).execute().data or []
        messages = db.table('messages').select('username').eq('role', 'user').gte('created_at', start_month.isoformat()).execute().data or []

        stats = {}
        for u_name in user_level_map.keys():
            # Passa o mapa de nomes para a função auxiliar
            stats[u_name] = _empty_stats(u_name, user_name_map)
            stats[u_name]['level'] = user_level_map[u_name]

        for a in actions:
            u = a.get('username')
            if u in stats:
                stats[u]['score'] += ACTION_POINTS.get(a.get('activity_type'), 0)
        
        for m in messages:
            u = m.get('username')
            if u in stats:
                stats[u]['score'] += ACTION_POINTS['message']

        # 3. Agrupa por categoria exata do projeto
        categories = {
            'Beginner': ['A1', 'Beginner', 'Elementary'],
            'Pre-Intermediate': ['A2', 'Pre-Intermediate'],
            'Intermediate': ['B1', 'B2', 'Intermediate', 'Upper Intermediate'],
            'Advanced': ['C1', 'Advanced', 'Mastery'],
            'Business': ['C2', 'Business', 'Business English', 'Professional']
        }

        result = {cat: [] for cat in categories.keys()}
        
        for user_stat in stats.values():
            lvl = str(user_stat.get('level', 'Beginner'))
            assigned = False
            for cat, levels in categories.items():
                if any(l.lower() in lvl.lower() for l in levels):
                    result[cat].append(user_stat)
                    assigned = True
                    break
            if not assigned:
                result['Beginner'].append(user_stat)

        # Ordena cada categoria e limita ao TOP 10
        for cat in result:
            result[cat] = sorted(result[cat], key=lambda x: x['score'], reverse=True)[:10]

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f'[Ranking] Erro by level: {e}')
        return {'Beginner': [], 'Pre-Intermediate': [], 'Intermediate': [], 'Advanced': [], 'Business': []}
