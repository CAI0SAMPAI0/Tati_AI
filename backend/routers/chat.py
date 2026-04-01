import json
import os
import base64

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
from pydantic import BaseModel
from services.database import get_client
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
from services.llm import stream_llm, transcribe_audio, text_to_speech, LLM_PROVIDER, groq_chat
from services.rag_search import obter_contexto_rag

router = APIRouter()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM      = "HS256"

# FIX: Stronger language enforcement — prevents AI from translating student messages
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "You are TATI, a dedicated, friendly and objective English teacher. "
    "Your goal is to help the student practice conversation and improve their English.\n\n"
    "CRITICAL LANGUAGE RULE — READ CAREFULLY:\n"
    "1. You MUST ALWAYS write your ENTIRE response in ENGLISH ONLY. No exceptions.\n"
    "2. Do NOT translate the student's message into Portuguese under any circumstance.\n"
    "3. Do NOT repeat the student's message back to them in another language.\n"
    "4. Even if the student writes in Portuguese, you respond ONLY in English — gently remind them to write in English.\n"
    "5. The ONLY time you may use a Portuguese word is when the student explicitly asks: 'how do you say X in Portuguese?' — in that case, give only the translation word/phrase, then continue in English.\n"
    "6. Never switch to Portuguese to 'help' the student understand. Always use simple English appropriate to their level instead.\n\n"
    "FILES: If the student sends a file, analyze the extracted text and respond about the content in English.\n\n"
    "CORRECTION GUIDELINES:\n"
    "7. Always identify grammar, vocabulary, or pronunciation mistakes in the student's message.\n"
    "8. After your conversational reply, add a short '📝 Feedback' section entirely in English.\n"
    "9. In the Feedback section, point out errors gently and explain why, adapted to the student's level.\n"
    "10. If there are no errors, give brief positive reinforcement (e.g. 'Great job! Your sentence was perfect.').\n"
    "11. Keep the feedback concise and encouraging — never make the student feel bad.\n\n"
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

def _clean_text(text: str) -> str:
    """Remove caracteres nulos e outros caracteres problemáticos para o Supabase."""
    return text.replace("\x00", "").replace("\u0000", "")

