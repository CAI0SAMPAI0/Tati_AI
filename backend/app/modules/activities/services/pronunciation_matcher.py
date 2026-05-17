"""
services/pronunciation_matcher.py
Serviço para avaliar a precisão fonética da pronúncia do aluno.
"""

import json
import re
from typing import Dict, Any
from app.modules.chat.services.llm import transcribe_audio, groq_chat

class PronunciationMatcher:
    def __init__(self):
        pass

    async def evaluate(self, audio_bytes: bytes, reference_text: str) -> Dict[str, Any]:
        """
        Avalia o áudio do aluno comparando-o com o texto de referência.
        """
        # 1. Transcrever com Whisper via Groq (otimizado para captura fonética no llm.py)
        transcription = await transcribe_audio(audio_bytes, prompt=f"Reference text: {reference_text}")
        
        if not transcription or transcription.startswith("[Erro"):
            return {
                "score": 0,
                "feedback": "Não foi possível ouvir sua voz claramente. Tente novamente.",
                "transcription": ""
            }

        # 2. Comparar semântica e fonética via LLM
        prompt = f"""
        You are a phonetic expert English teacher. 
        Compare the STUDENT'S TRANSCRIPTION with the REFERENCE TEXT.
        
        REFERENCE TEXT: "{reference_text}"
        STUDENT'S TRANSCRIPTION: "{transcription}"
        
        Calculate a pronunciation score (0-100) based on:
        1. Word accuracy (did they say the right words?)
        2. Phonetic similarity (even if transcribed slightly wrong, did it sound like the target?)
        
        Provide constructive feedback in Portuguese.
        
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
                    "feedback": "Tati ouviu você, mas não conseguiu gerar um score preciso agora.",
                    "transcription": transcription
                }
            
            return {
                "score": data.get("score", 0),
                "feedback": data.get("feedback", "Bom esforço! Continue praticando."),
                "transcription": transcription
            }
        except Exception as e:
            print(f"[PronunciationMatcher] Erro: {e}")
            return {
                "score": 50,
                "feedback": "Tati ouviu você, mas não conseguiu gerar um score preciso agora.",
                "transcription": transcription
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
        "feedback": "Bom esforço!" if score > 70 else "Continue praticando."
    }

pronunciation_matcher = PronunciationMatcher()
