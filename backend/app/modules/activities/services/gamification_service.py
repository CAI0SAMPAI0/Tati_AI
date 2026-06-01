import logging
"""
Serviço central de gamificação: XP, Níveis, Streaks e Metas.
"""

from typing import Dict, Any
from datetime import datetime, timezone, date
from fastapi.concurrency import run_in_threadpool
from fastapi import Depends
from app.core.dependencies.db import get_db
import asyncio


class GamificationService:
    XP_REWARDS = {
        'message_sent': 10,
        'correct_answer': 25,
        'streak_day': 5,
        'new_word': 15,
        'simulation_complete': 50,
        'goal_achieved': 30,
        'first_login': 100,
    }

    LEVELS = {
        'A1': {'min': 0, 'max': 500},
        'A2': {'min': 500, 'max': 1200},
        'B1': {'min': 1200, 'max': 2500},
        'B2': {'min': 2500, 'max': 4000},
        'C1': {'min': 4000, 'max': 6000},
        'C2': {'min': 6000, 'max': 999999},
    }

    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def _execute_db(self, func, retries=3):
        """Helper para executar chamadas de banco com retry."""
        for attempt in range(retries):
            try:
                return await run_in_threadpool(func)
            except Exception as e:
                err_str = str(e).lower()
                if ('disconnected' in err_str or 'connection' in err_str or 'protocol' in err_str) and attempt < retries - 1:
                    logging.info(
                        f'[Gamification DB] Connection issue, retrying ({
                            attempt + 1}/{retries})...')
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise e

    async def get_user_xp(self, username: str) -> Dict[str, Any]:
        """Busca dados de XP e nível do usuário."""

        def _fetch():
            res = (
                self.db.table('users')
                .select('xp_data')
                .eq('username', username)
                .single()
                .execute()
            )
            return res.data.get('xp_data') if res.data else None

        data = await self._execute_db(_fetch)
        if not data:
            return {
                'xp': 0,
                'level': 'A1',
                'level_progress': 0,
                'xp_to_next': 500}
        return data

    async def award_xp(
        self, username: str, amount: int, reason: str = ''
    ) -> Dict[str, Any]:
        """Atribui XP ao usuário e verifica level up."""
        xp_data = await self.get_user_xp(username)
        old_xp = xp_data.get('xp', 0)
        new_xp = old_xp + amount

        new_level = self._calculate_level(new_xp)
        level_up = new_level != xp_data.get('level', 'A1')

        level_config = self.LEVELS.get(new_level, self.LEVELS['A1'])
        xp_in_level = new_xp - level_config['min']
        xp_needed = level_config['max'] - level_config['min']

        updated_data = {
            'xp': new_xp,
            'level': new_level,
            'level_progress': min(100, int((xp_in_level / xp_needed) * 100)),
            'xp_to_next': level_config['max'] - new_xp,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }

        def _update():
            self.db.table('users').update({'xp_data': updated_data}).eq(
                'username', username
            ).execute()

        await self._execute_db(_update)
        updated_data['level_up'] = level_up
        return updated_data

    def _calculate_level(self, xp: int) -> str:
        for level, config in self.LEVELS.items():
            if config['min'] <= xp < config['max']:
                return level
        return 'C2'

    async def get_streak_data(self, username: str) -> Dict[str, Any]:
        """Busca dados de streak do usuário."""

        def _fetch():
            res = (
                self.db.table('users')
                .select('streak_data')
                .eq('username', username)
                .single()
                .execute()
            )
            data = res.data.get('streak_data') or {}

            earned = (
                self.db.table('user_trophies')
                .select('id')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            data['trophies_earned'] = len(earned)

            prog = (
                self.db.table('user_progress')
                .select('total_q')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            data['total_questions'] = sum(
                p.get('total_q', 0) for p in prog)

            sessions = (
                self.db.table('study_sessions')
                .select('duration_minutes')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            data['hours_saved'] = sum(s.get('duration_minutes', 0)
                                      for s in sessions) / 60.0

            return data

        data = await self._execute_db(_fetch)
        if not data.get('current_streak'):
            data['current_streak'] = 0
        if not data.get('longest_streak'):
            data['longest_streak'] = 0

        return data

    async def update_streak(self, username: str) -> Dict[str, Any]:
        """Incrementa o streak do usuário se ele praticou hoje."""
        streak_data = await self.get_streak_data(username)
        today = date.today().isoformat()
        last_date = streak_data.get('last_study_date')

        if last_date == today:
            return streak_data  # Já praticou hoje

        # Lógica de incremento simplificada
        current = streak_data.get('current_streak', 0)
        if last_date:
            from datetime import timedelta

            yesterday = (date.today() - timedelta(days=1)).isoformat()
            if last_date == yesterday:
                current += 1
            else:
                current = 1
        else:
            current = 1

        longest = max(current, streak_data.get('longest_streak', 0))

        updated_streak = {
            'current_streak': current,
            'longest_streak': longest,
            'last_study_date': today,
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }

        def _update():
            self.db.table('users').update({'streak_data': updated_streak}).eq(
                'username', username).execute()

        await self._execute_db(_update)
        return updated_streak
