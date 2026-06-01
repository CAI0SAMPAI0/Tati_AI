"""
services/progress_service.py
Serviço para gerenciamento de progresso, rankings e planos semanais.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from fastapi.concurrency import run_in_threadpool
from fastapi import Depends
from app.core.dependencies.db import get_db
from app.shared.services.upstash import cache_get, cache_set, cache_delete
from app.modules.users.services.progress_report import get_weekly_report, get_monthly_report


class ProgressService:
    def __init__(self, db: Any = Depends(get_db)):
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def get_weekly_report(self, username: str) -> Dict[str, Any]:
        cache_key = f'report:weekly:{username}'
        # Invalida cache antigo para garantir dados frescos
        await cache_delete(cache_key)
        res = await run_in_threadpool(get_weekly_report, username)
        await cache_set(cache_key, res, ttl=1800)
        return res

    async def get_monthly_report(self, username: str) -> Dict[str, Any]:
        cache_key = f'report:monthly:{username}'
        # Invalida cache antigo para garantir dados frescos
        await cache_delete(cache_key)
        res = await run_in_threadpool(get_monthly_report, username)
        await cache_set(cache_key, res, ttl=3600)
        return res

    async def get_study_time(self, username: str) -> Dict[str, Any]:
        def _fetch():
            now = datetime.now(timezone.utc)
            week_ago = now - timedelta(days=7)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_end = month_start - timedelta(days=1)
            last_month_start = last_month_end.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            three_months_ago = now - timedelta(days=90)

            sessions = (
                self.db.table('study_sessions')
                .select('*')
                .eq('username', username)
                .execute()
                .data
                or []
            )

            this_week, this_month, last_month, last_3_months = 0, 0, 0, 0
            for s in sessions:
                val = s.get('duration_minutes', 0)
                created = s.get('created_at')
                if not created:
                    continue
                dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                if dt >= week_ago:
                    this_week += val
                if dt >= month_start:
                    this_month += val
                if last_month_start <= dt <= last_month_end:
                    last_month += val
                if dt >= three_months_ago:
                    last_3_months += val

            return {
                'this_week': this_week,
                'this_month': this_month,
                'last_month': last_month,
                'last_3_months': last_3_months,
            }

        return await run_in_threadpool(_fetch)

    async def get_all_trophies(self, username: str) -> Dict[str, Any]:
        cache_key = f'trophies_all:{username}'
        cached = await cache_get(cache_key)
        if cached:
            return cached

        def _fetch():
            earned = (
                self.db.table('user_trophies')
                .select('trophy_id')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            earned_ids = {e['trophy_id'] for e in earned}

            # Simplified metrics fetch for progress
            stats = (
                self.db.table('users')
                .select('streak_data')
                .eq('username', username)
                .single()
                .execute()
                .data
                or {}
            )
            streak_obj = stats.get('streak_data') or {}
            streak_obj.get('current_streak', 0)

            all_trophies = self.db.table('trophies').select('*').execute().data or []
            medals = []
            for t in all_trophies:
                unlocked = t['id'] in earned_ids
                req_val = t.get('requirement_value') or 1
                cur_val = req_val if unlocked else 0  # Simplificado
                medals.append(
                    {
                        'id': t['id'],
                        'name': t.get('name'),
                        'description': t.get('description'),
                        'icon': t.get('icon', '🏆'),
                        'unlocked': unlocked,
                        'current_val': cur_val,
                        'required_val': req_val,
                        'progress_pct': round((cur_val / req_val) * 100)
                        if req_val
                        else 0,
                        'category': t.get('category', 'all'),
                    }
                )
            return {
                'earned': len(earned_ids),
                'total': len(all_trophies),
                'medals': medals,
            }

        res = await run_in_threadpool(_fetch)
        await cache_set(cache_key, res, ttl=300)
        return res

    async def get_ranking_position(
        self, username: str, user_name: str
    ) -> Dict[str, Any]:
        cache_key = f'ranking:position:{username}'
        cached = await cache_get(cache_key)
        if cached:
            return cached

        # Real logic would involve calling _calculate_rankings from original code
        # For now, let's restore the helper logic or move it here
        from app.modules.users.routes.progress import _calculate_rankings

        def _fetch():
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            rankings = _calculate_rankings(self.db, month_start)
            for i, entry in enumerate(rankings):
                if entry['username'] == username:
                    return {
                        'position': i + 1,
                        'name': entry.get('name', user_name),
                        'score': entry.get('score', 0),
                    }
            return {'position': len(rankings) + 1, 'name': user_name, 'score': 0}

        res = await run_in_threadpool(_fetch)
        await cache_set(cache_key, res, ttl=300)
        return res

    async def get_top_15_ranking(self) -> List[Dict[str, Any]]:
        cache_key = 'ranking:top15'
        cached = await cache_get(cache_key)
        if cached:
            return cached

        from app.modules.users.routes.progress import _calculate_rankings

        def _fetch():
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            rankings = _calculate_rankings(self.db, month_start)
            return rankings[:15]

        res = await run_in_threadpool(_fetch)
        await cache_set(cache_key, res, ttl=300)
        return res

    async def get_winners(self) -> Dict[str, Any]:
        from app.modules.users.routes.progress import _calculate_rankings

        def _fetch():
            now = datetime.now(timezone.utc)
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_month_end = month_start - timedelta(days=1)
            last_month_start = last_month_end.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            rankings = _calculate_rankings(self.db, last_month_start, last_month_end)
            return {
                'month': f'{last_month_start.month:02d}/{last_month_start.year}',
                'winners': [
                    {
                        'username': r['username'],
                        'name': r.get('name'),
                        'score': r['score'],
                        'position': i + 1,
                    }
                    for i, r in enumerate(rankings[:3])
                ],
            }

        return await run_in_threadpool(_fetch)

    async def get_weekly_plan(
        self, username: str, level: str, focus: str
    ) -> Dict[str, Any]:
        from app.modules.activities.services.weekly_plan import get_or_generate_weekly_plan

        return await get_or_generate_weekly_plan(username, level, focus)

    async def check_plan_progress(self, username: str) -> Dict[str, Any]:
        from app.modules.activities.services.weekly_plan import check_plan_progress

        progress = await check_plan_progress(username=username)
        return {'progress': progress}

    async def start_plan_transition(self, username: str) -> Dict[str, Any]:
        from app.modules.activities.services.weekly_plan import (
            check_plan_progress,
            generate_transition_exercises,
        )

        await check_plan_progress(username=username)
        result = await generate_transition_exercises(username=username)
        return result
