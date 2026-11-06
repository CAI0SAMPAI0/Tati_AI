import logging
import urllib.parse
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from apps.authentication.security import decode_token
from apps.notifications.websocket import get_user_group
from shared.async_db import aget_user_by_username

logger = logging.getLogger(__name__)


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        query_string = self.scope.get("query_string", b"").decode("utf-8")
        query_params = urllib.parse.parse_qs(query_string)
        token = query_params.get("token", [None])[0]
        payload = decode_token(token) if token else None

        if not payload or not payload.get("sub"):
            await self.close(code=4001)  # Código de fechamento personalizado para token inválido
            return

        # tokens de escopo restrito não podem se conectar a este WebSocket
        if payload.get("token_type") == "hub_page_view":
            await self.close(code=4003)  # Código de fechamento personalizado para token restrito
            return

        self.username = payload["sub"]
        self.user = await aget_user_by_username(self.username)

        if not self.user:
            await self.close(code=4001)
            return

        self.user_group = get_user_group(self.user.id)

        await self.channel_layer.group_add(
            self.user_group,
            self.channel_name
        )

        is_teacher = bool(
            getattr(self.user, "is_teacher", False)
            or getattr(self.user, "is_staff", False)
            or getattr(self.user, "is_programmer", False)
        )

        if is_teacher:
            await self.channel_layer.group_add(
                "teachers",
                self.channel_name
            )

        await self.accept()

        logger.info(
            "[NotificationsWS] Conexão aceita para %s (is_teacher=%s)",
            self.username,
            is_teacher,
        )
    
    async def disconnect(self, close_code):
        if hasattr(self, "user_group"):
            await self.channel_layer.group_discard(
                self.user_group,
                self.channel_name,
            )

        if getattr(self, "user", None):
            is_teacher = bool(
                getattr(self.user, "is_teacher", False)
                or getattr(self.user, "is_staff", False)
                or getattr(self.user, "is_programmer", False)
            )
            if is_teacher:
                await self.channel_layer.group_discard(
                    "teachers",
                    self.channel_name,
                )

    async def send_notification(self, event):
        await self.send_json(
            {
                "type": event.get("event_type"),
                "data": event.get("data", {}),
            }
        )
