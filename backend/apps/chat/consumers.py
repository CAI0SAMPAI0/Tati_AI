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

        # 2. Mensagem de texto do chat
        text_content = content.get("content") or content.get("text") or content.get("message")
        conv_id = content.get("conversation_id")

        if not conv_id:
            # Cria conversa automática se não enviada
            conv = await Conversation.objects.acreate(
                username=self.username,
                title="Conversa com a Teacher Tati",
            )
            conv_id = str(conv.id)
        else:
            conv_id = str(conv_id)

        if not text_content:
            return

        # Inicia evento de streaming
        await self.send_json({"type": "stream_start", "conversation_id": conv_id})

        try:
            # Gera resposta da IA
            if not self.user:
                self.user = await aget_user_by_username(self.username)

            # Executa geração via AIService
            from asgiref.sync import sync_to_async
            reply = await sync_to_async(AIService.generate_reply)(
                user=self.user,
                conversation_id=conv_id,
                user_text=text_content,
            )

            # Envia resposta
            await self.send_json({
                "type": "stream_token",
                "content": reply,
            })

            # Finaliza stream
            await self.send_json({"type": "stream_end"})

        except Exception as e:
            logger.error(f"[ChatWS] Erro ao processar mensagem: {e}")
            await self.send_json({
                "type": "error",
                "message": "Desculpe, tive um problema de conexão. Por favor, tente novamente.",
            })


class LiveChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def receive_json(self, content):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})
            return
