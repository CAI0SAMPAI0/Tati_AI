from .base import *

DEBUG = False

# SSL é terminado no proxy reverso externo (Hugging Face Spaces, Railway, Cloudflare).
# Redirecionamento forçado interno causa 301 nos health checks do ALB gerando erro 502/503.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "False").lower() in ("true", "1")
SECURE_REDIRECT_EXEMPT = [r"^health/?$", r"^api/health/?$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# Inicialização do Sentry para Django (desabilita sessões/telemetria contínua em modo SERVERLESS para permitir App-Sleeping)
SENTRY_DSN = os.getenv("SENTRY_DSN")
IS_SERVERLESS = os.getenv("SERVERLESS", "false").lower() in ("true", "1", "yes")
if SENTRY_DSN and not IS_SERVERLESS:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=0.1,
        send_default_pii=False,
    )
