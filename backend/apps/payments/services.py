import os
import logging
import httpx
from typing import Optional
from datetime import datetime, timedelta, timezone
from django.contrib.auth import get_user_model
from ninja.errors import HttpError
import mercadopago

from .models import Subscription, PremiumPurchase
from .schemas import (
    CreatePixInput,
    PixPaymentOut,
    CreatePreferenceInput,
    PreferenceOut,
    PaymentStatusOut,
)

User = get_user_model()
logger = logging.getLogger(__name__)

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
FORWARD_WEBHOOK_URL = os.getenv("FORWARD_WEBHOOK_URL", "")

SUBSCRIPTION_PLANS = {
    "monthly": 49.90,
    "quarterly": 129.90,
    "annual": 399.90,
    "full": 49.90,
}


def are_subscriptions_active() -> bool:
    """
    Verifica se a cobrança de assinaturas/mensalidades está habilitada.
    Por regra de negócio, as mensalidades só serão cobradas após o mês de fevereiro de 2027
    (data padrão: 2027-03-01, configurável via SUBSCRIPTION_BILLING_START_DATE).
    Pode ser forçada via SUBSCRIPTION_BILLING_ENABLED=true/false.
    """
    override = os.getenv("SUBSCRIPTION_BILLING_ENABLED")
    if override is not None and override.strip():
        return override.strip().lower() in ("true", "1", "yes")

    from django.conf import settings
    start_date_str = getattr(
        settings,
        "SUBSCRIPTION_BILLING_START_DATE",
        os.getenv("SUBSCRIPTION_BILLING_START_DATE", "2027-03-01"),
    )
    try:
        start_date = datetime.strptime(str(start_date_str).strip(), "%Y-%m-%d").date()
        today = datetime.now().date()
        return today >= start_date
    except Exception:
        return False


