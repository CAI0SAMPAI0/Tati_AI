import logging
import uuid
from pathlib import Path
from typing import Optional
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from .models import UserOnboarding
from .schemas import (
    StreakDataOut,
    StreakRecordOut,
    PurchaseFreezeOut,
    GoalInput,
    GoalOut,
    XPOut,
    OnboardingStatusOut,
    AccessControlOut,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _get_local_today(tz_name: str = "America/Sao_Paulo") -> date:
    try:
        return datetime.now(ZoneInfo(tz_name)).date()
    except Exception:
        return datetime.now(timezone.utc).date()


class StreakService:
    @staticmethod
    def get_streak_data(
        user: User, tz_name: str = "America/Sao_Paulo"
    ) -> StreakDataOut:
        streak_data = user.streak_data if isinstance(user.streak_data, dict) else {}
        today = _get_local_today(tz_name or user.timezone)

        last_date_str = streak_data.get("last_study_date")
        has_studied = last_date_str == today.isoformat()

        study_dates = streak_data.get("study_dates") or []

        return StreakDataOut(
            current_streak=streak_data.get("current_streak", 0) or 0,
            longest_streak=streak_data.get("longest_streak", 0) or 0,
            freeze_count=streak_data.get("freeze_count", 0) or 0,
            last_activity_date=last_date_str,
            study_dates=study_dates[-30:] if isinstance(study_dates, list) else [],
            has_studied_today=has_studied,
        )

    @classmethod
    def record_activity(
        cls, user: User, tz_name: str = "America/Sao_Paulo"
    ) -> StreakRecordOut:
        streak_data = user.streak_data if isinstance(user.streak_data, dict) else {}
        today = _get_local_today(tz_name or user.timezone)
        today_str = today.isoformat()

        study_dates = list(streak_data.get("study_dates") or [])
        if today_str not in study_dates:
            study_dates.append(today_str)
            streak_data["study_dates"] = study_dates

        last_date_str = streak_data.get("last_study_date")
        current_streak = streak_data.get("current_streak", 0) or 0
        longest_streak = streak_data.get("longest_streak", 0) or 0
        freeze_count = streak_data.get("freeze_count", 0) or 0

        # Se já estudou hoje, mantém streak mas atualiza o horário exato da última atividade
        if last_date_str == today_str:
            now_iso = datetime.now(timezone.utc).isoformat()
            streak_data["last_study_at"] = now_iso
            user.streak_data = streak_data
            user.save(update_fields=["streak_data"])
            return StreakRecordOut(
                success=True,
                current_streak=current_streak,
                streak_extended=False,
                message="Atividade registrada! Você já manteve o streak de hoje.",
            )

        yesterday_str = (today - timedelta(days=1)).isoformat()

        if last_date_str == yesterday_str:
            current_streak += 1
        elif not last_date_str:
            current_streak = 1
        else:
            try:
                last_d = date.fromisoformat(last_date_str[:10])
                diff = (today - last_d).days
                if diff == 2 and freeze_count > 0:
                    freeze_count -= 1
                    current_streak += 1
                    streak_data["freeze_count"] = freeze_count
                    logger.info(f"[Streak] Freeze utilizado para {user.username}")
                else:
                    current_streak = 1
            except Exception:
                current_streak = 1

        if current_streak > longest_streak:
            longest_streak = current_streak

        streak_data["current_streak"] = current_streak
        streak_data["longest_streak"] = longest_streak
        streak_data["last_study_date"] = today_str
        streak_data["last_study_at"] = datetime.now(timezone.utc).isoformat()

        user.streak_data = streak_data
        user.save(update_fields=["streak_data"])

        return StreakRecordOut(
            success=True,
            current_streak=current_streak,
            streak_extended=True,
            message=f"🔥 Incrível! Você alcançou {current_streak} dias seguidos de estudo com a Teacher Tati!",
        )

    @classmethod
    def purchase_freeze(cls, user: User) -> PurchaseFreezeOut:
        streak_data = user.streak_data if isinstance(user.streak_data, dict) else {}
        freeze_count = streak_data.get("freeze_count", 0) or 0

        if freeze_count >= 3:
            raise HttpError(
                400, "Você já atingiu o limite máximo de 3 proteções de Streak Freeze."
            )

        if user.total_xp < 150:
            raise HttpError(
                400, "XP insuficiente para comprar Streak Freeze. Custo: 150 XP."
            )

        # Deduz XP
        xp_data = user.xp_data if isinstance(user.xp_data, dict) else {}
        current_xp = xp_data.get("xp", 0) or 0
        current_xp -= 150
        xp_data["xp"] = current_xp
        user.xp_data = xp_data

        streak_data["freeze_count"] = freeze_count + 1
        user.streak_data = streak_data
        user.save(update_fields=["xp_data", "streak_data"])

        return PurchaseFreezeOut(
            success=True,
            freeze_count=streak_data["freeze_count"],
            user_xp=current_xp,
        )


class XPService:
    @staticmethod
    def get_xp(user: User) -> XPOut:
        xp_data = user.xp_data if isinstance(user.xp_data, dict) else {}
        total = xp_data.get("xp", 0) or 0

        levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
        current_idx = levels.index(user.level) if user.level in levels else 0
        next_threshold = (current_idx + 1) * 1000
        current_base = current_idx * 1000

        progress = (
            max(0.0, min(100.0, ((total - current_base) / 1000.0) * 100))
            if total >= current_base
            else 0.0
        )

        return XPOut(
            total_xp=total,
            level=user.level or "A1",
            next_level_xp=next_threshold,
            progress_percentage=round(progress, 1),
        )

    @classmethod
    def award_xp(
        cls, user: User, amount: int, reason: str = "Atividade concluída"
    ) -> XPOut:
        xp_data = user.xp_data if isinstance(user.xp_data, dict) else {}
        current = xp_data.get("xp", 0) or 0
        current += amount
        xp_data["xp"] = current
        xp_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        user.xp_data = xp_data
        user.save(update_fields=["xp_data"])

        return cls.get_xp(user)


class GoalService:
    @staticmethod
    def list_goals(user: User) -> list[GoalOut]:
        goals_data = user.study_goals if isinstance(user.study_goals, list) else []
        results = []
        for g in goals_data:
            if isinstance(g, dict):
                results.append(
                    GoalOut(
                        id=uuid.UUID(g.get("id", str(uuid.uuid4()))),
                        type=g.get("type", "study_time"),
                        target=g.get("target", 15),
                        progress=g.get("progress", 0),
                        period=g.get("period", "daily"),
                        is_completed=g.get("is_completed", False),
                    )
                )
        return results

    @staticmethod
    def create_goal(user: User, data: GoalInput) -> GoalOut:
        goals_data = (
            list(user.study_goals or []) if isinstance(user.study_goals, list) else []
        )
        new_id = str(uuid.uuid4())
        goal_item = {
            "id": new_id,
            "type": data.type,
            "target": data.target,
            "progress": 0,
            "period": data.period,
            "is_completed": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        goals_data.append(goal_item)
        user.study_goals = goals_data
        user.save(update_fields=["study_goals"])

        return GoalOut(
            id=uuid.UUID(new_id),
            type=data.type,
            target=data.target,
            progress=0,
            period=data.period,
            is_completed=False,
        )

    @staticmethod
    def update_goal_progress(user: User, goal_id: str) -> GoalOut:
        goals_data = (
            list(user.study_goals or []) if isinstance(user.study_goals, list) else []
        )
        target_item = None
        for g in goals_data:
            if isinstance(g, dict) and g.get("id") == goal_id:
                g["progress"] = (g.get("progress", 0) or 0) + 1
                if g["progress"] >= (g.get("target", 15) or 15):
                    g["is_completed"] = True
                target_item = g
                break

        if not target_item:
            raise HttpError(404, "Meta não encontrada.")

        user.study_goals = goals_data
        user.save(update_fields=["study_goals"])

        return GoalOut(
            id=uuid.UUID(target_item["id"]),
            type=target_item.get("type", "study_time"),
            target=target_item.get("target", 15),
            progress=target_item.get("progress", 0),
            period=target_item.get("period", "daily"),
            is_completed=target_item.get("is_completed", False),
        )

    @staticmethod
    def delete_goal(user: User, goal_id: str) -> dict:
        goals_data = (
            list(user.study_goals or []) if isinstance(user.study_goals, list) else []
        )
        filtered = [
            g for g in goals_data if isinstance(g, dict) and g.get("id") != goal_id
        ]
        user.study_goals = filtered
        user.save(update_fields=["study_goals"])
        return {"ok": True, "message": "Meta removida com sucesso."}


class OnboardingService:
    @staticmethod
    def get_status(user: User) -> OnboardingStatusOut:
        onb = UserOnboarding.objects.filter(username=user.username).first()
        has_seen = onb.has_seen_onboarding if onb else False
        return OnboardingStatusOut(has_seen_onboarding=bool(has_seen))

    @staticmethod
    def mark_done(user: User, has_seen: bool = True, initial_level: str = "A1") -> dict:
        onb, _ = UserOnboarding.objects.get_or_create(username=user.username)
        onb.has_seen_onboarding = has_seen
        onb.save()

        if initial_level and initial_level.upper() in [
            "A1",
            "A2",
            "B1",
            "B2",
            "C1",
            "C2",
        ]:
            user.level = initial_level.upper()
            user.save(update_fields=["level"])

        return {"ok": True, "has_seen_onboarding": has_seen}


class AccessControlService:
    @staticmethod
    def get_access(user: User) -> AccessControlOut:
        can_dash = user.is_teacher or user.is_programmer
        is_special = user.is_special_access or can_dash
        return AccessControlOut(
            full_access=True,
            full=True,
            can_access_activities=True,
            activities=True,
            free_mode=True,
            can_access_dashboard=can_dash,
            is_special_access=is_special,
            is_exempt=is_special,
            free_messages_remaining=999,
            plan_type="full",
            role=user.role or "student",
            status="active",
        )


class ProgressReportService:
    @staticmethod
    def get_weekly_report(user: User) -> dict:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)

        from apps.chat.models import Message

        msgs = list(
            Message.objects.filter(
                username=user.username, role="user", created_at__gte=week_ago
            )
        )

        days = [(now - timedelta(days=i)).strftime("%a") for i in range(6, -1, -1)]
        msg_counts = [0] * 7
        session_ids = set()
        study_days = set()

        for m in msgs:
            if m.created_at:
                delta = (m.created_at.date() - week_ago.date()).days - 1
                if 0 <= delta < 7:
                    msg_counts[delta] += 1
                study_days.add(m.created_at.date())
            if m.session_id:
                session_ids.add(m.session_id)

        streak = user.streak_count

        return {
            "period": "weekly",
            "username": user.username,
            "total_conversations": len(session_ids),
            "total_messages": len(msgs),
            "study_days": len(study_days) or (1 if streak > 0 else 0),
            "study_time_minutes": len(msgs) * 3,
            "exercises_completed": len(msgs) // 2,
            "words_learned": len(msgs) * 2,
            "accuracy_rate": 92.5,
            "unique_words_used": len(msgs) * 4,
            "current_streak": streak,
            "streak_count": streak,
            "total_xp": user.total_xp,
            "level": user.level or "A1",
            "messages_by_day": msg_counts,
            "days_of_week": days,
        }

    @staticmethod
    def get_monthly_report(user: Optional[User] = None) -> dict:
        username = user.username if user and isinstance(user, User) else "aluno"
        total_xp = user.total_xp if user and isinstance(user, User) else 0
        level = (user.level if user and isinstance(user, User) else "A1") or "A1"
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        from apps.chat.models import Message

        msgs = list(
            Message.objects.filter(
                username=username, role="user", created_at__gte=month_start
            )
        )

        return {
            "period": "monthly",
            "username": username,
            "total_xp": total_xp,
            "level": level,
            "total_messages": len(msgs),
            "study_time_hours": round((len(msgs) * 3) / 60, 1),
            "total_exercises": len(msgs) // 2,
            "fluency_score": 85,
        }

    @staticmethod
    def get_fluency_evolution(user: Optional[User] = None) -> dict:
        current_level = (
            user.level if user and isinstance(user, User) else "A1"
        ) or "A1"
        username = user.username if user and isinstance(user, User) else "aluno"

        from apps.activities.models import ActivitySubmission

        subs = list(
            ActivitySubmission.objects.filter(username=username).order_by("created_at")
        )

        pronunciation_history = []
        cefr_history = []

        for s in subs:
            meta = s.metadata if isinstance(s.metadata, dict) else {}
            date_str = (
                s.created_at.strftime("%Y-%m-%d")
                if s.created_at
                else datetime.now().strftime("%Y-%m-%d")
            )

            if s.activity_type in ["speech", "pronunciation", "drill"]:
                pronunciation_history.append(
                    {
                        "date": date_str,
                        "score": s.score,
                    }
                )
            else:
                cefr_history.append(
                    {
                        "date": date_str,
                        "level": meta.get("level") or current_level,
                        "score": s.score,
                        "type": s.activity_type,
                    }
                )

        if not pronunciation_history:
            start_date = datetime.now() - timedelta(days=10)
            for i in range(5):
                day = start_date + timedelta(days=i * 2)
                baseline_score = min(98, 65 + i * 5 + (i % 2) * 3)
                pronunciation_history.append(
                    {
                        "date": day.strftime("%Y-%m-%d"),
                        "score": baseline_score,
                    }
                )

        if not cefr_history:
            start_date = datetime.now() - timedelta(days=10)
            for i in range(5):
                day = start_date + timedelta(days=i * 2)
                cefr_history.append(
                    {
                        "date": day.strftime("%Y-%m-%d"),
                        "level": current_level,
                        "score": 75 + (i * 4) % 20,
                        "type": "exercise",
                    }
                )

        return {
            "pronunciation": pronunciation_history,
            "cefr": cefr_history,
            "current_level": current_level,
        }


class WeeklyPlanService:
    @staticmethod
    def get_weekly_plan(user: Optional[User] = None) -> dict:
        if (
            user
            and isinstance(user, User)
            and isinstance(user.weekly_plan, dict)
            and user.weekly_plan
        ):
            return user.weekly_plan
        level = (user.level if user and isinstance(user, User) else "A1") or "A1"
        return {
            "plan_id": "default-plan",
            "level": level,
            "days": [
                {
                    "day": 1,
                    "title": "Speaking & Daily Routine",
                    "status": "completed",
                    "xp": 20,
                },
                {
                    "day": 2,
                    "title": "Vocabulary Flashcards: Shopping & Clothes",
                    "status": "available",
                    "xp": 15,
                },
                {
                    "day": 3,
                    "title": "Grammar: Present Simple vs Continuous",
                    "status": "locked",
                    "xp": 25,
                },
                {
                    "day": 4,
                    "title": "Listening Podcast: British Accent Training",
                    "status": "locked",
                    "xp": 20,
                },
                {
                    "day": 5,
                    "title": "Pronunciation Drill with Teacher Tati",
                    "status": "locked",
                    "xp": 30,
                },
                {
                    "day": 6,
                    "title": "Interactive Wordwall Quiz",
                    "status": "locked",
                    "xp": 25,
                },
                {
                    "day": 7,
                    "title": "Weekly Evolution Review",
                    "status": "locked",
                    "xp": 40,
                },
            ],
        }


class AvatarService:
    _FRAME_FILES = {
        "normal": "avatar_tati_normal.webp",
        "meio": "avatar_tati_meio.webp",
        "aberta": "avatar_tati_aberta.webp",
        "bem_aberta": "avatar_tati_bem_aberta.webp",
        "ouvindo": "avatar_tati_ouvindo.webp",
        "piscando": "tati_piscando.webp",
        "frame_A": "frame_A.webp",
        "frame_B": "frame_B.webp",
        "frame_C": "frame_C.webp",
        "frame_D": "frame_D.webp",
        "frame_E": "frame_E.webp",
        "frame_F": "frame_F.webp",
    }

    _cached_frames = None

    @classmethod
    def _load_frame_b64(cls, filename: str) -> Optional[str]:
        import base64
        from django.conf import settings

        avatar_dir = Path(settings.BASE_DIR) / "assets" / "avatar"
        path = avatar_dir / filename
        if not path.exists():
            fallback_png = avatar_dir / filename.replace(".webp", ".png")
            if fallback_png.exists():
                path = fallback_png
            else:
                return None

        ext = path.suffix.lower()
        mime = "webp" if ext == ".webp" else ("png" if ext == ".png" else "jpeg")
        b64 = base64.b64encode(path.read_bytes()).decode()
        return f"data:image/{mime};base64,{b64}"

    @classmethod
    def get_frames(cls) -> dict:
        if cls._cached_frames:
            return cls._cached_frames

        frames = {
            key: (cls._load_frame_b64(fname) or "")
            for key, fname in cls._FRAME_FILES.items()
        }
        frames["has_frames"] = bool(frames.get("normal"))
        cls._cached_frames = frames
        return frames
