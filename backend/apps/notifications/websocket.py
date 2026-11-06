from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


def send_to_group(group_name: str, event_type: str, data: dict) -> None:
    """
    Publica um evento para todos os clientes conectados
    a determinado grupo WebSocket.
    """
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "send_notification",
            "event_type": event_type,
            "data": data,
        },
    )

def notify_user(user_id: int, event_type: str, data: dict) -> None:
    """Envia um evento para as conexões de um usuário."""
    send_to_group(f"user_{user_id}", event_type, data)


def notify_teacher(event_type: str, data: dict) -> None:
    """Envia um evento para as conexões de todos os professores."""
    send_to_group("teachers", event_type, data)