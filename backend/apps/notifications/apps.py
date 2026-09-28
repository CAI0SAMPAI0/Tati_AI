import sys
from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.notifications"
    verbose_name = "Notificações (Brevo & WAHA)"

    def ready(self):
        # Evita iniciar em comandos de migração, build ou testes
        cmd = " ".join(sys.argv).lower()
        if any(ignored in cmd for ignored in ["migrate", "makemigrations", "collectstatic", "test", "compilemessages"]):
            return

        # Permite desativar em ambientes que devem dormir (como instâncias serverless na Railway ou dev)
        import os
        is_serverless = os.getenv("SERVERLESS", "false").lower() in ("true", "1", "yes")
        enable_scheduler = os.getenv("ENABLE_NOTIFICATION_SCHEDULER", "false" if is_serverless else "true").lower() in ("true", "1", "yes")
        if is_serverless or not enable_scheduler:
            import logging
            logging.getLogger(__name__).info("[NotificationsConfig] Modo Serverless / ENABLE_NOTIFICATION_SCHEDULER=false detectado. Runner em background não será iniciado.")
            return

        try:
            from .scheduler import BackgroundNotificationRunner
            BackgroundNotificationRunner.start()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"[NotificationsConfig] Could not start scheduler: {e}")
