from typing import List, Optional
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model

from apps.authentication.security import auth_required, auth_optional
from .schemas import (
    ConversationOut,
    CreateConversationInput,
    MessageOut,
    SendMessageInput,
    VoiceSynthesisInput,
    VoiceSynthesisOut,
)
from .services import ConversationService, AIService

User = get_user_model()
chat_router = Router(tags=["Teacher Tati AI Chat"])


# ── CONVERSAS & HISTÓRICO ─────────────────────────────────────────────

@chat_router.get("/conversations", response=List[ConversationOut], auth=auth_required)
def list_conversations(request: HttpRequest):
    """
    Lista todas as conversas do aluno com a Teacher Tati.
    """
    return ConversationService.list_conversations(request.auth)


@chat_router.post("/conversations", response=ConversationOut, auth=auth_required)
def create_conversation(request: HttpRequest, payload: CreateConversationInput):
    """
    Inicia uma nova sessão de conversação com a Teacher Tati.
    """
    return ConversationService.create_conversation(request.auth, payload)


@chat_router.get("/conversations/{conversation_id}/messages", response=List[MessageOut], auth=auth_required)
def get_messages(request: HttpRequest, conversation_id: str):
    """
    Retorna o histórico completo de mensagens trocadas na conversa.
    """
    return ConversationService.get_messages(request.auth, conversation_id)


@chat_router.delete("/conversations/{conversation_id}", auth=auth_required)
def delete_conversation(request: HttpRequest, conversation_id: str):
    """
    Remove uma sessão de conversa e seu histórico associado.
    """
    return ConversationService.delete_conversation(request.auth, conversation_id)


@chat_router.get("/conversations/{conversation_id}/summary", auth=auth_required)
async def get_conversation_summary(request: HttpRequest, conversation_id: str, lang: Optional[str] = "pt"):
    """
    Gera um resumo pedagógico detalhado da sessão de conversa em inglês de forma assíncrona.
    """
    from asgiref.sync import sync_to_async
    return await sync_to_async(ConversationService.get_summary)(request.auth, conversation_id, lang=lang or "pt")


# ── ENVIO DE MENSAGEM & RESPOSTA DA IA ────────────────────────────────

@chat_router.post("", auth=auth_required)
@chat_router.post("/", auth=auth_required)
@chat_router.post("/message", auth=auth_required)
async def send_chat_message(request: HttpRequest, payload: SendMessageInput):
    """
    Envia uma mensagem do aluno e gera a resposta contextual da Teacher Tati acompanhada do áudio falado.
    """
    from asgiref.sync import sync_to_async
    res = await sync_to_async(AIService.generate_reply)(
        user=request.auth,
        conversation_id=payload.conversation_id,
        user_text=payload.message,
        difficulty=payload.current_difficulty,
    )
    reply_text = res.get("reply") if isinstance(res, dict) else str(res)
    audio_b64 = res.get("audio_b64") if isinstance(res, dict) else ""
    return {
        "ok": True,
        "reply": reply_text,
        "role": "assistant",
        "audio": audio_b64,
        "audio_b64": audio_b64,
    }


from pydantic import BaseModel

class TTSInput(BaseModel):
    text: Optional[str] = ""
    message: Optional[str] = ""
    accent: Optional[str] = "en-US"


class TranscribeInput(BaseModel):
    audio: Optional[str] = ""


# ── SÍNTESE DE VOZ & TTS ──────────────────────────────────────────────

@chat_router.post("/synthesize-voice", auth=auth_optional)
@chat_router.post("/tts", auth=auth_optional)
async def synthesize_voice(request: HttpRequest, payload: TTSInput):
    """
    Sintetiza áudio falado com a voz da Teacher Tati via Edge TTS assíncrono.
    """
    from .audio_service import AudioService
    text = payload.text or payload.message or ""
    accent = payload.accent or "en-US"
    audio_b64 = await AudioService.text_to_speech_async(text, accent=accent)
    return {
        "audio": audio_b64,
        "audio_b64": audio_b64,
        "duration_seconds": 2.0,
    }


# ── TRANSCRIÇÃO DE VOZ (STT) ──────────────────────────────────────────

@chat_router.post("/transcribe", auth=auth_optional)
async def transcribe_chat_voice(request: HttpRequest, payload: TranscribeInput):
    """
    Transcreve áudio do aluno usando Whisper Large V3 assíncrono.
    """
    from .audio_service import AudioService
    text = await AudioService.transcribe_audio_async(payload.audio or "")
    return {"text": text, "transcription": text}
