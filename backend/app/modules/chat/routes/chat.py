from __future__ import annotations

import logging

import json
from app.core.exceptions import ContentNotFoundError
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from pydantic import BaseModel

from app.core.dependencies.auth import get_current_user
from app.modules.chat.services.chat_service import ChatService
from app.shared.services.history import (
    create_conversation,
    delete_conversation,
    list_conversations,
    load_history,
    rename_conversation,
    update_message,
)
from app.modules.chat.services.llm import text_to_speech, groq_chat
from app.core.config import settings

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────
class RenameConversationBody(BaseModel):
    title: str


class EditMessageBody(BaseModel):
    content: str


class TTSRequest(BaseModel):
    text: str


class CreateConversationBody(BaseModel):
    title: str = 'Nova conversa'
    is_simulation: bool = False
    simulation_id: str | None = None


# ── REST endpoints ────────────────────────────────────────────────────


@router.post('/conversations', status_code=status.HTTP_201_CREATED)
async def new_conversation(
    body: CreateConversationBody = CreateConversationBody(),
    current_user: dict = Depends(get_current_user),
):
    return await create_conversation(
        username=current_user['username'],
        title=body.title,
        model=settings.llm_provider,
        is_simulation=body.is_simulation,
        simulation_id=body.simulation_id,
    )


@router.get('/conversations')
async def get_conversations(
        current_user: dict = Depends(get_current_user)):
    return await list_conversations(current_user['username'])


@router.delete('/conversations/{conversation_id}',
               status_code=status.HTTP_204_NO_CONTENT)
async def remove_conversation(
    conversation_id: str, current_user: dict = Depends(get_current_user)
):
    if not await delete_conversation(conversation_id, current_user['username']):
        raise ContentNotFoundError(detail='Conversa não encontrada')


@router.patch('/conversations/{conversation_id}/title')
async def update_title(
    conversation_id: str,
    body: RenameConversationBody,
    current_user: dict = Depends(get_current_user),
):
    conv = await rename_conversation(
        conversation_id, current_user['username'], body.title
    )
    if not conv:
        raise ContentNotFoundError(detail='Conversa não encontrada')
    return conv


@router.get('/conversations/{conversation_id}/messages')
async def get_history(
    conversation_id: str, current_user: dict = Depends(get_current_user)
):
    from app.core.database import get_client
    db = get_client()
    # Verifica se a conversa pertence ao usuário
    conv = db.table('conversations').select(
        'username').eq('id', conversation_id).execute()
    if not conv.data or conv.data[0]['username'] != current_user['username']:
        raise ContentNotFoundError(detail='Conversa não encontrada')

    messages = await load_history(conversation_id)
    return [
        m
        for m in messages
        if not (
            m.get('role') == 'system'
            and m.get('content', '').startswith('SUMMARY_CACHE_')
        )
    ]


@router.patch('/conversations/{conversation_id}/messages/{message_id}')
async def edit_message(
    conversation_id: str,
    message_id: str,
    body: EditMessageBody,
    current_user: dict = Depends(get_current_user),
):
    # message_id pode ser int ou str dependendo do banco, tentamos
    # converter
    try:
        m_id = int(message_id)
    except ValueError:
        m_id = message_id

    msg = await update_message(m_id, current_user['username'], body.content)
    if not msg:
        raise ContentNotFoundError(detail='Mensagem não encontrada')
    return msg


@router.get('/conversations/{conversation_id}/summary')
async def get_summary(
    conversation_id: str,
    lang: str = Query(default='pt'),
    current_user: dict = Depends(get_current_user),
):
    from app.core.database import get_client
    db = get_client()
    # Verifica se a conversa pertence ao usuário
    conv = db.table('conversations').select(
        'username').eq('id', conversation_id).execute()
    if not conv.data or conv.data[0]['username'] != current_user['username']:
        raise ContentNotFoundError(detail='Conversa não encontrada')

    # Restaurado lógica de resumo simplificada para manter
    # compatibilidade
    history = await load_history(conversation_id)
    if not history or len(history) < 2:
        raise HTTPException(400, 'Poucas mensagens')

    text = '\n'.join(
        [
            f'{m["role"]}: {m["content"]}'
            for m in history
            if m['role'] in ('user', 'assistant')
        ]
    )

    if lang.lower().startswith('en'):
        prompt = f'Generate a pedagogical summary in English for this conversation:\n{text}'
    else:
        prompt = f'Gere um resumo pedagógico em Português para esta conversa:\n{text}'

    try:
        res = await groq_chat([{'role': 'user', 'content': prompt}])
        return {'summary': res}
    except Exception as e:
        logging.info(f"Error in summary: {e}")
        raise HTTPException(500, 'Erro ao gerar resumo')


