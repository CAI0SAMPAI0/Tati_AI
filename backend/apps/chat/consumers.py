import asyncio
import logging
import re
import urllib.parse
from asgiref.sync import sync_to_async
from django.db import close_old_connections
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from apps.authentication.security import decode_token
from apps.chat.services import AIService
from apps.chat.models import Conversation
from shared.async_db import aget_user_by_username

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        # 1. Extração do token JWT dos Subprotocols ou Query String
        headers = dict(self.scope.get("headers", []))
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = urllib.parse.parse_qs(query_string)

        token = query_params.get("token", [None])[0]
        subprotocol = None

        # Verifica header sec-websocket-protocol
        subprotocols = self.scope.get("subprotocols", [])
        if not token and subprotocols:
            for p in subprotocols:
                if p != "access_token":
                    token = p
                    subprotocol = "access_token"
                    break

        if not token:
            raw_proto = headers.get(b"sec-websocket-protocol", b"").decode("utf-8")
            if raw_proto:
                parts = [x.strip() for x in raw_proto.split(",")]
                for p in parts:
                    if p != "access_token":
                        token = p
                        subprotocol = "access_token"
                        break

        payload = decode_token(token) if token else None
        if not payload or not payload.get("sub"):
            logger.warning("[ChatWS] Conexão rejeitada: Token inválido ou expirado.")
            await self.close(code=4001)
            return

        self.username = payload["sub"]
        try:
            self.user = await aget_user_by_username(self.username)
        finally:
            await sync_to_async(close_old_connections)()

        # Aceita a conexão WebSocket com o subprotocol negociado
        await self.accept(subprotocol=subprotocol)
        logger.info(f"[ChatWS] Conexão WebSocket aceita para o aluno: {self.username}")

    async def disconnect(self, close_code):
        logger.info(
            f"[ChatWS] Desconectado: {getattr(self, 'username', 'anon')} (Code: {close_code})"
        )
        try:
            await sync_to_async(close_old_connections)()
        except Exception:
            pass

    async def receive_json(self, content):
        try:
            await self._handle_receive_json(content)
        finally:
            await sync_to_async(close_old_connections)()

    async def _handle_receive_json(self, content):
        msg_type = content.get("type", "message")

        # 1. Ping / Pong para manter conexão ativa (Heartbeat)
        if msg_type == "ping":
            await self.send_json({"type": "pong"})
            return

        conv_id = content.get("conversation_id")
        if not conv_id:
            conv = await Conversation.objects.acreate(
                username=self.username,
                title="Conversa com a Teacher Tati",
            )
            conv_id = str(conv.id)
        else:
            conv_id = str(conv_id)

        # 2. Processamento de Áudio, Arquivos ou Texto
        text_content = ""
        is_audio = msg_type == "audio" or bool(content.get("audio"))

        # Extração de anexos (suporte a até 3 arquivos enviados pelo chat)
        uploaded_files = content.get("files") or []
        if not uploaded_files and content.get("file"):
            uploaded_files = [
                {
                    "filename": content.get("filename") or "documento.pdf",
                    "base64": content.get("file"),
                }
            ]
        # Garante limite máximo de 3 arquivos
        uploaded_files = uploaded_files[:3]

        if is_audio:
            from apps.chat.audio_service import AudioService

            raw_audio = content.get("audio") or ""
            text_content = await AudioService.transcribe_audio_async(raw_audio)
            if not text_content:
                text_content = "(Áudio não compreendido)"

            # Envia a transcrição imediata para o balão do usuário no frontend
            await self.send_json({"type": "transcription", "text": text_content})
        else:
            text_content = (
                content.get("content")
                or content.get("text")
                or content.get("caption")
                or content.get("message")
                or ""
            )
            if not text_content and uploaded_files:
                text_content = (
                    f"Enviei o arquivo: {uploaded_files[0].get('filename')}"
                    if len(uploaded_files) == 1
                    else f"Enviei {len(uploaded_files)} arquivos para análise"
                )

        if not text_content and not uploaded_files:
            return

        # 3. Inicia streaming de resposta (exibe animação das ... imediatamente)
        await self.send_json({"type": "stream_start", "conversation_id": conv_id})

        try:
            self.user = await aget_user_by_username(self.username)

            from apps.chat.audio_service import AudioService

            accent = (
                content.get("accent")
                or (self.user.profile.get("preferred_accent") if self.user and isinstance(getattr(self.user, "profile", None), dict) else None)
                or (self.user.profile.get("accent") if self.user and isinstance(getattr(self.user, "profile", None), dict) else None)
                or "en-US"
            )

            origin = content.get("origin") or ("voice" if is_audio else "chat")

            loop = asyncio.get_running_loop()
            token_queue = asyncio.Queue()

            def on_token(token_str: str):
                if token_str:
                    loop.call_soon_threadsafe(
                        token_queue.put_nowait,
                        {"type": "token", "content": token_str}
                    )

            def on_doc(doc_data: dict):
                if doc_data:
                    loop.call_soon_threadsafe(
                        token_queue.put_nowait,
                        {"type": "doc", "document": doc_data}
                    )

            def run_generation():
                close_old_connections()
                try:
                    result = AIService.generate_reply(
                        user=self.user,
                        conversation_id=conv_id,
                        user_text=text_content,
                        files=uploaded_files,
                        accent=accent,
                        origin=origin,
                        on_token=on_token,
                        on_doc=on_doc,
                    )
                    loop.call_soon_threadsafe(
                        token_queue.put_nowait,
                        {"type": "done", "result": result}
                    )
                except Exception as err:
                    logger.error(f"[ChatWS] Erro na thread de geração: {err}", exc_info=True)
                    loop.call_soon_threadsafe(
                        token_queue.put_nowait,
                        {"type": "error", "error": err}
                    )
                finally:
                    close_old_connections()

            worker_task = asyncio.create_task(asyncio.to_thread(run_generation))

            res = None

            while True:
                msg_item = await token_queue.get()
                item_type = msg_item.get("type")

                if item_type == "token":
                    await self.send_json(
                        {
                            "type": "stream_token",
                            "content": msg_item.get("content", ""),
                        }
                    )
                elif item_type == "doc":
                    doc_item = msg_item.get("document", {})
                    await self.send_json(
                        {
                            "type": "document_generated",
                            "conversation_id": conv_id,
                            "document": doc_item,
                            "filename": doc_item.get("filename"),
                            "format": doc_item.get("format"),
                            "url": doc_item.get("url"),
                            "preview_url": doc_item.get("preview_url", doc_item.get("url")),
                            "size": doc_item.get("size"),
                            "pdf_b64": doc_item.get("pdf_b64", ""),
                        }
                    )
                elif item_type == "done":
                    res = msg_item.get("result", {})
                    break
                elif item_type == "error":
                    raise msg_item.get("error")

            await worker_task

            reply_text = res.get("reply") if isinstance(res, dict) else str(res)
            audio_b64 = res.get("audio_b64") if isinstance(res, dict) else ""
            model_used = res.get("model", "unknown") if isinstance(res, dict) else "unknown"

            print(
                f"[ChatWS] Resposta concluída para '{self.username}' | Modelo: {model_used} | Modo: {origin}"
            )
            logger.info(
                f"[ChatWS] Resposta concluída para '{self.username}' | Modelo: {model_used} | Modo: {origin}"
            )

            # Se for modo de voz e não tiver áudio gerado, gera áudio via Edge TTS
            if not audio_b64 and origin == "voice":
                clean_reply_text = re.sub(r"\[ATTACHED_DOCUMENT:.*?\]", "", reply_text, flags=re.DOTALL).strip()
                audio_b64 = await AudioService.text_to_speech_async(
                    clean_reply_text, accent=accent
                )

            # Se tiver áudio gerado, envia o payload de áudio
            if audio_b64:
                await self.send_json(
                    {
                        "type": "audio_response",
                        "audio": audio_b64,
                        "audio_b64": audio_b64,
                        "model": model_used,
                    }
                )

            # Finaliza stream
            await self.send_json({"type": "stream_end", "model": model_used})

        except Exception as e:
            logger.error(f"[ChatWS] Erro ao processar mensagem: {e}")
            await self.send_json(
                {
                    "type": "error",
                    "message": "Desculpe, tive um problema ao responder. Por favor, tente novamente.",
                }
            )


class LiveChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def receive_json(self, content):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})
            return
