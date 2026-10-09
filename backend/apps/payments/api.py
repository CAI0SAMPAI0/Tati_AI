from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model

from apps.authentication.security import auth_required
from .schemas import (
    CreatePixInput,
    PixPaymentOut,
    CreatePreferenceInput,
    PreferenceOut,
    PaymentStatusOut,
)
from .services import MercadoPagoService

User = get_user_model()
payments_router = Router(tags=["Mercado Pago Payments"])


#    COBRANÇA PIX                                                       


@payments_router.post("/mercadopago/pix", response=PixPaymentOut, auth=auth_required)
def create_pix_payment(request: HttpRequest, payload: CreatePixInput):
    """
    Gera uma cobrança PIX instantânea com QR Code e Copia-e-Cola.
    """
    return MercadoPagoService.create_pix_payment(request.auth, payload)


#    CHECKOUT TRANSPARENTE / PREFERENCE                                 


@payments_router.post(
    "/mercadopago/preference", response=PreferenceOut, auth=auth_required
)
def create_preference(request: HttpRequest, payload: CreatePreferenceInput):
    """
    Gera link de checkout do Mercado Pago (Cartão de Crédito, Boleto, PIX).
    """
    return MercadoPagoService.create_preference(request.auth, payload)


#    CONSULTA DE STATUS DE PAGAMENTO / ASSINATURA                       


@payments_router.get("/status", auth=auth_required)
def get_current_user_payment_status(request: HttpRequest):
    """
    Retorna o status de pagamento e assinatura do usuário logado.
    """
    user = request.auth
    has_sub = bool(user.is_premium_active or user.is_special_access)
    return {
        "status": "active" if has_sub else "inactive",
        "is_premium": has_sub,
        "is_special_access": user.is_special_access,
        "role": user.role or "student",
    }


@payments_router.get("/plans")
def get_payment_plans(request: HttpRequest):
    """
    Retorna os planos de assinatura disponíveis na plataforma.
    Inclui status de disponibilidade (cobrança após fevereiro de 2027).
    """
    import os
    from django.conf import settings
    from .services import are_subscriptions_active

    active = are_subscriptions_active()
    start_date_str = getattr(
        settings,
        "SUBSCRIPTION_BILLING_START_DATE",
        os.getenv("SUBSCRIPTION_BILLING_START_DATE", "2027-03-01"),
    )
    notice = (
        None
        if active
        else f"Disponível para contratação a partir de {start_date_str} (após fev/2027)."
    )

    return [
        {
            "id": "full",
            "name": "Plano Ilimitado",
            "price": 49.90,
            "period": "mês",
            "available": active,
            "available_from": start_date_str,
            "notice": notice,
            "features": [
                "Acesso Ilimitado à Teacher Tati",
                "Simulações CEFR",
                "Flashcards com SRS",
                "Podcasts Interativos",
                "Suporte WhatsApp",
            ],
        },
        {
            "id": "monthly",
            "name": "Plano Mensal",
            "price": 49.90,
            "period": "mês",
            "available": active,
            "available_from": start_date_str,
            "notice": notice,
            "features": [
                "Acesso Ilimitado à Teacher Tati",
                "Simulações CEFR",
                "Flashcards com SRS",
                "Podcasts Interativos",
                "Suporte WhatsApp",
            ],
        },
        {
            "id": "quarterly",
            "name": "Plano Trimestral",
            "price": 129.90,
            "period": "3 meses",
            "popular": True,
            "available": active,
            "available_from": start_date_str,
            "notice": notice,
            "features": [
                "Tudo do plano mensal",
                "Desconto de 15%",
                "Relatórios de Evolução em PDF",
                "Grupo VIP com Professora Tatiana",
            ],
        },
        {
            "id": "annual",
            "name": "Plano Anual",
            "price": 399.90,
            "period": "ano",
            "available": active,
            "available_from": start_date_str,
            "notice": notice,
            "features": [
                "Tudo do plano trimestral",
                "Melhor Custo-Benefício (Economize 35%)",
                "Acesso a todos os materiais do Hub",
            ],
        },
    ]


@payments_router.post("/subscribe", auth=auth_required)
def subscribe_plan(request: HttpRequest, payload: dict):
    """
    Inicia assinatura de plano (disponível somente após fevereiro de 2027).
    """
    import os
    from django.conf import settings
    from ninja.errors import HttpError
    from .services import are_subscriptions_active

    if not are_subscriptions_active():
        start_date_str = getattr(
            settings,
            "SUBSCRIPTION_BILLING_START_DATE",
            os.getenv("SUBSCRIPTION_BILLING_START_DATE", "2027-03-01"),
        )
        raise HttpError(
            400,
            f"As assinaturas de planos só estarão disponíveis para contratação após fevereiro de 2027 "
            f"(início previsto: {start_date_str}). Atualmente apenas a aquisição de materiais do Hub está habilitada.",
        )

    return {"ok": True, "message": "Iniciando assinatura..."}


@payments_router.get(
    "/status/{payment_id}", response=PaymentStatusOut, auth=auth_required
)
def get_payment_status(request: HttpRequest, payment_id: str):
    """
    Consulta o status atualizado de uma transação no Mercado Pago.
    """
    return MercadoPagoService.get_payment_status(payment_id)


#    WEBHOOK MERCADO PAGO                                               


@payments_router.post("/mercadopago/webhook")
def mercadopago_webhook(request: HttpRequest):
    """
    Webhook público do Mercado Pago com encaminhamento para Railway / Hugging Face.
    """
    try:
        import json

        body = json.loads(request.body.decode("utf-8"))
    except Exception:
        body = {}
    return MercadoPagoService.process_webhook(body)
