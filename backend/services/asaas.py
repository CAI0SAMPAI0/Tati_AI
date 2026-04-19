import httpx
from core.config import settings

# ── Configurações ─────────────────────────────────────────────────────────────

ASAAS_BASE_URL_PROD    = "https://www.asaas.com/api/v3"
ASAAS_BASE_URL_SANDBOX = "https://sandbox.asaas.com/api/v3"

def get_base_url():
    if settings.asaas_environment == "production":
        return ASAAS_BASE_URL_PROD
    return ASAAS_BASE_URL_SANDBOX

def get_headers():
    if not settings.api_asaas:
        raise Exception("API_ASAAS não configurada no .env")
    return {
        "access_token": settings.api_asaas,
        "Content-Type": "application/json",
    }


# ── Clientes ──────────────────────────────────────────────────────────────────

async def create_customer(name: str, email: str, cpf_cnpj: str = None, phone: str = None) -> dict:
    url     = f"{get_base_url()}/customers"
    payload = {"name": name, "email": email, "cpfCnpj": cpf_cnpj, "mobilePhone": phone}
    payload = {k: v for k, v in payload.items() if v is not None}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao criar cliente: {exc.response.text}")
            raise Exception(f"Erro Asaas: {exc.response.text}")

async def update_customer(customer_id: str, payload: dict) -> dict:
    url = f"{get_base_url()}/customers/{customer_id}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao atualizar cliente: {exc.response.text}")
            raise Exception(f"Erro Asaas ao atualizar: {exc.response.text}")

async def get_customer_by_email(email: str) -> dict | None:
    url = f"{get_base_url()}/customers"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params={"email": email}, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0] if data.get("data") else None
        except Exception as exc:
            print(f"[Asaas] Erro ao buscar cliente: {exc}")
            return None


# ── Assinaturas ───────────────────────────────────────────────────────────────

async def create_subscription(
    customer_id:        str,
    billing_type:       str,
    value:              float,
    next_due_date:      str,
    description:        str = None,
    external_reference: str = None,
) -> dict:
    url     = f"{get_base_url()}/subscriptions"
    payload = {
        "customer":          customer_id,
        "billingType":       billing_type,
        "value":             value,
        "cycle":             "MONTHLY",
        "nextDueDate":       next_due_date,
        "description":       description,
        "externalReference": external_reference,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao criar assinatura: {exc.response.text}")
            raise Exception(f"Erro Asaas: {exc.response.text}")

async def cancel_subscription(subscription_id: str) -> bool:
    url = f"{get_base_url()}/subscriptions/{subscription_id}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(url, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return True
        except Exception as exc:
            print(f"[Asaas] Erro ao cancelar assinatura: {exc}")
            return False

async def update_subscription_due_day(subscription_id: str, next_due_date: str) -> dict:
    url = f"{get_base_url()}/subscriptions/{subscription_id}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json={"nextDueDate": next_due_date}, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao atualizar vencimento: {exc.response.text}")
            raise Exception(f"Erro Asaas: {exc.response.text}")

async def get_subscription_payments(subscription_id: str) -> list:
    url = f"{get_base_url()}/payments"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params={"subscription": subscription_id}, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json().get("data", [])
        except Exception as exc:
            print(f"[Asaas] Erro ao buscar pagamentos da assinatura: {exc}")
            return []


# ── PIX ───────────────────────────────────────────────────────────────────────

async def get_pix_qr_code(payment_id: str) -> dict:
    url = f"{get_base_url()}/payments/{payment_id}/pixQrCode"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            print(f"[Asaas] Erro ao obter QR Code Pix: {exc}")
            raise