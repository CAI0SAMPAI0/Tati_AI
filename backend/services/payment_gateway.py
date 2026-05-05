"""
services/payment_gateway.py
Abstract Factory para gateways de pagamento.

Referência: https://refactoring.guru/pt-br/design-patterns/abstract-factory

Hoje suporta apenas Asaas; a interface permite adicionar novos gateways
(Stripe, PagSeguro, etc.) sem alterar os routers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class PaymentGateway(ABC):
    """Interface abstrata para gateways de pagamento."""

    @abstractmethod
    async def create_customer(
        self,
        name: str,
        email: str,
        cpf_cnpj: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> dict:
        """Cria um cliente no gateway."""

    @abstractmethod
    async def update_customer(
        self,
        customer_id: str,
        payload: dict,
    ) -> dict:
        """Atualiza dados de um cliente."""

    @abstractmethod
    async def get_customer_by_email(self, email: str) -> Optional[dict]:
        """Busca cliente pelo e-mail."""

    @abstractmethod
    async def create_subscription(
        self,
        customer_id: str,
        billing_type: str,
        value: float,
        next_due_date: str,
        description: Optional[str] = None,
        external_reference: Optional[str] = None,
    ) -> dict:
        """Cria assinatura recorrente."""

    @abstractmethod
    async def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancela uma assinatura."""

    @abstractmethod
    async def update_subscription_due_day(
        self,
        subscription_id: str,
        next_due_date: str,
    ) -> dict:
        """Altera data de vencimento."""

    @abstractmethod
    async def get_subscription_payments(
        self,
        subscription_id: str,
    ) -> list:
        """Lista pagamentos de uma assinatura."""

    @abstractmethod
    async def get_pix_qr_code(self, payment_id: str) -> dict:
        """Obtém QR Code PIX de um pagamento."""


class AsaasGateway(PaymentGateway):
    """Implementação concreta do gateway Asaas."""

    async def create_customer(
        self,
        name: str,
        email: str,
        cpf_cnpj: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> dict:
        from services.asaas import create_customer

        return await create_customer(name, email, cpf_cnpj, phone)

    async def update_customer(
        self,
        customer_id: str,
        payload: dict,
    ) -> dict:
        from services.asaas import update_customer

        return await update_customer(customer_id, payload)

    async def get_customer_by_email(self, email: str) -> Optional[dict]:
        from services.asaas import get_customer_by_email

        return await get_customer_by_email(email)

    async def create_subscription(
        self,
        customer_id: str,
        billing_type: str,
        value: float,
        next_due_date: str,
        description: Optional[str] = None,
        external_reference: Optional[str] = None,
    ) -> dict:
        from services.asaas import create_subscription

        return await create_subscription(
            customer_id,
            billing_type,
            value,
            next_due_date,
            description,
            external_reference,
        )

    async def cancel_subscription(self, subscription_id: str) -> bool:
        from services.asaas import cancel_subscription

        return await cancel_subscription(subscription_id)

    async def update_subscription_due_day(
        self,
        subscription_id: str,
        next_due_date: str,
    ) -> dict:
        from services.asaas import update_subscription_due_day

        return await update_subscription_due_day(subscription_id, next_due_date)

    async def get_subscription_payments(
        self,
        subscription_id: str,
    ) -> list:
        from services.asaas import get_subscription_payments

        return await get_subscription_payments(subscription_id)

    async def get_pix_qr_code(self, payment_id: str) -> dict:
        from services.asaas import get_pix_qr_code

        return await get_pix_qr_code(payment_id)


class PaymentGatewayFactory:
    """Factory que instancia o gateway de pagamento configurado.

    Referência: https://refactoring.guru/pt-br/design-patterns/abstract-factory

    Uso:
        gateway = PaymentGatewayFactory.create("asaas")
        customer = await gateway.create_customer(...)
    """

    _registry: dict[str, type[PaymentGateway]] = {
        'asaas': AsaasGateway,
    }

    @classmethod
    def create(cls, provider: str = 'asaas') -> PaymentGateway:
        """Cria instância do gateway pelo nome do provider."""
        gateway_cls = cls._registry.get(provider.lower())
        if gateway_cls is None:
            raise ValueError(
                f"Gateway '{provider}' não suportado. "
                f'Opções: {", ".join(cls._registry.keys())}'
            )
        return gateway_cls()

    @classmethod
    def register(cls, name: str, gateway_cls: type[PaymentGateway]) -> None:
        """Registra um novo gateway (extensibilidade)."""
        cls._registry[name.lower()] = gateway_cls
