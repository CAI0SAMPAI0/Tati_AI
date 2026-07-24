import logging
from typing import Any

from app.core.enums import normalize_level
from app.modules.chat.services.llm import transcribe_audio_verbose


class PronunciationMatcher:
    def __init__(self):
        pass

    async def evaluate(
        self, audio_bytes: bytes, reference_text: str, user_level: str = "A1"
    ) -> dict[str, Any]:
        """
        Avalia o áudio do aluno comparando-o com o texto de referência.
        """
        user_level = normalize_level(user_level)

        from app.shared.services.gemini_speech_service import gemini_speech_service

        if gemini_speech_service.is_configured:
            try:
                gemini_res = await gemini_speech_service.evaluate_pronunciation(
                    audio_bytes, reference_text
                )
                if "error" not in gemini_res:
                    return {
                        "score": gemini_res.get("score", 0),
                        "feedback": gemini_res.get("feedback", ""),
                        "transcription": reference_text,
                        "words": gemini_res.get("words", []),
                    }
            except Exception as e:
                logging.info(
                    f"[PronunciationMatcher] Gemini evaluation failed: {e}. Falling back to Whisper + LLM."
                )

        # 1. Transcrever com Whisper via Groq (com verbose_json para capturar logprobs)
        trans_data = await transcribe_audio_verbose(
            audio_bytes,
            prompt="Transcribe the speech verbatim. Do not normalize or correct mispronunciations.",
        )

        transcription = (
            trans_data.get("text", "") if isinstance(trans_data, dict) else ""
        )

        if not transcription or transcription.startswith("[Erro"):
            return {
                "score": 0,
                "feedback": "I couldn't hear your voice clearly. Please try again.",
                "transcription": "",
            }

        # Extração de métricas acústicas de logprob
        segments = trans_data.get("segments", [])
        avg_logprob = segments[0].get("avg_logprob", 0) if segments else 0
        no_speech_prob = segments[0].get("no_speech_prob", 0) if segments else 0

        # 2. Comparar semântica e fonética via LLM, fornecendo as métricas acústicas
        prompt = f"""
        You are Tati, a friendly English teacher.
        Compare the STUDENT'S TRANSCRIPTION with the REFERENCE TEXT.

        REFERENCE TEXT: "{reference_text}"
        STUDENT'S TRANSCRIPTION: "{transcription}"
        STUDENT LEVEL: "{user_level}"

        ACOUSTIC METRICS FROM SPEECH-TO-TEXT:
        - Average Segment Logprob (Confidence): {avg_logprob} (Closer to 0 is higher confidence. E.g., -0.1 to -0.4 is excellent. Lower than -0.8 indicates poor pronunciation, hesitation, or errors.)
        - No Speech Probability: {no_speech_prob}

        Calculate a pronunciation score (0-100) based on:
        1. Word accuracy (did they say the right words?)
        2. Phonetic similarity (did the acoustic confidence score drop, or was the spelling transcribed with errors like 'arkitec' instead of 'architect'?)

        Provide constructive feedback IN ENGLISH directly to the student.
        IMPORTANT: Adjust your vocabulary and sentence structure to match the STUDENT LEVEL.
        For Beginners, use very simple, short sentences. For Advanced students, you can use more complex feedback.
        Always act as Tati and be encouraging!

        PROMPT RULES FOR PRONUNCIATION FEEDBACK:
        - When a pronunciation mistake is detected, you MUST identify the problematic word/phrase, state that the pronunciation needs improvement, provide ONLY the correctly spelled word or phrase, and ask the student to repeat it. (e.g., "You need to improve the pronunciation of 'architect'. Listen and repeat: architect." or "Good try. Let's practice this word again: architect.").
        - DO NOT write or use IPA symbols or phonetic transcriptions (no '/ʃiː/').
        - DO NOT use written sound approximations, syllable spelling, or phonetic spellings (no 'Ah-kee-tekt', no 'Sh-she').
        - DO NOT turn this into a phonetics lesson or write out sound/syllable explanations.

        Return ONLY valid JSON:
        {{
            "score": number,
            "feedback": "string",
            "transcription": "{transcription}"
        }}
        """

        try:
            from app.modules.chat.services.llm import groq_chat_json

            data = await groq_chat_json(
                [{"role": "user", "content": prompt}], temperature=0.2
            )

            if not data:
                return {
                    "score": 50,
                    "feedback": "Tati heard you, but couldn't generate an accurate score right now.",
                    "transcription": transcription,
                }

            return {
                "score": data.get("score", 0),
                "feedback": data.get("feedback", "Good effort! Keep practicing."),
                "transcription": transcription,
            }
        except Exception as e:
            logging.info(f"[PronunciationMatcher] Erro: {e}")
            return {
                "score": 50,
                "feedback": "Tati heard you, but couldn't generate an accurate score right now.",
                "transcription": transcription,
            }


def match_pronunciation(target: str, student_text: str) -> dict:
    """
    Função legada para compatibilidade síncrona.
    Em uma refatoração futura, o chat deve usar o evaluate (async).
    """
    from difflib import SequenceMatcher

    ratio = SequenceMatcher(None, target.lower(), student_text.lower()).ratio()
    score = int(ratio * 100)
    return {
        "score": score,
        "is_perfect": score >= 95,
        "feedback": "Good effort!" if score > 70 else "Keep practicing.",
    }


pronunciation_matcher = PronunciationMatcher()