@router.post('/tts')
async def tts_word(
        body: TTSRequest,
        current_user: dict = Depends(get_current_user)):
    audio_b64 = await text_to_speech(body.text)
    if not audio_b64:
        raise HTTPException(status_code=503, detail='TTS indisponível')
    return {'audio': audio_b64}


# ── WebSocket ─────────────────────────────────────────────────────────


@router.websocket('/ws')
async def chat_ws(
    websocket: WebSocket,
    token: str | None = Query(None),
    simulation_id: str | None = Query(None),
    service: ChatService = Depends(),
):
    '''logging.info(f'--- [WS DEBUG START] ---')
    logging.info(f'[WS] Query Token: {token[:10] if token else "None"}')
    logging.info(f'[WS] Headers: {dict(websocket.headers)}')'''

    from app.core.security import decode_token

    # Restaurar suporte a Sec-WebSocket-Protocol (comum em SPAs)
    ws_token = token
    subprotocol = None
    header_protocols = websocket.headers.get(
        'sec-websocket-protocol', '')
    # logging.info(f'[WS] Sec-WebSocket-Protocol Header: {header_protocols}')

    if header_protocols:
        protocols = [p.strip() for p in header_protocols.split(',')]
        for p in protocols:
            if p != 'access_token' and not ws_token:
                ws_token = p
                subprotocol = 'access_token'
                logging.info(
                    f'[WS] Extracted token from subprotocol: {ws_token[:10]}...')

    # logging.info(f'[WS] Final ws_token: {ws_token[:10] if ws_token else "None"}')
    payload = decode_token(ws_token) if ws_token else None
    # logging.info(f'[WS] Payload: {payload}')

    if not payload:
        logging.info('[WS] Rejeitando: Payload nulo')
        await websocket.close(code=4001, reason='Token inválido')
        return

    # logging.info(f'[WS] Aceitando conexÃ£o com subprotocol: {subprotocol}')
    await websocket.accept(subprotocol=subprotocol)
    # logging.info(f'[WS] ConexÃ£o aceita para: {payload.get("sub")}')
    username = payload['sub']
    pending_drill_target = None

    # Se for simulação e não tiver mensagens, envia saudação inicial
    if simulation_id:
        try:
            pass
        except Exception:
            pass

    try:
        while True:
            raw = await websocket.receive_text()
            # logging.info(f'[WS] Mensagem recebida: {raw[:50]}...')
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logging.info(f'[WS] Erro de JSON: {raw}')
                continue

            if msg.get('type') == 'ping':
                await websocket.send_json({'type': 'pong'})
                continue

            # logging.info(f'[WS] Processando: {msg.get("type")}')
            try:
                pending_drill_target = await service.process_chat_message(
                    websocket, msg, username, pending_drill_target, simulation_id=simulation_id
                )
            except Exception as e:
                logging.info(f'[WS] Erro ao processar mensagem: {e}')
                import traceback
                traceback.print_exc()
                try:
                    await websocket.send_json({
                        'type': 'error',
                        'message': 'Desculpe, tive um problema de conexão. Por favor, tente novamente.'
                    })
                except BaseException:
                    pass
            # logging.info(f'[WS] Processamento finalizado')

    except WebSocketDisconnect:
        pass
    except Exception:
        import traceback
        traceback.print_exc()


