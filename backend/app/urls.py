from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from app.api import api

urlpatterns = [
    # Painel Administrativo Nativo do Django
    path('django-admin/', admin.site.urls),

    # Django Debug Toolbar (apenas se habilitado nas settings)
    *([path('__debug__/', include('debug_toolbar.urls'))] if 'debug_toolbar' in settings.INSTALLED_APPS else []),

    # Servir arquivos estáticos (CSS, JS, Imagens do Admin) e de Mídia
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),

    # NinjaAPI Router montado na raiz para compatibilidade total com os endpoints do frontend
    path('', api.urls),
]
