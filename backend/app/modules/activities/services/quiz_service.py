import logging
"""
services/quiz_service.py
Serviço para gerenciamento de quizzes e geração dinâmica de questões.
"""

from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from fastapi import Depends
from app.core.dependencies.db import get_db


class QuizService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def get_quiz(self, quiz_id: str, username: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Busca um quiz e suas questões com embaralhamento determinístico."""
        quiz = None
        if str(quiz_id).startswith('cefr_'):
            parts = quiz_id.split('_')
            if len(parts) >= 3:
                level = parts[1].upper()

                def _fetch_cefr():
                    res = self.db.table('cefr_exercises').select(
                        '*').eq('level', level).eq('is_published', True).execute()
                    rows = res.data or []

                    import re
                    matched_rows = []
                    matched_topic = ""
                    for r in rows:
                        t = r.get('topic') or 'General Practice'
                        t_slug = re.sub(r'[^a-zA-Z0-9]', '_', t.lower())
                        if t_slug == "_".join(parts[2:]):
                            matched_rows.append(r)
                            matched_topic = t

                    if not matched_rows:
                        return None

                    questions = []
                    for idx, row in enumerate(matched_rows):
                        questions.append({
                            "id": str(row['id']),
                            "quiz_id": quiz_id,
                            "question": row['question'],
                            "options": row['options'],
                            "correct_index": row['correct_index'],
                            "explanation": row['explanation'] or "No explanation provided.",
                            "order": idx
                        })

                    return {
                        "id": quiz_id,
                        "title": f"CEFR {level}: {matched_topic}",
                        "description": f"AI-generated quiz from your materials about {matched_topic}. Explanations always in English to help you learn!",
                        "module_id": "00000000-0000-0000-0000-000000000001",
                        "module_title": "Personalized Practice",
                        "questions": questions}
                quiz = await run_in_threadpool(_fetch_cefr)
        else:
            def _fetch():
                quiz_data = (
                    self.db.table('quizzes')
                    .select('*, modules(title, description, image_url, youtube_url, spotify_url, file_url)')
                    .eq('id', quiz_id)
                    .single()
                    .execute()
                    .data
                )
                if not quiz_data:
                    return None

                # Map module fields
                mod = quiz_data.get('modules') or {}
                if mod:
                    quiz_data['module_title'] = mod.get('title')
                    quiz_data['description'] = mod.get('description')
                    quiz_data['image_url'] = mod.get('image_url')
                    quiz_data['youtube_url'] = mod.get('youtube_url')
                    quiz_data['spotify_url'] = mod.get('spotify_url')
                    # remove to avoid confusing frontend
                    quiz_data['file_url'] = mod.get('file_url')
                    del quiz_data['modules']
                questions_data = (
                    self.db.table('quiz_questions')
                    .select('*')
                    .eq('quiz_id', quiz_id)
                    .order('order', desc=False)
                    .execute()
                    .data
                    or []
                )
                quiz_data['questions'] = questions_data
                return quiz_data

            quiz = await run_in_threadpool(_fetch)

        if not quiz:
            return None

        # Embaralhamento determinístico se username for fornecido
        if username and quiz.get('questions'):
            import random
            import hashlib

            seed_str = f"{username}_{quiz_id}"
            seed_int = int(hashlib.md5(seed_str.encode('utf-8')).hexdigest(), 16)
            rng = random.Random(seed_int)

            questions_list = list(quiz['questions'])
            rng.shuffle(questions_list)

            for q in questions_list:
                if q.get('options') and len(q['options']) > 1:
                    opts = list(q['options'])
                    correct_opt = opts[q['correct_index']]
                    rng.shuffle(opts)
                    q['options'] = opts
                    q['correct_index'] = opts.index(correct_opt)

            quiz['questions'] = questions_list

        return quiz

    async def evaluate_submission(
        self, username: str, quiz_id: str, answers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Avalia as respostas de um quiz."""
        quiz = await self.get_quiz(quiz_id)
        if not quiz:
            return {'error': 'Quiz not found'}

        questions = quiz.get('questions', [])
        correct_count = 0
        total = len(questions)

        # Mapeamento de respostas corretas
        correct_map = {str(q['id']): q['correct_index']
                       for q in questions}

        for ans in answers:
            q_id = str(ans.get('question_id'))
            if q_id in correct_map and ans.get(
                    'selected_index') == correct_map[q_id]:
                correct_count += 1

        score = int((correct_count / total) * 100) if total > 0 else 0

        # Busca o module_id real (quizzes pertencem a módulos)
        real_module_id = quiz.get('module_id')

        # Salva resultado em background na tabela unificada
        def _save():
            self.db.table('activity_submissions').insert(
                {
                    'username': username,
                    'module_id': real_module_id,
                    'activity_type': 'quiz',
                    'score': score,
                    'status': 'done',
                    'metadata': {
                        'quiz_id': quiz_id,
                        'correct_count': correct_count,
                        'total': total,
                        'passed': score >= 70
                    }
                }
            ).execute()

        await run_in_threadpool(_save)

        # 🏆 Gamification
        try:
            import asyncio
            from app.modules.activities.services.gamification_service import GamificationService
            from app.modules.users.services.streaks import record_study_day
            gs = GamificationService()
            # XP reward: proportional to score (e.g., 100% -> 50 XP, 70%
            # -> 35 XP)
            xp_reward = int(score * 0.5)
            if xp_reward > 0:
                asyncio.create_task(
                    gs.award_xp(
                        username,
                        xp_reward,
                        f"Quiz: {
                            quiz.get(
                                'title',
                                'Practice')}"))
            asyncio.create_task(record_study_day(username, is_activity=True))
        except Exception as e:
            logging.info(f'[QuizService] Error awarding XP / streak: {e}')

        return {
            'score': score,
            'correct_count': correct_count,
            'total': total,
            'passed': score >= 70,
        }

    async def generate_module_quiz(self,
                                   title: str,
                                   level: str,
                                   context: str,
                                   num_questions: int = 5) -> Dict[str,
                                                                   Any]:
        """Gera um quiz completo para um módulo."""
        return await self.generate_dynamic_quiz(f"{title} ({context})", level, num_questions=num_questions)

    async def generate_dynamic_quiz(
            self, topic: str, level: str, num_questions: int = 5) -> Dict[str, Any]:
        """Gera um quiz dinâmico usando LLM baseado em um tópico."""
        from app.modules.chat.services.llm import groq_chat_json
        prompt = (
            f'Create a professional English language pedagogical quiz strictly about the topic "{topic}". '
            f'Target student level: {level}. '
            f'Generate exactly {num_questions} multiple choice questions. '
            f'CRITICAL: All questions, options AND explanations MUST be entirely in English. '
            f'Never use Portuguese in any field. '
            f'Avoid generic questions; focus strictly on "{topic}". '
            f'Return ONLY valid JSON: '
            f'{{"title": "...", "questions": [{{"question": "...", "options": ["...", "...", "..."], "correct_index": 0, "explanation": "..."}}]}}.'
        )

        try:
            data = await groq_chat_json([{'role': 'user', 'content': prompt}])
            if not data:
                return {}
            if 'title' in data and 'quiz_title' not in data:
                data['quiz_title'] = data['title']
            return data
        except Exception as e:
            logging.info(f'[QuizService] Erro ao gerar quiz: {e}')
            return {}
