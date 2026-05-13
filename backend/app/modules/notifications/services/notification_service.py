"""
services/notification_service.py
Serviço central de notificações (Push e Alertas).
"""

from typing import List, Dict, Any
from fastapi.concurrency import run_in_threadpool
from app.core.database import get_client


class NotificationService:
    def __init__(self):
        self.db = get_client()

    async def get_user_notifications(
        self, username: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Busca notificações recentes do usuário."""

        def _fetch():
            return (
                self.db.table('notifications')
                .select('*')
                .eq('username', username)
                .order('created_at', desc=True)
                .limit(limit)
                .execute()
                .data
                or []
            )

        return await run_in_threadpool(_fetch)

    async def mark_as_read(self, notification_id: str) -> bool:

        def _update():
            res = (
                self.db.table('notifications')
                .update({'is_read': True})
                .eq('id', notification_id)
                .execute()
            )
            return bool(res.data)

        return await run_in_threadpool(_update)

    async def mark_all_as_read(self, username: str) -> bool:

        def _update():
            res = (
                self.db.table('notifications')
                .update({'is_read': True})
                .eq('username', username)
                .eq('is_read', False)
                .execute()
            )
            return True

        return await run_in_threadpool(_update)

    async def send_notification(
        self, username: str, title: str, body: str, category: str = 'general'
    ) -> Dict[str, Any]:
        from datetime import datetime, timezone

        def _save():
            data = {
                'username': username,
                'title': title,
                'body': body,
                'category': category,
                'is_read': False,
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            return self.db.table('notifications').insert(data).execute().data

        return await run_in_threadpool(_save)
