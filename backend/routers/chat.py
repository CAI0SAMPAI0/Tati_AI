import json
import os
import base64

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
from pydantic import BaseModel

from routers.deps import get_current_user
from services.history import (
    create_conversation,
    list_conversations,
    delete_conversation,
    rename_conversation,
    load_history,
    save_message,
    auto_title,
)
from services.llm import stream_llm, transcribe_audio, text_to_speech, LLM_PROVIDER

router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM      = "HS256"

SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are TATI, a dedicated, friendly and objective English teacher. "
    "Your goal is to help the student practice conversation and improve their English.\n\n"
    "STRICT LANGUAGE GUIDELINES:\n"
    "1. Always speak and write 100% in ENGLISH. Never switch to Portuguese, even for corrections.\n"
    "2. Use Portuguese ONLY if the student explicitly asks for a translation of a specific word or phrase they didn't understand (e.g. 'How do you say this in Portuguese?' or 'Can you translate?').\n"
    "3. FILES: If the student sends a file, analyze the extracted text and respond about the content in English.\n\n"
    "CORRECTION GUIDELINES:\n"
    "4. Always identify grammar, vocabulary, or pronunciation mistakes in the student's message.\n"
    "5. After your conversational reply, add a short '📝 Feedback' section entirely in English.\n"
    "6. In the Feedback section, point out errors gently and explain why, adapted to the student's level.\n"
    "7. If there are no errors, give a brief positive reinforcement (e.g. 'Great job! Your sentence was perfect.').\n"
    "8. Keep the feedback concise and encouraging — never make the student feel bad.\n\n"
    "Example format:\n"
    "Your conversational reply here...\n\n"
    "📝 Feedback:\n"
    "- 'I go to school yesterday' → should be 'I went to school yesterday' (use past tense for completed actions).\n"
)

import io
import pypdf
import docx

def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

async def extract_text_from_file(filename: str, content_b64: str) -> str:
    """Extrai texto de PDF, Docx ou Texto puro."""
    try:
        file_bytes = base64.b64decode(content_b64)
        if filename.lower().endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            return "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
        elif filename.lower().endswith(".docx"):
            doc = docx.Document(io.BytesIO(file_bytes))
            return "\n".join([p.text for p in doc.paragraphs])
        else:
            return file_bytes.decode("utf-8", errors="ignore")
    except Exception as e:
        return f"[Erro ao ler arquivo {filename}: {str(e)}]"

# ─── REST 

class CreateConversationBody(BaseModel):
    title: str = "Nova conversa"

class RenameConversationBody(BaseModel):
    title: str

@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def new_conversation(
    body: CreateConversationBody = CreateConversationBody(),
    current_user: dict = Depends(get_current_user),
):
    return await create_conversation(
        username=current_user["username"],
        title=body.title,
        model=LLM_PROVIDER,
    )

@router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    return await list_conversations(current_user["username"])

@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
):
    deleted = await delete_conversation(conversation_id, current_user["username"])
    if not deleted:
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

# ─── WebSocket 

@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str = Query(...)):
    payload = verify_token(token)
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

            msg_type = msg.get("type")
            content  = msg.get("content", "").strip()
            conv_id  = msg.get("conversation_id")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if msg_type in ["text", "audio", "file"]:
                if not conv_id:
                    await websocket.send_json({"type": "error", "detail": "conversation_id obrigatório"})
                    continue

                if msg_type == "file":
                    filename = msg.get("filename", "file.txt")
                    file_b64 = msg.get("content")
                    extracted_text = await extract_text_from_file(filename, file_b64)
                    content = f"[Arquivo: {filename}]\n{extracted_text}"
                    await websocket.send_json({"type": "status", "text": f"Arquivo {filename} lido."})

                elif msg_type == "audio":
                    try:
                        audio_b64 = msg.get("audio")
                        audio_bytes = base64.b64decode(audio_b64)
                        content = await transcribe_audio(audio_bytes, filename="input.webm")
                        await websocket.send_json({"type": "transcription", "text": content})
                    except Exception as e:
                        await websocket.send_json({"type": "error", "detail": f"Erro no STT: {str(e)}"})
                        continue

                if not content:
                    continue

                history = await load_history(conv_id)
                if not history:
                    print(f"[DEBUG] Creating auto-title for {conv_id}: {content[:20]}...")
                    await auto_title(conv_id, username, content[:50])

                await save_message(conv_id, username, "user", content)
                history.append({"role": "user", "content": content})

                await websocket.send_json({"type": "stream_start", "conversation_id": conv_id})
                full_response = ""
                # busca custom prompt do usuário, se tiver, senão usa o SYSTEM_PROMPT padrão
                user_rows = get_client().table("users") \
                    .select("custom_prompt") \
                    .eq("username", username) \
                    .limit(1) \
                    .execute().data
                extra = (user_rows[0].get("custom_prompt") or "").strip() if user_rows else ""
                effective_prompt = SYSTEM_PROMPT
                if extra:
                    effective_prompt += f"\n\nExtra instructions from user:\n{extra}"
                try:
                    async for token_chunk in stream_llm(effective_prompt, history):
                        full_response += token_chunk
                        await websocket.send_json({"type": "stream_token", "token": token_chunk})
                except Exception as e:
                    await websocket.send_json({"type": "error", "detail": f"Erro na LLM: {str(e)}"})
                    continue

                await save_message(conv_id, username, "assistant", full_response)
                audio_response_b64 = await text_to_speech(full_response)
                if audio_response_b64:
                    await websocket.send_json({"type": "audio_response", "audio": audio_response_b64, "conversation_id": conv_id})

                await websocket.send_json({"type": "stream_end", "conversation_id": conv_id})

    except WebSocketDisconnect:
        print(f"[WS] {username} desconectou")
    except Exception as e:
        print(f"[WS] Erro geral: {e}")

# rota de pegar mensagens antigas da conversa, para mostrar o histórico quando o usuário abrir a conversa no frontend
@router.get("/conversations/{conversation_id}/messages")
async def get_history(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    messages = await load_history(conversation_id)

    if messages is None:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    return messages