"""
services/error_log_service.py
Captura e organiza erros gramaticais e de vocabulário detectados no chat.
"""

import json
import re
from typing import Dict, Any, List
from services.llm import groq_chat
from services.database import get_client
from fastapi.concurrency import run_in_threadpool

class ErrorLogService:
    def __init__(self):
        self.db = get_client()

    async def extract_and_log_errors(self, username: str, student_msg: str, teacher_msg: str):
        """
        Analisa a troca de mensagens para extrair erros explícitos e salvá-los.
        """
        # Verifica se a Tati deu um feedback de correção
        markers = ['should be', 'correct form', 'mistake', 'incorrect', '✅', 'você disse', 'o correto é']
        if not any(m in teacher_msg.lower() for m in markers):
            return

        prompt = f"""
        Analyze this conversation snippet and extract the SPECIFIC grammar or vocabulary errors 
        the student made. For each error, provide the incorrect fragment and the correct version.
        
        STUDENT: "{student_msg}"
        TEACHER: "{teacher_msg}"
        
        Return JSON list of errors:
        {{
            "errors": [
                {{
                    "incorrect": "string",
                    "correct": "string",
                    "category": "grammar|vocabulary|preposition|verb_tense",
                    "explanation": "short string in Portuguese"
                }}
            ]
        }}
        
        If no clear error was corrected, return an empty list.
        """
        
        try:
            raw_res = await groq_chat([{"role": "user", "content": prompt}], temperature=0.1)
            match = re.search(r'\{.*\}', raw_res, re.DOTALL)
            data = json.loads(match.group(0)) if match else {}
            errors = data.get("errors", [])
            
            if errors:
                await self._persist_errors(username, errors)
                
                # --- Sprint 6: Add to SRS ---
                from services.vocabulary_srs import vocabulary_srs_service
                for err in errors:
                    # Adiciona o termo correto ao SRS para memorização
                    await vocabulary_srs_service.add_to_srs(
                        username, 
                        err.get('correct'), 
                        definition=err.get('explanation', ''),
                        example=f"Incorrect: {err.get('incorrect')} -> Correct: {err.get('correct')}"
                    )
                
                return True
        except Exception as e:
            print(f"[ErrorLogService] Erro ao extrair: {e}")
        
        return False

    async def _persist_errors(self, username: str, errors: List[Dict[str, Any]]):
        """Salva os erros na tabela user_errors."""
        def _save():
            for err in errors:
                payload = {
                    "username": username,
                    "incorrect_text": err.get("incorrect"),
                    "correct_text": err.get("correct"),
                    "category": err.get("category", "grammar"),
                    "explanation": err.get("explanation"),
                    "is_resolved": False
                }
                self.db.table('user_errors').insert(payload).execute()
        
        await run_in_threadpool(_save)

error_log_service = ErrorLogService()
