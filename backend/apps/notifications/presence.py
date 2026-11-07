import logging
from datetime import datetime, timezone
from typing import Any, List, Set
from django.core.cache import cache
from asgiref.sync import sync_to_async
from apps.notifications.websocket import notify_teacher

logger = logging.getLogger(__name__)

PRESENCE_CHANNELS_KEY_PREFIX = "tati:presence:channels:"
PRESENCE_ONLINE_USERS_KEY = "tati:presence:online_usernames"
PRESENCE_USER_LAST_ACTIVE_KEY_PREFIX = "tati:presence:last_active:"


class PresenceService:
    """
    Controlador central de presença em tempo real dos alunos e professores via WebSockets.
    Rastreia conjuntos exatos de canais ativos (channels) para garantir que
    ao fechar a aba/sair, o status fique offline instantaneamente sem desyncs de contador.
    """

    @classmethod
    def get_online_usernames(cls) -> Set[str]:
        raw = cache.get(PRESENCE_ONLINE_USERS_KEY)
        if isinstance(raw, set):
            return raw
        elif isinstance(raw, (list, tuple)):
            return set(raw)
        return set()

    @classmethod
    def is_user_online(cls, username: str) -> bool:
        if not username:
            return False
        chan_key = f"{PRESENCE_CHANNELS_KEY_PREFIX}{username}"
        channels = cache.get(chan_key, set())
        if not isinstance(channels, set):
            channels = set(channels) if isinstance(channels, (list, tuple)) else set()
        return len(channels) > 0

    @classmethod
    def mark_online(cls, channel_name: str, username: str) -> bool:
        """
        Registra a conexão de um canal WebSocket para o usuário.
        Retorna True se o usuário acabou de ficar online (primeiro canal aberto).
        """
        if not username:
            return False

        now_iso = datetime.now(timezone.utc).isoformat()
        chan_key = f"{PRESENCE_CHANNELS_KEY_PREFIX}{username}"
        active_key = f"{PRESENCE_USER_LAST_ACTIVE_KEY_PREFIX}{username}"

        channels = cache.get(chan_key, set())
        if not isinstance(channels, set):
            channels = set(channels) if isinstance(channels, (list, tuple)) else set()

        was_empty = len(channels) == 0
        if channel_name:
            channels.add(channel_name)
        else:
            channels.add(f"manual_{now_iso}")

        cache.set(chan_key, channels, timeout=86400)
        cache.set(active_key, now_iso, timeout=86400)

        online_set = cls.get_online_usernames()
        online_set.add(username)
        cache.set(PRESENCE_ONLINE_USERS_KEY, online_set, timeout=86400)

        if was_empty:
            logger.info(f"[PresenceWS] Aluno '{username}' agora está ONLINE (canais={len(channels)})")
            notify_teacher(
                "user_presence_changed",
                {
                    "username": username,
                    "is_online": True,
                    "last_active": now_iso,
                },
            )
            try:
                from apps.authentication.models import User
                User.objects.filter(username=username).update(updated_at=datetime.now(timezone.utc))
            except Exception as e:
                logger.debug(f"[Presence] Erro ao atualizar updated_at do user: {e}")

        return was_empty

    @classmethod
    def mark_offline(cls, channel_name: str, username: str) -> bool:
        """
        Registra a desconexão de um canal WebSocket.
        Quando não restam canais abertos, marca o usuário como offline e notifica os professores imediatamente.
        """
        if not username:
            return False

        now_iso = datetime.now(timezone.utc).isoformat()
        chan_key = f"{PRESENCE_CHANNELS_KEY_PREFIX}{username}"
        active_key = f"{PRESENCE_USER_LAST_ACTIVE_KEY_PREFIX}{username}"

        channels = cache.get(chan_key, set())
        if not isinstance(channels, set):
            channels = set(channels) if isinstance(channels, (list, tuple)) else set()

        if channel_name:
            channels.discard(channel_name)
        else:
            # Logout total: limpa todos os canais
            channels.clear()

        cache.set(chan_key, channels, timeout=86400)
        cache.set(active_key, now_iso, timeout=86400)

        is_now_offline = len(channels) == 0

        if is_now_offline:
            online_set = cls.get_online_usernames()
            online_set.discard(username)
            cache.set(PRESENCE_ONLINE_USERS_KEY, online_set, timeout=86400)
            logger.info(f"[PresenceWS] Aluno '{username}' ficou OFFLINE")
            notify_teacher(
                "user_presence_changed",
                {
                    "username": username,
                    "is_online": False,
                    "last_active": now_iso,
                },
            )

        return is_now_offline

    @classmethod
    def force_offline(cls, username: str) -> None:
        """Força a desconexão de todos os canais de um usuário."""
        cls.mark_offline("", username)

    @classmethod
    def record_activity(cls, username: str) -> None:
        """Atualiza o timestamp de atividade do usuário levemente em cache sem bater no banco."""
        if not username:
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        cache.set(f"{PRESENCE_USER_LAST_ACTIVE_KEY_PREFIX}{username}", now_iso, timeout=86400)

    # Versões assíncronas para consumo direto nos consumers
    @classmethod
    async def amark_online(cls, channel_name: str, username: str) -> bool:
        return await sync_to_async(cls.mark_online)(channel_name, username)

    @classmethod
    async def amark_offline(cls, channel_name: str, username: str) -> bool:
        return await sync_to_async(cls.mark_offline)(channel_name, username)

    @classmethod
    async def aforce_offline(cls, username: str) -> None:
        await sync_to_async(cls.force_offline)(username)

    @classmethod
    async def aget_online_usernames(cls) -> Set[str]:
        return await sync_to_async(cls.get_online_usernames)()

    @classmethod
    async def arecord_activity(cls, username: str) -> None:
        await sync_to_async(cls.record_activity)(username)
