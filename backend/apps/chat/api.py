from django.contrib.auth import get_user_model
from django.http import HttpRequest
from ninja import Router

from apps.authentication.security import auth_optional, auth_required

from .schemas import (
    ConversationOut,
    CreateConversationInput,
    MessageOut,
    SendMessageInput,
)
from .services import AIService, ConversationService

User = get_user_model()
chat_router = Router(tags=["Teacher Tati AI Chat"])


# ── CONVERSAS & HISTÓRICO ─────────────────────────────────────────────


@chat_router.get("/conversations", response=list[ConversationOut], auth=auth_required)
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


# ── TESTE DE NIVELAMENTO CEFR (DIAGNÓSTICO) ──────────────────────────


@chat_router.post("/leveling/start", auth=auth_required)
def start_leveling_assessment(request: HttpRequest):
    """
    Inicia o Teste de Nivelamento CEFR oficial da Teacher Tati com base nos questionários diagnósticos.
    """
    from .leveling_service import LevelingService

    return LevelingService.start_leveling_session(request.auth)


@chat_router.get("/leveling/status", auth=auth_required)
def get_leveling_status(request: HttpRequest):
    """
    Retorna o status atual da sessão de nivelamento do aluno, se houver.
    """
    user = request.auth
    active = (
        getattr(user, "profile", {}).get("active_leveling")
        if isinstance(getattr(user, "profile", None), dict)
        else None
    )
    if isinstance(active, dict) and not active.get("completed", False):
        return {
            "active": True,
            "conversation_id": active.get("conversation_id"),
            "current_index": active.get("current_index", 0),
            "total_questions": active.get("total_questions", 0),
            "started_at": active.get("started_at"),
        }
    return {"active": False}


@chat_router.get(
    "/conversations/{conversation_id}/messages",
    response=list[MessageOut],
    auth=auth_required,
)
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
async def get_conversation_summary(
    request: HttpRequest, conversation_id: str, lang: str | None = "pt"
):
    """
    Gera um resumo pedagógico detalhado da sessão de conversa em inglês de forma assíncrona.
    """
    from asgiref.sync import sync_to_async

    return await sync_to_async(ConversationService.get_summary)(
        request.auth, conversation_id, lang=lang or "pt"
    )


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
    text: str | None = ""
    message: str | None = ""
    accent: str | None = "en-US"


class TranscribeInput(BaseModel):
    audio: str | None = ""


# ── SÍNTESE DE VOZ & TTS ──────────────────────────────────────────────


@chat_router.post("/synthesize-voice", auth=auth_optional)
@chat_router.post("/tts", auth=auth_optional)
async def synthesize_voice(request: HttpRequest, payload: TTSInput):
    """
    Sintetiza áudio falado com a voz da Teacher Tati via Edge TTS assíncrono respeitando o sotaque preferido do usuário.
    """
    from .audio_service import AudioService

    text = payload.text or payload.message or ""
    accent = payload.accent
    if not accent or accent == "en-US":
        if (
            hasattr(request, "auth")
            and request.auth
            and hasattr(request.auth, "profile")
            and isinstance(request.auth.profile, dict)
        ):
            accent = request.auth.profile.get("preferred_accent") or accent or "en-US"
    accent = accent or "en-US"
    audio_b64 = await AudioService.text_to_speech_async(text, accent=accent)
    return {
        "audio": audio_b64,
        "audio_b64": audio_b64,
        "accent": accent,
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
