from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve

from app.api import api


import json


def favicon_view(request):
    """Retorna 204 No Content para requisições de favicon.ico dos navegadores."""
    return HttpResponse(status=204)


def protected_media_serve(request, path, document_root=None, show_indexes=False):
    """
    Protege arquivos sensíveis da pasta media.
    Arquivos em 'hub_pages/' e documentos protegidos NUNCA podem ser servidos diretamente
    sem passar pelo pipeline de autorização e marca d'água em /activities/hub/.
    """
    normalized_path = path.lstrip("/").replace("\\", "/")
    if normalized_path.startswith("hub_pages/") or normalized_path.startswith("secure_docs/"):
        return HttpResponse(
            json.dumps({"detail": "Acesso direto bloqueado. Utilize o visualizador seguro do Hub."}, ensure_ascii=False),
            status=403,
            content_type="application/json; charset=utf-8",
        )
    return serve(request, path, document_root=document_root, show_indexes=show_indexes)


urlpatterns = [
    # Favicon rápido para evitar 404 em logs
    path("favicon.ico", favicon_view),
    # Painel Administrativo Nativo do Django
    path("django-admin/", admin.site.urls),
    # Django Debug Toolbar (apenas se habilitado nas settings)
    *(
        [path("__debug__/", include("debug_toolbar.urls"))]
        if "debug_toolbar" in settings.INSTALLED_APPS
        else []
    ),
    # Servir arquivos estáticos (CSS, JS, Imagens do Admin) e de Mídia
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
    re_path(r"^media/(?P<path>.*)$", protected_media_serve, {"document_root": settings.MEDIA_ROOT}),
    # NinjaAPI Router montado tanto em /api/v1/, /api/ e na raiz para compatibilidade total com todos os apps e frontends
    path("api/v1/", api.urls),
    path("api/", api.urls),
    path("", api.urls),
]
