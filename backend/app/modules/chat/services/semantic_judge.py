from app.core.dependencies.db import get_db
from fastapi import Depends
import json
from datetime import datetime
from typing import Any
from fastapi.concurrency import run_in_threadpool

class SemanticJudgeService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def check_topics_completion(self, username: str, conversation_text: str):
        """
        Analisa a conversa e marca tópicos do plano semanal como concluídos se detectados.
        """
        # 1. Recupera o plano atual
        def _fetch():
            res = self.db.table('users').select('weekly_plan').eq('username', username).single().execute()
            return res.data.get('weekly_plan') if res.data else None
        
        plan = await run_in_threadpool(_fetch)
        if not plan or not plan.get('topics'):
            return

        pending_topics = [t for t in plan['topics'] if t.get('status') == 'pending']
        if not pending_topics:
            return

        # 2. IA avalia se os tópicos foram abordados
        topics_json = json.dumps(pending_topics)
        prompt = f"""
        You are a pedagogical supervisor. Check if the following CONVERSATION covers any of the STUDY TOPICS.
        
        STUDY TOPICS:
        {topics_json}
        
        CONVERSATION:
        \"\"\"{conversation_text}\"\"\"
        
        A topic is 'completed' if the student successfully practiced the specific skill or discussed the theme mentioned.
        
        Return JSON with the IDs of completed topics:
        {{
            "completed_ids": ["id1", "id2"]
        }}
        """
        
        try:
            from app.modules.chat.services.llm import groq_chat_json
            data = await groq_chat_json([{"role": "user", "content": prompt}], temperature=0.1)
            
            if not data:
                return []

            completed_ids = data.get("completed_ids", [])
            
            if completed_ids:
                # 3. Atualiza o plano localmente e no banco
                updated = False
                for t in plan['topics']:
                    if t.get('id') in completed_ids:
                        t['status'] = 'completed'
                        t['completed_at'] = datetime.now().isoformat()
                        updated = True
                
                if updated:
                    from app.modules.activities.services.weekly_plan_service import weekly_plan_service
                    from app.modules.activities.services.trophy_service import TrophyService
                    
                    await weekly_plan_service._save_plan(username, plan)
                    
                    # Atribui badges de especialista para cada ID concluído
                    trophy_service = TrophyService()
                    for t in plan['topics']:
                        if t.get('id') in completed_ids:
                            await trophy_service.award_specialist_badge(username, t.get('title', 'Unknown Topic'))
                            
                    return completed_ids
        except Exception as e:
            print(f"[SemanticJudge] Erro ao julgar: {e}")

        return []

semantic_judge = SemanticJudgeService()
