import logging
"""
Serviço de Streaks (dias consecutivos de estudo).
Gerencia o acompanhamento de dias consecutivos que o aluno praticou.
"""

import asyncio
from datetime import date, datetime, timezone
from fastapi.concurrency import run_in_threadpool
from app.core.database import get_client


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _calculate_current_streak(streak_data: dict, today: date) -> int:
    """Helper puramente lógico para testes de streak."""
    study_dates = streak_data.get('study_dates', [])
    if not study_dates:
        return 0

    # Ordena datas decrescente (garante que a mais recente é a primeira)
    sorted_dates = sorted([date.fromisoformat(d)
                           for d in study_dates], reverse=True)

    last_study_date = sorted_dates[0]
    days_since_last = (today - last_study_date).days

    if days_since_last > 1:
        return 0

    streak = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i - 1] - sorted_dates[i]).days == 1:
            streak += 1
        else:
            break
    return streak


async def _execute_db(func, retries=3):
    """Helper para executar chamadas de banco com retry."""
    for attempt in range(retries):
        try:
            return await run_in_threadpool(func)
        except Exception as e:
            err_str = str(e).lower()
            if ('disconnected' in err_str or 'connection' in err_str or 'protocol' in err_str) and attempt < retries - 1:
                logging.info(
                    f'[Streak DB] Connection issue, retrying ({
                        attempt + 1}/{retries})...')
                await asyncio.sleep(0.5 * (attempt + 1))
                continue


async def apply_streak_freeze_if_needed(streak_data: dict, username: str) -> bool:
    if not streak_data:
        return False

    last_date_str = streak_data.get('last_study_date')
    if not last_date_str:
        return False

    try:
        last_date = date.fromisoformat(last_date_str)
    except Exception:
        return False

    today = _today()
    days_since_last = (today - last_date).days
    freeze_count = streak_data.get('streak_freeze_count', 0) or 0

    if days_since_last > 1 and freeze_count > 0:
        from datetime import timedelta
        streak_data['streak_freeze_count'] = freeze_count - 1
        yesterday = today - timedelta(days=1)
        streak_data['last_study_date'] = yesterday.isoformat()

        def _update():
            db = get_client()
            db.table('users').update({
                'streak_data': streak_data,
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }).eq('username', username).execute()

        await _execute_db(_update)
        return True

    return False


async def get_streak(username: str) -> dict:
    """Retorna o streak atual do usuário baseado em ATIVIDADE REAL."""
    def _fetch():
        db = get_client()
        return (
            db.table('users')
            .select('streak_data')
            .eq('username', username)
            .single()
            .execute()
            .data
        )

    try:
        row = await _execute_db(_fetch)
        streak_data = row.get('streak_data') if row else None

        if streak_data:
            await apply_streak_freeze_if_needed(streak_data, username)
            last_date_str = streak_data.get('last_study_date')
            if last_date_str:
                try:
                    last_date = date.fromisoformat(last_date_str)
                    today = _today()
                    days_since_last = (today - last_date).days
                    if days_since_last > 1:
                        streak_data['current_streak'] = 0
                except Exception:
                    pass
            streak_data.pop('streak_frozen', None)
            return streak_data
        return _empty_streak()
    except Exception as e:
        logging.info(
            f'[Streak] Erro ao buscar streak para {username}: {e}')
        return _empty_streak()


def _empty_streak() -> dict:
    return {
        'current_streak': 0,
        'longest_streak': 0,
        'last_study_date': None,
        'total_study_days': 0,
        'study_dates': [],
    }


