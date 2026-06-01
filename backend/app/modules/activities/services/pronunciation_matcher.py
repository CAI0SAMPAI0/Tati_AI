import logging
from typing import Dict, Any
from app.modules.chat.services.llm import transcribe_audio


class PronunciationMatcher:
    def __init__(self):
        pass

    async def evaluate(self,
                       audio_bytes: bytes,
                       reference_text: str,
                       user_level: str = "Beginner") -> Dict[str,
                                                             Any]:
        """
        Avalia o áudio do aluno comparando-o com o texto de referência.
        """
        # 1. Transcrever com Whisper via Groq (otimizado para captura
        # fonética no llm.py)
        transcription = await transcribe_audio(audio_bytes, prompt=f"Reference text: {reference_text}")

        if not transcription or transcription.startswith("[Erro"):
            return {
                "score": 0,
                "feedback": "I couldn't hear your voice clearly. Please try again.",
                "transcription": ""}

        # 2. Comparar semântica e fonética via LLM
        prompt = f"""
        You are Tati, a phonetic expert English teacher.
        Compare the STUDENT'S TRANSCRIPTION with the REFERENCE TEXT.

        REFERENCE TEXT: "{reference_text}"
        STUDENT'S TRANSCRIPTION: "{transcription}"
        STUDENT LEVEL: "{user_level}"

        Calculate a pronunciation score (0-100) based on:
        1. Word accuracy (did they say the right words?)
        2. Phonetic similarity (even if transcribed slightly wrong, did it sound like the target?)

        Provide constructive feedback IN ENGLISH directly to the student.
        IMPORTANT: Adjust your vocabulary and sentence structure to match the STUDENT LEVEL.
        For Beginners, use very simple, short sentences. For Advanced students, you can use more complex feedback.
        Always act as Tati and be encouraging!

        Return ONLY valid JSON:
        {{
            "score": number,
            "feedback": "string",
            "transcription": "{transcription}"
        }}
        """

        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json([{"role": "user", "content": prompt}], temperature=0.2)

            if not data:
                return {
                    "score": 50,
                    "feedback": "Tati heard you, but couldn't generate an accurate score right now.",
                    "transcription": transcription}

            return {
                "score": data.get(
                    "score",
                    0),
                "feedback": data.get(
                    "feedback",
                    "Good effort! Keep practicing."),
                "transcription": transcription}
        except Exception as e:
            logging.info(f"[PronunciationMatcher] Erro: {e}")
            return {
                "score": 50,
                "feedback": "Tati heard you, but couldn't generate an accurate score right now.",
                "transcription": transcription}


def match_pronunciation(target: str, student_text: str) -> dict:
    """
    Função legada para compatibilidade síncrona.
    Em uma refatoração futura, o chat deve usar o evaluate (async).
    """
    from difflib import SequenceMatcher
    ratio = SequenceMatcher(
        None,
        target.lower(),
        student_text.lower()).ratio()
    score = int(ratio * 100)
    return {
        "score": score,
        "is_perfect": score >= 95,
        "feedback": "Good effort!" if score > 70 else "Keep practicing."
    }


pronunciation_matcher = PronunciationMatcher()
