import logging
"""
services/podcast_exercise.py
Serviço para geração e avaliação de exercícios de podcasts.
"""

import re
from typing import Dict, Any, Set
from fastapi.concurrency import run_in_threadpool


class PodcastExerciseService:
    @staticmethod
    def _pick_lang(pt_text: str, en_text: str, ui_lang: str) -> str:
        return en_text if str(ui_lang).lower(
        ).startswith('en') else pt_text

    async def generate_exercises(
        self, podcast: Dict[str, Any], ui_lang: str
    ) -> Dict[str, Any]:
        """Gera exercícios para um podcast usando LLM."""
        if not podcast.get('transcript_segments'):
            await self._try_fetch_transcript(podcast)

        segments = []
        for segment in podcast.get('transcript_segments', []):
            if not segment.get('source_text'):
                continue
            segments.append(f'- {segment.get("start",
                                             "--:--")} | EN: {segment.get("source_text",
                                                                          "")} | PT: {segment.get("translated_text",
                                                                                                  "")}')
        logging.info(
            f'[exercise] transcript segments count: {
                len(segments)}')
        transcript_context = '\n'.join(segments)
        logging.info(
            f'[exercise] transcript_context preview: {transcript_context[:300]}')
        if not transcript_context.strip():
            transcript_context = f"Topic/Description: {
                podcast.get(
                    'description', '')}"
            logging.info(
                f"[exercise] WARNING: sem transcrição, usando description como fallback")

        from app.core.enums import normalize_level
        level = normalize_level(podcast.get('level'))
        is_beginner = level in ('A1', 'A2')
        difficulty_rule = (
            "Use short, simple English (CEFR A1-A2). Prefer common words, short sentences and direct questions."
            if is_beginner
            else "Use clear English aligned to the student's level. Avoid unnecessary complexity."
        )

        system_prompt = (
            f"You are Teacher TATI, a professional English teacher. Your goal is to create engaging and specific exercises for the podcast '{podcast.get('title')}'.\n\n"
            f'STUDENT LEVEL: {level}\n'
            f"CONTENT FOR EXERCISES (Transcript):\n{transcript_context}\n\n"
            "INSTRUCTIONS:\n"
            "1. Generate exactly 5 exercises.\n"
            "2. ALL exercises MUST be type 'voice'.\n"
            "3. Each exercise must ask the student to practice a SPECIFIC phrase from the transcript.\n"
            "4. The 'phrase' field MUST be a literal quote or a very close paraphrase of something said in the video.\n"
            "5. Provide a 'question' that gives context, e.g., 'Practice this phrase from the speaker: ...'.\n"
            f"6. LANGUAGE: return all questions and hints in English only. {difficulty_rule}\n\n"
            "RESPONSE FORMAT (STRICT JSON ONLY):\n"
            "{\n"
            '  "exercises": [\n'
            '    {"type": "voice", "question": "Context about the phrase...", "phrase": "exact phrase from transcript", "translation_hint": "Short English hint about meaning"}\n'
            '  ]\n'
            "}\n"
            "CRITICAL: Do not include any text outside the JSON. Use the transcript content religiously."
        )

        try:
            from app.modules.chat.services.llm import groq_chat_json

            payload = await groq_chat_json([{"role": "system", "content": system_prompt}], temperature=0.8)
            return self._normalize_exercises_payload(
                payload, podcast.get('title', ''), ui_lang, None
            )
        except Exception as exc:
            logging.info(
                f'Error generating/parsing LLM response for exercises: {exc}')
            return self.get_fallback_exercises(
                podcast.get('title', ''), ui_lang)

    async def _try_fetch_transcript(self, podcast: Dict[str, Any]):
        embed_url = podcast.get('embed_url', '')
        video_id = None

        if '/embed/' in embed_url:
            video_id = embed_url.split(
                '/embed/')[-1].split('?')[0].split('/')[0]

        if not video_id:
            ext = podcast.get('external_url', '')
            if 'v=' in ext:
                video_id = ext.split('v=')[-1].split('&')[0]
            elif 'youtu.be/' in ext:
                video_id = ext.split('youtu.be/')[-1].split('?')[0]

        if not video_id or len(video_id) != 11:
            logging.info(
                f'[transcript] video_id inválido: {
                    video_id!r}')
            return  # ← para aqui se inválido

        # daqui pra baixo, video_id é garantidamente válido
        def _fetch():
            try:
                from youtube_transcript_api import YouTubeTranscriptApi
                # Tenta buscar transcrições em inglês ou português
                transcript_list = YouTubeTranscriptApi.list_transcripts(
                    video_id)
                # Prioridade: Inglês manual -> Inglês auto -> Português
                # manual -> Português auto
                try:
                    transcript = transcript_list.find_transcript(
                        ['en', 'en-US', 'en-GB'])
                except BaseException:
                    try:
                        transcript = transcript_list.find_generated_transcript(
                            ['en', 'en-US'])
                    except BaseException:
                        try:
                            transcript = transcript_list.find_transcript(
                                ['pt', 'pt-BR'])
                        except BaseException:
                            transcript = transcript_list.find_generated_transcript(
                                ['pt', 'pt-BR'])

                raw = transcript.fetch()

                return [
                    {
                        'start': f'{int(s["start"] // 60):02d}:{int(s["start"] % 60):02d}',
                        'source_text': s['text'],
                        'translated_text': '',
                    }
                    for s in raw
                ]
            except Exception as e:
                logging.info(
                    f'Transcript fetch failed for {video_id}: {e}')
                return []

        segments = await run_in_threadpool(_fetch)
        podcast['transcript_segments'] = segments

        # persiste no banco para não buscar toda vez
        if segments and podcast.get('id'):
            try:
                from app.core.database import get_client
                await run_in_threadpool(
                    lambda: get_client()
                    .table('podcasts')
                    .update({'transcript_segments': segments})
                    .eq('id', podcast['id'])
                    .execute()
                )
            except Exception as e:
                logging.info(f'[transcript] falha ao persistir: {e}')

    def _normalize_exercises_payload(
        self, payload: Any, title: str, ui_lang: str, terms: Set[str] = None
    ) -> Dict[str, Any]:
        if not isinstance(
                payload,
                dict) or not payload.get('exercises'):
            return self.get_fallback_exercises(title, ui_lang)

        normalized = []
        for ex in payload['exercises']:
            ex_type = str(ex.get('type', '')).lower()
            if ex_type == 'choice':
                options = ex.get('options')
                if isinstance(options, list) and len(options) == 4:
                    normalized.append(
                        {
                            'type': 'choice',
                            'question': str(
                                ex.get('question', 'Choose the best answer.')
                            ).strip(),
                            'options': [str(o) for o in options],
                            'correct_index': min(
                                max(int(ex.get('correct_index', 0)), 0), 3
                            ),
                        }
                    )
            elif ex_type == 'voice':
                phrase = str(ex.get('phrase', '')).strip()
                if phrase:
                    normalized.append(
                        {
                            'type': 'voice',
                            'question': str(
                                ex.get(
                                    'question',
                                    '')).strip(),
                            'phrase': phrase,
                            'translation_hint': str(
                                ex.get(
                                    'translation_hint',
                                    '')).strip(),
                            'tts_text': phrase,
                        })
                continue

        if terms:
            normalized = [
                ex for ex in normalized if self._is_relevant(ex, terms)]

        if len(normalized) < 3:
            return self.get_fallback_exercises(title, ui_lang)

        return {'exercises': normalized[:8]}

    def _is_relevant(self, ex: Dict[str, Any], terms: Set[str]) -> bool:
        text = ' '.join(
            [
                str(ex.get('question', '')),
                str(ex.get('phrase', '')),
                ' '.join(str(o) for o in ex.get('options', [])),
            ]
        ).lower()
        ex_terms = set(re.findall(r'[a-z]{4,}', text))
        return bool(ex_terms.intersection(terms))

    def get_fallback_exercises(
            self, title: str, ui_lang: str) -> Dict[str, Any]:
        return {'exercises': [{'type': 'voice',
                               'question': f"Listen and answer with your voice: What is the main idea of '{title}'?",
                               'phrase': 'The main idea is to improve English communication skills.',
                               'translation_hint': 'Speak in one short sentence.',
                               },
                              {'type': 'voice',
                               'question': 'Listen and answer with your voice: What new word or phrase did you hear?',
                               'phrase': 'I heard a useful phrase about daily conversation.',
                               'translation_hint': 'Use simple words.',
                               },
                              {'type': 'voice',
                               'question': 'Listen and answer with your voice: What did you learn from this video?',
                               'phrase': 'I learned something new today.',
                               'translation_hint': 'Learned...',
                               'translation_hint': 'Say it slowly and clearly.',
                               },
                              ]}

    async def evaluate_exercise(
        self, req: Any, user_level: str, ui_lang: str
    ) -> Dict[str, Any]:
        if req.type == 'voice':
            system_prompt = (
                f"You are Teacher Tati evaluating English pronunciation.\n"
                f"Expected phrase: \"{req.correct_answer}\"\n"
                f"Student said: \"{req.user_answer}\"\n"
                f"Student level: {user_level}\n"
                "Compare word by word. Score 0-100 based on accuracy.\n"
                "In feedback: point out specific words they missed or mispronounced, and praise what was right.\n"
                "Be encouraging but honest. If score < 70, give the correct phrase again.\n"
                "Feedback MUST be in English only.\n"
                'Return JSON: { "score": 80, "feedback": "..." }'
            )
        else:
            system_prompt = (
                f"You are Teacher Tati.\n"
                f"Exercise type: {req.type}\n"
                f"Correct answer: \"{req.correct_answer}\"\n"
                f"Student answer: \"{req.user_answer}\"\n"
                f"Student level: {user_level}\n"
                "Score 0-100 strictly based on correctness. Do NOT default to 85.\n"
                "Feedback MUST be in English only.\n"
                'Return JSON: { "score": 70, "feedback": "..." }'
            )

        try:
            from app.modules.chat.services.llm import groq_chat_json

            payload = await groq_chat_json([{"role": "system", "content": system_prompt}], temperature=0.3)
            return self._normalize_evaluation_payload(payload, ui_lang)
        except Exception:
            return self._normalize_evaluation_payload({}, ui_lang)

    def _normalize_evaluation_payload(
        self, payload: Any, ui_lang: str
    ) -> Dict[str, Any]:
        raw_score = payload.get('score')
        score = min(max(int(raw_score), 0),
                    100) if raw_score is not None else 0
        feedback = str(
            payload.get(
                'feedback',
                '')).strip() or self._pick_lang(
            'Boa resposta!',
            'Good answer!',
            ui_lang)
        return {'score': score, 'feedback': feedback}
