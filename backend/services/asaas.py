import httpx
from core.config import settings

# ── Configurações ─────────────────────────────────────────────────────────────

ASAAS_BASE_URL_PROD = "https://www.asaas.com/api/v3"
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
        "Content-Type": "application/json"
    }

# ── Clientes ─────────────────────────────────────────────────────────────────

async def create_customer(name: str, email: str, cpf_cnpj: str = None, phone: str = None) -> dict:
    """
    Cria um novo cliente no Asaas.
    Se já existir um cliente com o mesmo email/cpf, o Asaas pode retornar erro ou o ID existente
    dependendo da configuração da conta, mas aqui faremos a criação direta.
    """
    url = f"{get_base_url()}/customers"
    payload = {
        "name": name,
        "email": email,
        "cpfCnpj": cpf_cnpj,
        "mobilePhone": phone,
    }
    
    # Remove valores nulos
    payload = {k: v for k, v in payload.items() if v is not None}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao criar cliente: {exc.response.text}")
            raise Exception(f"Erro Asaas: {exc.response.text}")
        except Exception as exc:
            print(f"[Asaas] Erro inesperado ao criar cliente: {exc}")
            raise

async def get_customer_by_email(email: str) -> dict | None:
    """Busca um cliente pelo email."""
    url = f"{get_base_url()}/customers"
    params = {"email": email}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            data = resp.json()
            if data.get("data"):
                return data["data"][0]
            return None
        except Exception as exc:
            print(f"[Asaas] Erro ao buscar cliente: {exc}")
            return None

# ── Pagamentos ──────────────────────────────────────────────────────────────

async def create_payment(
    customer_id: str, 
    billing_type: str, 
    value: float, 
    due_date: str, 
    description: str = None,
    external_reference: str = None
) -> dict:
    """
    Cria uma cobrança no Asaas.
    billing_type: 'PIX', 'BOLETO', 'CREDIT_CARD', 'UNDEFINED'
    """
    url = f"{get_base_url()}/payments"
    payload = {
        "customer": customer_id,
        "billingType": billing_type,
        "value": value,
        "dueDate": due_date,
        "description": description,
        "externalReference": external_reference,
    }
    
    # Remove valores nulos
    payload = {k: v for k, v in payload.items() if v is not None}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            print(f"[Asaas] Erro ao criar pagamento: {exc.response.text}")
            raise Exception(f"Erro Asaas: {exc.response.text}")
        except Exception as exc:
            print(f"[Asaas] Erro inesperado ao criar pagamento: {exc}")
            raise

async def get_pix_qr_code(payment_id: str) -> dict:
    """Obtém o QR Code e a chave copia e cola de um pagamento Pix."""
    url = f"{get_base_url()}/payments/{payment_id}/pixQrCode"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=get_headers(), timeout=20)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            print(f"[Asaas] Erro ao obter QR Code Pix: {exc}")
            raise
