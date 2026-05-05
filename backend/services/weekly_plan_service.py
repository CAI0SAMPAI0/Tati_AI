"""
services/weekly_plan_service.py
Gera e gerencia planos de estudo semanais personalizados.
"""

import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, timezone
from services.llm import groq_chat
from services.database import get_client
from fastapi.concurrency import run_in_threadpool

class WeeklyPlanService:
    def __init__(self):
        self.db = get_client()

    async def get_or_generate_plan(self, username: str, level: str, focus: str) -> Dict[str, Any]:
        """
        Retorna o plano atual ou gera um novo se necessário (expirado ou concluído).
        """
        def _fetch():
            res = self.db.table('users').select('weekly_plan').eq('username', username).single().execute()
            return res.data.get('weekly_plan') if res.data else None

        current_plan = await run_in_threadpool(_fetch)
        
        # Verifica se precisa de novo plano (7 dias ou se plano não existe)
        now = datetime.now(timezone.utc)
        should_generate = False
        
        if not current_plan:
            should_generate = True
        else:
            created_at = datetime.fromisoformat(current_plan.get('created_at', now.isoformat()))
            # Se passou 7 dias ou se todos os tópicos estão feitos (concluído antecipadamente)
            all_done = all(t.get('status') == 'completed' for t in current_plan.get('topics', []))
            if (now - created_at).days >= 7 or all_done:
                should_generate = True

        if should_generate:
            return await self.generate_new_plan(username, level, focus)
        
        return current_plan

    async def generate_new_plan(self, username: str, level: str, focus: str) -> Dict[str, Any]:
        """Gera 3-5 tópicos de estudo para a semana."""
        prompt = f"""
        Create a weekly English study plan for a student.
        LEVEL: {level}
        FOCUS: {focus}
        
        Provide 4 conversation topics/goals. Each topic should be specific and practical.
        Example: "Order food in a restaurant using polite forms" or "Discuss future travel plans using 'going to'".
        
        Return ONLY valid JSON:
        {{
            "created_at": "{datetime.now(timezone.utc).isoformat()}",
            "topics": [
                {{
                    "id": "1",
                    "title": "Topic title",
                    "description": "Short explanation",
                    "status": "pending"
                }}
            ]
        }}
        """
        
        try:
            raw_res = await groq_chat([{"role": "user", "content": prompt}], temperature=0.7)
            import re
            match = re.search(r'\{.*\}', raw_res, re.DOTALL)
            plan_data = json.loads(match.group(0)) if match else {}
            
            if plan_data:
                await self._save_plan(username, plan_data)
                return plan_data
        except Exception as e:
            print(f"[WeeklyPlan] Erro ao gerar: {e}")
            
        return {"topics": [], "created_at": datetime.now(timezone.utc).isoformat()}

    async def _save_plan(self, username: str, plan_data: Dict[str, Any]):
        def _save():
            self.db.table('users').update({'weekly_plan': plan_data}).eq('username', username).execute()
        await run_in_threadpool(_save)

weekly_plan_service = WeeklyPlanService()