async def record_study_day(username: str, is_activity: bool = False) -> dict:
    """Registra atividade hoje e atualiza o streak."""
    await get_streak(username)

    def _record():
        db = get_client()
        today = _today()
        today_str = today.isoformat()

        # 1. Conta mensagens do usuário HOJE
        res = (
            db.table('messages')
            .select('id', count='exact')
            .eq('username', username)
            .eq('date', today_str)
            .eq('role', 'user')
            .execute()
        )
        msg_count = res.count or 0

        # 2. Busca dados atuais
        row = (
            db.table('users')
            .select('streak_data')
            .eq('username', username)
            .single()
            .execute()
            .data
        )
        streak_data = row.get('streak_data') if row else None
        if not streak_data:
            streak_data = _empty_streak()

        streak_data['today_messages'] = msg_count
        last_date_str = streak_data.get('last_study_date')
        previous_streak = int(streak_data.get('current_streak') or 0)
        study_dates = streak_data.get('study_dates', [])

        if last_date_str == today_str:
            return streak_data

        # 3. Qualquer atividade ou pelo menos 1 mensagem conta!
        if msg_count < 1 and not is_activity:
            db.table('users').update({'streak_data': streak_data}).eq(
                'username', username).execute()
            return streak_data

        # 4. Atingiu a meta!
        if last_date_str:
            last_date = date.fromisoformat(last_date_str)
            days_since_last = (today - last_date).days
            if days_since_last == 1:
                streak_data['current_streak'] += 1
            else:
                streak_data['current_streak'] = 1
        else:
            streak_data['current_streak'] = 1

        if streak_data['current_streak'] > streak_data.get(
                'longest_streak', 0):
            streak_data['longest_streak'] = streak_data['current_streak']

        if today_str not in study_dates:
            study_dates.insert(0, today_str)
            streak_data['study_dates'] = study_dates[:90]
            streak_data['total_study_days'] = streak_data.get(
                'total_study_days', 0) + 1

        streak_data['last_study_date'] = today_str

        db.table('users').update({
            'streak_data': streak_data,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('username', username).execute()

        return streak_data, previous_streak

    try:
        result = await _execute_db(_record)
        
        # Invalida o cache do Redis para forçar atualização no dashboard
        try:
            from app.shared.services.upstash import invalidate_user_cache
            await invalidate_user_cache(username)
        except Exception:
            pass

        if isinstance(result, tuple):
            streak_data, previous_streak = result
            # Background tasks (Trophies/Notifs)
            try:
                from app.modules.activities.services.trophy_service import check_streak_trophies
                check_streak_trophies(
                    username, streak_data.get('longest_streak', 0))
            except Exception:
                pass

            try:
                from app.modules.notifications.services.notifications import notify_streak_milestone, should_notify_streak_milestone
                new_streak = int(streak_data.get('current_streak') or 0)
                if should_notify_streak_milestone(
                        previous_streak, new_streak):
                    notify_streak_milestone(username, new_streak)
            except Exception:
                pass

            return streak_data
        return result
    except Exception as e:
        logging.info(f'[Streak] Erro ao gravar: {e}')
        return _empty_streak()



async def get_streak_milestones(username: str) -> list[dict]:
    streak_data = await get_streak(username)
    longest = streak_data['longest_streak']

    milestones = [
        {'days': 1, 'badge': '🔥', 'label': 'First Day', 'achieved': longest >= 1},
        {'days': 3, 'badge': '⭐', 'label': '3 Day Streak', 'achieved': longest >= 3},
        {'days': 7, 'badge': '🔥', 'label': 'Week Warrior', 'achieved': longest >= 7},
        {'days': 14, 'badge': '💪', 'label': '2 Week Streak', 'achieved': longest >= 14},
        {'days': 30, 'badge': '🌟', 'label': 'Monthly Master',
            'achieved': longest >= 30},
        {'days': 60, 'badge': '🚀', 'label': '2 Month Streak',
            'achieved': longest >= 60},
        {'days': 100, 'badge': '💎', 'label': 'Diamond Learner',
            'achieved': longest >= 100},
        {'days': 365, 'badge': '👑', 'label': 'Year Champion',
            'achieved': longest >= 365},
    ]
    return milestones
