import os
import logging
import httpx
from datetime import datetime, timedelta, timezone
from django.contrib.auth import get_user_model
from ninja.errors import HttpError
import mercadopago

from .models import Order, Subscription, PremiumPurchase
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


class MercadoPagoService:
    @staticmethod
    def _get_sdk():
        if not MP_ACCESS_TOKEN:
            logger.warning("[MercadoPago] MP_ACCESS_TOKEN não configurado.")
        return mercadopago.SDK(MP_ACCESS_TOKEN)

    @classmethod
    def create_pix_payment(cls, user: User, data: CreatePixInput) -> PixPaymentOut:
        sdk = cls._get_sdk()
        external_reference = f"PLAN:{user.username}:{data.target_id or 'full'}" if data.target_type == "subscription" else f"HUB:{user.username}:{data.target_id}"

        payment_data = {
            "transaction_amount": float(data.amount),
            "description": data.description,
            "payment_method_id": "pix",
            "external_reference": external_reference,
            "payer": {
                "email": user.email or f"{user.username}@tati-ai.com",
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
    def create_preference(cls, user: User, data: CreatePreferenceInput) -> PreferenceOut:
        sdk = cls._get_sdk()
        external_reference = f"PLAN:{user.username}:{data.target_id or 'full'}" if data.target_type == "subscription" else f"HUB:{user.username}:{data.target_id}"

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
                "email": user.email or f"{user.username}@tati-ai.com",
                "name": user.name or user.username,
            },
            "external_reference": external_reference,
            "back_urls": {
                "success": "https://tati-ai.vercel.app/payment/success",
                "failure": "https://tati-ai.vercel.app/payment/failure",
                "pending": "https://tati-ai.vercel.app/payment/pending",
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
                    logger.info(f"[MercadoPago] Webhook encaminhado com sucesso para: {FORWARD_WEBHOOK_URL}")
            except Exception as fwd_err:
                logger.warning(f"[MercadoPago] Falha ao encaminhar webhook para {FORWARD_WEBHOOK_URL}: {fwd_err}")

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
                if prefix in ("PLAN", "SUB"):
                    # Libera assinatura
                    user.is_premium_active = True
                    user.save(update_fields=['is_premium_active'])
                    
                    Subscription.objects.create(
                        username=username,
                        plan_type="full",
                        status="active",
                        payment_id=str(payment_id),
                        expires_at=datetime.now(timezone.utc) + timedelta(days=32),
                    )
                    logger.info(f"[MercadoPago] Assinatura ativada para aluno: {username}")

                elif prefix in ("HUB", "PREMIUM"):
                    # Libera material do hub
                    PremiumPurchase.objects.create(
                        username=username,
                        content_id=target_id,
                        status="completed",
                    )
                    logger.info(f"[MercadoPago] Material {target_id} liberado para: {username}")

        return {"ok": True, "processed": True, "status": "approved"}
