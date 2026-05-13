"""
services/submission_service.py
Serviço para submissão e correção de atividades abertas.
"""

from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from app.core.database import get_client


class SubmissionService:
    def __init__(self):
        self.db = get_client()

    async def submit_activity(self, username: str, payload: Any) -> str:
        """Aluno envia atividade."""

        def _insert():
            res = (
                self.db.table('activity_submissions')
                .insert(
                    {
                        'username': username,
                        'module_id': payload.module_id,
                        'activity_type': payload.activity_type,
                        'student_answer': payload.student_answer,
                        'status': 'pending',
                    }
                )
                .execute()
            )

            # Registra para ranking
            try:
                self.db.table('study_sessions').insert(
                    {
                        'username': username,
                        'activity_type': payload.activity_type or 'exercise',
                        'duration_minutes': 3,
                    }
                ).execute()
            except Exception:
                pass

            return res.data[0]['id']

        return await run_in_threadpool(_insert)

    async def get_my_submissions(self, username: str) -> List[Dict[str, Any]]:
        """Busca submissões do aluno."""

        def _fetch():
            return (
                self.db.table('activity_submissions')
                .select('*, modules(title)')
                .eq('username', username)
                .order('created_at', desc=True)
                .execute()
                .data
                or []
            )

        return await run_in_threadpool(_fetch)

    async def list_all_admin(
        self, status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Admin: lista todas as submissões."""

        def _fetch():
            query = (
                self.db.table('activity_submissions')
                .select('*, users(name), modules(title)')
                .order('created_at', desc=True)
            )
            if status:
                query = query.eq('status', status)
            return query.execute().data or []

        return await run_in_threadpool(_fetch)

    async def correct_submission(
        self, sub_id: str, feedback: Optional[str], score: Optional[int]
    ) -> bool:
        """Admin: corrige submissão."""

        def _update():
            self.db.table('activity_submissions').update(
                {
                    'teacher_feedback': feedback,
                    'score': score,
                    'status': 'corrected',
                }
            ).eq('id', sub_id).execute()

        await run_in_threadpool(_update)
        return True

    async def get_submission_by_id(self, sub_id: str) -> Optional[Dict[str, Any]]:
        """Busca submissão por ID."""

        def _fetch():
            return (
                self.db.table('activity_submissions')
                .select('*, modules(title)')
                .eq('id', sub_id)
                .single()
                .execute()
                .data
            )

        return await run_in_threadpool(_fetch)
