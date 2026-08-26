from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
import uuid


class StreakDataOut(BaseModel):
    current_streak: int = 0
    longest_streak: int = 0
    freeze_count: int = 0
    last_activity_date: Optional[str] = None
    study_dates: List[str] = []
    has_studied_today: bool = False


class StreakRecordOut(BaseModel):
    success: bool = True
    current_streak: int
    streak_extended: bool = True
    message: str = "Streak atualizado com sucesso!"


class PurchaseFreezeOut(BaseModel):
    success: bool = True
    freeze_count: int
    user_xp: int


class GoalInput(BaseModel):
    type: str = "study_time"
    target: int = Field(..., gt=0)
    period: str = "daily"


class GoalOut(BaseModel):
    id: uuid.UUID
    type: str
    target: int
    progress: int = 0
    period: str
    is_completed: bool = False


class XPAwardInput(BaseModel):
    amount: int
    reason: str = "Atividade concluída"


class XPOut(BaseModel):
    total_xp: int
    level: str
    next_level_xp: int = 1000
    progress_percentage: float = 0.0


class OnboardingStatusOut(BaseModel):
    has_seen_onboarding: bool


class OnboardingDoneInput(BaseModel):
    has_seen_onboarding: bool = True
    initial_level: Optional[str] = "A1"


class DailySummaryOut(BaseModel):
    words_today: int = 0
    messages_week: int = 0
    streak_days: int = 0
    minutes_today: int = 0


class AccessControlOut(BaseModel):
    full_access: bool = True
    full: bool = True
    can_access_activities: bool = True
    activities: bool = True
    free_mode: bool = True
    can_access_dashboard: bool = False
    is_special_access: bool = False
    is_exempt: bool = False
    free_messages_remaining: Optional[int] = 999
    plan_type: Optional[str] = "full"
    role: str = "student"
    status: str = "active"
