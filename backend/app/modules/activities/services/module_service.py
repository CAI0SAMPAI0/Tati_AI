"""
services/module_service.py
Serviço para gerenciamento de módulos, conteúdos e flashcards.
"""

from typing import List, Dict, Any
import uuid
import os
from fastapi import UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool
from app.core.database import get_client
from app.shared.services.upstash import cache_delete, cache_get, cache_set


class ModuleService:
    def __init__(self):
        self.db = get_client()

    async def list_all_admin(self) -> List[Dict[str, Any]]:
        """Lista todos os módulos para admin."""

        def _fetch():
            return (
                self.db.table('modules')
                .select('*')
                .order('created_at', desc=True)
                .execute()
                .data
                or []
            )

        return await run_in_threadpool(_fetch)

    async def create_module(self, payload: Any) -> str:
        """Cria um módulo completo."""
        try:

            def _insert_mod():
                mod_res = (
                    self.db.table('modules')
                    .insert(
                        {
                            'title': payload.title,
                            'description': payload.description,
                            'level': payload.levels[0]
                            if payload.levels
                            else 'Beginner',
                            'levels': payload.levels,
                            'order': payload.order,
                            'is_published': False,
                            'flashcards': [f.model_dump() for f in payload.flashcards]
                            if payload.flashcards
                            else [],
                            'ai_prompt': payload.ai_prompt if hasattr(payload, 'ai_prompt') else None,
                        }
                    )
                    .execute()
                )
                return mod_res.data[0]['id']

            mod_id = await run_in_threadpool(_insert_mod)

            if payload.contents:

                def _insert_contents():
                    self.db.table('module_contents').insert(
                        [
                            {'module_id': mod_id, **c.model_dump()}
                            for c in payload.contents
                        ]
                    ).execute()

                await run_in_threadpool(_insert_contents)

            if payload.quiz and payload.quiz.questions:

                def _insert_quiz():
                    q_res = (
                        self.db.table('quizzes')
                        .insert({'module_id': mod_id, 'title': payload.quiz.title})
                        .execute()
                    )
                    quiz_id = q_res.data[0]['id']
                    self.db.table('quiz_questions').insert(
                        [
                            {'quiz_id': quiz_id, **q.model_dump()}
                            for q in payload.quiz.questions
                        ]
                    ).execute()

                await run_in_threadpool(_insert_quiz)

            await cache_delete('modules:list:all')
            return mod_id
        except Exception as e:
            raise HTTPException(500, f'Erro ao criar módulo: {str(e)}')

    async def update_module(self, module_id: str, payload: Any) -> bool:
        """Atualiza um módulo completo."""
        try:
            update_data = {
                'title': payload.title,
                'description': payload.description,
                'levels': payload.levels,
                'level': payload.levels[0] if payload.levels else 'Beginner',
                'order': payload.order,
                'flashcards': [f.model_dump() for f in payload.flashcards],
                'ai_prompt': payload.ai_prompt if hasattr(payload, 'ai_prompt') else None,
            }
            if payload.is_published is not None:
                update_data['is_published'] = payload.is_published

            def _update():
                self.db.table('modules').update(update_data).eq(
                    'id', module_id
                ).execute()
                if payload.contents is not None:
                    self.db.table('module_contents').delete().eq(
                        'module_id', module_id
                    ).execute()
                    if payload.contents:
                        self.db.table('module_contents').insert(
                            [
                                {'module_id': module_id, **c.model_dump()}
                                for c in payload.contents
                            ]
                        ).execute()

                if payload.quiz is not None:
                    self.db.table('quizzes').delete().eq(
                        'module_id', module_id
                    ).execute()
                    if payload.quiz.questions:
                        q_res = (
                            self.db.table('quizzes')
                            .insert(
                                {'module_id': module_id, 'title': payload.quiz.title}
                            )
                            .execute()
                        )
                        quiz_id = q_res.data[0]['id']
                        self.db.table('quiz_questions').insert(
                            [
                                {'quiz_id': quiz_id, **q.model_dump()}
                                for q in payload.quiz.questions
                            ]
                        ).execute()

            await run_in_threadpool(_update)
            await cache_delete('modules:list:all')
            return True
        except Exception as e:
            raise HTTPException(500, f'Erro ao atualizar módulo: {str(e)}')

    async def delete_module(self, module_id: str) -> bool:
        """Deleta um módulo."""

        def _delete():
            self.db.table('modules').delete().eq('id', module_id).execute()

        await run_in_threadpool(_delete)
        await cache_delete('modules:list:all')
        return True

    async def upload_content_file(self, file: UploadFile) -> str:
        """Faz upload de arquivo para o storage."""
        BUCKET = 'module-contents'
        filename = f'{uuid.uuid4()}{os.path.splitext(file.filename)[1].lower()}'
        file_content = await file.read()

        def _upload():
            self.db.storage.from_(BUCKET).upload(
                path=filename,
                file=file_content,
                file_options={'content-type': file.content_type},
            )
            return self.db.storage.from_(BUCKET).get_public_url(filename)

        return await run_in_threadpool(_upload)

    async def list_for_student(self, user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Lista módulos para o aluno com progresso."""
        username = user['username']
        user_level = user.get('level') or 'Beginner'
        cache_key = f'modules:list:{username}'

        cached = await cache_get(cache_key)
        if cached:
            return cached

        PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001'

        def _fetch_data():
            modules = (
                self.db.table('modules')
                .select('*, quizzes(id, title, description)')
                .or_(f'is_published.eq.true,id.eq.{PERSONALIZED_MODULE_ID}')
                .order('order')
                .execute()
                .data
                or []
            )
            progress = (
                self.db.table('user_progress')
                .select('quiz_id, score')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            status_rows = []
            try:
                status_rows = (
                    self.db.table('user_exercise_attempts')
                    .select('exercise_id, status')
                    .eq('username', username)
                    .eq('activity_type', 'quiz')
                    .execute()
                    .data
                    or []
                )
            except Exception:
                pass
            return modules, progress, status_rows

        modules_data, progress_data, status_rows = await run_in_threadpool(_fetch_data)

        attempts_map = {}
        for p in progress_data:
            qid = p['quiz_id']
            attempts_map[qid] = attempts_map.get(qid, 0) + 1

        status_map = {
            str(row.get('exercise_id')): row.get('status') or 'pending'
            for row in status_rows
            if row.get('exercise_id')
        }

        filtered = []
        for m in modules_data:
            lvls = m.get('levels') or []
            sing = m.get('level')
            show = (
                m.get('id') == PERSONALIZED_MODULE_ID
                or (not lvls and not sing)
                or any(x in lvls for x in ['all', 'todos'])
                or sing in ['all', 'todos']
                or user_level in lvls
                or user_level == sing
            )
            if show:
                quizzes = m.get('quizzes', [])
                for q in quizzes:
                    q['attempts'] = attempts_map.get(q['id'], 0)
                    if m.get('id') == PERSONALIZED_MODULE_ID:
                        default_status = 'pending' if q['attempts'] == 0 else 'done'
                        q['status'] = status_map.get(str(q['id']), default_status)
                m['has_quiz'] = len(quizzes) > 0
                m['has_flashcards'] = (
                    isinstance(m.get('flashcards'), list)
                    and len(m.get('flashcards', [])) > 0
                )
                filtered.append(m)

        await cache_set(cache_key, filtered, ttl=600)
        return filtered

    async def get_module_detail(self, module_id: str) -> Dict[str, Any]:
        """Busca detalhes de um módulo."""

        def _fetch():
            mod = (
                self.db.table('modules')
                .select('*')
                .eq('id', module_id)
                .single()
                .execute()
                .data
            )
            if not mod:
                return None
            contents = (
                self.db.table('module_contents')
                .select('*')
                .eq('module_id', module_id)
                .order('order')
                .execute()
                .data
                or []
            )
            quizzes_raw = (
                self.db.table('quizzes')
                .select('id, title, description')
                .eq('module_id', module_id)
                .execute()
                .data
                or []
            )
            quizzes = []
            for q in quizzes_raw:
                questions = (
                    self.db.table('quiz_questions')
                    .select('*')
                    .eq('quiz_id', q['id'])
                    .order('order')
                    .execute()
                    .data
                    or []
                )
                quizzes.append({**q, 'questions': questions})
            return {**mod, 'contents': contents, 'quizzes': quizzes}

        res = await run_in_threadpool(_fetch)
        if not res:
            raise HTTPException(404, 'Módulo não encontrado')
        return res
