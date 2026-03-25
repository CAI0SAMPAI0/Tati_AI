from fastapi import APIRouter, HTTPException
from app.models.chat import ChatRequest, ChatResponse
from app.services.gemini import gemini_service

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        response = await gemini_service.generate_chat_response(
            message=request.message,
            level=request.user_level
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
