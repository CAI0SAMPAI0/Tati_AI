from typing import Optional
from pydantic import BaseModel
import uuid


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: str
    role: str
    content: str
    audio_b64: Optional[str] = None
    created_at: Optional[str] = None


class ConversationOut(BaseModel):
    id: str
    title: str
    model: str
    is_simulation: bool = False
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateConversationInput(BaseModel):
    title: Optional[str] = "Nova Conversa"
    model: Optional[str] = "groq/openai/gpt-oss-20b"
    is_simulation: bool = False
    simulation_id: Optional[uuid.UUID] = None


class SendMessageInput(BaseModel):
    conversation_id: str
    message: str
    synthesize_audio: bool = False
    current_difficulty: Optional[str] = None


class VoiceSynthesisInput(BaseModel):
    text: str
    voice_id: Optional[str] = None


class VoiceSynthesisOut(BaseModel):
    audio_b64: str
    duration_seconds: float = 0.0


class PublicLevelingStartInput(BaseModel):
    total_questions: Optional[int] = 8
    count_per_level: Optional[int] = None
    accent: Optional[str] = "en-US"


class PublicLevelingStepInput(BaseModel):
    session_id: str
    user_text: str
    accent: Optional[str] = "en-US"


class PublicLevelingSubmitInput(BaseModel):
    session_id: str
    name: str
    email: str
    create_account: bool = False
    username: Optional[str] = None
    password: Optional[str] = None
