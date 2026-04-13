from datetime import datetime, timedelta, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.config import settings
from routers.deps import get_current_user
from routers.users.permissions import calc_due_date, SPECIAL_USERS
from services.asaas import (
    create_customer, create_payment,
    get_customer_by_email, get_pix_qr_code,
)
from services.database import get_client

from fastapi import HTTPException

router = APIRouter()


# ── Models ────────────────────────────────────────────────────────

class PaymentRequest(BaseModel):
    billingType: str
    value:       float
    planType:    str = "basic"          # 'basic' | 'full'
    description: Optional[str] = "Assinatura Teacher Tati"

class PaymentResponse(BaseModel):
    paymentId:    str
    invoiceUrl:   str
    bankSlipUrl:  Optional[str] = None
    pixQrCode:    Optional[str] = None
    pixCopyPaste: Optional[str] = None
    dueDate:      str


# ── Helpers ───────────────────────────────────────────────────────

def _upsert_subscription(username: str, plan_type: str, payment_id: str) -> None:
    """Cria ou renova a assinatura do usuário."""
    db    = get_client()
    today = date.today()

    # Busca preferred_due_day do usuário
    user_row = (
        db.table("users")
        .select("preferred_due_day")
        .eq("username", username)
        .single()
        .execute()
        .data
    )
    preferred_day = (user_row or {}).get("preferred_due_day") or 5
    expires_at    = calc_due_date(today, preferred_day)

    # Cancela assinaturas anteriores pendentes/ativas
    db.table("subscriptions").update({"status": "cancelled"}).eq(
        "username", username
    ).in_("status", ["pending", "active", "grace"]).execute()

    # Cria nova assinatura ativa
    db.table("subscriptions").insert({
        "username":          username,
        "plan_type":         plan_type,
        "status":            "active",
        "payment_id":        payment_id,
        "preferred_due_day": preferred_day,
        "expires_at":        expires_at.isoformat(),
    }).execute()

    # Atualiza flags no usuário
    db.table("users").update({
        "is_premium_active":   True,
        "plan_type":           plan_type,
        "free_messages_used":  0,        # zera o contador gratuito
    }).eq("username", username).execute()


def _expire_subscription(payment_id: str) -> None:
    """Marca assinatura como expirada após chargeback ou cancelamento."""
    db = get_client()
    rows = (
        db.table("subscriptions")
        .select("username")
        .eq("payment_id", payment_id)
        .limit(1)
        .execute()
        .data
    )
    if not rows:
        return

    username = rows[0]["username"]
    db.table("subscriptions").update({"status": "expired"}).eq("payment_id", payment_id).execute()
    db.table("users").update({
        "is_premium_active": False,
        "plan_type":         None,
    }).eq("username", username).execute()


# ── Endpoints ─────────────────────────────────────────────────────

