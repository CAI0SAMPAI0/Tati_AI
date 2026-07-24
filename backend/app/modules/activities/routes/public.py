import asyncio
import logging
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import get_client
from app.core.dependencies.auth import get_current_user, get_current_user_optional
from app.core.security import hash_password
from app.modules.activities.schema.premium import HubOrderPublic, PremiumContentPublic
from app.modules.activities.services.premium_service import PremiumService
from app.modules.payments.services.mercadopago import MercadoPago
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

router = APIRouter()


class CheckoutRequest(BaseModel):
    content_id: str
    name: str
    email: EmailStr
    cpf: str
    billingType: str


@router.get("", response_model=list[PremiumContentPublic])
async def list_premium_content(service: PremiumService = Depends()):
    """Lista todo o conteúdo premium disponível para compra (não requer login)."""
    from app.shared.services.upstash import cache_get, cache_set

    cache_key = "catalog:public_list"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    result = await service.list_public_catalog()

    # Cache por 5 minutos (300s) — revalidado em background pelo React Query
    await cache_set(cache_key, result, ttl=300)

    return result


@router.get("/orders", response_model=list[HubOrderPublic])
async def list_my_orders(
    user: dict = Depends(get_current_user),
    service: PremiumService = Depends(),
):
    """Lista pedidos do usuário autenticado no hub-site."""
    return await service.list_user_orders(user.get("username"))


