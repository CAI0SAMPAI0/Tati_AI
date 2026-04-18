"""
Configuração do Sentry para monitoramento de erros.
"""
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from core.config import settings


def init_sentry():
    """
    Inicializa o Sentry para monitoramento de erros.
    Usa as variáveis de ambiente SENTRY_DSN e SENTRY_ENVIRONMENT.
    """
    import os
    
    sentry_dsn = os.getenv('SENTRY_DSN')
    sentry_environment = os.getenv('SENTRY_ENVIRONMENT', 'production')
    sentry_traces_sample_rate = float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.2'))
    
    if not sentry_dsn:
        print("[Sentry] SENTRY_DSN não configurado - monitoramento desativado")
        return
    
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[
            FastApiIntegration(
                transaction_style="endpoint",
                middleware_spans=True,
            ),
        ],
        environment=sentry_environment,
        traces_sample_rate=sentry_traces_sample_rate,
        send_default_pii=True,
        # Desabilita instrumentações que causam conflitos com httpx
        default_integrations=True,
        _experiments={
            "profiles_sample_rate": float(os.getenv('SENTRY_PROFILES_SAMPLE_RATE', '0.1')),
        },
    )
    
    print(f"[Sentry] ✅ Inicializado - ambiente: {sentry_environment}")
