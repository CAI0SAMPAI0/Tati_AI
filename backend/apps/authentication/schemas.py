from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterInput(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=6)
    level: str = "A1"
    is_hub_only: bool = False


class LoginInput(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str


class GoogleAuthInput(BaseModel):
    credential: str
    is_hub_only: bool = False


class RefreshTokenInput(BaseModel):
    refresh_token: str


class ForgotPasswordInput(BaseModel):
    identifier: str
    base_url: Optional[str] = ""
    is_app: bool = False


class ResetPasswordInput(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: str = ""
    username: str
    email: Optional[str] = ""
    name: str = ""
    nickname: Optional[str] = ""
    role: str = "student"
    level: str = "A1"
    avatar_url: Optional[str] = None
    native_language: str = "pt-BR"
    timezone: str = "America/Sao_Paulo"
    focus: Optional[str] = "General Conversation"
    occupation: Optional[str] = ""
    profile: Optional[dict] = None
    streak_count: int = 0
    total_xp: int = 0
    is_special_access: bool = False
    is_hub_only: bool = False
    preferred_accent: Optional[str] = "en-US"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: UserOut


class ProfileUpdateInput(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    email: Optional[str] = None
    level: Optional[str] = None
    avatar_url: Optional[str] = None
    native_language: Optional[str] = None
    timezone: Optional[str] = None
    occupation: Optional[str] = None
    focus: Optional[str] = None
    responsible_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    allow_whatsapp_notifications: Optional[bool] = None
    preferred_accent: Optional[str] = None
    accent: Optional[str] = None
    profile: Optional[dict] = None
