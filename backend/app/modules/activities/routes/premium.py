import logging

"""
routers/activities/premium.py
Router para o Hub de Conteúdos Premium (Visão do Aluno).
"""

from typing import Any

from app.core.config import settings
from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from app.core.exceptions import (
    BusinessLogicError,
    ContentNotFoundError,
    UserNotFoundError,
)
from app.modules.activities.services.premium_service import PremiumService
from app.modules.payments.services.mercadopago import MercadoPago
from fastapi import APIRouter, Depends, HTTPException, Request

router = APIRouter()


@router.get("/")
async def list_premium_content(
    user: dict = Depends(get_current_user), service: PremiumService = Depends()
) -> list[dict[str, Any]]:
    """Lista a vitrine de conteúdos premium para o aluno."""
    return await service.list_content_for_student(user["username"])


@router.get("/{content_id}/access")
async def get_premium_access(
    content_id: str,
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends(),
) -> dict[str, str]:
    """Retorna a URL de acesso (Signed URL) para o conteúdo, se autorizado."""
    url = await service.get_content_access(content_id, user["username"])
    return {"url": url}


@router.post("/{content_id}/buy")
async def buy_premium_content(
    content_id: str,
    request: Request,
    billingType: str = "PIX",
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends(),
):
    """
    Inicia o processo de compra via Mercado Pago.
    Gera uma cobrança e retorna os dados de pagamento.
    """
    db = get_client()
    username = user["username"]

    # 1. Busca detalhes do conteúdo
    content = (
        db.table("premium_content")
        .select("*")
        .eq("id", content_id)
        .single()
        .execute()
        .data
    )
    if not content:
        raise ContentNotFoundError(detail="Conteúdo não encontrado")

    # Resolve o preço correto conforme o role do usuário
    user_role = user.get("role", "")
    if user_role == "buyer":
        resolved_price = float(content.get("price_buyers") or content.get("price") or 0)
    else:
        resolved_price = float(
            content.get("price_students") or content.get("price") or 0
        )

    if resolved_price <= 0:
        return {"message": "Este conteúdo é gratuito.", "free": True}

    # 2. Busca dados completos do usuário
    user_db = (
        db.table("users").select("*").eq("username", username).single().execute().data
    )
    if not user_db:
        raise UserNotFoundError(detail="Usuário não encontrado")

    raw_doc = (
        str(user_db.get("cpf") or user_db.get("cpf_cnpj") or "")
        .replace(".", "")
        .replace("-", "")
        .replace("/", "")
        .strip()
    )

    if not raw_doc:
        raise BusinessLogicError(detail="CPF/CNPJ é obrigatório para compras.")

    mp = MercadoPago()
    external_ref = f"PREMIUM:{content_id}:{username}"

    if billingType == "PIX":
        payer = {
            "email": user_db["email"],
            "identification": {"type": "CPF", "number": raw_doc},
        }
        name_parts = (user_db.get("name") or username).strip().split(" ", 1)
        if len(name_parts) > 0:
            payer["first_name"] = name_parts[0]
        if len(name_parts) > 1:
            payer["last_name"] = name_parts[1]

        try:
            payment = await mp.pay_with_pix(
                amount=resolved_price,
                description=f"Tati AI - Premium: {content['title']}",
                payer=payer,
                external_reference=external_ref,
            )
            logging.info(
                f"[MP PIX DEBUG] status={payment.get('status')} status_detail={payment.get('status_detail')} poi={payment.get('point_of_interaction')}"
            )
            payment_id = str(payment.get("id"))
            invoice_url = (
                payment.get("point_of_interaction", {})
                .get("transaction_data", {})
                .get("ticket_url")
            )
            pix_qr_code = (
                payment.get("point_of_interaction", {})
                .get("transaction_data", {})
                .get("qr_code_base64")
            )
            pix_copy_paste = (
                payment.get("point_of_interaction", {})
                .get("transaction_data", {})
                .get("qr_code")
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Erro Mercado Pago: {exc}")

    elif billingType == "DEBIT_CARD":
        origin = request.headers.get("origin") or "https://tati-ai.vercel.app"
        try:
            preference = await mp.create_preference_for_debit_card(
                amount=resolved_price,
                description=f"Tati AI - Premium: {content['title']}",
                payer_name=user_db.get("name") or username,
                payer_email=user_db["email"],
                payer_cpf=raw_doc,
                external_reference=external_ref,
                success_url=f"{origin}/materiais",
            )
            payment_id = preference.get("id")
            is_sandbox = settings.mp_access_token.startswith("TEST-")
            invoice_url = (
                preference.get("sandbox_init_point")
                if is_sandbox
                else preference.get("init_point")
            )
            pix_qr_code = None
            pix_copy_paste = None
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Erro Mercado Pago (Preference): {exc}"
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Método de pagamento não suportado para o Hub. Use PIX ou DEBIT_CARD.",
        )

    # 5. Registra tentativa de compra no banco
    try:
        db.table("premium_purchases").upsert(
            {
                "username": username,
                "content_id": content_id,
                "asaas_payment_id": payment_id,
                "status": "pending",
            },
            on_conflict="username,content_id",
        ).execute()
    except Exception as exc:
        err = str(exc).lower()
        if "duplicate key" in err or "23505" in err:
            logging.info(
                f"[Premium] Aviso: compra já existe (race): {username} - {content_id}"
            )
        else:
            raise

    return {
        "paymentId": payment_id,
        "invoiceUrl": invoice_url,
        "pixQrCode": pix_qr_code,
        "pixCopyPaste": pix_copy_paste,
        "value": resolved_price,
        "title": content["title"],
    }
