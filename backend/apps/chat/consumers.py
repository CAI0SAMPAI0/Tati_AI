import json
import logging
import urllib.parse
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from apps.authentication.security import decode_token
from apps.authentication.models import User
from apps.chat.services import AIService, ConversationService
from apps.chat.models import Conversation, Message
from apps.users.services import StreakService, XPService
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
        self.user = await aget_user_by_username(self.username)

        # Aceita a conexão WebSocket com o subprotocol negociado
        await self.accept(subprotocol=subprotocol)
        logger.info(f"[ChatWS] Conexão WebSocket aceita para o aluno: {self.username}")

    async def disconnect(self, close_code):
        logger.info(f"[ChatWS] Desconectado: {getattr(self, 'username', 'anon')} (Code: {close_code})")

    async def receive_json(self, content):
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

        # 2. Processamento de Áudio (Voice Message)
        text_content = ""
        is_audio = msg_type == "audio" or bool(content.get("audio"))

        if is_audio:
            from apps.chat.audio_service import AudioService
            raw_audio = content.get("audio") or ""
            text_content = await AudioService.transcribe_audio_async(raw_audio)
            if not text_content:
                text_content = "(Áudio não compreendido)"
            
            # Envia a transcrição imediata para o balão do usuário no frontend
            await self.send_json({"type": "transcription", "text": text_content})
        else:
            text_content = content.get("content") or content.get("text") or content.get("message") or ""

        if not text_content:
            return

        # 3. Inicia streaming de resposta
        await self.send_json({"type": "stream_start", "conversation_id": conv_id})

        try:
            if not self.user:
                self.user = await aget_user_by_username(self.username)

            from asgiref.sync import sync_to_async
            from apps.chat.audio_service import AudioService

            res = await sync_to_async(AIService.generate_reply)(
                user=self.user,
                conversation_id=conv_id,
                user_text=text_content,
            )

            reply_text = res.get("reply") if isinstance(res, dict) else str(res)
            audio_b64 = res.get("audio_b64") if isinstance(res, dict) else ""

            if not audio_b64 and is_audio:
                audio_b64 = await AudioService.text_to_speech_async(reply_text)

            # Envia o texto da resposta
            await self.send_json({
                "type": "stream_token",
                "content": reply_text,
            })

            # Se for modo de voz ou tiver áudio gerado, envia o payload de áudio
            if audio_b64:
                await self.send_json({
                    "type": "audio_response",
                    "audio": audio_b64,
                    "audio_b64": audio_b64,
                })

            # Finaliza stream
            await self.send_json({"type": "stream_end"})

        except Exception as e:
            logger.error(f"[ChatWS] Erro ao processar mensagem: {e}")
            await self.send_json({
                "type": "error",
                "message": "Desculpe, tive um problema ao responder. Por favor, tente novamente.",
            })


class LiveChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def receive_json(self, content):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})
            return
