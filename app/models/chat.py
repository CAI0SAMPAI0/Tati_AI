from pydantic import BaseModel
from typing import List, Optional

class ChatRequest(BaseModel):
    message: str
    user_level: str = "A2"  # Default level for testing

class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str

class ChatResponse(BaseModel):
    reply: str
    corrections: List[Correction] = []
