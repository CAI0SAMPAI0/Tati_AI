import logging
"""
services/activity_service.py
Serviço para gerenciamento de módulos, lições e progresso em atividades.
"""

from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from app.shared.services.upstash import cache_get, cache_set, cache_delete
from app.core.utils.level_utils import matches_level
from fastapi import Depends
from app.core.dependencies.db import get_db


class ActivityService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def list_modules(self,
                           level: Optional[str] = None,
                           username: Optional[str] = None) -> List[Dict[str,
                                                                        Any]]:
        """Lista módulos filtrados por nível e inclui status do usuário se logado."""
        # Se houver usuário, não usamos cache global pois a resposta é
        # personalizada
        if not username:
            cache_key = f'modules:list:{level or "all"}'
            cached = await cache_get(cache_key)
            if cached:
                return cached

        def _fetch():
            # Busca módulos publicados.
            query = self.db.table('modules').select(
                '*, quizzes(*)').eq('is_published', True)
            try:
                data = query.order(
                    'created_at', desc=True).execute().data or []
                logging.info(
                    f"[ActivityService] Módulos carregados: {
                        len(data)}")
                for m in data:
                    if m.get(
                            'id') == '00000000-0000-0000-0000-000000000001':
                        logging.info(
                            f"[ActivityService] Módulo mestre encontrado com {
                                len(
                                    m.get(
                                        'quizzes',
                                        []))} quizzes.")
            except Exception as e:
                logging.info(
                    f"[ActivityService] Erro ao buscar módulos: {e}")
                data = query.execute().data or []

            # Se logado, busca submissões do usuário para estes módulos
            submissions_map = {}
            if username and data:
                module_ids = [m['id'] for m in data]
                subs = self.db.table('activity_submissions').select('module_id, score').eq(
                    'username', username).in_('module_id', module_ids).execute().data or []
                for s in subs:
                    # Guardamos a melhor pontuação de cada módulo
                    m_id = s['module_id']
                    if m_id not in submissions_map or s['score'] > submissions_map.get(
                            m_id, -1):
                        submissions_map[m_id] = s['score']

            # Filtro e anexação de status
            filtered = []
            MASTER_MODULE_ID = '00000000-0000-0000-0000-000000000001'
            for m in data:
                if m.get('id') == MASTER_MODULE_ID:
                    continue

                # Anexa status do usuário
                score = submissions_map.get(m['id'])
                m['user_status'] = {
                    'is_done': score is not None,
                    'score': score
                }

                # Filtro usando lógica unificada
                if matches_level(
                        level,
                        m.get('level'),
                        m.get('levels')):
                    filtered.append(m)

            return filtered

        result = await run_in_threadpool(_fetch)
        if not username:
            await cache_set(f'modules:list:{level or "all"}', result, ttl=3600)
        return result

    async def get_module_details(
            self, module_id: str) -> Optional[Dict[str, Any]]:
        """Busca detalhes de um módulo e suas lições."""
        if str(module_id).startswith('cefr_fc_'):
            parts = module_id.split('_')
            if len(parts) >= 4:
                level = parts[2].upper()

                def _fetch_cefr_fc():
                    res = self.db.table('cefr_flashcards').select(
                        '*').eq('level', level).eq('is_published', True).execute()
                    rows = res.data or []

                    import re
                    matched_rows = []
                    matched_topic = ""
                    for r in rows:
                        t = r.get('topic') or 'General Vocabulary'
                        t_slug = re.sub(r'[^a-zA-Z0-9]', '_', t.lower())
                        if t_slug == "_".join(parts[3:]):
                            matched_rows.append(r)
                            matched_topic = t

                    if not matched_rows:
                        return None

                    flashcards = []
                    for row in matched_rows:
                        flashcards.append({
                            "front": row['front'],
                            "back": row['back'],
                            "explanation": row['explanation'] or "No explanation provided.",
                            "image_url": row.get('image_url')
                        })

                    return {
                        "id": module_id,
                        "title": f"CEFR {level}: {matched_topic}",
                        "description": f"Vocabulary deck about {matched_topic}.",
                        "level": level,
                        "flashcards": flashcards,
                        "lessons": []}
                return await run_in_threadpool(_fetch_cefr_fc)
            return None

        def _fetch():
            try:
                module = (
                    self.db.table('modules')
                    .select('*')
                    .eq('id', module_id)
                    .single()
                    .execute()
                    .data
                )
            except Exception:
                # .single() throws if 0 rows found
                try:
                    rows = self.db.table('modules').select(
                        '*').eq('id', module_id).execute().data or []
                    module = rows[0] if rows else None
                except Exception:
                    return None
            if not module:
                return None
            try:
                lessons = (
                    self.db.table('lessons')
                    .select('*')
                    .eq('module_id', module_id)
                    .order('order', desc=False)
                    .execute()
                    .data
                    or []
                )
            except Exception:
                lessons = []
            module['lessons'] = lessons
            return module

        return await run_in_threadpool(_fetch)

    async def get_ranking(
        self, category: str = 'global', limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Busca o ranking de usuários, filtrando staff."""
        cache_key = f'ranking:{category}:{limit}'
        cached = await cache_get(cache_key)
        if cached:
            return cached

        def _fetch():
            # Busca um pouco mais para compensar os filtrados
            data = (
                self.db.table('users')
                .select('username, name, xp_data')
                .order('xp_data->xp', desc=True)
                .limit(limit + 10)
                .execute()
                .data
                or []
            )
            excluded = {
                'programador',
                'professor',
                'admin',
                'caio',
                'tati'}
            return [u for u in data if u['username']
                    not in excluded][:limit]

        ranking = await run_in_threadpool(_fetch)
        await cache_set(cache_key, ranking, ttl=300)
        return ranking

    async def get_user_submissions(
            self, username: str) -> List[Dict[str, Any]]:
        """Busca histórico de atividades de um usuário."""
        try:
            def _fetch():
                return self.db.table('activity_submissions').select('*, modules(title)').eq(
                    'username', username).order('created_at', desc=True).execute().data or []
            return await run_in_threadpool(_fetch)
        except Exception as e:
            logging.info(
                f'[ActivityService] Erro ao buscar submissões: {e}')
            return []

    async def get_weekly_tasks(self, username: str) -> Dict[str, Any]:
        """Consolida atividades pendentes para o Weekly Goal."""
        def _fetch():
            # 1. Busca IDs de quizzes concluídos via submissions
            done_quizzes = self.db.table('activity_submissions').select('metadata').eq(
                'username', username).eq('activity_type', 'quiz').execute().data or []
            done_ids = {str(r['metadata'].get('quiz_id')) for r in done_quizzes if r.get(
                'metadata') and r['metadata'].get('quiz_id')}

            # 2. Quizzes pendentes (não feitos)
            # Quizzes não parecem ter filtro de username, mas de active.
            all_quizzes = self.db.table('quizzes').select(
                'id, title, description, module_id').eq('is_active', True).execute().data or []
            pending_quizzes = [
                q for q in all_quizzes if str(q['id']) not in done_ids]

            # 3. Exercícios IA (personalized_quiz) pendentes via
            # attempts
            attempts = self.db.table('user_exercise_attempts').select('exercise_id').eq(
                'username', username).eq('status', 'pending').execute().data or []

            # 4. Simulações pendentes (Tabela pode não existir ainda)
            try:
                sims = self.db.table('simulation_attempts').select('simulation_id').eq(
                    'username', username).eq('status', 'not_started').execute().data or []
            except Exception:
                sims = []

            logging.info(f"[WeeklyGoalDebug] User: {username}")
            logging.info(
                f"[WeeklyGoalDebug] Done Quizzes: {
                    len(done_ids)}")
            logging.info(
                f"[WeeklyGoalDebug] Pending Quizzes: {
                    len(pending_quizzes)}")
            logging.info(
                f"[WeeklyGoalDebug] Pending AI Exercises: {
                    len(attempts)}")
            logging.info(
                f"[WeeklyGoalDebug] Pending Simulations: {
                    len(sims)}")

            return {
                'quizzes': pending_quizzes,
                'ai_exercises': attempts,
                'simulations': sims
            }
        return await run_in_threadpool(_fetch)

    async def get_all_submissions(self) -> List[Dict[str, Any]]:
        """Busca todas as submissões (admin)."""
        try:
            def _fetch():
                return self.db.table('activity_submissions').select(
                    '*, modules(title), users(name)').order('created_at', desc=True).limit(200).execute().data or []
            return await run_in_threadpool(_fetch)
        except Exception as e:
            logging.info(
                f'[ActivityService] Erro ao buscar todas as submissões: {e}')
            return []

    async def list_all_modules_admin(self) -> List[Dict[str, Any]]:
        """Lista todos os módulos (admin), ignorando aqueles que são puramente decks de flashcards."""
        def _fetch():
            # Busca módulos com dados de quiz e lições para determinar
            # se são puramente de flashcards
            try:
                data = self.db.table('modules').select(
                    '*, quizzes(*), lessons(*)').order('created_at', desc=True).execute().data or []
            except BaseException:
                # Fallback se a expansão falhar
                data = self.db.table('modules').select(
                    '*').order('created_at', desc=True).execute().data or []
                # Busca quiz e lições separadamente para cada módulo
                # (menos eficiente mas funcional)
                for module in data:
                    module_id = module.get('id')
                    try:
                        quizzes = self.db.table('quizzes').select(
                            '*').eq('module_id', module_id).execute().data or []
                        module['quizzes'] = quizzes
                    except BaseException:
                        module['quizzes'] = []
                    try:
                        lessons = self.db.table('lessons').select(
                            '*').eq('module_id', module_id).execute().data or []
                        module['lessons'] = lessons
                    except BaseException:
                        module['lessons'] = []

            # Filtra fora apenas os módulos que são PURAMENTE decks de flashcards
            # Ou seja: tem flashcards E NÃO tem quiz E NÃO tem lições
            filtered_modules = []
            for module in data:
                flashcards = module.get('flashcards') or []
                quizzes = module.get('quizzes') or []
                lessons = module.get('lessons') or []

                # É um deck puramente de flashcards se: tem flashcards E
                # não tem quiz E não tem lições
                is_pure_flashcard_deck = len(flashcards) > 0 and len(
                    quizzes) == 0 and len(lessons) == 0

                # Mantemos o módulo se NÃO for um deck puramente de
                # flashcards
                if not is_pure_flashcard_deck:
                    filtered_modules.append(module)

            return filtered_modules
        return await run_in_threadpool(_fetch)

    async def record_submission(
        self,
        username: str,
        module_id: str,
        activity_type: str,
        score: int,
        metadata: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Registra uma submissão de atividade."""

        def _save():
            data = {
                'username': username,
                'module_id': module_id,
                'activity_type': activity_type,
                'score': score,
                'metadata': metadata or {},
                'created_at': 'now()',
            }
            return self.db.table('activity_submissions').insert(
                data).execute().data

        return await run_in_threadpool(_save)

    async def save_correction(
        self,
        submission_id: str,
        teacher_feedback: str,
        score: int,
    ) -> dict:
        """Salva correção manual do professor em uma submissão."""
        from datetime import datetime, timezone

        def _update() -> dict:
            payload = {
                'teacher_feedback': teacher_feedback,
                'score': score,
                'status': 'corrected',
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }
            result = (
                self.db.table('activity_submissions')
                .update(payload)
                .eq('id', submission_id)
                .execute()
            )
            return result.data[0] if result.data else {}

        return await run_in_threadpool(_update)

    async def ai_correct_submission(
        self, submission_id: str, lang: str = 'pt-BR'
    ) -> dict:
        """Gera feedback automatizado via IA para uma submissão."""
        from app.modules.chat.services.llm import groq_chat

        def _fetch() -> dict:
            result = (
                self.db.table('activity_submissions')
                .select('*, modules(title)')
                .eq('id', submission_id)
                .single()
                .execute()
            )
            return result.data or {}

        submission = await run_in_threadpool(_fetch)
        if not submission:
            return {'ai_feedback': '', 'score': 0}

        answer = submission.get('student_answer', '')
        module_title = (submission.get('modules') or {}
                        ).get('title', 'Activity')

        prompt = (
            f'You are an English teacher. Evaluate this student answer for the activity '
            f'\'{module_title}\'. Provide constructive feedback and a score 0-100. '
            f'Reply in {lang}. Answer: {answer[:800]}\n\n'
            f'Return JSON: {{"ai_feedback": "...", "score": N}}'
        )
        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json([{'role': 'user', 'content': prompt}])

            if not data:
                return {
                    'ai_feedback': 'Could not generate feedback automatically.',
                    'score': 70}

            ai_feedback = str(data.get('ai_feedback', ''))
            score = int(data.get('score', 70))
        except Exception as exc:
            logging.info(
                f'[ActivityService] Erro na correção IA: {exc}')
            ai_feedback = 'Could not generate feedback automatically.'
            score = 70

        def _save_ai() -> dict:
            payload = {
                'ai_feedback': ai_feedback,
                'score': score,
            }
            result = (
                self.db.table('activity_submissions')
                .update(payload)
                .eq('id', submission_id)
                .execute()
            )
            return result.data[0] if result.data else {}

        await run_in_threadpool(_save_ai)
        return {'ai_feedback': ai_feedback, 'score': score}

    async def save_module(self,
                          data: Dict[str,
                                     Any],
                          module_id: Optional[str] = None) -> Dict[str,
                                                                   Any]:
        """Cria ou atualiza um módulo e seus componentes (quiz)."""
        def _save():
            # Filtra apenas campos permitidos pelo schema
            optional_fields = {
                'image_url',
                'youtube_url',
                'spotify_url',
                'flashcards',
                'icon',
                'levels',
                'order',
                'ai_prompt',
                'file_url'}
            core_fields = {
                'title',
                'description',
                'level',
                'is_published'}
            allowed_fields = core_fields | optional_fields

            # Converte strings vazias em None para limpar no banco de
            # dados
            filtered_data = {}
            for k, v in data.items():
                if k in allowed_fields:
                    # Se for string vazia, vira None para o Supabase
                    # entender como NULL
                    filtered_data[k] = v if v != '' else None

            # Garantir level (NOT NULL constraint - Fix 23502)
            if not filtered_data.get('level'):
                # Busca do dado original se não estiver no filtered
                lvls = data.get('levels', [])
                filtered_data['level'] = lvls[0] if (
                    isinstance(lvls, list) and lvls) else 'all'

            if filtered_data.get('level'):
                filtered_data['level'] = filtered_data['level'].lower()

            if filtered_data.get('levels'):
                filtered_data['levels'] = [lvl.lower()
                                           for lvl in filtered_data['levels']]

            def _do_upsert(payload):
                if module_id:
                    res = self.db.table('modules').update(
                        payload).eq('id', module_id).execute()
                    return res, module_id
                else:
                    res = self.db.table('modules').insert(
                        payload).execute()
                    mid = res.data[0]['id'] if res.data else None
                    return res, mid

            try:
                res, final_module_id = _do_upsert(filtered_data)
            except Exception as e:
                err_str = str(e)
                if 'PGRST204' in err_str or 'column' in err_str.lower():
                    # Se a coluna 'file_url' estiver faltando, tentamos
                    # sem ela
                    if 'file_url' in err_str:
                        logging.info(
                            "[ActivityService] Coluna 'file_url' não encontrada no banco. Tentando sem ela...")
                        safe_data = {
                            k: v for k, v in filtered_data.items() if k != 'file_url'}
                        res, final_module_id = _do_upsert(safe_data)
                    else:
                        # Fallback geral para campos básicos se houver
                        # outro erro de coluna
                        core_only = {
                            k: v for k, v in filtered_data.items() if k in core_fields}
                        logging.info(
                            f'[ActivityService] Erro de schema. Tentando apenas campos core: {
                                list(
                                    core_only.keys())}')
                        res, final_module_id = _do_upsert(core_only)
                else:
                    raise

            # Salvar Quiz se fornecido
            quiz_data = data.get('quiz')
            if quiz_data and final_module_id:
                # 1. Cria/Atualiza Quiz Principal
                quiz_payload = {
                    'module_id': final_module_id,
                    'title': quiz_data.get(
                        'title',
                        filtered_data.get(
                            'title',
                            'Quiz')),
                    'is_active': True}

                # Busca se já existe um quiz para este módulo
                existing_quiz = self.db.table('quizzes').select(
                    'id').eq('module_id', final_module_id).execute().data
                if existing_quiz:
                    quiz_id = existing_quiz[0]['id']
                    self.db.table('quizzes').update(
                        quiz_payload).eq('id', quiz_id).execute()
                else:
                    q_res = self.db.table('quizzes').insert(
                        quiz_payload).execute()
                    quiz_id = q_res.data[0]['id'] if q_res.data else None

                # 2. Salvar Questões
                questions = quiz_data.get('questions', [])
                if quiz_id and questions:
                    # Remove questões antigas (simplificação de
                    # sincronização)
                    self.db.table('quiz_questions').delete().eq(
                        'quiz_id', quiz_id).execute()

                    # Insere novas
                    prepared_questions = []
                    for i, q in enumerate(questions):
                        options = q.get('options', [])
                        if not options:
                            continue

                        # Tenta extrair o índice correto de várias
                        # formas
                        correct_index = q.get('correct_index')
                        if correct_index is None:
                            # Tenta pelo campo 'answer' (valor literal
                            # da resposta)
                            answer = q.get('answer')
                            if answer in options:
                                correct_index = options.index(answer)
                            else:
                                correct_index = 0

                        try:
                            correct_index = int(correct_index)
                        except BaseException:
                            correct_index = 0

                        prepared_questions.append({
                            'quiz_id': quiz_id,
                            'question': q.get('question', 'Question'),
                            'options': options,
                            'correct_index': correct_index,
                            'explanation': q.get('explanation', ''),
                            'order': i
                        })

                    if prepared_questions:
                        self.db.table('quiz_questions').insert(
                            prepared_questions).execute()

            # Desabilitado: Notificação global de nova atividade
            """
            if not module_id and filtered_data.get('is_published'):
                try:
                    from app.modules.notifications.services.notifications import notify_all_students
                    notify_all_students(
                        category='new_module',
                        title='New Activity Available! 📚',
                        message=f"New quiz available: {filtered_data.get('title', 'English Practice')}. Try it now!",
                        url='/activities.html'
                    )
                except Exception as e:
                    logging.info(f'[ActivityService] Erro ao notificar novo módulo: {e}')
            """

            return res.data[0] if res.data else {}

        result = await run_in_threadpool(_save)
        await cache_delete('modules:list:all')
        return result

    async def delete_module(self, module_id: str) -> bool:
        """Exclui um módulo e suas dependências."""
        def _delete():
            # Deletar dependências que violam FK (Postgrest 23503)
            try:
                self.db.table('activity_submissions').delete().eq(
                    'module_id', module_id).execute()
            except BaseException:
                pass

            try:
                self.db.table('user_exercise_attempts').delete().eq(
                    'module_id', module_id).execute()
            except BaseException:
                pass

            try:
                self.db.table('lessons').delete().eq(
                    'module_id', module_id).execute()
            except BaseException:
                pass

            try:
                self.db.table('quizzes').delete().eq(
                    'module_id', module_id).execute()
            except BaseException:
                pass

            self.db.table('modules').delete().eq(
                'id', module_id).execute()

        await run_in_threadpool(_delete)
        await cache_delete('modules:list:all')
        return True

    async def upload_file(
            self,
            contents: bytes,
            filename: str,
            content_type: str) -> str:
        """Faz upload de arquivo para o storage do Supabase."""
        import uuid
        import os

        # BUCKET deve existir no Supabase
        BUCKET = 'module-files'
        ext = os.path.splitext(filename)[1].lower()
        new_filename = f"{uuid.uuid4()}{ext}"

        def _upload():
            from app.core.database import get_client
            db = get_client()
            # Tenta criar o bucket se não existir
            try:
                db.storage.create_bucket(
                    BUCKET, options={'public': True})
            except BaseException:
                pass

            db.storage.from_(BUCKET).upload(
                path=new_filename,
                file=contents,
                file_options={'content-type': content_type}
            )
            return db.storage.from_(BUCKET).get_public_url(new_filename)

        return await run_in_threadpool(_upload)

    async def generate_flashcards(
            self, theme: str, level: str, module_id: Optional[str] = None) -> Dict[str, Any]:
        """Gera um deck de flashcards via IA em Inglês."""
        from app.modules.chat.services.llm import groq_chat

        prompt = (
            f'Create a high-quality English vocabulary flashcard deck about "{theme}". '
            f'Level: {level}. Count: 10 cards. '
            f'Format: JSON {{"title": "{theme} Vocabulary", "description": "...", "cards": [{{"front": "term", "back": "definition/example"}}]}}. '
            f'Focus strictly on "{theme}". All text in English.'
        )
        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json([{'role': 'user', 'content': prompt}])

            if not data:
                return {'ok': False}

            cards = data.get('cards', [])

            # Se solicitado geração automática de imagens (ou se quisermos oferecer isso)
            # Para não ser muito lento, podemos gerar apenas se o
            # usuário pedir explicitamente via flag
            if data.get('generate_images') or theme.startswith('IMG:'):
                from app.modules.chat.services.llm import generate_image
                from app.shared.services.cloudinary_service import upload_image_from_url

                for card in cards:
                    img_prompt = f"{card['front']}: {card['back']}"
                    img_url = await generate_image(img_prompt)
                    if img_url:
                        perm_url = await run_in_threadpool(upload_image_from_url, img_url)
                        card['image_url'] = perm_url

            # Salva como um módulo de flashcards (ajustado para o schema
            # real)
            def _save_mod():
                payload = {
                    'title': data.get(
                        'title',
                        theme.replace(
                            'IMG:',
                            '')),
                    'description': data.get(
                        'description',
                        f'Flashcards sobre {theme}'),
                    'level': level,
                    'flashcards': cards,
                    'is_published': True}
                if module_id:
                    return self.db.table('modules').update(
                        payload).eq('id', module_id).execute().data
                else:
                    payload['order'] = 99
                    return self.db.table('modules').insert(
                        payload).execute().data

            mod_res = await run_in_threadpool(_save_mod)

            if mod_res:
                from app.core.database import cache_delete
                await cache_delete('modules:list:all')
                return {'ok': True, 'id': mod_res[0]['id']}

            return {'ok': False}
        except Exception as e:
            logging.info(
                f'[ActivityService] Erro ao gerar flashcards: {e}')
            return {'ok': False}