async def extract_text_from_file(filename: str, content_b64: str) -> str:
    """Extrai texto de PDF, Docx ou Texto puro."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        file_bytes = base64.b64decode(content_b64)

        if ext == "pdf":
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
            return _clean_text(text) or "[PDF sem texto extraível]"

        elif ext == "docx":
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs])
            return _clean_text(text) or "[Documento sem texto]"

        elif ext in ("png", "jpg", "jpeg", "gif", "webp", "bmp"):
            # Imagens não têm texto — avisa a IA para descrever pelo contexto
            return f"[Imagem enviada: {filename}. Descreva que recebeu uma imagem e peça ao aluno para explicar o que é ou o que quer sobre ela.]"

        else:
            text = file_bytes.decode("utf-8", errors="ignore")
            return _clean_text(text) or "[Arquivo sem conteúdo legível]"

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

# ─── TTS endpoint para palavras individuais (word_tooltip) no frontend

from fastapi import Query as FastAPIQuery

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
async def tts_word(body: TTSRequest, current_user: dict = Depends(get_current_user)):
    """Converte uma palavra/frase curta em áudio usando o mesmo TTS da IA."""
    if not body.text or len(body.text) > 200:
        raise HTTPException(status_code=400, detail="Texto inválido ou muito longo")

    audio_b64 = await text_to_speech(body.text)
    if not audio_b64:
        raise HTTPException(status_code=503, detail="TTS indisponível")

    return {"audio": audio_b64}

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
                    caption = msg.get("caption", "").strip()
                    extracted_text = await extract_text_from_file(filename, file_b64)
                    file_part = f"[Arquivo: {filename}]\n{extracted_text}"
                    content = f"{caption}\n\n{file_part}" if caption else file_part
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
                # Puxa o custom prompt do usuário
                user_rows = get_client().table("users") \
                    .select("custom_prompt", "level", "focus") \
                    .eq("username", username) \
                    .limit(1) \
                    .execute().data
                extra = (user_rows[0].get("custom_prompt") or "").strip() if user_rows else ""
                # puxando o nível e foco do aluno para dar instruções extras à IA
                nivel = user_rows[0].get("level")
                foco = user_rows[0].get("focus")
                instrucao_perfil = (f"\n\n--- STUDENT PROFILE ---\n"
                    f"English Level: {nivel}\n"
                    f"Main Focus: {foco}\n\n"
                    "ADAPTATION RULES:\n"
                    "- If the level is 'beginner' or 'Beginner': Use extremely simple words, short sentences, and avoid complex grammar. Explain things very slowly.\n"
                    "- If the level is 'Intermediate' or 'intermediate': Speak naturally but avoid overly complex slang. Introduce useful phrasal verbs.\n"
                    "- If the level is 'Advanced' or 'advanced': Talk like a native speaker, use idioms, complex vocabulary, and correct even minor stylistic errors.\n"
                    "- Always align your examples and conversation topics with their Main Focus."
                )
                # --- A MÁGICA DO RAG AQUI (Versão Segura) ---
                resultado_rag = obter_contexto_rag(content)
                contexto_rag = resultado_rag["contexto"]
                fontes_rag = resultado_rag["fontes"]
                
                instrucao_rag = (
                    "\n\n--- INSTRUÇÕES DA BIBLIOTECA (RAG) ---\n"
                    "Use o contexto abaixo, retirado dos livros e materiais de aula, para embasar sua resposta. "
                    "Se a resposta estiver lá, use-a. Se não estiver, use seu conhecimento geral para ajudar o aluno, mas seja educativa.\n\n"
                    f"CONTEXTO:\n{contexto_rag}\n"
                    "REGRAS ESTRITAS DE COMPORTAMENTO:\n"
                    "1. NUNCA mencione que você tem acesso a um livro, documento ou \"conhecimento de base\".\n"
                    "2. NUNCA leia, copie ou repita o texto do livro palavra por palavra.\n"
                    "3. Use o texto do livro APENAS como inspiração silenciosa para saber qual vocabulário ou gramática ensinar.\n"
                    "4. Suas respostas devem ser curtas, naturais e parecer uma pessoa conversando, e não um áudio-livro.\n"
                    "5. Fale diretamente com o aluno focando na prática do idioma.\n"
                    "6. NUNCA se justifique. NUNCA diga 'I removed the references' ou 'Based on the text'. Apenas entregue a resposta e o feedback naturalmente."
                )

                # Monta o super prompt invisível
                effective_prompt = SYSTEM_PROMPT + instrucao_perfil+instrucao_rag
                if extra:
                    effective_prompt += f"\n\nExtra instructions from user:\n{extra}"
                try:
                    async for token_chunk in stream_llm(effective_prompt, history):
                        full_response += token_chunk
                        await websocket.send_json({"type": "stream_token", "token": token_chunk})
                except Exception as e:
                    await websocket.send_json({"type": "error", "detail": f"Erro na LLM: {str(e)}"})
                    continue
                texto_para_falar = full_response
                texto_para_falar = texto_para_falar.replace('*', "")  # remove asteriscos para evitar problemas no TTS
                # Lista de possíveis variações de marcadores de feedback para cortar a resposta antes de enviar ao TTS, garantindo que o áudio seja apenas a parte conversacional
                marcadores_de_fontes = ["📚 Fontes", "Fontes consultadas:", "Sources:", "References:"]
                for marcador in marcadores_de_fontes:
                    if marcador in texto_para_falar:
                        texto_para_falar = texto_para_falar.split(marcador)[0]
                        break
                texto_para_falar = texto_para_falar.strip()
                '''if fontes_rag:
                    full_response += f"\n\n**📚 Fontes consultadas:**\n{fontes_rag}"'''

                await save_message(conv_id, username, "assistant", full_response)
                audio_response_b64 = await text_to_speech(texto_para_falar)
                if audio_response_b64:
                    await websocket.send_json({"type": "audio_response", "audio": audio_response_b64, "conversation_id": conv_id})

                await websocket.send_json({"type": "stream_end", "conversation_id": conv_id})

    except WebSocketDisconnect:
        print(f"[WS] {username} desconectou")
    except Exception as e:
        print(f"[WS] Erro geral: {e}")

# rota de pegar mensagens antigas da conversa
@router.get("/conversations/{conversation_id}/messages")
async def get_history(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    messages = await load_history(conversation_id)

    if messages is None:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    return messages

# gerando resumo de aula
@router.get("/conversations/{conversation_id}/summary")
async def get_summary(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    # pegando o histórico da conversa
    history = await load_history(conversation_id)
    print(f"Identificando conversa {conversation_id} para resumo. Total mensagens: {len(history) if history else 0}")
    if not history or len(history) < 5:  # precisa de pelo menos 5 mensagens para um resumo decente
        raise HTTPException(status_code=400, detail="Conversa sem mensagens suficientes para gerar resumo")
    
    # formatando o histórico
    texto_conv = ""
    for msg in history:
        papel = "TATI (Teacher)" if msg["role"] == "assistant" else "STUDENT"
        texto_conv += f"{papel}: {msg['content']}\n\n"
        
    # prompt para gerar o resumo
    prompt_resumo = (
        "Você é um coordenador pedagógico de inglês. Sua tarefa é analisar a transcrição "
        "de uma conversa entre a professora Tati e um aluno. "
        "Escreva um relatório direto para o aluno (em português, para facilitar o estudo), "
        "com a seguinte estrutura:\n\n"
        "🌟 **Pontos Fortes:** (Elogie o que o aluno fez bem)\n"
        "🛠️ **Para Melhorar:** (Liste 2 ou 3 erros gramaticais ou de estrutura que o aluno cometeu, explicando a correção)\n"
        "📚 **Vocabulário Novo:** (Extraia 3 a 5 palavras ou expressões úteis que apareceram na conversa, com tradução)\n\n"
        "Seja encorajador, didático e use formatação Markdown."
    )
    messages = [
        {"role": "system", "content": prompt_resumo},
        {"role": "user", "content": f'Aqui está a conversa para analisar:\n\n{texto_conv}'}
    ]
    try:
        resumo = await groq_chat(messages, max_tokens=1500)
        return {"summary": resumo}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Erro ao gerar resumo: {str(e)}")