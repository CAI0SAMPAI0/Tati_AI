from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import uuid


class DashboardMetricsOut(BaseModel):
    total_students: int
    active_students_this_week: int
    average_streak_days: float
    total_messages_exchanged: int
    total_exercises_completed: int
    top_performer: Optional[str] = None


class StudentSummaryOut(BaseModel):
    username: str
    name: str
    email: Optional[str] = ""
    role: str
    level: str
    total_xp: int
    streak_count: int
    is_exempt: bool = False
    is_premium_active: bool = False
    last_study_date: Optional[str] = None
    created_at: Optional[str] = None


class StudentDetailOut(StudentSummaryOut):
    profile: Optional[Dict[str, Any]] = {}
    streak_data: Optional[Dict[str, Any]] = {}
    xp_data: Optional[Dict[str, Any]] = {}
    study_goals: Optional[List[Any]] = []


class StudentUpdateInput(BaseModel):
    level: Optional[str] = None
    role: Optional[str] = None
    is_exempt: Optional[bool] = None
    is_premium_active: Optional[bool] = None
    name: Optional[str] = None


class SubmissionReportOut(BaseModel):
    id: uuid.UUID
    username: str
    activity_type: str
    score: int
    created_at: Optional[str] = None


class FinancialSummaryOut(BaseModel):
    total_revenue: float
    active_subscriptions: int
    orders_count: int
    currency: str = "BRL"
