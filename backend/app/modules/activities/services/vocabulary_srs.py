"""
services/vocabulary_srs.py
Gerencia a lógica de Repetição Espaçada (SRS) para o vocabulário do aluno.
Algoritmo: SuperMemo-2 (SM-2) adaptado.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from app.core.database import get_client
from fastapi.concurrency import run_in_threadpool

class VocabularySRSService:
    def __init__(self):
        self.db = get_client()

    async def add_to_srs(self, username: str, word: str, definition: str = '', example: str = ''):
        """Adiciona uma nova palavra ao ciclo de revisão SRS do aluno."""
        def _add():
            # Evita duplicidade simples
            existing = self.db.table('user_vocabulary').select('id').eq('username', username).eq('word', word).execute().data
            if existing: return
            
            payload = {
                'username': username,
                'word': word,
                'definition': definition,
                'example_sentence': example,
                'next_review': datetime.now(timezone.utc).isoformat()
            }
            self.db.table('user_vocabulary').insert(payload).execute()
        
        await run_in_threadpool(_add)

    async def record_review(self, entry_id: str, quality_score: int):
        """
        Atualiza os dados de SRS após uma revisão.
        quality_score: 0-5 (0=esqueci total, 5=fácil demais)
        """
        def _update():
            # 1. Recupera estado atual
            res = self.db.table('user_vocabulary').select('*').eq('id', entry_id).single().execute()
            if not res.data: return
            
            data = res.data
            ef = data.get('easiness_factor', 2.5)
            interval = data.get('interval', 0)
            reps = data.get('repetitions', 0)
            
            # 2. Algoritmo SM-2
            if quality_score >= 3:
                if reps == 0:
                    interval = 1
                elif reps == 1:
                    interval = 6
                else:
                    interval = round(interval * ef)
                reps += 1
            else:
                reps = 0
                interval = 1
            
            # Ajusta Easiness Factor
            ef = ef + (0.1 - (5 - quality_score) * (0.08 + (5 - quality_score) * 0.02))
            if ef < 1.3: ef = 1.3
            
            # 3. Salva novo estado
            next_date = datetime.now(timezone.utc) + timedelta(days=interval)
            update_payload = {
                'easiness_factor': ef,
                'interval': interval,
                'repetitions': reps,
                'next_review': next_date.isoformat(),
                'last_score': quality_score
            }
            self.db.table('user_vocabulary').update(update_payload).eq('id', entry_id).execute()
        
        await run_in_threadpool(_update)

    async def get_due_words(self, username: str) -> List[Dict[str, Any]]:
        """Busca palavras que precisam de revisão hoje."""
        def _fetch():
            now = datetime.now(timezone.utc).isoformat()
            return self.db.table('user_vocabulary')\
                .select('*')\
                .eq('username', username)\
                .lte('next_review', now)\
                .order('next_review')\
                .execute().data or []
        
        return await run_in_threadpool(_fetch)

vocabulary_srs_service = VocabularySRSService()
