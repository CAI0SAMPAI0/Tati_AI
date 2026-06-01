from app.core.dependencies.db import get_db
from fastapi import Depends
from typing import Dict, Any
import httpx
from bs4 import BeautifulSoup
from app.modules.activities.services.activity_service import ActivityService

class UrlToModuleService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db
        self.activity_service = ActivityService()

    async def generate_from_url(self, url: str, username: str, target_level: str = 'Intermediate') -> Dict[str, Any]:
        """
        Lê uma URL, extrai o texto e gera um módulo de estudo completo.
        """
        # 1. Extração de conteúdo
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return {"ok": False, "error": "Could not access the URL"}
                
                soup = BeautifulSoup(resp.text, 'html.parser')
                # Remove scripts, styles e tags irrelevantes
                for s in soup(['script', 'style', 'nav', 'footer', 'header']):
                    s.decompose()
                
                text = soup.get_text(separator=' ', strip=True)
                # Limita o texto para não estourar contexto (aprox 2000 palavras)
                text = ' '.join(text.split()[:2000])
        except Exception as e:
            return {"ok": False, "error": f"Scraping failed: {str(e)}"}

        # 2. IA gera o conteúdo pedagógico
        prompt = f"""
        You are a curriculum designer. Create an English lesson module based on this text.
        TEXT: \"\"\"{text}\"\"\"
        TARGET LEVEL: {target_level}
        
        The module must include:
        1. A catchy title.
        2. A simplified version of the text (reading practice).
        3. A "Grammar Focus" section based on the text.
        4. 3 Multiple choice questions (quiz).
        5. 2 Vocabulary flashcards (term + definition).
        
        Return ONLY valid JSON:
        {{
            "title": "string",
            "reading_content": "string",
            "grammar_focus": "string",
            "quizzes": [
                {{
                    "question": "string",
                    "options": ["A", "B", "C", "D"],
                    "correct_index": number,
                    "explanation": "string"
                }}
            ],
            "flashcards": [
                {{ "front": "term", "back": "definition" }}
            ]
        }}
        """
        
        try:
            from app.modules.chat.services.llm import groq_chat_json
            module_data = await groq_chat_json([{"role": "user", "content": prompt}], temperature=0.3)
            
            if not module_data:
                return {"ok": False, "error": "IA failed to structure the module"}

            # 3. Salva no banco usando ActivityService existente
            # Adaptamos o payload para o formato que save_module espera
            formatted_payload = {
                "title": module_data.get('title'),
                "level": target_level,
                "is_published": False, # Começa como rascunho para o usuário ver
                "contents": [
                    {"title": "Reading Practice", "content": module_data.get('reading_content'), "order": 0},
                    {"title": "Grammar Insights", "content": module_data.get('grammar_focus'), "order": 1}
                ],
                "quiz": {
                    "title": f"Quiz: {module_data.get('title')}",
                    "questions": module_data.get('quizzes', [])
                }
            }
            
            res = await self.activity_service.save_module(formatted_payload)
            return {"ok": True, "module_id": res.get('id')}

        except Exception as e:
            print(f"[UrlToModule] Erro: {e}")
            return {"ok": False, "error": str(e)}

url_to_module_service = UrlToModuleService()
