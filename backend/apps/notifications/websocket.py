import asyncio
import logging
import re
from typing import Any, Dict
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def get_user_group(user_identifier: Any) -> str:
    """
    Sanitiza o identificador do usuário para criar um nome de grupo compatível
    com as regras rígidas do Django Channels (somente alfanuméricos ASCII, '-', '_', '.').
    """
    clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", str(user_identifier))[:90]
    return f"user_{clean}"


def send_to_group(group_name: str, event_type: str, data: Dict[str, Any]) -> None:
    """
    Publica um evento para todos os clientes conectados a determinado grupo WebSocket.
    Suporta contextos síncronos e assíncronos transparentemente.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        logger.warning(f"[WS] Nenhum channel_layer disponível para enviar evento ao grupo '{group_name}'")
        return

    payload = {
        "type": "send_notification",
        "event_type": event_type,
        "data": data,
    }

    try:
        # Verifica se já estamos rodando dentro de um event loop assíncrono ativo
        loop = None
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            asyncio.create_task(channel_layer.group_send(group_name, payload))
        else:
            async_to_sync(channel_layer.group_send)(group_name, payload)
    except Exception as exc:
        logger.warning(f"[WS] Falha ao enviar para grupo '{group_name}' ({event_type}): {exc}")


def notify_user(user_id: Any, event_type: str, data: Dict[str, Any]) -> None:
    """Envia um evento para as conexões de um usuário específico."""
    send_to_group(get_user_group(user_id), event_type, data)


def notify_teacher(event_type: str, data: Dict[str, Any]) -> None:
    """Envia um evento para o grupo 'teachers' (todos os professores e administradores)."""
    send_to_group("teachers", event_type, data)
