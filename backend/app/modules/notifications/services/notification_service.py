"""
Serviço central de notificações (Push e Alertas).
"""

from typing import List, Dict, Any
from fastapi.concurrency import run_in_threadpool
from fastapi import Depends
from app.core.dependencies.db import get_db


class NotificationService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def get_user_notifications(
        self, username: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Busca notificações recentes do usuário."""

        def _fetch():
            try:
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
            except Exception as e:
                import logging
                logging.error(f"[NotificationService] Erro ao buscar notificações: {e}")
                return []

        return await run_in_threadpool(_fetch)

    async def mark_as_read(
            self,
            notification_id: str,
            username: str) -> bool:
        def _update():
            try:
                res = (
                    self.db.table('notifications')
                    .update({'is_read': True})
                    .eq('id', notification_id)
                    .eq('username', username)
                    .execute()
                )
                return bool(res.data)
            except Exception as e:
                import logging
                logging.error(f"[NotificationService] Erro ao marcar como lida: {e}")
                return False

        return await run_in_threadpool(_update)

    async def mark_all_as_read(self, username: str) -> bool:

        def _update():
            try:
                res = (
                    self.db.table('notifications')
                    .update({'is_read': True})
                    .eq('username', username)
                    .eq('is_read', False)
                    .execute()
                )
                return True
            except Exception as e:
                import logging
                logging.error(f"[NotificationService] Erro ao marcar todas como lidas: {e}")
                return False

        return await run_in_threadpool(_update)

    async def send_notification(
        self, username: str, title: str, body: str, category: str = 'general'
    ) -> Dict[str, Any]:
        from datetime import datetime, timezone

        def _save():
            try:
                data = {
                    'username': username,
                    'title': title,
                    'body': body,
                    'category': category,
                    'is_read': False,
                    'created_at': datetime.now(timezone.utc).isoformat(),
                }
                return self.db.table('notifications').insert(
                    data).execute().data
            except Exception as e:
                import logging
                logging.error(f"[NotificationService] Erro ao enviar notificação: {e}")
                return {}

        return await run_in_threadpool(_save)
