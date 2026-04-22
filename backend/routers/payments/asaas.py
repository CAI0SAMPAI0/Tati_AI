from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.config import settings
from routers.deps import get_current_user
from routers.users.permissions import PAID_START, SPECIAL_USERS, calc_due_date
from services.asaas import (
    cancel_subscription, create_customer, create_subscription,
    get_customer_by_email, get_pix_qr_code, get_subscription_payments,
    update_customer, update_subscription_due_day,
)
from services.database import get_client
from services.document_validator import validate_document_auto

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    billingType: str          # 'PIX' | 'BOLETO' | 'CREDIT_CARD'
    planType:    str = "basic"  # 'basic' | 'full'

class ChangeDueDateRequest(BaseModel):
    preferred_day: int  # 1–28


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _find_customer_by_document(doc: str) -> dict | None:
    """Busca customer Asaas pelo documento (CPF/CNPJ)."""
    from services.asaas import get_base_url, get_headers
    import httpx
    url = f"{get_base_url()}/customers"
    params = {}
    if len(doc) == 11:
        params["cpf"] = doc
    else:
        params["cnpj"] = doc
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, headers=get_headers(), timeout=15)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0] if data.get("data") else None
    except Exception:
        return None


def _get_validated_user(username: str) -> dict:
    """Busca e valida dados do usuário necessários para pagamento."""
    db = get_client()
    try:
        user_db = db.table("users").select(
            "email, name, username, cpf, cpf_cnpj, phone, preferred_due_day"
        ).eq("username", username).single().execute().data
    except Exception:
        user_db = db.table("users").select(
            "email, name, username, cpf, cpf_cnpj, preferred_due_day"
        ).eq("username", username).single().execute().data

    if not user_db:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if not user_db.get("email"):
        raise HTTPException(status_code=400, detail="Usuário não possui e-mail cadastrado.")

    if user_db.get("username") in SPECIAL_USERS:
        raise HTTPException(status_code=403, detail="Usuários especiais têm acesso gratuito.")

    raw_doc = str(
        user_db.get("cpf") or user_db.get("cpf_cnpj") or ""
    ).replace(".", "").replace("-", "").replace("/", "").strip()

    if not raw_doc:
        raise HTTPException(
            status_code=400,
            detail="CPF/CNPJ é obrigatório. Por favor, preencha no seu perfil.",
        )

    validation = validate_document_auto(raw_doc)
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=f"Documento inválido: {validation['message']}")

    user_db["_raw_doc"] = raw_doc
    return user_db


def _activate_subscription(username: str, plan_type: str, asaas_subscription_id: str, payment_id: str) -> None:
    """Ativa assinatura no banco após confirmação de pagamento."""
    db            = get_client()
    today         = date.today()
    user_row      = db.table("users").select("preferred_due_day").eq("username", username).single().execute().data or {}
    preferred_day = user_row.get("preferred_due_day") or 5
    expires_at    = calc_due_date(today, preferred_day)

    # Cancela assinaturas anteriores
    db.table("subscriptions").update({"status": "cancelled"}).eq(
        "username", username
    ).in_("status", ["pending", "active", "grace"]).execute()

    # Cria nova assinatura ativa
    db.table("subscriptions").insert({
        "username":               username,
        "plan_type":              plan_type,
        "status":                 "active",
        "payment_id":             payment_id,
        "asaas_subscription_id":  asaas_subscription_id,
        "preferred_due_day":      preferred_day,
        "expires_at":             expires_at.isoformat(),
    }).execute()

    # Atualiza flags do usuário
    db.table("users").update({
        "is_premium_active":  True,
        "plan_type":          plan_type,
        "free_messages_used": 0,
    }).eq("username", username).execute()


def _expire_by_subscription_id(asaas_subscription_id: str) -> None:
    """Expira assinatura pelo ID do Asaas."""
    db   = get_client()
    rows = db.table("subscriptions").select("username").eq(
        "asaas_subscription_id", asaas_subscription_id
    ).limit(1).execute().data

    if not rows:
        return

    username = rows[0]["username"]
    db.table("subscriptions").update({"status": "expired"}).eq(
        "asaas_subscription_id", asaas_subscription_id
    ).execute()
    db.table("users").update({
        "is_premium_active": False,
        "plan_type":         None,
    }).eq("username", username).execute()


