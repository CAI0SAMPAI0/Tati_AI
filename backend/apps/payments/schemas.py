from typing import Optional
from pydantic import BaseModel, Field


class CreatePixInput(BaseModel):
    amount: float = Field(..., gt=0)
    description: str = "Assinatura Teacher Tati AI"
    target_type: str = "subscription"  # subscription, hub_material
    target_id: Optional[str] = None


class PixPaymentOut(BaseModel):
    payment_id: str
    qr_code: str
    qr_code_base64: Optional[str] = None
    ticket_url: Optional[str] = None
    amount: float
    status: str = "pending"


class CreatePreferenceInput(BaseModel):
    title: str
    amount: float
    quantity: int = 1
    target_type: str = "subscription"
    target_id: Optional[str] = None


class PreferenceOut(BaseModel):
    preference_id: str
    init_point: str
    sandbox_init_point: Optional[str] = None


class PaymentStatusOut(BaseModel):
    payment_id: str
    status: str
    is_approved: bool
    paid_amount: Optional[float] = None
    external_reference: Optional[str] = None
