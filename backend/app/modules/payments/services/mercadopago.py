import uuid

import httpx
from app.core.config import settings


class MercadoPago:
    def __init__(self):
        self.access_token = settings.mp_access_token
        self.base_url = settings.mp_base_api_url
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}",
        }

    async def _post(self, path: str, payload: dict) -> dict:
        url = f'{self.base_url.rstrip("/")}{path}'
        headers = {**self.headers, "X-Idempotency-Key": str(uuid.uuid4())}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url, json=payload, headers=headers, timeout=20
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                try:
                    error = exc.response.json()
                except ValueError:
                    error = exc.response.text
                print(
                    f"[MercadoPago] Erro API status={exc.response.status_code}: {error}"
                )
                raise RuntimeError(
                    f"Erro Mercado Pago {exc.response.status_code}: {error}"
                )
            except Exception as exc:
                print(f"[MercadoPago] Erro de rede/desconhecido: {exc}")
                raise RuntimeError(f"Erro ao conectar com Mercado Pago: {exc}")

    async def _get(self, path: str) -> dict:
        url = f'{self.base_url.rstrip("/")}{path}'
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, timeout=20)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                try:
                    error = exc.response.json()
                except ValueError:
                    error = exc.response.text
                print(
                    f"[MercadoPago] Erro API GET status={exc.response.status_code}: {error}"
                )
                raise RuntimeError(
                    f"Erro Mercado Pago {exc.response.status_code}: {error}"
                )

    async def pay_with_pix(
        self, amount: float, description: str, payer: dict, external_reference: str
    ) -> dict:
        payload = {
            "transaction_amount": amount,
            "description": description,
            "payment_method_id": "pix",
            "payer": payer,
            "external_reference": external_reference,
        }
        return await self._post("/v1/payments", payload)

    async def create_preference_for_debit_card(
        self,
        amount: float,
        description: str,
        payer_name: str,
        payer_email: str,
        payer_cpf: str,
        external_reference: str,
        success_url: str,
    ) -> dict:
        if success_url.startswith("http://"):
            success_url = success_url.replace("http://", "https://", 1)

        is_sandbox = self.access_token.startswith("TEST-")
        excluded_types = [{"id": "ticket"}, {"id": "bank_transfer"}]
        if not is_sandbox:
            excluded_types.append({"id": "credit_card"})

        payload = {
            "items": [
                {
                    "title": description,
                    "quantity": 1,
                    "unit_price": amount,
                    "currency_id": "BRL",
                }
            ],
            "payment_methods": {
                "excluded_payment_types": excluded_types,
                "installments": 1,
            },
            "back_urls": {
                "success": success_url,
                "failure": success_url,
                "pending": success_url,
            },
            "auto_return": "approved",
            "external_reference": external_reference,
        }

        if not is_sandbox:
            payload["payer"] = {
                "name": payer_name,
                "email": payer_email,
                "identification": {"type": "CPF", "number": payer_cpf},
            }

        return await self._post("/checkout/preferences", payload)

    async def _put(self, path: str, payload: dict) -> dict:
        url = f'{self.base_url.rstrip("/")}{path}'
        async with httpx.AsyncClient() as client:
            try:
                response = await client.put(
                    url, json=payload, headers=self.headers, timeout=20
                )
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                try:
                    error = exc.response.json()
                except ValueError:
                    error = exc.response.text
                print(
                    f"[MercadoPago] Erro API PUT status={exc.response.status_code}: {error}"
                )
                raise RuntimeError(
                    f"Erro Mercado Pago {exc.response.status_code}: {error}"
                )

    async def get_payment(self, payment_id: str) -> dict:
        return await self._get(f"/v1/payments/{payment_id}")

    async def get_preference(self, preference_id: str) -> dict:
        return await self._get(f"/checkout/preferences/{preference_id}")