class MercadoPagoService:
    @staticmethod
    def _get_sdk():
        if not MP_ACCESS_TOKEN:
            logger.warning("[MercadoPago] MP_ACCESS_TOKEN não configurado.")
        return mercadopago.SDK(MP_ACCESS_TOKEN)

    @classmethod
    def resolve_server_price(
        cls,
        user: User,
        target_type: str,
        target_id: Optional[str],
        requested_amount: Optional[float] = None,
    ) -> float:
        """
        Determina o preço real e imutável do produto/plano no backend,
        evitando adulteração de valores pelo cliente (price tampering).
        """
        target_type = (target_type or "subscription").lower()
        if target_type in ("subscription", "sub", "plan"):
            if not are_subscriptions_active():
                from django.conf import settings
                start_date_str = getattr(
                    settings,
                    "SUBSCRIPTION_BILLING_START_DATE",
                    os.getenv("SUBSCRIPTION_BILLING_START_DATE", "2027-03-01"),
                )
                raise HttpError(
                    400,
                    f"Planos e mensalidades só serão cobrados após fevereiro de 2027 (início previsto: {start_date_str}). "
                    f"No momento, apenas materiais avulsos salvos no dashboard com preços definidos estão disponíveis para compra.",
                )

            plan_key = (target_id or "monthly").lower()
            if plan_key not in SUBSCRIPTION_PLANS:
                plan_key = "monthly"
            return float(SUBSCRIPTION_PLANS[plan_key])

        elif target_type in ("hub", "hub_material", "premium"):
            if not target_id:
                raise HttpError(400, "Identificador de material ausente.")

            from apps.activities.models import PremiumContent

            item = PremiumContent.objects.filter(id=str(target_id)).first()
            if not item:
                raise HttpError(404, "Material do Hub não encontrado.")

            role = getattr(user, "role", "student")
            if role != "buyer":
                price = float(item.price_students or item.price or 0.0)
            else:
                price = float(item.price_buyers or item.price or 0.0)

            if price <= 0:
                raise HttpError(400, "Material não possui preço configurado para venda.")
            return price

        if requested_amount and float(requested_amount) > 0:
            return float(requested_amount)

        raise HttpError(400, "Tipo de cobrança ou valor inválido.")

    @classmethod
    def create_pix_payment(cls, user: User, data: CreatePixInput) -> PixPaymentOut:
        sdk = cls._get_sdk()
        server_price = cls.resolve_server_price(
            user, data.target_type, data.target_id, data.amount
        )
        data.amount = server_price

        external_reference = (
            f"PLAN:{user.username}:{data.target_id or 'full'}"
            if data.target_type == "subscription"
            else f"HUB:{user.username}:{data.target_id}"
        )

        payment_data = {
            "transaction_amount": float(data.amount),
            "description": data.description,
            "payment_method_id": "pix",
            "external_reference": external_reference,
            "payer": {
                "email": user.email or f"{user.username}@tati.ai",
                "first_name": user.name or user.username,
            },
        }

        try:
            payment_response = sdk.payment().create(payment_data)
            payment = payment_response.get("response", {})

            if payment_response.get("status") not in (200, 201):
                logger.error(f"[MercadoPago] Erro ao criar PIX: {payment_response}")
                raise HttpError(400, "Erro ao gerar cobrança PIX no Mercado Pago.")

            point_of_interaction = payment.get("point_of_interaction", {})
            transaction_data = point_of_interaction.get("transaction_data", {})

            return PixPaymentOut(
                payment_id=str(payment.get("id")),
                qr_code=transaction_data.get("qr_code", ""),
                qr_code_base64=transaction_data.get("qr_code_base64"),
                ticket_url=transaction_data.get("ticket_url"),
                amount=float(payment.get("transaction_amount", data.amount)),
                status=payment.get("status", "pending"),
            )
        except HttpError:
            raise
        except Exception as e:
            logger.error(f"[MercadoPago] Exception ao criar PIX: {e}")
            raise HttpError(500, f"Falha na comunicação com o Mercado Pago: {str(e)}")

    @classmethod
    def create_preference(
        cls, user: User, data: CreatePreferenceInput
    ) -> PreferenceOut:
        from django.conf import settings

        sdk = cls._get_sdk()
        server_price = cls.resolve_server_price(
            user, data.target_type, data.target_id, data.amount
        )
        data.amount = server_price

        external_reference = (
            f"PLAN:{user.username}:{data.target_id or 'full'}"
            if data.target_type == "subscription"
            else f"HUB:{user.username}:{data.target_id}"
        )

        frontend_base = (
            getattr(settings, "FRONTEND_URL", "")
            or os.getenv("FRONTEND_URL", "https://tati-ai.vercel.app")
        ).rstrip("/")

        preference_data = {
            "items": [
                {
                    "title": data.title,
                    "quantity": data.quantity,
                    "unit_price": float(data.amount),
                    "currency_id": "BRL",
                }
            ],
            "payer": {
                "email": user.email or f"{user.username}@tati.ai",
                "name": user.name or user.username,
            },
            "external_reference": external_reference,
            "back_urls": {
                "success": f"{frontend_base}/payment/success",
                "failure": f"{frontend_base}/payment/failure",
                "pending": f"{frontend_base}/payment/pending",
            },
            "auto_return": "approved",
        }

        try:
            preference_response = sdk.preference().create(preference_data)
            pref = preference_response.get("response", {})

            return PreferenceOut(
                preference_id=pref.get("id", ""),
                init_point=pref.get("init_point", ""),
                sandbox_init_point=pref.get("sandbox_init_point"),
            )
        except Exception as e:
            logger.error(f"[MercadoPago] Erro ao criar preferência: {e}")
            raise HttpError(500, "Erro ao gerar checkout do Mercado Pago.")

    @classmethod
    def get_payment_status(cls, payment_id: str) -> PaymentStatusOut:
        sdk = cls._get_sdk()
        try:
            res = sdk.payment().get(payment_id)
            payment = res.get("response", {})
            status = payment.get("status", "pending")
            return PaymentStatusOut(
                payment_id=str(payment.get("id", payment_id)),
                status=status,
                is_approved=(status == "approved"),
                paid_amount=payment.get("transaction_amount"),
                external_reference=payment.get("external_reference"),
            )
        except Exception as e:
            logger.error(f"[MercadoPago] Erro ao consultar pagamento {payment_id}: {e}")
            return PaymentStatusOut(
                payment_id=payment_id,
                status="unknown",
                is_approved=False,
            )

    @classmethod
    def process_webhook(cls, payload: dict) -> dict:
        # 1. Encaminha para Railway / Hugging Face se configurado
        if FORWARD_WEBHOOK_URL:
            try:
                with httpx.Client(timeout=4.0) as client:
                    client.post(FORWARD_WEBHOOK_URL, json=payload)
                    logger.info(
                        f"[MercadoPago] Webhook encaminhado com sucesso para: {FORWARD_WEBHOOK_URL}"
                    )
            except Exception as fwd_err:
                logger.warning(
                    f"[MercadoPago] Falha ao encaminhar webhook para {FORWARD_WEBHOOK_URL}: {fwd_err}"
                )

        # 2. Processa notificação
        payment_id = payload.get("data", {}).get("id") or payload.get("id")
        if not payment_id and payload.get("resource"):
            payment_id = str(payload.get("resource", "")).split("/")[-1]

        if not payment_id:
            return {"ok": True, "ignored": True}

        status_data = cls.get_payment_status(str(payment_id))
        if not status_data.is_approved:
            return {"ok": True, "status": status_data.status}

        ext_ref = status_data.external_reference or ""
        if ":" in ext_ref:
            parts = ext_ref.split(":")
            prefix = parts[0]
            username = parts[1]
            target_id = parts[2] if len(parts) > 2 else ""

            user = User.objects.filter(username=username).first()
            if user:
                paid_amount = float(status_data.paid_amount or 0.0)
                if prefix in ("PLAN", "SUB"):
                    plan_key = (target_id or "monthly").lower()
                    expected_price = SUBSCRIPTION_PLANS.get(plan_key, 49.90)
                    if paid_amount > 0 and paid_amount < (expected_price - 0.5):
                        logger.warning(
                            f"[MercadoPago] Pagamento insuficiente para plano {plan_key}: pago R${paid_amount}, esperado R${expected_price}"
                        )
                        return {"ok": True, "error": "underpaid"}

                    # Libera assinatura
                    user.is_premium_active = True
                    user.save(update_fields=["is_premium_active"])

                    Subscription.objects.create(
                        username=username,
                        plan_type=target_id or "full",
                        status="active",
                        payment_id=str(payment_id),
                        expires_at=datetime.now(timezone.utc) + timedelta(days=32),
                    )
                    logger.info(
                        f"[MercadoPago] Assinatura ativada para aluno: {username}"
                    )

                elif prefix in ("HUB", "PREMIUM"):
                    from apps.activities.models import PremiumContent

                    item = PremiumContent.objects.filter(id=str(target_id)).first()
                    if item:
                        role = getattr(user, "role", "student")
                        expected_price = (
                            float(item.price_students or item.price or 0.0)
                            if role != "buyer"
                            else float(item.price_buyers or item.price or 0.0)
                        )
                        if expected_price > 0 and paid_amount > 0 and paid_amount < (expected_price - 0.5):
                            logger.warning(
                                f"[MercadoPago] Pagamento insuficiente para material {target_id}: pago R${paid_amount}, esperado R${expected_price}"
                            )
                            return {"ok": True, "error": "underpaid"}

                    # Libera material do hub
                    PremiumPurchase.objects.create(
                        username=username,
                        content_id=target_id,
                        status="completed",
                    )
                    logger.info(
                        f"[MercadoPago] Material {target_id} liberado para: {username}"
                    )

        return {"ok": True, "processed": True, "status": "approved"}
