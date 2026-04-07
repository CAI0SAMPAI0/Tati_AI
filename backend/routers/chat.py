from __future__ import annotations

import base64
import io
import json

import docx
import pypdf
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from core.config import settings
from routers.deps import get_current_user
from services.database import get_client
from services.history import (
    auto_title,
    create_conversation,
    delete_conversation,
    list_conversations,
    load_history,
    rename_conversation,
    save_message,
)
from services.llm import GroqKeyError, groq_chat, stream_llm, text_to_speech, transcribe_audio
from services.prompt_builder import UserProfile, build_effective_prompt
from services.rag_search import obter_contexto_rag

router = APIRouter()

_SOURCE_MARKERS = ["📚 Fontes", "Fontes consultadas:", "Sources:", "References:"]


# ── Models ────────────────────────────────────────────────────────────────────


class CreateConversationBody(BaseModel):
    title: str = "Nova conversa"


class RenameConversationBody(BaseModel):
    title: str


class TTSRequest(BaseModel):
    text: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _verify_ws_token(token: str) -> dict | None:
    from core.security import decode_token
    return decode_token(token)


def _clean_tts_text(text: str) -> str:
    """Remove marcadores de fontes e asteriscos do texto antes de enviar ao TTS."""
    text = text.replace("*", "")
    for marker in _SOURCE_MARKERS:
        if marker in text:
            text = text.split(marker)[0]
            break
    return text.strip()


