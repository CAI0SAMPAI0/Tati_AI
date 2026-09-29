import logging
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Optional
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from django.core.cache import cache
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

        f_count = streak_data.get("freeze_count", 0) or 0

        trophies_earned, total_trophies = 0, 50
        if user and isinstance(user, User):
            try:
                from apps.activities.services import TrophyService
                trophies_earned, total_trophies = TrophyService.get_unlocked_trophies_count(user)
            except Exception as e:
                logger.warning(f"Error computing trophies_earned in get_streak_data: {e}")

        return StreakDataOut(
            current_streak=streak_data.get("current_streak", 0) or 0,
            longest_streak=streak_data.get("longest_streak", 0) or 0,
            freeze_count=f_count,
            streak_freeze_count=f_count,
            last_activity_date=last_date_str,
            study_dates=study_dates[-30:] if isinstance(study_dates, list) else [],
            has_studied_today=has_studied,
            trophies_earned=trophies_earned,
            total_trophies=total_trophies,
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

        now = datetime.now(timezone.utc)
        current_month_key = f"{now.year}-{now.month:02d}"
        monthly_xp = xp_data.get("monthly_xp")
        if not isinstance(monthly_xp, dict):
            monthly_xp = {}
        monthly_xp[current_month_key] = int(monthly_xp.get(current_month_key, 0) or 0) + amount
        xp_data["monthly_xp"] = monthly_xp
        xp_data["updated_at"] = now.isoformat()

        user.xp_data = xp_data
        user.save(update_fields=["xp_data"])

        return cls.get_xp(user)

    @classmethod
    def deduct_xp(
        cls, user: User, amount: int, reason: str = "Atividade revertida para pendente"
    ) -> XPOut:
        xp_data = user.xp_data if isinstance(user.xp_data, dict) else {}
        current = xp_data.get("xp", 0) or 0
        current = max(0, current - amount)
        xp_data["xp"] = current

        now = datetime.now(timezone.utc)
        current_month_key = f"{now.year}-{now.month:02d}"
        monthly_xp = xp_data.get("monthly_xp")
        if isinstance(monthly_xp, dict):
            monthly_xp[current_month_key] = max(
                0, int(monthly_xp.get(current_month_key, 0) or 0) - amount
            )
            xp_data["monthly_xp"] = monthly_xp
        xp_data["updated_at"] = now.isoformat()

        user.xp_data = xp_data
        user.save(update_fields=["xp_data"])

        return cls.get_xp(user)


class GoalService:
    WEEKLY_CATEGORIES = [
        "grammar",
        "vocabulary",
        "listening",
        "reading",
        "music",
        "flashcards",
        "simulations",
        "games",
    ]

    @staticmethod
    def get_week_start(tz_name: str = "America/Sao_Paulo") -> datetime:
        """
        Retorna o início da semana atual (Domingo às 00:00:00).
        Domingo é o dia de reset semanal automático.
        """
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = timezone.utc
        now = datetime.now(tz)
        today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=tz)
        # Python weekday(): Monday is 0, Sunday is 6
        days_since_sunday = (now.weekday() + 1) % 7
        return today_start - timedelta(days=days_since_sunday)

    @classmethod
    def get_current_week_key(cls, tz_name: str = "America/Sao_Paulo") -> str:
        """
        Identificador único para a semana vigente (ex: '2026-W39').
        """
        week_start = cls.get_week_start(tz_name)
        return f"{week_start.year}-W{week_start.strftime('%U')}"

    @classmethod
    def get_weekly_category_counts(cls, user: User) -> dict[str, int]:
        """
        Contabiliza o progresso em cada uma das 8 categorias obrigatórias
        a partir do último domingo (reset semanal automático).
        A categoria News NÃO faz parte do Objetivo da Semana.
        """
        from apps.activities.models import ActivitySubmission
        cat_counts = defaultdict(int)
        week_start = cls.get_week_start(getattr(user, "timezone", "America/Sao_Paulo"))

        user_subs = ActivitySubmission.objects.filter(
            username=user.username,
            status="completed",
            created_at__gte=week_start,
        ).only("metadata", "activity_type")

        for s in user_subs:
            meta = s.metadata if isinstance(s.metadata, dict) else {}
            cat = (meta.get("category") or "").lower().strip()
            act_type = (s.activity_type or "").lower().strip()

            # Estrita exclusão de 'news' do Objetivo da Semana
            if cat == "news" or "news" in act_type:
                continue

            if cat in ("grammar", "grammars") or "grammar" in act_type or "grammar" in cat:
                cat_counts["grammar"] += 1
            elif cat in ("vocabulary", "vocab", "vocabularies") or "vocab" in act_type or "vocab" in cat:
                cat_counts["vocabulary"] += 1
            elif cat in ("listening", "listenings", "podcast", "podcasts") or "listen" in act_type or "podcast" in act_type or "listen" in cat:
                cat_counts["listening"] += 1
            elif cat in ("reading", "readings") or "read" in act_type or "reading" in cat:
                cat_counts["reading"] += 1
            elif cat in ("music", "musics", "lingoclip", "lyrics") or "music" in act_type or "lingoclip" in act_type or "lyrics" in act_type or "music" in cat:
                cat_counts["music"] += 1
            elif cat in ("flashcard", "flashcards") or "flashcard" in act_type or "flashcard" in cat:
                cat_counts["flashcards"] += 1
            elif cat in ("simulation", "simulations", "scenario", "roleplay", "interview") or "simul" in act_type or "scenario" in act_type or "roleplay" in act_type or "interview" in act_type or "simul" in cat:
                cat_counts["simulations"] += 1
            elif cat in ("game", "games", "wordwall") or "game" in act_type or "wordwall" in act_type or "game" in cat:
                cat_counts["games"] += 1

        # Flashcards adicionais revisados na semana
        try:
            from apps.activities.models import UserFlashcardProgress
            fc_prog = UserFlashcardProgress.objects.filter(
                user_id=user.username,
                reviewed_at__gte=week_start,
            ).count()
            cat_counts["flashcards"] = max(cat_counts["flashcards"], fc_prog)
        except Exception:
            pass

        return {cat: cat_counts.get(cat, 0) for cat in cls.WEEKLY_CATEGORIES}

    @classmethod
    def is_weekly_goal_completed(cls, user: User) -> bool:
        """
        Retorna True se o aluno completou pelo menos 1 atividade em todas as 8 categorias da semana.
        """
        counts = cls.get_weekly_category_counts(user)
        return all(counts.get(cat, 0) >= 1 for cat in cls.WEEKLY_CATEGORIES)

    @classmethod
    def get_weekly_goal_summary(cls, user: User) -> dict:
        """
        Sumário completo do Objetivo da Semana com categorias, progresso e bônus multiplicador.
        """
        week_start = cls.get_week_start(getattr(user, "timezone", "America/Sao_Paulo"))
        counts = cls.get_weekly_category_counts(user)
        completed_cats = [cat for cat in cls.WEEKLY_CATEGORIES if counts.get(cat, 0) >= 1]
        is_completed = len(completed_cats) == len(cls.WEEKLY_CATEGORIES)

        categories_dict = {}
        category_labels = {
            "grammar": "Grammar",
            "vocabulary": "Vocabulary",
            "listening": "Listening",
            "reading": "Reading",
            "music": "Music",
            "flashcards": "Flashcards",
            "simulations": "Simulations",
            "games": "Games",
        }

        for cat in cls.WEEKLY_CATEGORIES:
            prog = counts.get(cat, 0)
            categories_dict[cat] = {
                "name": category_labels.get(cat, cat.capitalize()),
                "target": 1,
                "progress": prog,
                "is_completed": prog >= 1,
            }

        return {
            "week_start": week_start.isoformat(),
            "week_key": cls.get_current_week_key(getattr(user, "timezone", "America/Sao_Paulo")),
            "total_categories": len(cls.WEEKLY_CATEGORIES),
            "completed_categories": len(completed_cats),
            "is_completed": is_completed,
            "multiplier": 2 if is_completed else 1,
            "bonus_applied": is_completed,
            "categories": categories_dict,
        }

    @classmethod
    def list_goals(cls, user: User) -> list[GoalOut]:
        cache_key = f"user_goals_{user.username}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

        counts = cls.get_weekly_category_counts(user)

        system_goals = [
            {
                "type": "grammar",
                "title": "Grammar Practice",
                "description": "Complete at least 1 grammar activity this week",
                "target": 1,
                "progress": counts.get("grammar", 0),
                "period": "weekly",
            },
            {
                "type": "vocabulary",
                "title": "Vocabulary Expansion",
                "description": "Complete at least 1 vocabulary activity this week",
                "target": 1,
                "progress": counts.get("vocabulary", 0),
                "period": "weekly",
            },
            {
                "type": "listening",
                "title": "Listening & Podcasts",
                "description": "Complete at least 1 listening or podcast activity this week",
                "target": 1,
                "progress": counts.get("listening", 0),
                "period": "weekly",
            },
            {
                "type": "reading",
                "title": "Reading Comprehension",
                "description": "Complete at least 1 reading activity this week",
                "target": 1,
                "progress": counts.get("reading", 0),
                "period": "weekly",
            },
            {
                "type": "music",
                "title": "Music & Lyrics",
                "description": "Complete at least 1 music or lyrics challenge this week",
                "target": 1,
                "progress": counts.get("music", 0),
                "period": "weekly",
            },
            {
                "type": "flashcards",
                "title": "Flashcards Mastery",
                "description": "Review flashcards or complete a flashcard session this week",
                "target": 1,
                "progress": counts.get("flashcards", 0),
                "period": "weekly",
            },
            {
                "type": "simulations",
                "title": "Real-World Simulations",
                "description": "Complete at least 1 conversation simulation or interview this week",
                "target": 1,
                "progress": counts.get("simulations", 0),
                "period": "weekly",
            },
            {
                "type": "games",
                "title": "Learning Games",
                "description": "Play at least 1 interactive English learning game this week",
                "target": 1,
                "progress": counts.get("games", 0),
                "period": "weekly",
            },
        ]

        results = []
        for g in system_goals:
            goal_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"weekly-goal-{g['type']}")
            prog = g["progress"]
            tgt = g["target"]
            results.append(
                GoalOut(
                    id=goal_uuid,
                    type=g["type"],
                    title=g["title"],
                    description=g["description"],
                    target=tgt,
                    progress=prog,
                    period=g["period"],
                    is_completed=prog >= tgt,
                )
            )

        cache.set(cache_key, results, 30)
        return results

    @staticmethod
    def create_goal(user: User, data: GoalInput) -> GoalOut:
        # Custom goal creation is deprecated; return the first matching system goal
        goals = GoalService.list_goals(user)
        for g in goals:
            if g.type == data.type:
                return g
        return goals[0] if goals else GoalOut(
            id=uuid.uuid4(),
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

        # Messages grouped by week of the month (Week 1: days 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-28, Week 5: 29+)
        messages_by_week = [0, 0, 0, 0]
        import calendar

        _, last_day = calendar.monthrange(now.year, now.month)
        if last_day > 28:
            messages_by_week.append(0)

        study_dates = set()
        words_set = set()

        for m in msgs:
            d = m.created_at.day if m.created_at else 1
            if d <= 7:
                messages_by_week[0] += 1
            elif d <= 14:
                messages_by_week[1] += 1
            elif d <= 21:
                messages_by_week[2] += 1
            elif d <= 28:
                messages_by_week[3] += 1
            else:
                if len(messages_by_week) >= 5:
                    messages_by_week[4] += 1

            if m.created_at:
                study_dates.add(m.created_at.date())

            if m.content:
                for w in m.content.split():
                    if len(w) > 2:
                        words_set.add(w.lower())

        from apps.activities.models import ActivitySubmission

        subs = list(
            ActivitySubmission.objects.filter(
                username=username, created_at__gte=month_start, status="completed"
            )
        )
        for s in subs:
            if s.created_at:
                study_dates.add(s.created_at.date())

        total_conversations = len(
            set(m.session_id for m in msgs if getattr(m, "session_id", None))
        ) or max(1, len(msgs) // 4)
        unique_words_count = len(words_set) or (len(msgs) * 4)

        return {
            "period": "monthly",
            "username": username,
            "total_xp": total_xp,
            "score": total_xp,
            "level": level,
            "total_messages": len(msgs),
            "messages_by_week": messages_by_week,
            "study_days": len(study_dates),
            "unique_words_used": unique_words_count,
            "total_conversations": total_conversations,
            "study_time_hours": round((len(msgs) * 3) / 60, 1),
            "total_exercises": len(subs) or (len(msgs) // 2),
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