@router.post("/create", response_model=PaymentResponse)
async def create_new_payment(
    body:         PaymentRequest,
    current_user: dict = Depends(get_current_user),
):
    user_email = current_user.get("email")
    username   = current_user.get("username")
    user_name  = current_user.get("name") or current_user.get("username")
    cpf_cnpj   = current_user.get("cpf") or current_user.get("cpf_cnpj")

    raw_phone = str(current_user.get("phone") or "")
    phone     = "".join(filter(str.isdigit, raw_phone))
    if len(phone) < 10:
        phone = None

    if not user_email:
        raise HTTPException(status_code=400, detail="Usuário não possui e-mail cadastrado.")

    if body.planType not in ("basic", "full"):
        raise HTTPException(status_code=400, detail="planType inválido. Use 'basic' ou 'full'.")

    launch_date = date(2026, 5, 1)

    # Se a data atual for menor que o lançamento E o usuário não for especial, bloqueia:
    if date.today() < launch_date and username not in SPECIAL_USERS:
        raise HTTPException(
            status_code=403, 
            detail="As assinaturas estarão disponíveis apenas a partir de 01/05/2026."
        )

    try:
        customer    = await get_customer_by_email(user_email)
        
        if customer:
            customer_id = customer["id"]
        else:
            if not cpf_cnpj:
                raise HTTPException(
                    status_code=400, 
                    detail="CPF/CNPJ é obrigatório para o primeiro pagamento (Asaas)."
                )
            
            new_cust = await create_customer(
                name=user_name, email=user_email,
                cpf_cnpj=cpf_cnpj, phone=phone,
            )
            customer_id = new_cust["id"]

        # Usa preferred_due_day do usuário para calcular vencimento
        user_row = get_client().table("users").select("preferred_due_day").eq(
            "username", current_user["username"]
        ).single().execute().data
        preferred_day = (user_row or {}).get("preferred_due_day") or 5
        due_date      = calc_due_date(date.today(), preferred_day).isoformat()

        payment = await create_payment(
            customer_id=customer_id,
            billing_type=body.billingType,
            value=body.value,
            due_date=due_date,
            description=body.description,
            external_reference=f"{current_user['username']}|{body.planType}",
        )

        # Salva como 'pending' até o webhook confirmar
        get_client().table("subscriptions").insert({
            "username":          current_user["username"],
            "plan_type":         body.planType,
            "status":            "pending",
            "payment_id":        payment["id"],
            "preferred_due_day": preferred_day,
            "expires_at":        due_date,
        }).execute()

        response_data = {
            "paymentId":  payment["id"],
            "invoiceUrl": payment["invoiceUrl"],
            "bankSlipUrl": payment.get("bankSlipUrl"),
            "dueDate":    payment["dueDate"],
        }

        if body.billingType == "PIX":
            pix_data = await get_pix_qr_code(payment["id"])
            response_data["pixQrCode"]    = pix_data.get("encodedImage")
            response_data["pixCopyPaste"] = pix_data.get("payload")

        return response_data

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/webhook")
async def asaas_webhook(request: Request):
    """
    Webhook do Asaas — confirma pagamento e ativa/cancela assinatura.
    Configure no painel Asaas: https://www.asaas.com/config/webhooks
    """
    # Valida token secreto do webhook (configure ASAAS_WEBHOOK_TOKEN no .env)
    '''token = request.headers.get("asaas-access-token", "")
    if settings.asaas_webhook_token and token != settings.asaas_webhook_token:
        raise HTTPException(status_code=401, detail="Token inválido")'''

    try:
        body    = await request.json()
        event   = body.get("event", "")
        payment = body.get("payment", {})

        payment_id = payment.get("id", "")
        # external_reference formato: "username|planType"
        ext_ref    = payment.get("externalReference", "")
        parts      = ext_ref.split("|") if "|" in ext_ref else [ext_ref, "basic"]
        username   = parts[0]
        plan_type  = parts[1] if len(parts) > 1 else "basic"

        print(f"[Webhook] event={event} username={username} plan={plan_type} payment={payment_id}")

        if event in ("PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"):
            _upsert_subscription(username, plan_type, payment_id)
            print(f"[Webhook] ✅ Assinatura ativada: {username} ({plan_type})")

        elif event in ("PAYMENT_OVERDUE",):
            # Apenas registra — ainda na grace period, não cancela
            get_client().table("subscriptions").update(
                {"status": "grace"}
            ).eq("payment_id", payment_id).execute()
            print(f"[Webhook] ⚠️ Pagamento vencido: {username}")

        elif event in ("PAYMENT_DELETED", "PAYMENT_REFUNDED", "CHARGEBACK_REQUESTED"):
            _expire_subscription(payment_id)
            print(f"[Webhook] ❌ Assinatura cancelada: {username}")

        return {"ok": True}

    except Exception as exc:
        print(f"[Webhook] ERRO: {exc}")
        # Retorna 200 mesmo em erro para o Asaas não retentar infinitamente
        return {"ok": False, "error": str(exc)}


@router.get("/status")
async def get_payment_status(current_user: dict = Depends(get_current_user)):
    """Retorna status da assinatura atual do usuário logado."""
    db  = get_client()
    sub = (
        db.table("subscriptions")
        .select("plan_type, status, expires_at, payment_id, preferred_due_day")
        .eq("username", current_user["username"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not sub:
        return {"has_subscription": False}

    s          = sub[0]
    expires    = date.fromisoformat(s["expires_at"][:10])
    today      = date.today()
    days_left  = (expires - today).days

    return {
        "has_subscription":  True,
        "plan_type":         s["plan_type"],
        "status":            s["status"],
        "expires_at":        s["expires_at"][:10],
        "days_left":         max(0, days_left),
        "payment_id":        s["payment_id"],
        "preferred_due_day": s.get("preferred_due_day", 5),
    }