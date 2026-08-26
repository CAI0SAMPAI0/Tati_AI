from ninja import NinjaAPI, Router
from ninja.errors import HttpError
from django.http import JsonResponse, HttpRequest
import os
import logging

logger = logging.getLogger(__name__)

api = NinjaAPI(
    title="Teacher Tati AI API",
    version="2.2.0",
    description="API RESTful de Alta Performance (Django-Ninja) para Teacher Tati AI",
    docs_url="/docs",
)


@api.exception_handler(Exception)
def global_exception_handler(request, exc):
    logger.exception(f"Erro não tratado: {exc}")
    return JsonResponse(
        {
            "detail": "Internal Server Error",
            "error": str(exc) if os.getenv("DEBUG", "False").lower() in ("true", "1") else "Erro interno no servidor.",
            "path": request.path,
        },
        status=500,
    )


@api.get("/health", tags=["System"])
def health_check(request):
    """
    Health check da API e do banco de dados (Django ORM).
    """
    from django.db import connection
    db_status = "ok"
    db_msg = "Database connection verified successfully"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as e:
        db_status = "error"
        db_msg = f"TEST_FAILED: {e}"

    return {
        "status": "ok",
        "database": db_status,
        "service": "Teacher Tati API (Django-Ninja)",
        "version": "2.2.0",
        "db_check": db_msg,
    }


@api.get("/app/version", tags=["System"])
def app_version(request):
    """
    Retorna a versão mínima do app móvel e URL de download do APK.
    """
    download_url = os.getenv("APP_DOWNLOAD_URL", "https://tati-ai.vercel.app/downloads/tati-ai.apk")
    return {
        "android": os.getenv("APP_VERSION_ANDROID", "1.0.0"),
        "download_url": download_url,
    }


from apps.authentication.security import auth_required, auth_optional
from apps.authentication.api import auth_router, profile_router
from apps.users.api import users_router, avatar_router
from apps.activities.api import (
    activities_router,
    catalog_router,
    grammar_router,
    speech_router,
    flashcard_assets_router,
    admin_premium_router,
    cefr_admin_router,
    cefr_images_router,
)
from apps.chat.api import chat_router
from apps.chat.simulation_api import simulation_router
from apps.payments.api import payments_router
from apps.notifications.api import notifications_router
from apps.dashboard.api import dashboard_router

api.add_router("/auth", auth_router)
api.add_router("/profile", profile_router)
api.add_router("/users", users_router)
api.add_router("/avatar", avatar_router)
api.add_router("/activities", activities_router)
api.add_router("/catalog", catalog_router)
api.add_router("/grammar", grammar_router)
api.add_router("/speech", speech_router)
api.add_router("/chat", chat_router)
api.add_router("/simulation", simulation_router)
api.add_router("/payments", payments_router)
api.add_router("/notifications", notifications_router)
api.add_router("/dashboard", dashboard_router)
api.add_router("/flashcard-assets", flashcard_assets_router)
api.add_router("/admin/premium", admin_premium_router)
api.add_router("/cefr/admin", cefr_admin_router)
api.add_router("/cefr/images", cefr_images_router)

tasks_router = Router(tags=["Async Tasks"])

@tasks_router.get("/status/{task_id}", auth=auth_optional)
@tasks_router.get("/{task_id}", auth=auth_optional)
def get_task_status(request: HttpRequest, task_id: str):
    return {"status": "success", "success": True, "task_id": task_id}

api.add_router("/tasks", tasks_router)


@api.get("/cors-test", auth=auth_optional)
def cors_test(request: HttpRequest):
    """
    Endpoint de teste de conectividade e CORS para o frontend.
    """
    return {"status": "ok", "message": "CORS is working properly!"}