async def _get_user_profile(username: str) -> UserProfile:
    rows = (
        get_client()
        .table("users")
        .select("custom_prompt, level, focus")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    data = rows[0] if rows else {}
    return UserProfile(
        username=username,
        level=data.get("level") or "Intermediate",
        focus=data.get("focus") or "General Conversation",
        custom_prompt=(data.get("custom_prompt") or "").strip(),
    )


async def extract_text_from_file(filename: str, content_b64: str) -> str:
    """Extrai texto de PDF, DOCX ou texto puro de um arquivo base64."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        file_bytes = base64.b64decode(content_b64)

        if ext == "pdf":
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text = "\n".join(p.extract_text() for p in reader.pages if p.extract_text())
            return text.replace("\x00", "") or "[PDF sem texto extraível]"

        if ext == "docx":
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs)
            return text.replace("\x00", "") or "[Documento sem texto]"

        if ext in ("png", "jpg", "jpeg", "gif", "webp", "bmp"):
            return f"[Imagem enviada: {filename}. Descreva que recebeu uma imagem e peça ao aluno para explicar.]"

        text = file_bytes.decode("utf-8", errors="ignore").replace("\x00", "")
        return text or "[Arquivo sem conteúdo legível]"

    except Exception as exc:
        return f"[Erro ao ler arquivo {filename}: {exc}]"


# ── REST endpoints ────────────────────────────────────────────────────────────


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def new_conversation(
    body: CreateConversationBody = CreateConversationBody(),
    current_user: dict = Depends(get_current_user),
):
    return await create_conversation(
        username=current_user["username"],
        title=body.title,
        model=settings.llm_provider,
    )


@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    return await list_conversations(current_user["username"])


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    if not await delete_conversation(conversation_id, current_user["username"]):
        raise HTTPException(status_code=404, detail="Conversa não encontrada")


@router.patch("/conversations/{conversation_id}/title")
async def update_title(
    conversation_id: str,
    body: RenameConversationBody,
    current_user: dict = Depends(get_current_user),
):
    conv = await rename_conversation(conversation_id, current_user["username"], body.title)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return conv


@router.get("/conversations/{conversation_id}/messages")
async def get_history(conversation_id: str, current_user: dict = Depends(get_current_user)):
    messages = await load_history(conversation_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return messages


@router.post("/tts")
async def tts_word(body: TTSRequest, current_user: dict = Depends(get_current_user)):
    if not body.text or len(body.text) > 200:
        raise HTTPException(status_code=400, detail="Texto inválido ou muito longo")
    audio_b64 = await text_to_speech(body.text)
    if not audio_b64:
        raise HTTPException(status_code=503, detail="TTS indisponível")
    return {"audio": audio_b64}


@router.get("/conversations/{conversation_id}/summary")
async def get_summary(conversation_id: str, current_user: dict = Depends(get_current_user)):
    history = await load_history(conversation_id)
    if not history or len(history) < 5:
        raise HTTPException(status_code=400, detail="Mensagens insuficientes para gerar resumo")

    conversation_text = "\n\n".join(
        f"{'TATI' if m['role'] == 'assistant' else 'STUDENT'}: {m['content']}"
        for m in history
    )
    prompt_system = (
        "Você é um coordenador pedagógico de inglês. Analise a transcrição e escreva um "
        "relatório para o aluno (em português) com:\n\n"
        "🌟 **Pontos Fortes:** (elogie o que foi bem)\n"
        "🛠️ **Para Melhorar:** (2-3 erros com correção)\n"
        "📚 **Vocabulário Novo:** (3-5 palavras/expressões com tradução)\n\n"
        "Seja encorajador, didático e use Markdown."
    )
    try:
        resumo = await groq_chat(
            messages=[
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": f"Conversa:\n\n{conversation_text}"},
            ],
            max_tokens=1500,
        )
        return {"summary": resumo}
    except GroqKeyError as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao gerar resumo: {exc}")


# ── WebSocket ─────────────────────────────────────────────────────────────────


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(...)):
    payload = _verify_ws_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Token inválido")
        return

    await websocket.accept()
    username = payload["sub"]

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "JSON inválido"})
                continue

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            await _handle_chat_message(websocket, msg, username)

    except WebSocketDisconnect:
        print(f"[WS] {username} desconectou")
    except Exception as exc:
        print(f"[WS] Erro geral: {exc}")


async def _handle_chat_message(websocket: WebSocket, msg: dict, username: str) -> None:
    msg_type = msg.get("type")
    content = msg.get("content", "").strip()
    conv_id = msg.get("conversation_id")

    if msg_type not in ("text", "audio", "file") or not conv_id:
        await websocket.send_json({"type": "error", "detail": "Tipo ou conversation_id inválido"})
        return

    # Processa tipo de input
    if msg_type == "file":
        filename = msg.get("filename", "file.txt")
        extracted = await extract_text_from_file(filename, msg.get("content", ""))
        caption = msg.get("caption", "").strip()
        content = f"{caption}\n\n[Arquivo: {filename}]\n{extracted}" if caption else f"[Arquivo: {filename}]\n{extracted}"
        await websocket.send_json({"type": "status", "text": f"Arquivo {filename} lido."})

    elif msg_type == "audio":
        try:
            audio_bytes = base64.b64decode(msg.get("audio", ""))
            content = await transcribe_audio(audio_bytes, filename="input.webm")
            await websocket.send_json({"type": "transcription", "text": content})
        except Exception as exc:
            await websocket.send_json({"type": "error", "detail": f"Erro no STT: {exc}"})
            return

    if not content:
        return

    # Histórico e auto-título
    history = await load_history(conv_id)
    if not history:
        await auto_title(conv_id, username, content[:50])

    await save_message(conv_id, username, "user", content)
    history.append({"role": "user", "content": content})

    # Monta prompt
    profile = await _get_user_profile(username)
    rag_result = obter_contexto_rag(content)
    effective_prompt = build_effective_prompt(profile, rag_result.contexto)

    # Streaming
    await websocket.send_json({"type": "stream_start", "conversation_id": conv_id})
    full_response = ""

    try:
        async for token_chunk in stream_llm(effective_prompt, history):
            full_response += token_chunk
            await websocket.send_json({"type": "stream_token", "token": token_chunk})
    except Exception as exc:
        await websocket.send_json({"type": "error", "detail": f"Erro na LLM: {exc}"})
        return

    # TTS
    tts_text = _clean_tts_text(full_response)
    await save_message(conv_id, username, "assistant", full_response)

    audio_b64 = await text_to_speech(tts_text)
    if audio_b64:
        await websocket.send_json({"type": "audio_response", "audio": audio_b64, "conversation_id": conv_id})

    await websocket.send_json({"type": "stream_end", "conversation_id": conv_id})