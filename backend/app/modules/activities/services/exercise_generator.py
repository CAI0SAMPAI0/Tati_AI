from __future__ import annotations

import logging
from typing import Dict, Any, List, Optional
from app.core.dependencies.db import get_db
from fastapi import Depends

from fastapi.concurrency import run_in_threadpool

from app.modules.chat.services.llm import groq_chat_json
from app.modules.chat.services.prompt_builder import build_exercise_prompt

PERSONALIZED_MODULE_ID = '00000000-0000-0000-0000-000000000001'


class ExerciseGeneratorService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def generate_exercises_from_targets(
        self,
        username: str,
        training_targets: List[Dict[str, Any]],
        exercise_type: str = 'quiz',
        title: Optional[str] = None,
        attempt_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Gera exercícios baseados em padrões específicos de erro detectados.

        Args:
            username: Identificação do aluno
            training_targets: Lista de dicionários com padrões de erro (vindo do ErrorLogService)
            exercise_type: Tipo de exercício (quiz, story, fill_in, dialogue)
        """
        if not training_targets:
            logging.info(
                f'[ExerciseGen] Nenhum target de treino fornecido para {username}')
            return None

        # Seleciona os top 3 padrões mais críticos para focar o
        # exercício
        primary_targets = training_targets[:3]

        # Monta contexto estruturado dos erros
        error_context = self._build_error_context(primary_targets)

        # Busca nível do aluno para adequar dificuldade
        user_level = 'Intermediate'
        try:
            def _get_lvl():
                return self.db.table('users').select('level').eq(
                    'username', username).single().execute()
            user_res = await run_in_threadpool(_get_lvl)
            if user_res.data:
                user_level = user_res.data.get('level', 'Intermediate')
        except Exception:
            pass

        # Gera o conteúdo do exercício
        exercise_data = await self._generate_exercise_content(
            error_context=error_context,
            exercise_type=exercise_type,
            targets=primary_targets,
            user_level=user_level
        )

        if not exercise_data:
            # Atualiza tentativa como falhada para não re-tentar
            # imediatamente
            try:
                if attempt_id:
                    self.db.table('user_exercise_attempts').update(
                        {'status': 'failed'}).eq('id', attempt_id).execute()
            except Exception:
                pass
            return None

        # Persiste no banco e vincula aos padrões
        quiz_id = await self._persist_exercise(
            username=username,
            exercise_data=exercise_data,
            exercise_type=exercise_type,
            targets=primary_targets,
            title=title
        )

        # Atualiza tentativa para referenciar o quiz gerado
        try:
            if attempt_id and quiz_id:
                self.db.table('user_exercise_attempts').update(
                    {'exercise_id': quiz_id, 'status': 'pending'}).eq('id', attempt_id).execute()
        except Exception:
            pass

        return quiz_id

    def _build_error_context(
            self, targets: List[Dict[str, Any]]) -> str:
        """
        Constrói um contexto rico baseado nos padrões de erro estruturados.
        """
        context_parts = []

        for target in targets:
            pattern_key = target.get('pattern_key', 'unknown')
            category = target.get('category', 'grammar')
            incorrect = target.get('incorrect_text', '')
            correct = target.get('correct_text', '')
            explanation = target.get('explanation', '')
            frequency = target.get('frequency', 1)

            context_parts.append(f"""
Padrão detectado: {pattern_key}
Categoria: {category}
Erro comum: "{incorrect}" -> Correto: "{correct}"
Explicação: {explanation}
Frequência: {frequency} ocorrências
---""")

        return "\n".join(context_parts)

    async def _generate_exercise_content(
        self,
        error_context: str,
        exercise_type: str,
        targets: List[Dict[str, Any]],
        user_level: str = 'Intermediate'
    ) -> Optional[Dict[str, Any]]:
        """
        Chama o LLM para gerar o exercício baseado nos padrões específicos.
        """

        # Prompts específicos por tipo, mas agora com contexto
        # estruturado
        type_instructions = {
            'quiz': (
                "STRICT CONSTRAINTS:\n"
                "1. DO NOT generate general English questions (like 'How are you?', 'What is your name?', 'Where are you from?').\n"
                "2. DO NOT use examples from your internal knowledge unless they directly relate to the patterns above.\n"
                "3. EVERY question must specifically test the student's ability to distinguish between the 'Incorrect' and 'Correct' forms provided in the patterns.\n"
                "4. FOR GRAMMAR ERRORS (like Subject-Verb Agreement, Verb Tenses): Use 'fill-in-the-blank' format. Example: 'I ____ (am/are/is) a student.'\n"
                "5. THE INCORRECT FORMS must be present as distractors.\n"
                "6. DO NOT use labels like 'A)', 'B)', 'C)', 'D)' in the options. Return ONLY the plain text of the options.\n"
                "7. Return ONLY valid JSON.\n"
                "8. If the student made a mistake like 'I are', the question MUST be about that specific subject-verb agreement.\n"
                'Return JSON: {"title": "...", "description": "...", "exercises": '
                '[{"question": "...", "options": ["Correct Option", "Distractor 1", "Distractor 2", "Distractor 3"], "correct_index": 0, "explanation": "...", "target_pattern": "pattern_key"}]}'
            ),
            'story': (
                'Write a SHORT story (5-8 sentences) that naturally incorporates the grammar structures '
                'the student is struggling with, specifically: ' +
                ', '.join([t.get('correct_text', '') for t in targets[:2]]) +
                '. Then create 3 comprehension questions.\n'
                "STRICT RULE: DO NOT use labels like 'A)', 'B)' etc. in the options.\n"
                'Return JSON: {"title": "Story Practice", "description": "...", "story": "...", '
                '"exercises": [{"question": "...", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correct_index": 0, "explanation": "...", "target_pattern": "pattern_key"}]}'
            ),
            'fill_in': (
                "Create 5 fill-in-the-blank sentences targeting these specific mistakes: " +
                ', '.join([f"{t.get('incorrect_text')} -> {t.get('correct_text')}" for t in targets]) +
                '. Each sentence must test one of these patterns.\n'
                "STRICT RULE: DO NOT use labels like 'A)', 'B)' etc. in the options.\n"
                'Return JSON: {"title": "Targeted Practice", "description": "...", '
                '"exercises": [{"question": "...", "options": ["Correct Word", "Incorrect Word 1", "Incorrect Word 2", "Incorrect Word 3"], "correct_index": 0, "explanation": "...", "target_pattern": "pattern_key"}]}'
            ),
            'dialogue': (
                'Write a short dialogue (6-8 lines) demonstrating correct usage of: ' +
                ', '.join([t.get('correct_text', '') for t in targets]) +
                '. Then create 3 questions.\n'
                "STRICT RULE: DO NOT use labels like 'A)', 'B)' etc. in the options.\n"
                'Return JSON: {"title": "Dialogue Practice", "description": "...", "dialogue": "...", '
                '"exercises": [{"question": "...", "options": ["Option 1", "Option 2", "Option 3", "Option 4"], "correct_index": 0, "explanation": "...", "target_pattern": "pattern_key"}]}'
            ),
        }

        type_titles = {
            'quiz': 'Targeted Quiz',
            'story': 'Contextual Story',
            'fill_in': 'Precision Fill-in',
            'dialogue': 'Dialogue Practice',
        }

        # Use centralized prompt builder (ensures consistent rules)
        prompt = build_exercise_prompt(
            error_context,
            exercise_type,
            targets,
            user_level=user_level)

        try:
            data = await groq_chat_json(
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=1500,
                temperature=0.1,  # Temperatura muito baixa para seguir os padrões estritamente
            )

            # Validação básica
            if not data or 'exercises' not in data or not data['exercises']:
                raise ValueError(
                    'Nenhum exercício gerado ou JSON inválido retornado')

            # Sanitização das opções: remover rótulos A)/B)/1. etc e
            # garantir presença da resposta correta
            import re
            pattern_keys = [t.get('pattern_key') for t in targets]

            for ex in data.get('exercises', []):
                # Normaliza target_pattern
                tp = ex.get('target_pattern')
                if not tp or tp not in pattern_keys:
                    ex['target_pattern'] = pattern_keys[0] if pattern_keys else 'general'

                opts = ex.get('options') or []
                clean_opts = []
                for o in opts:
                    if not isinstance(o, str):
                        o = str(o or '')
                    # remove leading labels como 'A)' 'B.' '1.'
                    o_clean = re.sub(
                        r"^\s*(?:[A-Za-z]\)|[A-Za-z]\.|[0-9]+[\.)])\s*", '', o).strip()
                    if o_clean:
                        clean_opts.append(o_clean)

                # Remove duplicatas mantendo ordem
                seen = set()
                dedup_opts = []
                for o in clean_opts:
                    if o in seen:
                        continue
                    seen.add(o)
                    dedup_opts.append(o)

                # Garante que a opção correta esteja presente
                correct_index = ex.get('correct_index')
                # tenta obter texto correto a partir do target
                target_key = ex.get('target_pattern') or (
                    pattern_keys[0] if pattern_keys else None)
                correct_text = None
                for t in targets:
                    if t.get('pattern_key') == target_key:
                        correct_text = t.get('correct_text')
                        break

                if correct_index is None:
                    answer = ex.get('answer')
                    if answer and answer in dedup_opts:
                        correct_index = dedup_opts.index(answer)

                # Se ainda não temos índice correto, tentar localizar
                # por texto correto
                if (correct_index is None or not (
                        0 <= int(correct_index) < len(dedup_opts))) and correct_text:
                    try:
                        if correct_text in dedup_opts:
                            correct_index = dedup_opts.index(
                                correct_text)
                        else:
                            # Insere como primeira opção
                            dedup_opts.insert(0, correct_text)
                            correct_index = 0
                    except Exception:
                        correct_index = 0

                # Garantir ao menos uma opção
                if not dedup_opts:
                    dedup_opts = [correct_text or 'Correct']
                    correct_index = 0

                ex['options'] = dedup_opts
                try:
                    ex['correct_index'] = int(correct_index)
                except Exception:
                    ex['correct_index'] = 0

            return data

        except Exception as e:
            logging.info(f'[ExerciseGen] Erro ao gerar conteúdo: {e}')
            return None

    async def _persist_exercise(
        self,
        username: str,
        exercise_data: Dict[str, Any],
        exercise_type: str,
        targets: List[Dict[str, Any]],
        title: Optional[str] = None
    ) -> Optional[str]:
        """
        Persiste o exercício e vincula aos padrões de erro que ele visa corrigir.
        """
        def _save():
            # Prevenção de duplicidade por título (janela de 1 hora)
            target_title = title or exercise_data.get(
                'title', f'{exercise_type.title()} Practice')
            try:
                from datetime import datetime, timedelta, timezone
                one_hour_ago = (datetime.now(timezone.utc) -
                                timedelta(hours=1)).isoformat()
                dup = self.db.table('quizzes').select('id').eq(
                    'username',
                    username).eq(
                    'title',
                    target_title).gte(
                    'created_at',
                    one_hour_ago).execute()
                if dup.data:
                    logging.info(
                        f"[ExerciseGen] Quiz '{target_title}' já existe para {username}. Abortando inserção.")
                    return dup.data[0]['id']
            except Exception as e:
                logging.info(
                    f"[ExerciseGen] Erro no check de duplicidade: {e}")

            # Garante módulo personalizado
            try:
                mod_check = (
                    self.db.table('modules')
                    .select('id')
                    .eq('id', PERSONALIZED_MODULE_ID)
                    .execute()
                )
                if not mod_check.data:
                    self.db.table('modules').insert({
                        'id': PERSONALIZED_MODULE_ID,
                        'title': 'Personalized Practice',
                        'description': 'Exercises generated based on your specific error patterns.',
                        'level': 'Adaptive',
                        'is_published': True,
                    }).execute()
            except Exception as e:
                logging.info(f'[ExerciseGen] Aviso módulo: {e}')

            # Cria o quiz
            quiz_res = self.db.table('quizzes').insert({
                'module_id': PERSONALIZED_MODULE_ID,
                'username': username,
                'title': title or exercise_data.get('title', f'{exercise_type.title()} Practice'),
                'description': exercise_data.get('description', 'Based on your recent error patterns.'),
                # Metadado útil
                'generated_from_patterns': [t.get('pattern_key') for t in targets],
            }).execute()

            if not quiz_res.data:
                return None

            quiz_id = quiz_res.data[0]['id']

            # Insere as questões
            for i, q in enumerate(exercise_data.get('exercises', [])):
                options = q.get('options', [])
                if not options:
                    continue

                correct_index = self._extract_correct_index(q, options)
                pattern_key = q.get('target_pattern', targets[0].get(
                    'pattern_key') if targets else 'general')

                self.db.table('quiz_questions').insert({
                    'quiz_id': quiz_id,
                    'question': q.get('question', 'Question'),
                    'options': options,
                    'correct_index': correct_index,
                    'explanation': q.get('explanation', ''),
                    'order': i,
                    'target_pattern': pattern_key,  # Vincula a questão ao padrão específico
                }).execute()

            # Registra tentativa
            try:
                self.db.table('user_exercise_attempts').insert({
                    'username': username,
                    'exercise_id': quiz_id,
                    'module_id': PERSONALIZED_MODULE_ID,
                    'activity_type': f'pattern_based_{exercise_type}',
                    'status': 'pending',
                    'target_patterns': [t.get('pattern_key') for t in targets],
                }).execute()
            except Exception as e:
                logging.info(
                    f'[ExerciseGen] Aviso ao registrar tentativa: {e}')

            # Vincula explicitamente aos padrões na tabela de
            # relacionamento
            for target in targets:
                try:
                    self.db.table('exercise_pattern_links').insert({
                        'username': username,
                        'quiz_id': quiz_id,
                        'pattern_key': target.get('pattern_key'),
                        'frequency_at_generation': target.get('frequency', 1),
                        'score_at_generation': target.get('score', 0),
                    }).execute()
                except Exception as e:
                    logging.info(
                        f'[ExerciseGen] Erro ao vincular padrão: {e}')

            return quiz_id

        try:
            quiz_id = await run_in_threadpool(_save)

            # Invalida cache
            try:
                from app.shared.services.upstash import cache_delete
                await cache_delete(f'modules:list:{username}')
            except Exception:
                pass

            logging.info(
                f'[ExerciseGen] Exercício gerado com sucesso: {quiz_id} para {username}')
            return quiz_id

        except Exception as e:
            logging.info(f'[ExerciseGen] Erro ao persistir: {e}')
            return None

    def _extract_correct_index(
            self,
            question_data: Dict,
            options: List[str]) -> int:
        """
        Extrai o índice correto de várias possibilidades.
        """
        correct_index = question_data.get('correct_index')

        if correct_index is None:
            answer = question_data.get('answer')
            if answer in options:
                correct_index = options.index(answer)
            else:
                correct_index = 0

        try:
            return int(correct_index)
        except (ValueError, TypeError):
            return 0


# Instância global para manter compatibilidade com código existente
exercise_generator_service = ExerciseGeneratorService()


# Função de compatibilidade (wrapper) para manter assinatura antiga se necessário,
# mas recomendo migrar para usar o service diretamente
async def generate_exercises_from_history(
    username: str,
    current_conversations_text: str,
    exercise_type: str = 'quiz'
) -> Optional[str]:
    """
    Mantida para compatibilidade, mas delega para a nova arquitetura.
    Se possível, use diretamente o ExerciseGeneratorService com training_targets.
    """
    logging.info(
        f'[ExerciseGen] WARN: Usando função legada. Considere migrar para training_targets.')

    # Fallback: cria um target genérico se não tiver acesso aos patterns
    # reais
    from app.modules.activities.services.error_log_service import error_log_service

    try:
        # Tenta buscar targets reais do usuário
        targets = await error_log_service._get_training_targets(username)
        return await exercise_generator_service.generate_exercises_from_targets(
            username, targets, exercise_type
        )
    except Exception as e:
        logging.info(f'[ExerciseGen] Erro no fallback: {e}')
        return None


# Nova função recomendada para usar com a arquitetura de patterns
async def generate_exercises_from_targets(
    username: str,
    training_targets: List[Dict[str, Any]],
    exercise_type: str = 'quiz',
    title: Optional[str] = None,
    attempt_id: Optional[str] = None
) -> Optional[str]:
    """
    Função pública recomendada. Recebe training_targets do ErrorLogService.
    """
    return await exercise_generator_service.generate_exercises_from_targets(
        username, training_targets, exercise_type, title=title, attempt_id=attempt_id
    )
