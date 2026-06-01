from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID

VALID_CATEGORIES = (
    'grammar', 'speaking', 'travel', 'business', 'vocabulary', 'writing', 'other',
)


class PremiumContentPublic(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    price: float
    price_students: Optional[float] = None   # preço para alunos da Tati AI
    price_buyers: Optional[float] = None     # preço para clientes do Hub
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None
    category: Optional[str] = 'other'
    is_featured: Optional[bool] = False
    processing_status: Optional[str] = None
    type: Optional[str] = None

    class Config:
        from_attributes = True


class HubOrderItemPublic(BaseModel):
    content_id: str
    title: str
    price: float


class HubOrderPublic(BaseModel):
    id: str
    status: str
    total_amount: float
    payment_method: Optional[str] = None
    created_at: Optional[str] = None
    items: List[HubOrderItemPublic] = []


class SecureAccessResponse(BaseModel):
    type: str = 'secure_images'
    pages: List[str]
    total_pages: int
    is_secure_viewer: bool = True
    title: Optional[str] = None
