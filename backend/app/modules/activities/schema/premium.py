from uuid import UUID

from pydantic import BaseModel

VALID_CATEGORIES = (
    "grammar",
    "speaking",
    "travel",
    "business",
    "vocabulary",
    "writing",
    "other",
)


class PremiumContentPublic(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    price: float
    # preço para alunos da Tati AI
    price_students: float | None = None
    # preço para clientes do Hub
    price_buyers: float | None = None
    thumbnail_url: str | None = None
    preview_url: str | None = None
    category: str | None = "other"
    is_featured: bool | None = False
    processing_status: str | None = None
    type: str | None = None

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
    payment_method: str | None = None
    created_at: str | None = None
    items: list[HubOrderItemPublic] = []


class SecureAccessResponse(BaseModel):
    type: str = "secure_images"
    pages: list[str]
    total_pages: int
    is_secure_viewer: bool = True
    title: str | None = None
