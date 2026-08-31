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

async def lifespan_handler(scope, receive, send):
    """
    Tratador de eventos lifespan do ASGI para garantir compatibilidade
    plena com UvicornWorker / Gunicorn e evitar erros de scope 'lifespan'.
    """
    while True:
        message = await receive()
        if message["type"] == "lifespan.startup":
            await send({"type": "lifespan.startup.complete"})
        elif message["type"] == "lifespan.shutdown":
            await send({"type": "lifespan.shutdown.complete"})
            return


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
        ),
        "lifespan": lifespan_handler,
    }
)
