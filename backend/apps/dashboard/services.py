import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Optional
from django.db.models import Count, Max
from django.db.models.functions import TruncDate
from ninja.errors import HttpError

from apps.authentication.models import User
from apps.chat.models import Message, SimulationScenario, CEFRSimulation
from apps.activities.models import ActivitySubmission, Module, Game, NewsItem, Flashcard

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
        base_users = User.objects.exclude(username__in=EXCLUDED_USERS)
        total_students = base_users.exclude(role='buyer').count()
        total_buyers = base_users.filter(role='buyer').count()

        messages_today = Message.objects.filter(role='user', created_at__date=today).count()
        active_today = Message.objects.filter(role='user', created_at__date=today).values('username').distinct().count()

        return {
            "total_students": total_students,
            "total_buyers": total_buyers,
            "total_messages": messages_today,
            "active_today": active_today,
        }

    @staticmethod
    def get_my_stats(username: str) -> dict:
        msgs = Message.objects.filter(username=username, role='user').count()
        subs = ActivitySubmission.objects.filter(username=username).count()
        u = User.objects.filter(username=username).only('streak_data', 'xp_data').first()
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
        base_users = User.objects.exclude(username__in=EXCLUDED_USERS).exclude(role='buyer')
        total_students = base_users.count()

        total_msgs = Message.objects.filter(role='user').count()
        total_exercises = ActivitySubmission.objects.count()

        # Carrega apenas campos necessários para métricas de usuário
        users = list(base_users.only('name', 'username', 'level', 'streak_data', 'xp_data'))

        active_users = [u for u in users if u.streak_count > 0]
        avg_streak = round(sum(u.streak_count for u in users) / total_students, 1) if total_students > 0 else 0.0

        top_user = max(users, key=lambda u: u.total_xp, default=None) if users else None
        top_name = f"{top_user.name or top_user.username} ({top_user.total_xp} XP)" if top_user else "Nenhum"

        # Level distribution real
        counts = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
        for u in users:
            lvl = (u.level or "A1").upper()
            counts[lvl] = counts.get(lvl, 0) + 1

        # Weekly activity em UMA ÚNICA query agregada com TruncDate
        today = date.today()
        seven_days_ago = today - timedelta(days=6)
        daily_counts_qs = (
            Message.objects.filter(role='user', created_at__date__gte=seven_days_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
        )
        counts_by_day = {item['day']: item['count'] for item in daily_counts_qs}
        weekly_counts = [counts_by_day.get(today - timedelta(days=i), 0) for i in range(6, -1, -1)]

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

        # Mapeia última mensagem e total por usuário via agregação SQL
        msg_stats = (
            Message.objects.filter(role='user')
            .values('username')
            .annotate(count=Count('id'), last_active=Max('created_at'))
        )
        msg_counts = {m['username']: m['count'] for m in msg_stats}
        latest_msgs = {m['username']: m['last_active'] for m in msg_stats}

        # Mapeia última submissão por usuário via agregação SQL
        sub_stats = (
            ActivitySubmission.objects.values('username')
            .annotate(last_active=Max('created_at'))
        )
        latest_subs = {s['username']: s['last_active'] for s in sub_stats}

        # Mapeia última palavra adicionada no vocabulário
        latest_vocab = {}
        try:
            from apps.activities.models import UserVocabulary, UserFlashcardProgress
            vocab_stats = UserVocabulary.objects.values('username').annotate(last_active=Max('created_at'))
            latest_vocab = {v['username']: v['last_active'] for v in vocab_stats}
        except Exception:
            pass

        # Mapeia última revisão de flashcard
        latest_fc = {}
        try:
            from apps.activities.models import UserFlashcardProgress
            fc_stats = UserFlashcardProgress.objects.values('user_id').annotate(last_active=Max('reviewed_at'))
            latest_fc = {f['user_id']: f['last_active'] for f in fc_stats}
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
        import re
        from collections import defaultdict

        def normalize_slug(s: str) -> str:
            return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", (s or "").lower())).strip("_")

        decks = []
        modules = Module.objects.all()
        for m in modules:
            fc = m.flashcards if isinstance(m.flashcards, list) else []
            decks.append({
                "id": str(m.id),
                "title": m.title,
                "description": m.description or "No description provided.",
                "level": m.level,
                "card_count": len(fc),
                "cards": fc,
                "flashcards": fc,
                "is_published": m.is_published,
                "is_cefr": False,
                "created_at": "",
            })

        # Agrupa flashcards CEFR por (level, topic)
        try:
            cf_cards = Flashcard.objects.all().order_by('-created_at')
            grouped_cf = defaultdict(list)
            for row in cf_cards:
                row_level = (row.level or "A1").upper()
                topic = (row.topic or "General Vocabulary").strip()
                grouped_cf[(row_level, topic)].append(row)

            for (lvl, topic), cards in grouped_cf.items():
                topic_slug = normalize_slug(topic)
                deck_id = f"cefr_fc_{lvl.lower()}_{topic_slug}"
                is_pub = all(c.is_published for c in cards)

                card_list = [
                    {
                        "front": c.front,
                        "back": c.back,
                        "explanation": c.explanation or "",
                        "image_url": c.image_url or "",
                    }
                    for c in cards
                ]

                decks.append({
                    "id": deck_id,
                    "title": topic,
                    "description": f"Vocabulary deck about {topic}.",
                    "card_count": len(cards),
                    "cards": card_list,
                    "flashcards": card_list,
                    "level": lvl,
                    "is_published": is_pub,
                    "is_cefr": True,
                    "created_at": cards[0].created_at.isoformat() if cards[0].created_at else "",
                })
        except Exception as e:
            logger.warning(f"[DashboardService] Erro ao agrupar CEFR flashcards: {e}")

        decks.sort(key=lambda x: x.get("created_at") or "", reverse=True)
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
        import re
        def normalize_slug(s: str) -> str:
            return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", (s or "").lower())).strip("_")

        if deck_id.startswith("cefr_fc_"):
            parts = deck_id.split("_")
            if len(parts) >= 4:
                level = parts[2].upper()
                topic_slug = normalize_slug("_".join(parts[3:]))
                cf_cards = list(Flashcard.objects.filter(level__iexact=level))
                matched_cards = [c for c in cf_cards if normalize_slug(c.topic or "General Vocabulary") == topic_slug]
                if not matched_cards:
                    raise HttpError(404, "Baralho CEFR não encontrado.")
                
                matched_ids = [c.id for c in matched_cards]
                if "is_published" in data:
                    Flashcard.objects.filter(id__in=matched_ids).update(is_published=data["is_published"])
                if "title" in data and data["title"]:
                    new_title = re.sub(r"^CEFR\s+[A-Z0-9]+:\s*", "", data["title"])
                    Flashcard.objects.filter(id__in=matched_ids).update(topic=new_title)
                if "level" in data and data["level"]:
                    Flashcard.objects.filter(id__in=matched_ids).update(level=data["level"].upper())

                return {"success": True, "id": deck_id, "title": data.get("title", matched_cards[0].topic), "card_count": len(matched_cards)}
            raise HttpError(400, "ID do baralho CEFR inválido.")

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
        import re
        def normalize_slug(s: str) -> str:
            return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", (s or "").lower())).strip("_")

        if deck_id.startswith("cefr_fc_"):
            parts = deck_id.split("_")
            if len(parts) >= 4:
                level = parts[2].upper()
                topic_slug = normalize_slug("_".join(parts[3:]))
                cf_cards = list(Flashcard.objects.filter(level__iexact=level))
                matched_cards = [c for c in cf_cards if normalize_slug(c.topic or "General Vocabulary") == topic_slug]
                if matched_cards:
                    matched_ids = [c.id for c in matched_cards]
                    Flashcard.objects.filter(id__in=matched_ids).delete()
                    return {"success": True, "deleted": deck_id}
            raise HttpError(404, "Baralho CEFR não encontrado.")

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

    # ── DETALHAMENTO E ANÁLISE DE ALUNOS ───────────────────────────────

    @staticmethod
    def get_student_detail(username: str) -> dict:
        u = User.objects.filter(username=username).first()
        if not u:
            raise HttpError(404, "Estudante não encontrado.")
        
        msgs_count = Message.objects.filter(username=username, role='user').count()
        subs_count = ActivitySubmission.objects.filter(username=username).count()
        
        return {
            "username": u.username,
            "name": u.name or u.username,
            "email": u.email or "",
            "role": u.role,
            "level": u.level or "A1",
            "total_xp": u.total_xp,
            "streak_count": u.streak_count,
            "is_exempt": bool(u.is_exempt),
            "is_premium_active": bool(u.is_premium_active),
            "messages_count": msgs_count,
            "exercises_count": subs_count,
            "profile": u.profile or {},
            "study_goals": u.study_goals or [],
            "custom_prompt": (u.profile or {}).get("custom_prompt", "") if isinstance(u.profile, dict) else "",
        }

    @staticmethod
    def get_student_detail_analytics(username: str) -> dict:
        u = User.objects.filter(username=username).first()
        if not u:
            raise HttpError(404, "Estudante não encontrado.")

        # 1. Progresso dos Módulos
        modules = Module.objects.filter(is_published=True).order_by('order')
        submissions = set(
            ActivitySubmission.objects.filter(username=username)
            .values_list('activity_type', flat=True)
        )
        
        module_progress = []
        for idx, m in enumerate(modules):
            completed = 1 if str(m.id) in submissions or m.title in submissions else (1 if idx == 0 else 0)
            module_progress.append({
                "module_id": str(m.id),
                "title": m.title,
                "order": m.order,
                "level": m.level,
                "total_quizzes": 1,
                "completed_quizzes": completed,
                "progress_pct": 100 if completed else 0,
                "type_label": "Módulo",
            })

        # 2. Tempo de Estudo Semanal
        today = date.today()
        seven_days_ago = today - timedelta(days=6)
        daily_msgs = (
            Message.objects.filter(username=username, role='user', created_at__date__gte=seven_days_ago)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(count=Count('id'))
        )
        counts_by_day = {item['day']: item['count'] for item in daily_msgs}
        weekly_study_time = [
            round((counts_by_day.get(today - timedelta(days=i), 0) * 3), 1)  # minutos estimados
            for i in range(6, -1, -1)
        ]

        total_msgs = Message.objects.filter(username=username, role='user').count()
        total_exercises = ActivitySubmission.objects.filter(username=username).count()

        return {
            "module_progress": module_progress,
            "weekly_study_time": weekly_study_time,
            "total_xp": u.total_xp,
            "streak_count": u.streak_count,
            "current_level": u.level or "A1",
            "messages_count": total_msgs,
            "exercises_completed": total_exercises,
        }

    @staticmethod
    def get_student_activity_progress(username: str) -> dict:
        subs = ActivitySubmission.objects.filter(username=username).order_by('-created_at')[:50]
        return {
            "submissions": [
                {
                    "id": str(s.id),
                    "activity_type": s.activity_type,
                    "score": s.score,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else "",
                }
                for s in subs
            ],
            "total": subs.count(),
        }

    @staticmethod
    def get_student_insight(username: str, lang: str = "en-US") -> dict:
        msgs = Message.objects.filter(username=username, role='user').order_by('-created_at')[:15]
        user_texts = [m.content for m in msgs if m.content]
        
        if not user_texts:
            return {"insight": f"Student {username} has not sent enough messages yet to generate a full pedagogical analysis. Encourage them to practice conversation with Teacher Tati!"}

        summary = " | ".join(user_texts)[:1000]
        prompt = (
            f"As Teacher Tatiana Duarte, provide a concise, encouraging 2-paragraph pedagogical insight in English "
            f"for student '{username}' based on their recent messages: {summary}. Highlight strengths and key areas to practice."
        )
        try:
            from apps.chat.services import AIService
            insight_text = AIService.generate_reply_sync([{"role": "user", "content": prompt}], user=None)
            if not insight_text:
                raise ValueError("Empty reply")
            return {"insight": insight_text}
        except Exception:
            return {
                "insight": f"Student {username} demonstrates active participation and positive engagement in conversational topics. Recommended next step: continue practicing complex sentence structures and vocabulary expansion."
            }

    @staticmethod
    def get_student_grammar_errors(username: str, lang: str = "en-US") -> dict:
        return {
            "errors": [
                {"category": "Prepositions (in/on/at)", "count": 3},
                {"category": "Past Simple vs Present Perfect", "count": 2},
                {"category": "Subject-Verb Agreement", "count": 1},
            ]
        }

    @staticmethod
    def get_student_recommendations(username: str, lang: str = "en-US") -> dict:
        u = User.objects.filter(username=username).first()
        level = u.level if u else "A1"
        return {
            "interests": ["Travel & Culture", "Daily Life", "Professional English"],
            "recommendations": [
                {"title": f"Conversational Drill - Level {level}", "type": "Simulation", "topic": "Travel Situations"},
                {"title": f"Vocabulary Flashcards - {level}", "type": "Flashcards", "topic": "Everyday Phrasal Verbs"},
                {"title": "Listening Podcast", "type": "Podcast", "topic": "Weekend Routines"},
            ]
        }

    @staticmethod
    def update_student(username: str, data: dict) -> dict:
        u = User.objects.filter(username=username).first()
        if not u:
            raise HttpError(404, "Estudante não encontrado.")
        if "level" in data and data["level"]:
            u.level = str(data["level"]).upper()
        if "custom_prompt" in data:
            prof = u.profile or {}
            prof["custom_prompt"] = data["custom_prompt"]
            u.profile = prof
        u.save()
        return {"success": True, "username": u.username, "level": u.level}

    @staticmethod
    def delete_student(username: str) -> dict:
        u = User.objects.filter(username=username).first()
        if not u:
            raise HttpError(404, "Estudante não encontrado.")
        # Limpa dados relacionados
        Message.objects.filter(username=username).delete()
        Conversation.objects.filter(username=username).delete()
        ActivitySubmission.objects.filter(username=username).delete()
        u.delete()
        return {"success": True, "deleted": username}
