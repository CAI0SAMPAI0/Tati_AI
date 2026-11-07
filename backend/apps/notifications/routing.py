from django.urls import re_path
from .consumers import NotificationConsumer

websocket_urlpatterns = [
    re_path(
        r"^notifications/ws/?$",
        NotificationConsumer.as_asgi(),
    ),
    re_path(
        r"^ws/notifications/?$",
        NotificationConsumer.as_asgi(),
    ),
]
