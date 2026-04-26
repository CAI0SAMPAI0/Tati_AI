from __future__ import annotations

import base64
import io
import json
from datetime import date, datetime, timedelta

import docx
import pypdf
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel

from core.config import settings
from routers.deps import get_current_user
from routers.users.permissions import SPECIAL_USERS
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

PAID_START     = date(2026, 6, 30)
FREE_MSG_LIMIT = 5

_SOURCE_MARKERS = ["📚 Fontes", "Fontes consultadas:", "Sources:", "References:"]


# ── Models ────────────────────────────────────────────────────────────────────
class RenameConversationBody(BaseModel):
    title: str


class TTSRequest(BaseModel):
    text: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _verify_ws_token(token: str) -> dict | None:
    from core.security import decode_token
    return decode_token(token)


def _clean_tts_text(text: str) -> str:
    """Remove marcadores de fontes, feedback e asteriscos do texto antes de enviar ao TTS."""
    text = text.replace("*", "")
    
    # Remove seções de feedback/correção para não ser lida no áudio
    markers_to_cut = [
        "📝 Feedback", "Feedback:", "Correction:", "📝 Correção", "Note:",
        "You could say it like this", "A small correction", "By the way, it's better to say",
        "Just a quick tip"
    ]
    for marker in markers_to_cut:
        if marker in text:
            text = text.split(marker)[0]

    for marker in _SOURCE_MARKERS:
        if marker in text:
            text = text.split(marker)[0]
            break
    return text.strip()


