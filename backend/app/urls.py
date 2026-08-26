from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from app.api import api

urlpatterns = [
    # Painel Administrativo Nativo do Django
    path('django-admin/', admin.site.urls),

    # NinjaAPI Router montado na raiz para compatibilidade total com os endpoints do frontend
    path('', api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
