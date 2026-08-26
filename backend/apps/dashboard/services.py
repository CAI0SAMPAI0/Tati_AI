import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import List, Dict, Any, Optional
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from apps.chat.models import Message, SimulationScenario, CEFRSimulation
from apps.activities.models import ActivitySubmission, Flashcard, Module, Game, NewsItem
from apps.payments.models import Subscription, Order

User = get_user_model()
logger = logging.getLogger(__name__)

EXCLUDED_USERS = ["programador", "admin", "professor", "professora"]
SP_TZ = ZoneInfo("America/Sao_Paulo")


def parse_dt_to_sp(val) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        dt = val
    elif isinstance(val, str):
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            try:
                dt = datetime.strptime(val[:10], "%Y-%m-%d")
            except Exception:
                return None
    elif isinstance(val, date):
        dt = datetime.combine(val, datetime.min.time())
    else:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(SP_TZ)


def format_sp_datetime(dt_obj: Optional[datetime]) -> str:
    if not dt_obj:
        return "—"
    return dt_obj.strftime("%m/%d/%Y, %I:%M %p")


def format_sp_date(dt_obj: Optional[datetime]) -> str:
    if not dt_obj:
        return "—"
    return dt_obj.strftime("%m/%d/%Y")


def format_sp_time(dt_val) -> str:
    dt = parse_dt_to_sp(dt_val)
    return format_sp_datetime(dt)