def _get_full_user(username: str) -> dict:
    """Retorna dados completos do usuário incluindo role e flags de acesso."""
    rows = (
        get_client()
        .table("users")
        .select("username, name, role, focus, is_exempt, is_premium_active, plan_type, free_messages_used, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    return rows[0] if rows else {}


def _get_active_subscription(username: str) -> dict | None:
    """Retorna a assinatura ativa do usuário, se existir."""
    try:
        rows = (
            get_client()
            .table("subscriptions")
            .select("*")
            .eq("username", username)
            .eq("status", "active")
            .order("expires_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        return rows[0] if rows else None
    except Exception as exc:
        print(f"[WARN] Falha ao buscar assinatura: {exc}")
        return None


def _in_grace_period(today: date, expires: date) -> bool:
    """
    Verifica se ainda está no grace period (até 5 dias úteis após vencimento).
    Pula finais de semana e conta apenas dias úteis.
    """
    if today <= expires:
        return False
    business_days = 0
    check = expires + timedelta(days=1)
    while check <= today:
        if check.weekday() < 5:  # 0=segunda ... 4=sexta
            business_days += 1
        check += timedelta(days=1)
    return business_days <= 5


def _get_free_messages_used(username: str) -> int:
    """Retorna quantas mensagens gratuitas o usuário já usou."""
    try:
        rows = (
            get_client()
            .table("users")
            .select("free_messages_used")
            .eq("username", username)
            .limit(1)
            .execute()
            .data
        )
        return (rows[0].get("free_messages_used") or 0) if rows else 0
    except Exception as exc:
        print(f"[WARN] Falha ao buscar free_messages_used: {exc}")
        return 0


def _check_chat_access(username: str) -> dict:
    """
    Verifica se o usuário pode enviar mensagens.
    Retorna dict com:
      - allowed: bool
      - reason: str | None
      - free_messages_remaining: int | None
    """
    today = date.today()

    user      = _get_full_user(username)
    print(f"DEBUG ACCESS: username={username}, today={today}, PAID_START={PAID_START}")
    print(f"DEBUG ACCESS: user data = {user}")
    is_admin  = user.get("role") in settings.staff_roles or username in SPECIAL_USERS
    is_exempt = user.get("is_exempt", False) or username in SPECIAL_USERS
    print(f"DEBUG ACCESS: is_admin={is_admin}, is_exempt={is_exempt}")

    # Admin e staff ou Usuário Especial → sempre permitido
    if is_admin or is_exempt:
        return {"allowed": True, "reason": None, "free_messages_remaining": None}
    if user.get("is_premium_active"):
        return {"allowed": True, "reason": None, "free_messages_remaining": None}

    # Período gratuito (antes de 30/06/2026) → só para quem já era usuário
    if today < PAID_START:
        user_created = date.fromisoformat(user["created_at"][:10])
        if user_created < PAID_START:
            return {"allowed": True, "reason": None, "free_messages_remaining": None}
        # Usuário novo → segue para verificar assinatura ou mensagens gratuitas

    # Assinatura ativa ou em grace period
    sub = _get_active_subscription(username)
    print(f"DEBUG ACCESS: sub={sub}")

    if sub:
        expires  = date.fromisoformat(sub["expires_at"][:10])
        in_grace = _in_grace_period(today, expires)
        if today <= expires or in_grace:
            return {"allowed": True, "reason": None, "free_messages_remaining": None}

    # Sem assinatura → verifica mensagens gratuitas
    used      = _get_free_messages_used(username)
    print(f"DEBUG ACCESS: used={used}, remaining={max(0, FREE_MSG_LIMIT - used)}")

    remaining = max(0, FREE_MSG_LIMIT - used)

    if remaining <= 0:
        return {
            "allowed": False,
            "reason": "free_limit_reached",
            "free_messages_remaining": 0,
        }

    return {
        "allowed": True,
        "reason": None,
        "free_messages_remaining": remaining,
    }


def _increment_free_messages(username: str) -> None:
    """Incrementa o contador de mensagens gratuitas usadas."""
    try:
        user = _get_full_user(username)
        used = user.get("free_messages_used") or 0
        get_client().table("users").update(
            {"free_messages_used": used + 1}
        ).eq("username", username).execute()
    except Exception as exc:
        print(f"[WARN] Falha ao incrementar free_messages: {exc}")


async def _get_user_profile(username: str) -> UserProfile:
    rows = (
        get_client()
        .table("users")
        .select("name, custom_prompt, level, focus")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
    )
    data = rows[0] if rows else {}
    return UserProfile(
        username=username,
        name=data.get("name") or username,
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


class CreateConversationBody(BaseModel):
    title: str = "Nova conversa"
    is_simulation: bool = False


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
        is_simulation=body.is_simulation
    )


from fastapi.responses import FileResponse
from services.pdf_generator import generate_report_pdf

class DownloadReportRequest(BaseModel):
    content: str
    filename: str = "tati_study_report.pdf"

@router.post("/download_report")
async def download_report(body: DownloadReportRequest, current_user: dict = Depends(get_current_user)):
    try:
        path = generate_report_pdf(body.content, body.filename)
        return FileResponse(path, filename=body.filename, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar PDF: {str(e)}")


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
    # Filtra mensagens de sistema que são cache de resumo
    filtered = [m for m in messages if not (m.get("role") == "system" and m.get("content", "").startswith("SUMMARY_CACHE_"))]
    return filtered


@router.post("/tts")
async def tts_word(body: TTSRequest, current_user: dict = Depends(get_current_user)):
    if not body.text or len(body.text) > 200:
        raise HTTPException(status_code=400, detail="Texto inválido ou muito longo")
    audio_b64 = await text_to_speech(body.text)
    if not audio_b64:
        raise HTTPException(status_code=503, detail="TTS indisponível")
    return {"audio": audio_b64}


@router.get("/conversations/{conversation_id}/summary")
async def get_summary(conversation_id: str, lang: str = Query(default='pt'), current_user: dict = Depends(get_current_user)):
    username = current_user["username"]
    history = await load_history(conversation_id)
    if not history or len(history) < 3:
        raise HTTPException(status_code=400, detail="Mensagens insuficientes para gerar resumo")

    # 1. Verifica Cache no histórico (mensagem do sistema começando com SUMMARY_CACHE_)
    cache_prefix = f"SUMMARY_CACHE_{lang.upper()}:"
    for m in history:
        if m.get("role") == "system" and m.get("content", "").startswith("SUMMARY_CACHE_"):
            # Verifica se o idioma bate, senão ignora o cache
            if m.get("content", "").startswith(cache_prefix):
                print(f"[Summary] Usando cache para {conversation_id}")
                return {"summary": m["content"].replace(cache_prefix, "").strip()}

    conversation_text = "\n\n".join(
        f"{'TATI' if m['role'] == 'assistant' else 'STUDENT'}: {m['content']}"
        for m in history if m['role'] in ('assistant', 'user')
    )
    
    # Gera exercícios silenciosamente para a página de Atividades
    try:
        from services.exercise_generator import generate_exercises_from_history
        await generate_exercises_from_history(username, conversation_text)
    except Exception as e:
        print(f"[Summary] Erro ao gerar exercícios: {e}")

    if lang.startswith("en"):
        prompt_system = (
            "You are an English teaching coordinator. Analyze the transcript and write a "
            "performance report for the student (in English) with:\n\n"
            "🌟 **Strengths:** (praise what went well)\n"
            "🛠️ **Areas to Improve:** (2-3 errors with corrections)\n"
            "📚 **New Vocabulary:** (3-5 words/expressions with meaning)\n\n"
            "Be encouraging and didactic. DO NOT mention exercises here."
        )
    else:
        prompt_system = (
            "Você é um coordenador pedagógico de inglês. Analise a transcrição e escreva um "
            "relatório para o aluno (em português) com:\n\n"
            "🌟 **Pontos Fortes:** (elogie o que foi bem)\n"
            "🛠️ **Para Melhorar:** (2-3 erros com correção)\n"
            "📚 **Vocabulário Novo:** (3-5 palavras/expressões com tradução)\n\n"
            "Seja encorajador e didático. NÃO mencione exercícios aqui."
        )
        
    try:
        resumo = await groq_chat(
            messages=[
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": f"Conversa:\n\n{conversation_text}"},
            ],
            max_tokens=1500,
        )
        final_summary = resumo.strip()
        
        # 2. Salva no Cache (como mensagem de sistema)
        try:
            await save_message(conversation_id, username, "system", cache_prefix + final_summary)
        except Exception as e:
            print(f"[Summary] Falha ao salvar cache: {e}")

        return {"summary": final_summary}
    except GroqKeyError as exc:
        raise HTTPException(status_code=503, detail=f"Erro ao gerar resumo: {exc}")


# ── WebSocket ─────────────────────────────────────────────────────────────────


@router.websocket("/ws")
async def chat_ws(websocket: WebSocket, token: str | None = Query(None)):
    ws_token = token
    subprotocol = None
    
    protocols = websocket.headers.get("sec-websocket-protocol", "").split(",")
    for p in protocols:
        p = p.strip()
        if p != "access_token" and not ws_token:
            ws_token = p
            subprotocol = "access_token"
    
    payload = _verify_ws_token(ws_token)
    if not payload:
        await websocket.close(code=4001, reason="Token inválido")
        return

    await websocket.accept(subprotocol=subprotocol)
    username = payload["sub"]
    
    print(f"[WS] Conexão aceita para usuário: {username}")

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
        print(f"[WS] {username} deslogou")
    except Exception as exc:
        print(f"[WS] Erro geral: {exc}")


async def _handle_chat_message(websocket: WebSocket, msg: dict, username: str) -> None:
    access = {"allowed": True, "reason": None, "free_messages_remaining": None}

    try:
        msg_type = msg.get("type")
        content  = msg.get("content", "").strip()
        conv_id  = msg.get("conversation_id")
        # is_voice_mode agora se refere à INTERFACE de Voz, não apenas se a entrada foi áudio
        is_voice_mode = (msg.get("origin") == "voice")

        if msg_type not in ("text", "audio", "file"):
            await websocket.send_json({"type": "error", "detail": "Tipo de mensagem inválido"})
            return
            
        if not conv_id:
            await websocket.send_json({"type": "error", "detail": "conversation_id ausente"})
            return

        # ── Processa tipo de input ────────────────────────
        if msg_type == "file":
            filename  = msg.get("filename", "file.txt")
            extracted = await extract_text_from_file(filename, msg.get("content", ""))
            caption   = msg.get("caption", "").strip()
            content   = f"{caption}\n\n[Arquivo: {filename}]\n{extracted}" if caption else f"[Arquivo: {filename}]\n{extracted}"
            await websocket.send_json({"type": "status", "text": f"Arquivo {filename} lido."})

        elif msg_type == "audio":
            try:
                user_db = _get_full_user(username)
                user_real_name = user_db.get("name") or user_db.get("username") or username
                user_focus = user_db.get("focus", "")
                stt_prompt = f"User name: {user_real_name}. Learning focus: {user_focus}. The user is practicing English."
                
                audio_bytes = base64.b64decode(msg.get("audio", ""))
                content = await transcribe_audio(audio_bytes, filename="input.webm", prompt=stt_prompt)
                await websocket.send_json({"type": "transcription", "text": content})
            except Exception as exc:
                print(f"DEBUG: Erro no STT: {exc}")
                await websocket.send_json({"type": "error", "detail": f"Erro no STT: {exc}"})
                return

        if not content:
            return

        # ── Controle de acesso ────────────────────────────
        access = _check_chat_access(username)
        if not access["allowed"]:
            await websocket.send_json({
                "type":   "error",
                "code":   402,
                "detail": "Limite de mensagens gratuitas atingido.",
            })
            return

        remaining = access.get("free_messages_remaining")
        if remaining is not None:
            await websocket.send_json({"type": "free_warning", "remaining": remaining})

        # ── Histórico e auto-título ───────────────────────
        history = await load_history(conv_id)
        if not history:
            await auto_title(conv_id, username, content[:50])

        # Dica de Sumário após 3 mensagens (1 histórico + 2 usuário = 3)
        user_msg_count = len([m for m in (history or []) if m.get("role") == "user"])
        if user_msg_count == 2:
            await websocket.send_json({
                "type": "status",
                "text": "💡 Tip: You've sent 3 messages! Click the 'Summary' button anytime for a report and exercises."
            })

        # ── Salva Mensagem e Registra Streak ──────────────
        print(f"DEBUG: Salvando mensagem do usuário...")
        await save_message(conv_id, username, "user", content)
        history.append({"role": "user", "content": content})
        try:
            new_user_msg_count = user_msg_count + 1
            if new_user_msg_count % 3 == 0:
                from routers.activities.podcasts import invalidate_podcast_recommendations_cache

                invalidate_podcast_recommendations_cache(username)
        except Exception as e:
            print(f"[Podcast Reco] Erro ao invalidar cache: {e}")

        # contando erros e geração de atividades automaticamente
        try:
            from services.streaks import record_study_day
            record_study_day(username)
        except Exception as e:
            print(f"[Streak] Erro ao registrar: {e}")

        # ── Monta prompt ──────────────────────────────────
        profile          = await _get_user_profile(username)
        rag_result       = obter_contexto_rag(content)
        effective_prompt = build_effective_prompt(profile, rag_result.contexto)
        
        if is_voice_mode:
            effective_prompt += "\n\nCRITICAL: User is in VOICE MODE. DO NOT generate PDFs or long reports. Keep responses very short for listening."

        # ── Streaming ─────────────────────────────────────
        level_limits = {
            "Beginner": 300,
            "Pre-Intermediate": 500,
            "Intermediate": 800,
            "Advanced": 1200,
            "Business English": 1200
        }
        max_tokens = level_limits.get(profile.level, 1500)

        # Se for pedido de relatório/PDF, aumenta o limite para garantir conteúdo completo
        _report_keywords = ["report", "pdf", "study material", "study guide", "lesson", "exercise",
                             "worksheet", "relatorio", "relatório", "material", "exercicio", "exercício"]
        _is_report_request = any(kw in content.lower() for kw in _report_keywords)
        if _is_report_request:
            max_tokens = 4000

        print(f"DEBUG: Iniciando stream com Groq (max_tokens={max_tokens})...")
        await websocket.send_json({"type": "stream_start", "conversation_id": conv_id})
        full_response = ""

        try:
            async for token_chunk in stream_llm(effective_prompt, history, max_tokens=max_tokens):
                full_response += token_chunk
                await websocket.send_json({"type": "stream_token", "token": token_chunk})
        except Exception as exc:
            print(f"DEBUG: Erro na LLM: {exc}")
            await websocket.send_json({"type": "error", "detail": f"Erro na LLM: {exc}"})
            return

        # ── AutoExercise: contando erros e geração de atividades ──────────
        try:
            correction_markers = [
                "should be", "correct form", "you should say",
                "instead of", "the correct", "mistake", "incorrect",
                "correction:", "❌", "✅ correct", "you could say",
                "small correction", "better to say", "quick tip"
            ]
            response_lower = full_response.lower()
            has_correction = any(m in response_lower for m in correction_markers)
            if has_correction:
                from services.upstash import cache_get, cache_set
                db = get_client() # Supabase client
                error_key = f'error_count:{username}'
                cached = await cache_get(error_key)
                count = int(cached) + 1 if cached else 1
                await cache_set(error_key, str(count), ttl=604800) # 7 dias

                if count >= 5:
                    await cache_set(error_key, '0', ttl=604800)
                    type_key = f'exercise_type:{username}'
                    type_cached = await cache_get(type_key)
                    current_type = int(type_cached) if type_cached else 0
                    next_type = (current_type + 1) % 4
                    await cache_set(type_key, str(next_type), ttl=604800)

                    exercise_types = ["quiz", "story", "fill_in", "dialogue"]
                    chosen_type = exercise_types[current_type]

                    # Busca contexto das últimas conversas
                    from services.exercise_generator import generate_exercises_from_history
                    convs = db.table("conversations").select("id").eq("username", username).order("updated_at", desc=True).limit(5).execute()
                    context = ""
                    for c in (convs.data or []):
                        msgs_ctx = db.table("messages").select("content, role").eq("session_id", c["id"]).order("created_at").limit(30).execute()
                        context += "\n\n" + "\n".join(f"{m['role'].upper()}: {m['content']}" for m in msgs_ctx.data)

                    await generate_exercises_from_history(username, context, exercise_type=chosen_type)
                    await websocket.send_json({
                        "type": "status",
                        "text": "🎯 Nova atividade personalizada gerada com base nos seus erros! Veja em Atividades."
                    })
        except Exception as e:
            print(f"[AutoExercise] Erro: {e}")

        # ── TTS e finalização ─────────────────────────────
        tts_text = _clean_tts_text(full_response)
        audio_b64 = await text_to_speech(tts_text)
        await save_message(conv_id, username, "assistant", full_response, audio_b64=audio_b64)

        try:
            from services.trophy_service import check_chat_trophies
            check_chat_trophies(username)
        except Exception as e:
            print(f"[Trophy Chat] Erro: {e}")

        if access.get("free_messages_remaining") is not None:
            _increment_free_messages(username)

        if audio_b64:
            await websocket.send_json({"type": "audio_response", "audio": audio_b64, "conversation_id": conv_id})

        await websocket.send_json({"type": "stream_end", "conversation_id": conv_id})

        try:
            db = get_client()
            db.table("study_sessions").insert({
                "username": username,
                "activity_type": "chat",
                "duration_minutes": 2
            }).execute()
        except Exception as e:
            print(f"[StudyTime] Erro ao gravar sessão: {e}")

    except Exception as e:
        print(f"FATAL ERROR in _handle_chat_message: {e}")
        import traceback
        traceback.print_exc()
        await websocket.send_json({"type": "error", "detail": f"Erro interno: {str(e)}"})


