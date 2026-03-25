import google.generativeai as genai
from app.core.config import settings
from app.models.chat import ChatResponse
import json

class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.google_api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    async def generate_chat_response(self, message: str, level: str) -> ChatResponse:
        prompt = f"""
        You are an English tutor called Tati. 
        Student level: {level}
        
        Task: 
        1. Chat with the student naturally.
        2. ALWAYS detect grammar or vocabulary mistakes in their message.
        3. Explain the mistakes simply based on their level.
        4. Return the response in a VALID JSON format.
        
        JSON Structure:
        {{
            "reply": "Your natural conversational response here",
            "corrections": [
                {{
                    "original": "the wrong part",
                    "corrected": "the right part",
                    "explanation": "why it was wrong"
                }}
            ]
        }}
        
        Student message: "{message}"
        """
        
        response = self.model.generate_content(prompt)
        
        try:
            # Clean response if Gemini adds markdown code blocks
            content = response.text.replace("```json", "").replace("```", "").strip()
            data = json.loads(content)
            return ChatResponse(**data)
        except Exception as e:
            # Fallback if AI fails to return structured JSON
            return ChatResponse(
                reply=response.text,
                corrections=[{"original": "", "corrected": "", "explanation": f"Error parsing JSON: {str(e)}"}]
            )

gemini_service = GeminiService()
