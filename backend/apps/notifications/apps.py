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

        try:
            from .scheduler import BackgroundNotificationRunner
            BackgroundNotificationRunner.start()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"[NotificationsConfig] Could not start scheduler: {e}")
