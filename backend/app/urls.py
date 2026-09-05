from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path, re_path
from django.views.static import serve

from app.api import api


def favicon_view(request):
    """Retorna 204 No Content para requisições de favicon.ico dos navegadores."""
    return HttpResponse(status=204)


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
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    # NinjaAPI Router montado tanto em /api/v1/, /api/ e na raiz para compatibilidade total com todos os apps e frontends
    path("api/v1/", api.urls),
    path("api/", api.urls),
    path("", api.urls),
]
