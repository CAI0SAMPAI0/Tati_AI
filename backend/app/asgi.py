import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from channels.auth import AuthMiddlewareStack

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "app.settings.development")

# Inicializa o Django ASGI antes de carregar routing de WebSockets
django_asgi_app = get_asgi_application()

from apps.chat.routing import websocket_urlpatterns as chat_ws_patterns

websocket_urlpatterns = [
    *chat_ws_patterns,
]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
    }
)