def _activate_special_user(username: str, plan_type: str = "full") -> None:
    """Ativa assinatura para usuários especiais sem pagamento."""
    if username not in SPECIAL_USERS:
        return
    db         = get_client()
    today      = date.today()
    expires_at = date(today.year + 2, today.month, today.day)

    db.table("subscriptions").update({"status": "cancelled"}).eq(
        "username", username
    ).in_("status", ["pending", "active", "grace"]).execute()

    db.table("subscriptions").insert({
        "username":               username,
        "plan_type":              plan_type,
        "status":                 "active",
        "payment_id":             f"special_{username}",
        "asaas_subscription_id":  f"special_{username}",
        "preferred_due_day":      5,
        "expires_at":             expires_at.isoformat(),
    }).execute()

    db.table("users").update({
        "is_premium_active":  True,
        "plan_type":          plan_type,
        "free_messages_used": 0,
    }).eq("username", username).execute()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/subscribe")
async def subscribe(
    body:         SubscribeRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Cria uma assinatura recorrente mensal no Asaas.
    O valor vem do banco (tabela plans) — nunca do frontend.
    Retorna o invoiceUrl para redirecionar o aluno ao checkout do Asaas.
    """
    db = get_client()

    username = current_user["username"]
    if username not in SPECIAL_USERS:
        if date.today() < PAID_START:
            raise HTTPException(
                status_code=403,
                detail="Planos e pagamentos só estarão disponíveis a partir de 01/05/2026.",
            )

    # 1. Busca o plano no banco — o valor vem daqui, nunca do frontend
    plan = db.table("plans").select("*").eq("id", body.planType).eq("is_active", True).execute().data
    if not plan:
        raise HTTPException(status_code=404, detail="Plano não encontrado ou indisponível.")
    plan  = plan[0]
    value = float(plan["price"])

    # 2. Valida usuário (CPF, email, não é especial)
    user_db  = _get_validated_user(current_user["username"])
    username = user_db["username"]
    raw_doc  = user_db["_raw_doc"]
    phone    = "".join(filter(str.isdigit, str(user_db.get("phone") or "")))
    phone    = phone if len(phone) >= 10 else None

    # 3. Busca ou cria customer no Asaas
    customer = await get_customer_by_email(user_db["email"])
    if customer:
        customer_id = customer["id"]
        if not customer.get("cpfCnpj") and raw_doc:
            await update_customer(customer_id, {"cpfCnpj": raw_doc})
    else:
        try:
            new_cust    = await create_customer(
                name=user_db.get("name") or username,
                email=user_db["email"],
                cpf_cnpj=raw_doc,
                phone=phone,
            )
            customer_id = new_cust["id"]
        except Exception as exc:
            err_str = str(exc)
            if "já cadastrado" in err_str or "already been taken" in err_str or "duplicate" in err_str.lower():
                customer_by_doc = await _find_customer_by_document(raw_doc)
                if customer_by_doc:
                    customer_id = customer_by_doc["id"]
                else:
                    raise HTTPException(status_code=409, detail="Documento já cadastrado no sistema de pagamento. Use outro CPF/CNPJ ou entre em contato.")
            else:
                raise HTTPException(status_code=500, detail=err_str)

    # 4. Calcula data do primeiro vencimento
    preferred_day = user_db.get("preferred_due_day") or 5
    next_due_date = calc_due_date(date.today(), preferred_day).isoformat()

    # 5. Cria assinatura recorrente no Asaas
    try:
        subscription = await create_subscription(
            customer_id        = customer_id,
            billing_type       = body.billingType,
            value              = value,
            next_due_date      = next_due_date,
            description        = plan.get("description") or f"Assinatura Teacher Tati — {plan['name']}",
            external_reference = f"{username}|{body.planType}",
        )
    except Exception as exc:
        err_str = str(exc)
        if body.billingType == "PIX" and ("duplicate" in err_str.lower() or "já" in err_str.lower()):
            raise HTTPException(status_code=409, detail="Este pagamento PIX já foi gerado. Tente outra forma de pagamento (boleto ou cartão).")
        raise HTTPException(status_code=500, detail=err_str)

    subscription_id = subscription.get("id")

    # 6. Busca o primeiro payment gerado pela subscription
    # O invoiceUrl e QR Code ficam no payment, não na subscription
    first_payment    = None
    invoice_url      = subscription.get("invoiceUrl")
    first_payment_id = None

    try:
        payments = await get_subscription_payments(subscription_id)
        if payments:
            first_payment    = payments[0]
            first_payment_id = first_payment.get("id")
            invoice_url      = first_payment.get("invoiceUrl") or invoice_url
    except Exception as e:
        print(f"[Subscribe] Aviso: não foi possível buscar payment da subscription: {e}")

    # 7. Salva no banco como 'pending' — webhook vai ativar
    db.table("subscriptions").insert({
        "username":               username,
        "plan_type":              body.planType,
        "status":                 "pending",
        "payment_id":             first_payment_id or subscription_id,
        "asaas_subscription_id":  subscription_id,
        "preferred_due_day":      preferred_day,
        "expires_at":             next_due_date,
    }).execute()

    # 8. Busca QR Code PIX se necessário
    pix_qr_code    = None
    pix_copy_paste = None
    if body.billingType == "PIX" and first_payment_id:
        try:
            pix_data       = await get_pix_qr_code(first_payment_id)
            pix_qr_code    = pix_data.get("encodedImage")
            pix_copy_paste = pix_data.get("payload")
        except Exception as e:
            print(f"[Subscribe] Aviso: erro ao buscar QR Code PIX: {e}")

    # 9. Retorna dados para o frontend
    return {
        "subscriptionId": subscription_id,
        "paymentId":      first_payment_id,
        "invoiceUrl":     invoice_url,
        "pixQrCode":      pix_qr_code,
        "pixCopyPaste":   pix_copy_paste,
        "dueDate":        next_due_date,
        "value":          value,
        "planName":       plan["name"],
    }


@router.post("/cancel")
async def cancel(current_user: dict = Depends(get_current_user)):
    """Cancela a assinatura ativa do usuário."""
    db  = get_client()
    sub = db.table("subscriptions").select(
        "asaas_subscription_id, status"
    ).eq("username", current_user["username"]).in_(
        "status", ["active", "pending", "grace"]
    ).order("created_at", desc=True).limit(1).execute().data

    if not sub:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada.")

    asaas_id = sub[0].get("asaas_subscription_id")

    # Cancela no Asaas
    if asaas_id and not asaas_id.startswith("special_"):
        await cancel_subscription(asaas_id)

    # Atualiza no banco
    db.table("subscriptions").update({"status": "cancelled"}).eq(
        "username", current_user["username"]
    ).in_("status", ["active", "pending", "grace"]).execute()

    db.table("users").update({
        "is_premium_active": False,
        "plan_type":         None,
    }).eq("username", current_user["username"]).execute()

    return {"ok": True, "message": "Assinatura cancelada com sucesso."}


@router.post("/change-due-date")
async def change_due_date(
    body:         ChangeDueDateRequest,
    current_user: dict = Depends(get_current_user),
):
    """Troca o dia de vencimento da assinatura no banco e no Asaas."""
    if not (1 <= body.preferred_day <= 28):
        raise HTTPException(status_code=400, detail="Dia deve ser entre 1 e 28.")

    db  = get_client()
    sub = db.table("subscriptions").select(
        "asaas_subscription_id"
    ).eq("username", current_user["username"]).in_(
        "status", ["active", "grace"]
    ).order("created_at", desc=True).limit(1).execute().data

    if not sub:
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa encontrada.")

    new_due  = calc_due_date(date.today(), body.preferred_day)
    asaas_id = sub[0].get("asaas_subscription_id")

    # Atualiza no Asaas
    if asaas_id and not asaas_id.startswith("special_"):
        await update_subscription_due_day(asaas_id, new_due.isoformat())

    # Atualiza no banco
    db.table("subscriptions").update({
        "preferred_due_day": body.preferred_day,
        "expires_at":        new_due.isoformat(),
    }).eq("username", current_user["username"]).in_(
        "status", ["active", "grace"]
    ).execute()

    db.table("users").update({
        "preferred_due_day": body.preferred_day,
    }).eq("username", current_user["username"]).execute()

    return {
        "ok":           True,
        "new_due_date": new_due.isoformat(),
        "message":      f"Vencimento alterado para dia {body.preferred_day} (próximo: {new_due}).",
    }


@router.get("/plans")
async def list_plans(current_user: dict = Depends(get_current_user)):
    """Retorna os planos disponíveis com preços do banco."""
    plans = get_client().table("plans").select(
        "id, name, description, price"
    ).eq("is_active", True).execute().data
    return plans or []


@router.get("/status")
async def get_status(current_user: dict = Depends(get_current_user)):
    """Retorna status da assinatura atual do usuário."""
    db  = get_client()
    sub = db.table("subscriptions").select(
        "plan_type, status, expires_at, asaas_subscription_id, preferred_due_day"
    ).eq("username", current_user["username"]).order(
        "created_at", desc=True
    ).limit(1).execute().data

    if not sub:
        return {"has_subscription": False}

    s         = sub[0]
    expires   = date.fromisoformat(s["expires_at"][:10])
    today     = date.today()
    days_left = (expires - today).days

    return {
        "has_subscription":      True,
        "plan_type":             s["plan_type"],
        "status":                s["status"],
        "expires_at":            s["expires_at"][:10],
        "days_left":             max(0, days_left),
        "asaas_subscription_id": s.get("asaas_subscription_id"),
        "preferred_due_day":     s.get("preferred_due_day", 5),
    }


@router.post("/webhook")
async def asaas_webhook(request: Request):
    """
    Webhook do Asaas — processa eventos de pagamento e assinatura.
    Configure a URL no painel Asaas em: Configurações > Integrações > Webhooks
    """
    # Valida token do webhook
    token = request.headers.get("asaas-access-token", "")
    if settings.asaas_webhook_token and token != settings.asaas_webhook_token:
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        body    = await request.json()
        event   = body.get("event", "")
        payment = body.get("payment", {})

        payment_id       = payment.get("id", "")
        subscription_id  = payment.get("subscription", "")  # ID da assinatura no Asaas
        ext_ref          = payment.get("externalReference", "")
        parts            = ext_ref.split("|") if "|" in ext_ref else [ext_ref, "basic"]
        username         = parts[0]
        plan_type        = parts[1] if len(parts) > 1 else "basic"

        print(f"[Webhook] event={event} username={username} plan={plan_type} subscription={subscription_id}")

        if event in ("PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"):
            # Pagamento confirmado — ativa a assinatura
            _activate_subscription(username, plan_type, subscription_id, payment_id)
            print(f"[Webhook] ✅ Assinatura ativada: {username} ({plan_type})")

        elif event == "PAYMENT_OVERDUE":
            # Venceu — entra em grace period, ainda não cancela
            get_client().table("subscriptions").update({"status": "grace"}).eq(
                "asaas_subscription_id", subscription_id
            ).execute()
            print(f"[Webhook] ⚠️ Em grace period: {username}")

        elif event in ("PAYMENT_DELETED", "PAYMENT_REFUNDED", "CHARGEBACK_REQUESTED", "SUBSCRIPTION_DELETED"):
            # Cancelado ou estornado — expira acesso
            _expire_by_subscription_id(subscription_id)
            print(f"[Webhook] ❌ Assinatura expirada: {username}")

        return {"ok": True}

    except Exception as exc:
        print(f"[Webhook] ERRO: {exc}")
        return {"ok": False, "error": str(exc)}  # sempre 200 para o Asaas não retentar