class DashboardService:
    @staticmethod
    def get_stats() -> dict:
        today = date.today()
        users = list(User.objects.exclude(username__in=EXCLUDED_USERS))
        students = [u for u in users if u.role != 'buyer']
        buyers = [u for u in users if u.role == 'buyer']

        messages_today = Message.objects.filter(role='user', created_at__date=today).count()
        active_today = len(set(Message.objects.filter(role='user', created_at__date=today).values_list('username', flat=True)))

        return {
            "total_students": len(students),
            "total_buyers": len(buyers),
            "total_messages": messages_today,
            "active_today": active_today,
        }

    @staticmethod
    def get_my_stats(username: str) -> dict:
        msgs = Message.objects.filter(username=username, role='user').count()
        subs = ActivitySubmission.objects.filter(username=username).count()
        u = User.objects.filter(username=username).first()
        streak = u.streak_count if u else 0
        xp = u.total_xp if u else 0

        return {
            "total_messages": msgs,
            "messages_sent": msgs,
            "total_exercises": subs,
            "exercises_completed": subs,
            "current_streak": streak,
            "total_xp": xp,
            "study_time_hours": round((msgs * 3) / 60, 1),
        }

    @staticmethod
    def get_reports_overview() -> dict:
        users = list(User.objects.exclude(username__in=EXCLUDED_USERS).exclude(role='buyer'))
        total_students = len(users)

        total_msgs = Message.objects.filter(role='user').count()
        total_exercises = ActivitySubmission.objects.count()

        active_users = [u for u in users if u.streak_count > 0]
        avg_streak = round(sum(u.streak_count for u in users) / total_students, 1) if total_students > 0 else 0.0

        top_user = max(users, key=lambda u: u.total_xp, default=None) if users else None
        top_name = f"{top_user.name or top_user.username} ({top_user.total_xp} XP)" if top_user else "Nenhum"

        # Level distribution real
        counts = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        for u in users:
            lvl = (u.level or "A1").upper()
            counts[lvl] = counts.get(lvl, 0) + 1

        # Weekly activity (últimos 7 dias)
        today = date.today()
        weekly_counts = []
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            c = Message.objects.filter(role='user', created_at__date=d).count()
            weekly_counts.append(c)

        return {
            "total_students": total_students,
            "active_students_this_week": len(active_users),
            "average_streak_days": avg_streak,
            "total_messages_exchanged": total_msgs,
            "total_exercises_completed": total_exercises,
            "top_performer": top_name,
            "level_distribution": counts,
            "weekly_activity": weekly_counts,
        }

    @staticmethod
    def get_students_list(search: str = None, level: str = None) -> list[dict]:
        users = User.objects.exclude(username__in=EXCLUDED_USERS).exclude(role='buyer')
        if search:
            users = users.filter(username__icontains=search) | users.filter(name__icontains=search) | users.filter(email__icontains=search)
        if level:
            users = users.filter(level__iexact=level)

        # Mapeia última mensagem por usuário
        latest_msgs = {}
        msg_counts = {}
        for m in Message.objects.filter(role='user').order_by('created_at'):
            latest_msgs[m.username] = m.created_at
            msg_counts[m.username] = msg_counts.get(m.username, 0) + 1

        # Mapeia última submissão por usuário
        latest_subs = {}
        for s in ActivitySubmission.objects.all().order_by('created_at'):
            latest_subs[s.username] = s.created_at

        # Mapeia última palavra adicionada no vocabulário
        latest_vocab = {}
        try:
            from apps.activities.models import UserVocabulary, UserFlashcardProgress
            for v in UserVocabulary.objects.all().order_by('created_at'):
                latest_vocab[v.username] = v.created_at
        except Exception:
            pass

        # Mapeia última revisão de flashcard
        latest_fc = {}
        try:
            for f in UserFlashcardProgress.objects.all().order_by('reviewed_at'):
                latest_fc[f.user_id] = f.reviewed_at
        except Exception:
            pass

        results = []
        for u in users:
            st = u.streak_data if isinstance(u.streak_data, dict) else {}
            last_study_at = st.get("last_study_at")
            last_study_date = st.get("last_study_date")
            last_msg = latest_msgs.get(u.username)
            last_sub = latest_subs.get(u.username)
            last_v = latest_vocab.get(u.username)
            last_f = latest_fc.get(u.username)
            created_at_dt = parse_dt_to_sp(u.created_at)
            updated_at_dt = parse_dt_to_sp(u.updated_at)

            # Dates to compare
            dt_candidates = [
                d for d in [
                    parse_dt_to_sp(last_study_at),
                    parse_dt_to_sp(last_study_date),
                    parse_dt_to_sp(last_msg),
                    parse_dt_to_sp(last_sub),
                    parse_dt_to_sp(last_v),
                    parse_dt_to_sp(last_f),
                    updated_at_dt,
                    created_at_dt
                ]
                if d is not None
            ]
            latest_dt = max(dt_candidates) if dt_candidates else None

            focus_val = getattr(u, 'focus', None) or (u.profile or {}).get("focus") if isinstance(u.profile, dict) else "General Conversation"
            if not focus_val or focus_val in ["—", "None", ""]:
                focus_val = "General Conversation"

            last_active_iso = latest_dt.isoformat() if latest_dt else ""
            created_iso = created_at_dt.isoformat() if created_at_dt else ""

            results.append({
                "username": u.username,
                "name": u.name or u.username,
                "email": u.email or "",
                "role": u.role or "student",
                "level": u.level or "A1",
                "focus": focus_val,
                "total_xp": u.total_xp,
                "streak_count": u.streak_count,
                "is_exempt": bool(u.is_exempt),
                "is_premium_active": bool(u.is_premium_active),
                "last_active": last_active_iso,
                "last_activity": last_active_iso,
                "messages_count": msg_counts.get(u.username, 0),
                "total_messages": msg_counts.get(u.username, 0),
                "msgs": msg_counts.get(u.username, 0),
                "risk_level": "active" if u.streak_count > 0 else "inactive",
                "days_inactive": 0 if u.streak_count > 0 else 7,
                "created_at": created_iso or format_sp_date(created_at_dt),
                "joined": format_sp_date(created_at_dt),
                "_sort_dt": latest_dt or datetime.min.replace(tzinfo=timezone.utc),
            })

        results.sort(key=lambda x: x["_sort_dt"], reverse=True)
        for r in results:
            del r["_sort_dt"]
        return results

    @staticmethod
    def get_difficulties_stats() -> dict:
        users = User.objects.exclude(username__in=EXCLUDED_USERS).exclude(role='buyer')
        counts = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        for u in users:
            lvl = (u.level or "A1").upper()
            if lvl in counts:
                counts[lvl] += 1
            else:
                counts["A1"] += 1
        return {"distribution": counts, "total": sum(counts.values()), "alerts": []}

    @staticmethod
    def get_flashcards_admin() -> list[dict]:
        decks = []
        modules = Module.objects.all()
        for m in modules:
            fc = m.flashcards if isinstance(m.flashcards, list) else []
            decks.append({
                "id": str(m.id),
                "title": m.title,
                "level": m.level,
                "card_count": len(fc),
                "cards": fc,
                "flashcards": fc,
                "is_published": m.is_published,
            })
        return decks

    @staticmethod
    def create_flashcard_deck(data: dict) -> dict:
        title = data.get("title", "Novo Baralho")
        val = data.get("level")
        level = "all" if val and str(val).lower().strip() in ["all", "todos", "any"] else (val or "A1").upper()
        cards = data.get("flashcards") or data.get("cards") or []
        description = data.get("description", "")
        is_published = data.get("is_published", True)

        m = Module.objects.create(
            title=title,
            level=level,
            description=description,
            flashcards=cards,
            is_published=is_published,
        )
        return {"success": True, "id": str(m.id), "title": m.title, "card_count": len(cards)}

    @staticmethod
    def update_flashcard_deck(deck_id: str, data: dict) -> dict:
        m = Module.objects.filter(id=deck_id).first()
        if not m:
            raise HttpError(404, "Baralho não encontrado.")
        if "title" in data:
            m.title = data["title"]
        if "level" in data:
            m.level = data["level"].upper()
        if "description" in data:
            m.description = data["description"]
        if "flashcards" in data or "cards" in data:
            m.flashcards = data.get("flashcards") or data.get("cards") or []
        if "is_published" in data:
            m.is_published = data["is_published"]
        m.save()
        return {"success": True, "id": str(m.id), "title": m.title, "card_count": len(m.flashcards or [])}

    @staticmethod
    def delete_flashcard_deck(deck_id: str) -> dict:
        m = Module.objects.filter(id=deck_id).first()
        if m:
            m.delete()
            return {"success": True, "deleted": deck_id}
        raise HttpError(404, "Baralho não encontrado.")

    # ── SIMULATIONS ADMIN ─────────────────────────────────────────────────

    @staticmethod
    def get_all_simulations(limit: int = 200, offset: int = 0) -> list[dict]:
        sims = []
        for s in SimulationScenario.objects.all():
            sims.append({
                "id": str(s.id),
                "name": s.name,
                "name_en": s.name_en or s.name,
                "description": s.description,
                "difficulty": s.difficulty or "all",
                "levels": s.levels or ([s.difficulty] if s.difficulty and s.difficulty != "all" else ["all"]),
                "system_prompt": s.system_prompt,
                "emoji": s.emoji or "🎭",
                "is_active": s.is_active,
                "is_published": s.is_active,
                "initial_message": s.initial_message or s.greeting or "Hello! Let's start our scenario.",
                "created_at": s.created_at.isoformat() if s.created_at else "",
            })

        for cs in CEFRSimulation.objects.all():
            roles = cs.roles if isinstance(cs.roles, dict) else {}
            student_role = roles.get("student", "Student")
            ai_role = roles.get("ai", "Assistant")
            sys_prompt = f"You are {ai_role}. The user is {student_role}. Goal: {cs.goal}. Scenario: {cs.scenario}"

            sims.append({
                "id": f"cefr_sim_{cs.id}",
                "name": cs.topic,
                "description": cs.scenario,
                "difficulty": cs.level,
                "levels": [cs.level],
                "system_prompt": sys_prompt,
                "emoji": "🎭",
                "is_active": cs.is_published,
                "is_published": cs.is_published,
                "is_cefr": True,
                "initial_message": f"Hello! We are starting the scenario: '{cs.topic}'.",
                "created_at": cs.created_at.isoformat() if cs.created_at else "",
            })

        sims.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return sims[offset:offset + limit]

    @staticmethod
    def get_simulation_detail(sim_id: str) -> dict:
        if sim_id.startswith("cefr_sim_"):
            clean_id = sim_id.replace("cefr_sim_", "")
            cs = CEFRSimulation.objects.filter(id=clean_id).first()
            if not cs:
                raise HttpError(404, "Simulação não encontrada.")
            return {
                "id": sim_id,
                "name": cs.topic,
                "description": cs.scenario,
                "difficulty": cs.level,
                "levels": [cs.level],
                "system_prompt": f"Goal: {cs.goal}",
                "is_published": cs.is_published,
                "emoji": "🎭",
            }
        s = SimulationScenario.objects.filter(id=sim_id).first()
        if not s:
            raise HttpError(404, "Simulação não encontrada.")
        return {
            "id": str(s.id),
            "name": s.name,
            "name_en": s.name_en or s.name,
            "description": s.description,
            "difficulty": s.difficulty,
            "levels": s.levels or [],
            "system_prompt": s.system_prompt,
            "emoji": s.emoji or "🎭",
            "is_active": s.is_active,
            "is_published": s.is_active,
            "initial_message": s.initial_message or "",
        }

    @staticmethod
    def create_simulation(data: dict) -> dict:
        name = data.get("name") or "Nova Simulação"
        desc = data.get("description", "")
        diff = data.get("difficulty") or "all"
        levels = data.get("levels") or [diff]
        sys_prompt = data.get("system_prompt", "")
        emoji = data.get("emoji", "🎭")
        is_published = data.get("is_published", True)
        initial_msg = data.get("initial_message") or ""

        s = SimulationScenario.objects.create(
            name=name,
            description=desc,
            difficulty=diff,
            levels=levels,
            system_prompt=sys_prompt,
            emoji=emoji,
            is_active=is_published,
            initial_message=initial_msg,
        )
        return {"success": True, "id": str(s.id), "name": s.name}

    @staticmethod
    def update_simulation(sim_id: str, data: dict) -> dict:
        if sim_id.startswith("cefr_sim_"):
            clean_id = sim_id.replace("cefr_sim_", "")
            cs = CEFRSimulation.objects.filter(id=clean_id).first()
            if not cs:
                raise HttpError(404, "Simulação não encontrada.")
            if "name" in data:
                cs.topic = data["name"]
            if "description" in data:
                cs.scenario = data["description"]
            if "is_published" in data:
                cs.is_published = data["is_published"]
            cs.save()
            return {"success": True, "id": sim_id}

        s = SimulationScenario.objects.filter(id=sim_id).first()
        if not s:
            raise HttpError(404, "Simulação não encontrada.")
        if "name" in data:
            s.name = data["name"]
        if "description" in data:
            s.description = data["description"]
        if "difficulty" in data:
            s.difficulty = data["difficulty"]
        if "levels" in data:
            s.levels = data["levels"]
        if "system_prompt" in data:
            s.system_prompt = data["system_prompt"]
        if "emoji" in data:
            s.emoji = data["emoji"]
        if "is_published" in data or "is_active" in data:
            s.is_active = data.get("is_published", data.get("is_active", True))
        if "initial_message" in data:
            s.initial_message = data["initial_message"]
        s.save()
        return {"success": True, "id": str(s.id), "name": s.name}

    @staticmethod
    def delete_simulation(sim_id: str) -> dict:
        if sim_id.startswith("cefr_sim_"):
            clean_id = sim_id.replace("cefr_sim_", "")
            CEFRSimulation.objects.filter(id=clean_id).delete()
            return {"success": True, "deleted": sim_id}
        SimulationScenario.objects.filter(id=sim_id).delete()
        return {"success": True, "deleted": sim_id}

    # ── GAMES ADMIN ───────────────────────────────────────────────────────

    @staticmethod
    def get_games_admin() -> list[dict]:
        games = Game.objects.all().order_by('-created_at')
        return [
            {
                "id": str(g.id),
                "title": g.title,
                "description": g.description or "",
                "wordwall_url": g.wordwall_url,
                "levels": g.levels or ["all"],
                "is_published": g.is_published,
                "created_at": g.created_at.isoformat() if g.created_at else "",
            }
            for g in games
        ]

    @staticmethod
    def create_game(data: dict) -> dict:
        title = (data.get("title") or "").strip()
        wordwall_url = (data.get("wordwall_url") or "").strip()
        if not title or not wordwall_url:
            raise HttpError(400, "Título e URL do Wordwall são obrigatórios.")

        levels = data.get("levels") or ["ALL"]
        if isinstance(levels, str):
            levels = [l.strip().upper() for l in levels.split(",") if l.strip()]

        g = Game.objects.create(
            title=title,
            description=data.get("description", ""),
            wordwall_url=wordwall_url,
            levels=levels,
            is_published=data.get("is_published", True),
        )
        return {"success": True, "id": str(g.id), "title": g.title}

    @staticmethod
    def update_game(game_id: str, data: dict) -> dict:
        g = Game.objects.filter(id=game_id).first()
        if not g:
            raise HttpError(404, "Game não encontrado.")
        if "title" in data:
            g.title = data["title"]
        if "description" in data:
            g.description = data["description"]
        if "wordwall_url" in data:
            g.wordwall_url = data["wordwall_url"]
        if "levels" in data:
            lvls = data["levels"]
            g.levels = [l.strip().upper() for l in lvls.split(",")] if isinstance(lvls, str) else lvls
        if "is_published" in data:
            g.is_published = data["is_published"]
        g.save()
        return {"success": True, "id": str(g.id), "title": g.title}

    @staticmethod
    def delete_game(game_id: str) -> dict:
        g = Game.objects.filter(id=game_id).first()
        if g:
            g.delete()
            return {"success": True, "deleted": game_id}
        raise HttpError(404, "Game não encontrado.")

    # ── NEWS ADMIN ────────────────────────────────────────────────────────

    @staticmethod
    def get_news_admin() -> list[dict]:
        news = NewsItem.objects.all().order_by('-created_at')
        return [
            {
                "id": str(n.id),
                "title": n.title,
                "url": n.url,
                "description": n.description or "",
                "levels": n.levels or ["all"],
                "thumbnail_url": n.thumbnail_url or "",
                "is_published": n.is_published,
                "created_at": n.created_at.isoformat() if n.created_at else "",
            }
            for n in news
        ]

    @staticmethod
    def create_news(data: dict) -> dict:
        title = (data.get("title") or "").strip()
        url = (data.get("url") or "").strip()
        if not title or not url:
            raise HttpError(400, "Título e URL são obrigatórios.")

        levels = data.get("levels") or ["ALL"]
        if isinstance(levels, str):
            levels = [l.strip().upper() for l in levels.split(",") if l.strip()]

        n = NewsItem.objects.create(
            title=title,
            url=url,
            description=data.get("description", ""),
            levels=levels,
            thumbnail_url=data.get("thumbnail_url") or None,
            is_published=data.get("is_published", True),
        )
        return {"success": True, "id": str(n.id), "title": n.title}

    @staticmethod
    def update_news(news_id: str, data: dict) -> dict:
        n = NewsItem.objects.filter(id=news_id).first()
        if not n:
            raise HttpError(404, "Notícia não encontrada.")
        if "title" in data:
            n.title = data["title"]
        if "url" in data:
            n.url = data["url"]
        if "description" in data:
            n.description = data["description"]
        if "levels" in data:
            lvls = data["levels"]
            n.levels = [l.strip().upper() for l in lvls.split(",")] if isinstance(lvls, str) else lvls
        if "thumbnail_url" in data:
            n.thumbnail_url = data["thumbnail_url"]
        if "is_published" in data:
            n.is_published = data["is_published"]
        n.save()
        return {"success": True, "id": str(n.id), "title": n.title}

    @staticmethod
    def delete_news(news_id: str) -> dict:
        n = NewsItem.objects.filter(id=news_id).first()
        if n:
            n.delete()
            return {"success": True, "deleted": news_id}
        raise HttpError(404, "Notícia não encontrada.")
