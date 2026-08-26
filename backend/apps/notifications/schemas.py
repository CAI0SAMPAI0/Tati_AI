from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class NotificationOut(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    body: str
    is_read: bool
    created_at: Optional[str] = None


class SubscribePushInput(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = ""


class SendEmailInput(BaseModel):
    to_email: str
    subject: str
    html_content: str
    recipient_name: Optional[str] = None


class SendWhatsAppInput(BaseModel):
    phone_number: str
    message: str
    media_url: Optional[str] = None