@router.post("/checkout")
async def public_checkout(
    body: CheckoutRequest,
    request: Request,
    service: PremiumService = Depends(),
    current_user: dict | None = Depends(get_current_user_optional),
):
    """
    Fluxo de checkout para visitantes:
    1. Busca ou Cria usuário com role 'buyer'
    2. Cria pedido nas tabelas 'orders' e 'order_items'
    3. Gera cobrança no Asaas
    """
    db = get_client()
    clean_email = body.email.strip().lower()
    raw_doc = "".join(filter(str.isdigit, body.cpf))

    temp_pass = None
    existing = (
        db.table("users").select("username").eq("email", clean_email).execute().data
    )
    if existing:
        username = existing[0]["username"]
        db.table("users").update({"cpf": raw_doc, "cpf_cnpj": raw_doc}).eq(
            "username", username
        ).execute()
    else:
        import random

        base_user = clean_email.split("@")[0]
        username = f"hub_{base_user}_{
            datetime.now().strftime('%H%M%S')}"
        clean_prefix = "".join(filter(str.isalnum, base_user))[:3].lower()
        random_suffix = "".join([str(random.randint(0, 9)) for _ in range(4)])
        temp_pass = f"{clean_prefix}{random_suffix}"

        db.table("users").insert(
            {
                "username": username,
                "name": body.name,
                "email": clean_email,
                "password": hash_password(temp_pass),
                "role": "buyer",
                "cpf": raw_doc,
                "cpf_cnpj": raw_doc,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()

        from app.shared.services.email import EmailSender

        try:
            EmailSender().send_welcome_hub_email(
                to_email=clean_email,
                name=body.name,
                username=username,
                password=temp_pass,
            )
        except Exception as e:
            logging.info(f"Erro ao enviar e-mail de boas-vindas: {e}")

    item = await service.get_public_item(body.content_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material não encontrado")

    # Determina o role do usuário para decidir o preço.
    # Primeiro verifica o token (se estiver logado no hub).
    # Se não, verifica se o e-mail já existe no banco.
    user_role = "buyer"
    if current_user and current_user.get("role"):
        user_role = current_user.get("role")
    elif existing:
        # Precisamos buscar a role do usuário existente
        existing_full = (
            db.table("users").select("role").eq("username", username).execute().data
        )
        if existing_full and existing_full[0].get("role"):
            user_role = existing_full[0].get("role")

    # Alunos, professores e admins ganham o preço de estudante
    if user_role != "buyer":
        resolved_price = float(item.get("price_students") or item.get("price") or 0)
    else:
        resolved_price = float(item.get("price_buyers") or item.get("price") or 0)

    if resolved_price <= 0:
        raise HTTPException(
            status_code=400,
            detail="Este material não possui preço configurado para compra.",
        )

    # Mercado Pago Checkout
    mp = MercadoPago()
    external_ref = f"HUB:{item['id']}:{username}"

    # --- Reaproveitamento de cobrança pendente (limite 5 minutos) ---
    try:
        existing_purchases = (
            db.table("premium_purchases")
            .select("*")
            .eq("username", username)
            .eq("content_id", item["id"])
            .eq("status", "pending")
            .execute()
            .data
        )

        if existing_purchases:
            existing_payment_id = existing_purchases[0].get("asaas_payment_id")
            if existing_payment_id:
                is_mp = (
                    existing_payment_id.isdigit()
                    or existing_payment_id.startswith("pref_")
                    or "-" in existing_payment_id
                )
                if is_mp:
                    from dateutil.parser import parse as parse_date

                    # 1. Caso seja PIX
                    if existing_payment_id.isdigit():
                        try:
                            payment_details = await mp.get_payment(existing_payment_id)
                            status = payment_details.get("status")
                            if status == "pending":
                                date_created = payment_details.get("date_created")
                                created_at = parse_date(date_created)
                                if created_at.tzinfo is None:
                                    created_at = created_at.replace(tzinfo=timezone.utc)

                                if (
                                    datetime.now(timezone.utc) - created_at
                                ).total_seconds() < 300:
                                    if body.billingType == "PIX":
                                        invoice_url = (
                                            payment_details.get(
                                                "point_of_interaction", {}
                                            )
                                            .get("transaction_data", {})
                                            .get("ticket_url")
                                        )
                                        pix_qr_code = (
                                            payment_details.get(
                                                "point_of_interaction", {}
                                            )
                                            .get("transaction_data", {})
                                            .get("qr_code_base64")
                                        )
                                        pix_copy_paste = (
                                            payment_details.get(
                                                "point_of_interaction", {}
                                            )
                                            .get("transaction_data", {})
                                            .get("qr_code")
                                        )

                                        # Busca order_id correspondente
                                        order_id = None
                                        order_res = (
                                            db.table("orders")
                                            .select("id")
                                            .eq("asaas_id", existing_payment_id)
                                            .execute()
                                            .data
                                        )
                                        if order_res:
                                            order_id = order_res[0]["id"]

                                        logging.info(
                                            f"[PublicCheckout] Reaproveitando pagamento PIX pendente {existing_payment_id} para {username}"
                                        )
                                        return {
                                            "orderId": order_id,
                                            "paymentId": existing_payment_id,
                                            "invoiceUrl": invoice_url,
                                            "pix": {
                                                "qrCode": pix_qr_code,
                                                "copyPaste": pix_copy_paste,
                                            },
                                            "username": username,
                                            "password": temp_pass,
                                        }
                                    else:
                                        # Mudou de método de pagamento (ex: de PIX para DEBIT_CARD).
                                        # Cancela o PIX antigo preventivamente
                                        try:
                                            await mp._put(
                                                f"/v1/payments/{existing_payment_id}",
                                                {"status": "cancelled"},
                                            )
                                            db.table("premium_purchases").update(
                                                {"status": "revoked"}
                                            ).eq(
                                                "asaas_payment_id", existing_payment_id
                                            ).execute()
                                            db.table("orders").update(
                                                {"status": "cancelled"}
                                            ).eq(
                                                "asaas_id", existing_payment_id
                                            ).execute()
                                            logging.info(
                                                f"[PublicCheckout] Cancelado PIX antigo {existing_payment_id} devido a alteração do método de pagamento"
                                            )
                                        except Exception as ec:
                                            logging.info(
                                                f"[PublicCheckout] Erro ao cancelar PIX antigo: {ec}"
                                            )
                        except Exception as ep:
                            logging.info(
                                f"[PublicCheckout] Erro ao recuperar pagamento PIX do MP: {ep}"
                            )

                    # 2. Caso seja Preferência (Cartão de Débito)
                    elif (
                        existing_payment_id.startswith("pref_")
                        or "-" in existing_payment_id
                    ):
                        try:
                            preference_details = await mp.get_preference(
                                existing_payment_id
                            )
                            date_created = preference_details.get("date_created")
                            created_at = parse_date(date_created)
                            if created_at.tzinfo is None:
                                created_at = created_at.replace(tzinfo=timezone.utc)

                            if (
                                datetime.now(timezone.utc) - created_at
                            ).total_seconds() < 300:
                                if body.billingType == "DEBIT_CARD":
                                    is_sandbox = settings.mp_access_token.startswith(
                                        "TEST-"
                                    )
                                    invoice_url = (
                                        preference_details.get("sandbox_init_point")
                                        if is_sandbox
                                        else preference_details.get("init_point")
                                    )

                                    order_id = None
                                    order_res = (
                                        db.table("orders")
                                        .select("id")
                                        .eq("asaas_id", existing_payment_id)
                                        .execute()
                                        .data
                                    )
                                    if order_res:
                                        order_id = order_res[0]["id"]

                                    logging.info(
                                        f"[PublicCheckout] Reaproveitando preferência de débito {existing_payment_id} para {username}"
                                    )
                                    return {
                                        "orderId": order_id,
                                        "paymentId": existing_payment_id,
                                        "invoiceUrl": invoice_url,
                                        "pix": None,
                                        "username": username,
                                        "password": temp_pass,
                                    }
                                else:
                                    # Mudou o método de pagamento de débito para PIX.
                                    # Apenas marcamos como cancelado/revogado no banco
                                    try:
                                        db.table("premium_purchases").update(
                                            {"status": "revoked"}
                                        ).eq(
                                            "asaas_payment_id", existing_payment_id
                                        ).execute()
                                        db.table("orders").update(
                                            {"status": "cancelled"}
                                        ).eq("asaas_id", existing_payment_id).execute()
                                        logging.info(
                                            f"[PublicCheckout] Cancelada preferência antiga {existing_payment_id} no banco devido a alteração do método"
                                        )
                                    except Exception as ec:
                                        logging.info(
                                            f"[PublicCheckout] Erro ao revogar preferência antiga no banco: {ec}"
                                        )
                        except Exception as ep:
                            logging.info(
                                f"[PublicCheckout] Erro ao recuperar preferência do MP: {ep}"
                            )
    except Exception as e:
        logging.info(f"[PublicCheckout] Erro no fluxo de reaproveitamento: {e}")
    # -------------------------------------------------------------

    if body.billingType == "PIX":
        payer = {
            "email": clean_email,
            "identification": {"type": "CPF", "number": raw_doc},
        }
        name_parts = body.name.strip().split(" ", 1)
        if len(name_parts) > 0:
            payer["first_name"] = name_parts[0]
        if len(name_parts) > 1:
            payer["last_name"] = name_parts[1]

        try:
            payment = await mp.pay_with_pix(
                amount=resolved_price,
                description=f"Material: {item['title']}",
                payer=payer,
                external_reference=external_ref,
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
            pix_data = {"qrCode": pix_qr_code, "copyPaste": pix_copy_paste}
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Erro ao processar pagamento via Mercado Pago: {exc}",
            )

    elif body.billingType == "DEBIT_CARD":
        origin = request.headers.get("origin") or "https://tati-ai.vercel.app"
        try:
            preference = await mp.create_preference_for_debit_card(
                amount=resolved_price,
                description=f"Material: {item['title']}",
                payer_name=body.name,
                payer_email=clean_email,
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
            pix_data = None
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Erro ao criar preferência de pagamento no Mercado Pago: {exc}",
            )
    else:
        raise HTTPException(
            status_code=400,
            detail="Método de pagamento não suportado para o Hub. Use PIX ou DEBIT_CARD.",
        )

    order_res = (
        db.table("orders")
        .insert(
            {
                "username": username,
                "total_amount": resolved_price,
                "status": "pending",
                "asaas_id": payment_id,
                "payment_method": body.billingType,
            }
        )
        .execute()
    )

    order_id = order_res.data[0]["id"]

    db.table("order_items").insert(
        {"order_id": order_id, "content_id": item["id"], "price": resolved_price}
    ).execute()

    try:
        db.table("premium_purchases").upsert(
            {
                "username": username,
                "content_id": item["id"],
                "asaas_payment_id": payment_id,
                "status": "pending",
            },
            on_conflict="username,content_id",
        ).execute()
    except Exception as exc:
        logging.info(
            f"[PublicCheckout] Aviso: erro ao inserir premium_purchases: {exc}"
        )

    # Auto-cancelamento após 5 minutos se não pago
    async def _auto_cancel_after_timeout(pid: str, oid: str):
        await asyncio.sleep(300)  # 5 minutos
        try:
            db2 = get_client()
            order_check = (
                db2.table("orders").select("status").eq("id", oid).execute().data
            )
            if order_check and order_check[0]["status"] == "pending":
                logging.info(
                    f"[AutoCancel] Expirando pagamento pendente payment_id={pid} order_id={oid}"
                )
                db2.table("orders").update({"status": "cancelled"}).eq(
                    "id", oid
                ).execute()
                db2.table("premium_purchases").update({"status": "revoked"}).eq(
                    "asaas_payment_id", pid
                ).execute()
                # Tenta cancelar no MP (PIX apenas, ignore erros)
                if pid.isdigit():
                    try:
                        await MercadoPago()._put(
                            f"/v1/payments/{pid}", {"status": "cancelled"}
                        )
                    except Exception:
                        pass
        except Exception as e:
            logging.info(f"[AutoCancel] Erro no auto-cancel: {e}")

    asyncio.create_task(_auto_cancel_after_timeout(payment_id, order_id))

    return {
        "orderId": order_id,
        "paymentId": payment_id,
        "invoiceUrl": invoice_url,
        "pix": pix_data,
        "username": username,
        "password": temp_pass,
    }


@router.get("/{item_id}", response_model=PremiumContentPublic)
async def get_catalog_item(item_id: str, service: PremiumService = Depends()):
    """Retorna detalhes de um item específico do catálogo."""
    item = await service.get_public_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Material não encontrado")
    return item


@router.post("/checkout/{payment_id}/cancel")
async def cancel_checkout(payment_id: str):
    """
    Cancela um pedido pendente. Funciona para Mercado Pago (PIX/Débito) e Asaas.
    Não requer autenticação pois o visitante pode não estar logado.
    """
    db = get_client()

    # Busca em orders pelo asaas_id
    order = (
        db.table("orders")
        .select("id, status")
        .eq("asaas_id", payment_id)
        .execute()
        .data
    )

    if order:
        current_status = order[0]["status"]
        order_id = order[0]["id"]
    else:
        # Fallback: busca diretamente em premium_purchases (ex: hub sem order)
        pp = (
            db.table("premium_purchases")
            .select("id, status")
            .eq("asaas_payment_id", payment_id)
            .execute()
            .data
        )
        if not pp:
            raise HTTPException(status_code=404, detail="Pedido não encontrado.")
        current_status = pp[0]["status"]
        order_id = None

    # Idempotente: já cancelado
    if current_status in ("cancelled", "revoked"):
        return {"ok": True, "message": "Pedido já estava cancelado."}

    # Não cancela se confirmado
    if current_status == "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Este pedido já foi confirmado. Não é possível cancelá-lo.",
        )

    if current_status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Pedido não pode ser cancelado (status: {current_status}).",
        )

    # Cancela no gateway externo
    is_mp = payment_id.isdigit() or payment_id.startswith("pref_")
    is_asaas = not is_mp and "-" not in payment_id

    if is_mp and payment_id.isdigit():
        # Cancela PIX no Mercado Pago
        try:
            await MercadoPago()._put(
                f"/v1/payments/{payment_id}", {"status": "cancelled"}
            )
            logging.info(f"[CancelCheckout] PIX MP {payment_id} cancelado.")
        except Exception as e:
            logging.info(f"[CancelCheckout] Aviso: erro ao cancelar PIX no MP: {e}")

    if is_asaas:
        try:
            from app.modules.payments.services.asaas import cancel_payment

            await cancel_payment(payment_id)
        except Exception as e:
            logging.info(f"[CancelCheckout] Aviso: erro ao cancelar no Asaas: {e}")

    # Atualiza banco
    if order_id:
        db.table("orders").update({"status": "cancelled"}).eq("id", order_id).execute()
    db.table("premium_purchases").update({"status": "revoked"}).eq(
        "asaas_payment_id", payment_id
    ).execute()

    return {"ok": True, "message": "Pedido cancelado com sucesso."}