LIVE_SYSTEM_PROMPT = (
    "You are TATI, a friendly and encouraging English teacher.\n\n"
    "STRICT OUTPUT FORMAT:\n"
    "You must ALWAYS respond in valid JSON format. Do not include any text or markdown code blocks (like ```json) outside the JSON. "
    "Use the following structure:\n"
    "{\n"
    '  "reply": "Your conversational response to the student, suitable for voice conversation (1-2 sentences max).",\n'
    '  "correction": "A small correction if the student made a grammar or vocabulary mistake in their English, or null if no correction is necessary."\n'
    "}\n"
)

def clean_and_parse_json(text: str) -> tuple[str, str | None]:
    import re
    import json
    clean = text.strip()
    if clean.startswith('```'):
        clean = re.sub(r'^```[\w]*\n?', '', clean)
        clean = re.sub(r'\n?```$', '', clean.strip())
    try:
        # Tenta extrair qualquer coisa entre as chaves principais
        match = re.search(r'\{.*\}', clean, re.DOTALL)
        if match:
            clean = match.group(0)
        data = json.loads(clean)
        reply = data.get('reply') or ''
        correction = data.get('correction')
        return reply.strip(), correction
    except Exception:
        # Fallback se falhar
        match = re.search(r'"reply"\s*:\s*"([^"]*)"', clean)
        if match:
            reply = match.group(1)
            correction_match = re.search(r'"correction"\s*:\s*"([^"]*)"', clean)
            correction = correction_match.group(1) if correction_match else None
            return reply, correction
        return text, None


@router.websocket('/live')
async def voice_live_ws(
    websocket: WebSocket,
    token: str | None = Query(None),
):
    import json
    import base64
    from app.core.security import decode_token
    from app.modules.chat.services.llm import transcribe_audio
    payload = decode_token(token) if token else None
    if not payload:
        await websocket.close(code=4001, reason='Token inválido')
        return

    await websocket.accept()

    try:
        while True:
            message = await websocket.receive()

            if "text" in message:
                raw_text = message["text"]
                msg_data = json.loads(raw_text)

                if msg_data.get('type') == 'ping':
                    await websocket.send_json({'type': 'pong'})
                    continue

                if msg_data.get('type') == 'audio' and msg_data.get('audio'):
                    audio_bytes = base64.b64decode(msg_data['audio'])

                    transcription = await transcribe_audio(
                        audio_bytes,
                        prompt="Phonetic practice live stream."
                    )

                    if transcription and not transcription.startswith("[Erro"):
                        await websocket.send_json({
                            'type': 'transcription',
                            'text': transcription
                        })

                        from app.modules.chat.services.llm import groq_chat
                        messages = [
                            {"role": "system", "content": LIVE_SYSTEM_PROMPT},
                            {"role": "user", "content": transcription}
                        ]
                        response_text = await groq_chat(messages)
                        reply, correction = clean_and_parse_json(response_text)
                        final_json = json.dumps({"reply": reply, "correction": correction})

                        await websocket.send_json({
                            'type': 'stream_token',
                            'content': final_json
                        })

                        audio_b64 = await text_to_speech(reply)
                        if audio_b64:
                            await websocket.send_json({
                                'type': 'audio_response',
                                'audio': audio_b64,
                                'content': final_json
                            })

                        await websocket.send_json({'type': 'stream_end'})

            elif "bytes" in message:
                audio_bytes = message["bytes"]
                transcription = await transcribe_audio(
                    audio_bytes,
                    prompt="Live audio chunk."
                )
                if transcription and not transcription.startswith("[Erro"):
                    await websocket.send_json({
                        'type': 'transcription',
                        'text': transcription
                    })

                    from app.modules.chat.services.llm import groq_chat
                    messages = [
                        {"role": "system", "content": LIVE_SYSTEM_PROMPT},
                        {"role": "user", "content": transcription}
                    ]
                    response_text = await groq_chat(messages)
                    reply, correction = clean_and_parse_json(response_text)
                    final_json = json.dumps({"reply": reply, "correction": correction})

                    await websocket.send_json({
                        'type': 'stream_token',
                        'content': final_json
                    })

                    audio_b64 = await text_to_speech(reply)
                    if audio_b64:
                        await websocket.send_json({
                            'type': 'audio_response',
                            'audio': audio_b64,
                            'content': final_json
                        })
                    await websocket.send_json({'type': 'stream_end'})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logging.info(f'[LiveWS] Error: {exc}')
