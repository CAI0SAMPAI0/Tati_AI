"""
services/quiz_service.py
Serviço para gerenciamento de quizzes e geração dinâmica de questões.
"""

from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from app.modules.chat.services.llm import groq_chat
from fastapi import Depends
from supabase import Client
from app.core.dependencies.db import get_db


class QuizService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def get_quiz(self, quiz_id: str) -> Optional[Dict[str, Any]]:
        """Busca um quiz e suas questões."""

        def _fetch():
            quiz = (
                self.db.table('quizzes')
                .select('*, modules(title, description, image_url, youtube_url, spotify_url, file_url)')
                .eq('id', quiz_id)
                .single()
                .execute()
                .data
            )
            if not quiz:
                return None

            # Map module fields
            mod = quiz.get('modules') or {}
            if mod:
                quiz['module_title'] = mod.get('title')
                quiz['description'] = mod.get('description')
                quiz['image_url'] = mod.get('image_url')
                quiz['youtube_url'] = mod.get('youtube_url')
                quiz['spotify_url'] = mod.get('spotify_url')
                quiz['file_url'] = mod.get('file_url')                # remove to avoid confusing frontend
                del quiz['modules']
            questions = (
                self.db.table('quiz_questions')
                .select('*')
                .eq('quiz_id', quiz_id)
                .order('order', desc=False)
                .execute()
                .data
                or []
            )
            quiz['questions'] = questions
            return quiz

        return await run_in_threadpool(_fetch)

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
        correct_map = {str(q['id']): q['correct_index'] for q in questions}

        for ans in answers:
            q_id = str(ans.get('question_id'))
            if q_id in correct_map and ans.get('selected_index') == correct_map[q_id]:
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
            gs = GamificationService()
            # XP reward: proportional to score (e.g., 100% -> 50 XP, 70% -> 35 XP)
            xp_reward = int(score * 0.5)
            if xp_reward > 0:
                asyncio.create_task(gs.award_xp(username, xp_reward, f"Quiz: {quiz.get('title', 'Practice')}"))
        except Exception as e:
            print(f'[QuizService] Error awarding XP: {e}')

        return {
            'score': score,
            'correct_count': correct_count,
            'total': total,
            'passed': score >= 70,
        }

    async def generate_module_quiz(self, title: str, level: str, context: str, num_questions: int = 5) -> Dict[str, Any]:
        """Gera um quiz completo para um módulo."""
        return await self.generate_dynamic_quiz(f"{title} ({context})", level, num_questions=num_questions)

    async def generate_dynamic_quiz(self, topic: str, level: str, num_questions: int = 5) -> Dict[str, Any]:
        """Gera um quiz dinâmico usando LLM baseado em um tópico."""
        from app.modules.chat.services.llm import groq_chat_json
        prompt = (
            f'Create a professional English language pedagogical quiz strictly about the topic "{topic}". '
            f'Target student level: {level}. '
            f'Generate exactly {num_questions} multiple choice questions. '
            f'CRITICAL: All questions and options MUST be in English. '
            f'THE EXPLANATION FIELD MUST BE IN PORTUGUESE to help the student understand. '
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
            print(f'[QuizService] Erro ao gerar quiz: {e}')
            return {}
