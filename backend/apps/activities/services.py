import logging
import os
import re
import difflib
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from .models import (
    Flashcard,
    Module,
    UserFlashcardProgress,
    UserVocabulary,
    Podcast,
    Trophy,
    UserTrophy,
    PremiumContent,
    Game,
    NewsItem,
    ActivitySubmission,
)
from .schemas import (
    FlashcardOut,
    FlashcardReviewOut,
    PodcastOut,
    HubMaterialOut,
    GameOut,
    NewsOut,
    TrophyOut,
    RankingUserOut,
    SubmissionInput,
    SubmissionOut,
    PronunciationVerifyOut,
    WordResultOut,
)
from apps.users.services import XPService, StreakService

User = get_user_model()
logger = logging.getLogger(__name__)


def normalize_slug(s: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-zA-Z0-9]", "_", (s or "").lower())).strip("_")


def matches_level(user_lvl: str, target_lvl: str, target_levels: list = None) -> bool:
    if not user_lvl or not target_lvl:
        return True
    u = str(user_lvl).upper().strip()
    t = str(target_lvl).upper().strip()
    if u in ("ALL", "ANY", "") or t in ("ALL", "ANY", "", u):
        return True
    if target_levels and (u in [str(lvl).upper().strip() for lvl in target_levels] or "ALL" in [str(lvl).upper().strip() for lvl in target_levels]):
        return True
    return False


class FlashcardService:
    @staticmethod
    def get_my_decks(user_level: str = "A1") -> list[dict]:
        filtered = []

        # 1. Busca módulos que possuem flashcards
        modules = Module.objects.filter(is_published=True).exclude(id="00000000-0000-0000-0000-000000000001")
        for m in modules:
            fc = m.flashcards
            if fc and isinstance(fc, list) and len(fc) > 0:
                if matches_level(user_level, m.level, m.levels):
                    filtered.append({
                        "id": str(m.id),
                        "title": m.title,
                        "description": m.description or f"Deck com {len(fc)} flashcards",
                        "card_count": len(fc),
                        "level": m.level,
                        "is_published": True,
                        "image_url": m.image_url,
                        "created_at": m.created_at.isoformat() if m.created_at else datetime.now(timezone.utc).isoformat(),
                    })

        # 2. Busca CEFR Flashcards agrupados por tópico
        cefr_cards = Flashcard.objects.filter(is_published=True)
        grouped = defaultdict(list)
        for row in cefr_cards:
            row_lvl = (row.level or "A1").upper()
            if matches_level(user_level, row_lvl):
                topic = (row.topic or "General Vocabulary").strip()
                grouped[(row_lvl, topic)].append(row)

        for (lvl, topic), cards in grouped.items():
            topic_slug = normalize_slug(topic)
            deck_id = f"cefr_fc_{lvl.lower()}_{topic_slug}"
            filtered.append({
                "id": deck_id,
                "title": f"CEFR {lvl}: {topic}",
                "description": f"Vocabulário essencial sobre {topic}.",
                "card_count": len(cards),
                "level": lvl,
                "is_published": True,
                "created_at": cards[0].created_at.isoformat() if cards[0].created_at else datetime.now(timezone.utc).isoformat(),
            })

        filtered.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return filtered

    @staticmethod
    def get_deck_details(deck_id: str) -> dict:
        if str(deck_id).startswith("cefr_fc_"):
            parts = str(deck_id).split("_")
            if len(parts) >= 4:
                lvl = parts[2].upper()
                target_slug = normalize_slug("_".join(parts[3:]))

                cefr_cards = Flashcard.objects.filter(level__iexact=lvl, is_published=True)
                matched = []
                matched_topic = ""
                for c in cefr_cards:
                    t = (c.topic or "General Vocabulary").strip()
                    if normalize_slug(t) == target_slug:
                        matched.append(c)
                        matched_topic = t

                if matched:
                    cards_list = [
                        {
                            "id": str(c.id),
                            "front": c.front,
                            "back": c.back,
                            "explanation": c.explanation or "No explanation provided.",
                            "image_url": c.image_url,
                        }
                        for c in matched
                    ]
                    return {
                        "id": deck_id,
                        "title": f"CEFR {lvl}: {matched_topic}",
                        "description": f"Vocabulary deck about {matched_topic}.",
                        "level": lvl,
                        "flashcards": cards_list,
                        "card_count": len(cards_list),
                        "lessons": [],
                    }

        # Busca módulo físico
        m = Module.objects.filter(id=deck_id).first()
        if m:
            fc = m.flashcards if isinstance(m.flashcards, list) else []
            return {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "level": m.level,
                "flashcards": fc,
                "card_count": len(fc),
                "lessons": [],
            }

        raise HttpError(404, "Deck de flashcards não encontrado.")

    @staticmethod
    def get_friday_review(username: str) -> dict:
        progress_rows = UserFlashcardProgress.objects.filter(user_id=username, status__in=["wrong", "unknown"])
        review_cards = []
        for r in progress_rows:
            try:
                deck = FlashcardService.get_deck_details(r.flashcard_id)
                if deck and deck.get("flashcards"):
                    review_cards.extend(deck["flashcards"][:5])
            except Exception:
                pass

        return {
            "has_review": len(review_cards) > 0,
            "total": len(review_cards),
            "cards": review_cards,
        }

    @staticmethod
    def save_flashcard_progress(username: str, payload: dict) -> dict:
        deck_id = payload.get("deck_id", "")
        card_front = payload.get("card_front", "")
        status = payload.get("status", "correct")

        now = datetime.now(timezone.utc)
        next_review = now + timedelta(days=2) if status == "wrong" else (now + timedelta(days=1) if status == "unknown" else None)

        UserFlashcardProgress.objects.update_or_create(
            user_id=username,
            flashcard_id=deck_id,
            defaults={
                "status": status,
                "next_review_date": next_review,
                "reviewed_at": now,
            }
        )
        return {"ok": True}


class VocabularyService:
    @staticmethod
    def list_vocabulary(username: str) -> dict:
        vocab = UserVocabulary.objects.filter(username=username)
        words = []
        for v in vocab:
            status = "new" if v.repetitions == 0 else ("learned" if v.repetitions >= 4 else "learning")
            words.append({
                "id": str(v.id),
                "term": v.word,
                "translation": v.definition,
                "example": v.example_sentence,
                "status": status,
            })
        return {"words": words, "total": len(words)}

    @staticmethod
    def add_word(username: str, word: str, definition: str = "", example: str = "") -> dict:
        uname = username.username if hasattr(username, "username") else str(username)
        word_clean = (word or "").strip().lower()
        if not word_clean:
            return {"ok": False, "message": "Word is required"}

        vocab, created = UserVocabulary.objects.update_or_create(
            username=uname,
            word=word_clean,
            defaults={
                "definition": definition or "Word added from conversation",
                "example_sentence": example or "",
            }
        )
        return {
            "ok": True,
            "id": str(vocab.id),
            "word": vocab.word,
            "term": vocab.word,
            "definition": vocab.definition,
            "example": vocab.example_sentence,
            "created": created,
        }

    @staticmethod
    def lookup_dictionary(word: str) -> dict:
        import re
        import json
        from groq import Groq
        from apps.chat.services import get_groq_keys

        word_clean = (word or "").strip().lower()
        word_clean = re.sub(r"[^a-z'-]", "", word_clean)
        if not word_clean:
            return {"word": word, "meanings": [], "phonetics": []}

        # Fallback inteligente com Groq caso a API pública de dicionário falhe
        keys = get_groq_keys()
        prompt = (
            f"Provide dictionary details for the English word/term '{word_clean}'. "
            "Return JSON with format:\n"
            "{\n"
            '  "partOfSpeech": "verb/noun/adjective/etc",\n'
            '  "phonetic": "/.../",\n'
            '  "definition": "Clear, concise definition in English",\n'
            '  "example": "Example sentence using the word."\n'
            "}"
        )

        for key in keys:
            try:
                client = Groq(api_key=key)
                res = client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=200,
                    temperature=0.2,
                )
                data = json.loads(res.choices[0].message.content)
                pos = data.get("partOfSpeech", "word")
                phon = data.get("phonetic", "")
                defn = data.get("definition", f"Meaning of {word_clean}")
                ex = data.get("example", f"Example with {word_clean}.")
                return {
                    "word": word_clean,
                    "phonetics": [{"text": phon}],
                    "meanings": [
                        {
                            "partOfSpeech": pos,
                            "definitions": [{"definition": defn, "example": ex}]
                        }
                    ]
                }
            except Exception:
                continue

        return {
            "word": word_clean,
            "phonetics": [],
            "meanings": [
                {
                    "partOfSpeech": "word",
                    "definitions": [{"definition": f"Definition for {word_clean}", "example": ""}]
                }
            ]
        }


class PodcastService:
    @staticmethod
    def get_podcasts(level: str = None, category: str = None) -> list[PodcastOut]:
        qs = Podcast.objects.all()
        if level and level.lower() not in ("all", "any"):
            qs = qs.filter(level__iexact=level)
        if category:
            qs = qs.filter(category__iexact=category)

        items = list(qs[:30])
        if not items:
            return [
                PodcastOut(
                    id="tati_pod_1",
                    title="Real English Conversation with Teacher Tati",
                    description="Listen and learn natural English phrases used daily in conversations.",
                    level=level or "A1",
                    thumbnail="https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=60",
                    embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
                    duration="12:45",
                    category="Conversation",
                    source_name="YouTube",
                    has_full_transcript=False,
                    easy_words=["conversation", "fluent", "daily"],
                ),
                PodcastOut(
                    id="tati_pod_2",
                    title="Business English & Meetings Masterclass",
                    description="Essential vocabulary for job interviews, email writing, and conferences.",
                    level=level or "B1",
                    thumbnail="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=60",
                    embed_url="https://www.youtube.com/embed/dQw4w9WgXcQ",
                    duration="18:30",
                    category="Business",
                    source_name="YouTube",
                    has_full_transcript=False,
                    easy_words=["meeting", "schedule", "deadline"],
                ),
            ]

        return [
            PodcastOut(
                id=p.id,
                title=p.title,
                description=p.description or "",
                level=p.level or "Beginner",
                thumbnail=p.thumbnail,
                embed_url=p.embed_url,
                duration=p.duration or "",
                category=p.category or "General",
                source_name=p.source_name or "YouTube",
                has_full_transcript=p.has_full_transcript,
                easy_words=p.easy_words or [],
            )
            for p in items
        ]

    @staticmethod
    def get_podcast(podcast_id: str) -> PodcastOut:
        p = Podcast.objects.filter(id=podcast_id).first()
        if not p:
            raise HttpError(404, "Podcast não encontrado.")
        return PodcastOut(
            id=p.id,
            title=p.title,
            description=p.description or "",
            level=p.level or "Beginner",
            thumbnail=p.thumbnail,
            embed_url=p.embed_url,
            duration=p.duration or "",
            category=p.category or "General",
            source_name=p.source_name or "YouTube",
            has_full_transcript=p.has_full_transcript,
            easy_words=p.easy_words or [],
        )


class RankingService:
    EXCLUDED_STAFF = {"tatiana", "tati", "programador", "admin", "professor", "professora"}
    EXCLUDED_ROLES = {"admin", "administrator", "programmer", "programador", "teacher", "professor", "professora", "buyer"}

    ACTIVITY_POINTS = {
        "grammar": 12,
        "vocabulary": 10,
        "listening": 10,
        "reading": 8,
        "flashcards": 8,
        "simulations": 8,
        "games": 8,
        "news": 6,
        "quiz": 7,
        "flashcard": 3,
        "message": 8,
        "simulation": 10,
    }

    @classmethod
    def _activity_scores(cls) -> dict[str, int]:
        scores = {}
        rows = list(ActivitySubmission.objects.all())
        for r in rows:
            meta = r.metadata if isinstance(r.metadata, dict) else {}
            if r.score <= 0 or str(meta.get('status') or '').lower() == 'pending':
                continue
            pts = meta.get('points_awarded')
            if pts is None:
                cat = str(meta.get('category') or r.activity_type or '').lower().strip()
                pts = cls.ACTIVITY_POINTS.get(cat, 0)
            pts = int(pts or 0)
            if pts:
                scores[r.username] = scores.get(r.username, 0) + pts

        for u in User.objects.all():
            xp_data = u.xp_data if isinstance(u.xp_data, dict) else {}
            legacy = int(xp_data.get('legacy_competition_points', 0) or 0)
            if legacy:
                scores[u.username] = scores.get(u.username, 0) + legacy

        return scores

    @classmethod
    def _get_students(cls) -> list[dict]:
        scores = cls._activity_scores()
        all_users = User.objects.all()
        user_map = {u.username: u for u in all_users}

        students = []
        for username, user in user_map.items():
            if username.lower() in cls.EXCLUDED_STAFF or (user.role or '').lower() in cls.EXCLUDED_ROLES:
                continue
            score = scores.get(username, 0)
            if score > 0:
                students.append({
                    "username": username,
                    "name": user.name or username,
                    "score": score,
                    "total_xp": score,
                    "level": (user.level or "A1").upper(),
                    "avatar_url": user.avatar_url,
                    "streak_count": user.streak_count,
                })

        return sorted(students, key=lambda x: x["score"], reverse=True)

    @classmethod
    def get_ranking(cls, current_user: User) -> list[RankingUserOut]:
        students = cls._get_students()
        results = []
        for rank, u in enumerate(students[:50], start=1):
            results.append(
                RankingUserOut(
                    position=rank,
                    username=u["username"],
                    name=u["name"],
                    total_xp=u["score"],
                    level=u["level"],
                    avatar_url=u["avatar_url"],
                    streak_count=u["streak_count"],
                    is_current_user=(u["username"] == getattr(current_user, 'username', '')),
                )
            )
        return results

    @classmethod
    def get_top15(cls, current_user: Optional[User] = None) -> list[dict]:
        students = cls._get_students()
        return [
            {
                "position": i + 1,
                "username": u["username"],
                "name": u["name"],
                "score": u["score"],
                "total_xp": u["score"],
                "level": u["level"],
                "avatar_url": u["avatar_url"],
                "streak_count": u["streak_count"],
                "is_current_user": (u["username"] == getattr(current_user, 'username', '')),
            }
            for i, u in enumerate(students[:15])
        ]

    @classmethod
    def get_ranking_by_level(cls, current_user: Optional[User] = None) -> dict:
        students = cls._get_students()
        cefr_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
        result = {lvl: [] for lvl in cefr_levels}

        for u in students:
            lvl = u["level"]
            if lvl not in result:
                lvl = "A1"
            pos = len(result[lvl]) + 1
            result[lvl].append({
                "position": pos,
                "username": u["username"],
                "name": u["name"],
                "score": u["score"],
                "total_xp": u["score"],
                "level": lvl,
                "avatar_url": u["avatar_url"],
                "streak_count": u["streak_count"],
                "is_current_user": (u["username"] == getattr(current_user, 'username', '')),
            })

        user_level = (getattr(current_user, 'level', 'A1') or "A1").upper()
        level_list = result.get(user_level, [])
        my_pos = next((x["position"] for x in level_list if x["username"] == getattr(current_user, 'username', '')), 1)

        return {
            **result,
            "user_level": user_level,
            "my_position": my_pos,
            "top15": cls.get_top15(current_user),
        }

    @classmethod
    def get_user_position(cls, current_user: User) -> dict:
        students = cls._get_students()
        my_pos = next((i + 1 for i, x in enumerate(students) if x["username"] == getattr(current_user, 'username', '')), 0)
        user_score = next((x["score"] for x in students if x["username"] == getattr(current_user, 'username', '')), 0)
        return {
            "position": my_pos,
            "score": user_score,
            "total_students": len(students),
        }


class TrophyService:
    @staticmethod
    def get_trophies(user: User) -> list[TrophyOut]:
        all_trophies = Trophy.objects.all()
        unlocked_ids = set(UserTrophy.objects.filter(username=user.username).values_list('trophy_id', flat=True))

        results = []
        for t in all_trophies:
            is_unlocked = str(t.id) in unlocked_ids
            results.append(
                TrophyOut(
                    id=str(t.id),
                    name=t.name,
                    description=t.description or "",
                    icon=t.icon or "🏆",
                    category=t.category or "general",
                    is_unlocked=is_unlocked,
                )
            )
        return results


class HubService:
    @staticmethod
    def list_materials(user: Optional[User], category: str = None) -> list[HubMaterialOut]:
        qs = PremiumContent.objects.filter(is_active=True)
        if category:
            qs = qs.filter(category__iexact=category)

        can_access_all = False
        purchased_ids = set()

        if user and isinstance(user, User):
            if user.role in ('programador', 'professor', 'admin', 'Admin') or user.username in ('programador', 'admin', 'professor', 'professora'):
                can_access_all = True
            else:
                try:
                    from apps.payments.models import PremiumPurchase, Order
                    purchased_ids.update(
                        str(cid) for cid in PremiumPurchase.objects.filter(
                            username=user.username, status='confirmed'
                        ).values_list('content_id', flat=True)
                    )
                    confirmed_orders = Order.objects.filter(username=user.username, status='confirmed').values_list('id', flat=True)
                    if confirmed_orders:
                        from django.db import connection
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT content_id FROM order_items WHERE order_id = ANY(%s)",
                                [list(confirmed_orders)]
                            )
                            purchased_ids.update(str(row[0]) for row in cursor.fetchall())
                except Exception as e:
                    logger.warning(f"[Hub] Erro ao buscar compras do usuário {user.username}: {e}")

        return [
            HubMaterialOut(
                id=str(m.id),
                title=m.title,
                description=m.description or "",
                price=float(m.price or 0.0),
                type=m.type or "book",
                thumbnail_url=m.thumbnail_url,
                emoji=m.emoji or "📚",
                category=m.category or "materials",
                is_featured=m.is_featured,
                is_secure=m.is_secure,
                has_access=can_access_all or (str(m.id) in purchased_ids) or float(m.price or 0.0) == 0.0,
            )
            for m in qs
        ]

    @staticmethod
    def get_content_access(user: Optional[User], content_id: str) -> dict:
        item = PremiumContent.objects.filter(id=content_id).first()
        if not item:
            raise HttpError(404, "Material não encontrado.")

        has_access = False
        if user and isinstance(user, User):
            if user.role in ('programador', 'professor', 'admin', 'Admin') or user.username in ('programador', 'admin', 'professor', 'professora'):
                has_access = True
            else:
                try:
                    from apps.payments.models import PremiumPurchase, Order
                    has_purchase = PremiumPurchase.objects.filter(username=user.username, content_id=content_id, status='confirmed').exists()
                    has_order = False
                    confirmed_orders = Order.objects.filter(username=user.username, status='confirmed').values_list('id', flat=True)
                    if confirmed_orders:
                        from django.db import connection
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT 1 FROM order_items WHERE order_id = ANY(%s) AND content_id = %s LIMIT 1",
                                [list(confirmed_orders), content_id]
                            )
                            has_order = cursor.fetchone() is not None
                    has_access = has_purchase or has_order
                except Exception as e:
                    logger.warning(f"[Hub] Erro ao validar acesso: {e}")
        else:
            if float(item.price or 0.0) == 0.0:
                has_access = True

        if not has_access and float(item.price or 0.0) > 0:
            raise HttpError(403, "Acesso bloqueado. Adquira o material no Hub ou assine o plano.")

        # 1. Checa se o material é do tipo documento seguro com páginas
        from apps.activities.secure_document_service import get_client, _RAW_IMAGE_CACHE
        import json

        secure_pages = []
        raw_pages = getattr(item, 'secure_pages', None)
        if not raw_pages:
            try:
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("SELECT secure_pages, processing_status FROM premium_content WHERE id = %s", [content_id])
                    row = cursor.fetchone()
                    if row and row[0]:
                        raw_pages = row[0]
            except Exception as e:
                logger.warning(f"[Hub] Erro ao buscar secure_pages: {e}")

        if raw_pages:
            if isinstance(raw_pages, str):
                try:
                    secure_pages = json.loads(raw_pages)
                except Exception:
                    secure_pages = []
            elif isinstance(raw_pages, list):
                secure_pages = list(raw_pages)

        external_links = []
        if secure_pages and isinstance(secure_pages[-1], str) and secure_pages[-1].startswith('{"external_links"'):
            try:
                meta = json.loads(secure_pages.pop())
                external_links = meta.get("external_links", [])
            except Exception:
                pass

        if secure_pages:
            base_url = os.getenv("API_URL", "https://caio007-tati-ai-backend.hf.space").rstrip('/')
            page_urls = [
                f"{base_url}/activities/hub/{content_id}/pages/{i}"
                for i in range(len(secure_pages))
            ]
            return {
                "type": "secure_images",
                "pages": page_urls,
                "total_pages": len(page_urls),
                "is_secure_viewer": True,
                "title": item.title,
                "external_links": external_links,
                "has_access": True,
            }

        # 2. Se for arquivo direto (PPTX, PDF no Storage)
        source = item.content_source or item.preview_path or ""
        if source and not source.startswith("http"):
            try:
                db = get_client()
                res = db.storage.from_("module-files").create_signed_url(source, 3600)
                if res and isinstance(res, dict) and res.get("signedURL"):
                    source = res["signedURL"]
            except Exception as e:
                logger.warning(f"[Hub] Erro ao gerar signed URL para {source}: {e}")

        return {
            "url": source,
            "type": "direct",
            "title": item.title,
            "has_access": True,
            "is_secure_viewer": False,
            "is_secure": bool(item.is_secure),
        }

    @classmethod
    def process_checkout(cls, user: Optional[User], payload: dict) -> dict:
        content_id = payload.get("content_id")
        item = PremiumContent.objects.filter(id=content_id).first()
        if not item:
            raise HttpError(404, "Material não encontrado.")

        clean_email = (payload.get("email") or getattr(user, 'email', '') or '').strip().lower()
        clean_name = (payload.get("name") or getattr(user, 'name', '') or '').strip()
        raw_doc = "".join(filter(str.isdigit, str(payload.get("cpf") or getattr(user, 'cpf', '') or getattr(user, 'cpf_cnpj', '') or '')))
        billing_type = str(payload.get("billingType") or "PIX").upper()

        if user and isinstance(user, User):
            target_user = user
        else:
            target_user = User.objects.filter(email=clean_email).first()
            if not target_user:
                base_username = clean_email.split('@')[0] if clean_email else "buyer"
                username = f"hub_{base_username}_{datetime.now().strftime('%H%M%S')}"
                target_user = User.objects.create(
                    username=username,
                    name=clean_name or username,
                    email=clean_email,
                    role="buyer",
                    cpf=raw_doc,
                    cpf_cnpj=raw_doc,
                )

        role = getattr(target_user, 'role', 'buyer')
        if role != 'buyer':
            price = float(item.price_students or item.price or 0.0)
        else:
            price = float(item.price_buyers or item.price or 0.0)

        if price <= 0:
            raise HttpError(400, "Material sem preço configurado para compra.")

        from apps.payments.services import MercadoPagoService
        from apps.payments.models import Order
        import uuid

        if billing_type == "PIX":
            from apps.payments.schemas import CreatePixInput
            pix_in = CreatePixInput(
                amount=price,
                description=f"Material Hub: {item.title}",
                target_id=str(item.id),
                target_type="hub",
            )
            pix_res = MercadoPagoService.create_pix_payment(target_user, pix_in)
            
            order_id = uuid.uuid4()
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO orders (id, username, total_amount, status, payment_method, asaas_id, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())",
                    [order_id, target_user.username, price, 'pending', 'PIX', pix_res.payment_id]
                )
                cursor.execute(
                    "INSERT INTO order_items (id, order_id, content_id, price, created_at) VALUES (%s, %s, %s, %s, NOW())",
                    [uuid.uuid4(), order_id, item.id, price]
                )

            return {
                "orderId": str(order_id),
                "paymentId": str(pix_res.payment_id),
                "invoiceUrl": pix_res.ticket_url,
                "pix": {
                    "qrCode": pix_res.qr_code_base64 or pix_res.qr_code,
                    "copyPaste": pix_res.qr_code,
                },
                "username": target_user.username,
                "password": None,
            }
        else:
            from apps.payments.schemas import CreatePreferenceInput
            pref_in = CreatePreferenceInput(
                amount=price,
                title=f"Material Hub: {item.title}",
                target_id=str(item.id),
                target_type="hub",
            )
            pref_res = MercadoPagoService.create_preference(target_user, pref_in)

            order_id = uuid.uuid4()
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "INSERT INTO orders (id, username, total_amount, status, payment_method, asaas_id, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())",
                    [order_id, target_user.username, price, 'pending', 'DEBIT_CARD', pref_res.preference_id]
                )
                cursor.execute(
                    "INSERT INTO order_items (id, order_id, content_id, price, created_at) VALUES (%s, %s, %s, %s, NOW())",
                    [uuid.uuid4(), order_id, item.id, price]
                )

            return {
                "orderId": str(order_id),
                "paymentId": str(pref_res.preference_id),
                "invoiceUrl": pref_res.init_point or pref_res.sandbox_init_point,
                "pix": None,
                "username": target_user.username,
                "password": None,
            }

    @classmethod
    def cancel_checkout(cls, payment_id: str) -> dict:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute("UPDATE orders SET status = 'cancelled' WHERE asaas_id = %s", [payment_id])
            cursor.execute("UPDATE premium_purchases SET status = 'revoked' WHERE asaas_payment_id = %s", [payment_id])
        return {"ok": True, "message": "Pedido cancelado com sucesso."}

    @classmethod
    def get_checkout_status(cls, payment_id: str) -> dict:
        from apps.payments.services import MercadoPagoService
        import uuid
        status_res = MercadoPagoService.get_payment_status(payment_id)
        if status_res.is_approved:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("UPDATE orders SET status = 'confirmed', confirmed_at = NOW() WHERE asaas_id = %s", [payment_id])
                cursor.execute("SELECT username, id FROM orders WHERE asaas_id = %s LIMIT 1", [payment_id])
                row = cursor.fetchone()
                if row:
                    uname, o_id = row
                    cursor.execute("SELECT content_id FROM order_items WHERE order_id = %s", [o_id])
                    for i_row in cursor.fetchall():
                        cid = i_row[0]
                        cursor.execute(
                            "INSERT INTO premium_purchases (id, username, content_id, status, asaas_payment_id, created_at) VALUES (%s, %s, %s, %s, %s, NOW()) ON CONFLICT DO NOTHING",
                            [uuid.uuid4(), uname, cid, 'confirmed', payment_id]
                        )
        return {
            "status": "confirmed" if status_res.is_approved else status_res.status,
            "is_approved": status_res.is_approved,
            "paymentId": payment_id,
        }


class SpeechService:
    @staticmethod
    def verify_pronunciation(
        target: Optional[str] = None,
        spoken: Optional[str] = None,
        threshold: float = 70.0,
        audio_b64: Optional[str] = None,
        reference_text: Optional[str] = None,
    ) -> PronunciationVerifyOut:
        import re
        from apps.chat.audio_service import AudioService

        target_phrase = (reference_text or target or "").strip()
        spoken_phrase = (spoken or "").strip()

        if audio_b64 and not spoken_phrase:
            try:
                spoken_phrase = AudioService.transcribe_audio(audio_b64) or ""
            except Exception as e:
                logger.warning(f"Error transcribing pronunciation audio: {e}")
                spoken_phrase = ""

        clean_target = re.sub(r'[^\w\s]', '', target_phrase.lower()).strip()
        clean_spoken = re.sub(r'[^\w\s]', '', spoken_phrase.lower()).strip()

        target_words = target_phrase.split() if target_phrase else (spoken_phrase.split() if spoken_phrase else [])
        spoken_words = spoken_phrase.split() if spoken_phrase else []

        words_out = []
        for tw in target_words:
            clean_tw = re.sub(r'[^\w\s]', '', tw.lower())
            best_match = 0.0
            for sw in spoken_words:
                clean_sw = re.sub(r'[^\w\s]', '', sw.lower())
                m = difflib.SequenceMatcher(None, clean_tw, clean_sw).ratio()
                if m > best_match:
                    best_match = m

            w_score = round(best_match * 100, 1)
            words_out.append(WordResultOut(
                word=tw,
                score=w_score,
                accuracy="correct" if w_score >= 65.0 else "incorrect",
            ))

        if clean_target and clean_spoken:
            ratio = difflib.SequenceMatcher(None, clean_target, clean_spoken).ratio()
            score = round(ratio * 100, 1)
        elif not clean_target and clean_spoken:
            score = 100.0
        else:
            score = 0.0

        is_correct = score >= threshold

        if score >= 85:
            feedback = "Excellent pronunciation! Very clear, natural and well-articulated."
        elif score >= 60:
            feedback = "Good attempt! Keep practicing word stress and vowel sounds."
        else:
            feedback = "Sentence was a bit unclear. Listen to Teacher Tati's audio and try repeating once more."

        correct_audio = ""
        if target_phrase:
            try:
                correct_audio = AudioService.text_to_speech(target_phrase)
            except Exception as e:
                logger.warning(f"Error generating correct audio TTS: {e}")

        return PronunciationVerifyOut(
            score=score,
            transcription=spoken_phrase,
            words=words_out,
            feedback=feedback,
            correct_audio=correct_audio,
            target=target_phrase,
            recognized=spoken_phrase,
            is_correct=is_correct,
            metadata={"accuracy_score": score, "fluency_score": max(50.0, score)},
        )


class SubmissionService:
    @staticmethod
    def get_user_submissions(username: str) -> list[dict]:
        subs = list(ActivitySubmission.objects.filter(username=username).order_by('-created_at'))
        return [
            {
                "id": str(s.id),
                "activity_id": s.metadata.get("activity_id") if isinstance(s.metadata, dict) else (str(s.module_id) if s.module_id else str(s.id)),
                "module_id": str(s.module_id) if s.module_id else None,
                "activity_type": s.activity_type,
                "score": s.score,
                "status": s.status,
                "metadata": s.metadata or {},
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ]

    @staticmethod
    def submit_activity(user: Optional[User], data: dict) -> dict:
        username = user.username if user and isinstance(user, User) else "aluno"
        activity_id = data.get("activity_id") or data.get("module_id") or ""
        activity_type = data.get("activity_type", "exercise")
        score = int(data.get("score", 100))
        metadata = data.get("metadata") or data.get("details") or {}
        if activity_id and "activity_id" not in metadata:
            metadata["activity_id"] = str(activity_id)

        target_url = metadata.get("url") or str(activity_id)
        target_slug = metadata.get("slug") or str(activity_id)
        status_req = metadata.get("status") or data.get("status") or ("completed" if score > 0 else "pending")

        # 1. Se for marcar como PENDENTE (Reverter)
        if status_req == "pending" or score <= 0:
            from django.db.models import Q
            ActivitySubmission.objects.filter(
                Q(username=username) & (
                    Q(metadata__activity_id=str(activity_id)) |
                    Q(metadata__url=target_url) |
                    Q(metadata__slug=target_slug)
                )
            ).delete()

            total_xp = user.total_xp if user and isinstance(user, User) else 0
            streak_count = user.streak_count if user and isinstance(user, User) else 0

            return {
                "success": True,
                "status": "pending",
                "message": "Atividade revertida para pendente.",
                "xp_earned": 0,
                "new_total_xp": total_xp,
                "streak_count": streak_count,
            }

        # 2. Se for marcar como CONCLUÍDO
        from django.db.models import Q
        ActivitySubmission.objects.filter(
            Q(username=username) & (
                Q(metadata__activity_id=str(activity_id)) |
                Q(metadata__url=target_url) |
                Q(metadata__slug=target_slug)
            )
        ).delete()

        xp_earned = 15 if score >= 70 else 5
        if user and isinstance(user, User):
            XPService.award_xp(user, xp_earned, f"Atividade {activity_type}")
            StreakService.record_activity(user)

        submission = ActivitySubmission.objects.create(
            username=username,
            activity_type=activity_type,
            score=score,
            status="completed",
            metadata=metadata,
        )

        total_xp = user.total_xp if user and isinstance(user, User) else 15
        streak_count = user.streak_count if user and isinstance(user, User) else 1

        return {
            "success": True,
            "id": str(submission.id),
            "xp_earned": xp_earned,
            "new_total_xp": total_xp,
            "streak_count": streak_count,
            "status": "completed",
        }


class ExternalContentService:
    DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
    TE_LEVELS = ["A1", "A2", "B1", "B1+", "B2", "C1"]
    TE_CATEGORIES = {"grammar": "grammar-points", "vocabulary": "vocabulary", "listening": "listening", "reading": "reading"}

    @classmethod
    def get_test_english_content(cls, level: str = "A1", category: str = "grammar") -> dict:
        data_file = os.path.join(cls.DATA_DIR, "te_english_data.json")
        if not os.path.exists(data_file):
            return {"success": True, "level": level, "category": category, "items": []}

        import json
        with open(data_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        cat = category.lower()
        cat_slug = cls.TE_CATEGORIES.get(cat, cat)
        cat_data = data.get(cat, {})

        enriched = []
        if level.lower() in ("all", "any"):
            for lvl in cls.TE_LEVELS:
                for it in cat_data.get(lvl, []):
                    slug = it.get("slug", "")
                    url = f"https://test-english.com/{cat_slug}/{lvl.lower()}/{slug}/"
                    enriched.append({**it, "url": url, "level": lvl})
        else:
            level_code = level.upper()
            for it in cat_data.get(level_code, []):
                slug = it.get("slug", "")
                url = f"https://test-english.com/{cat_slug}/{level.lower()}/{slug}/"
                enriched.append({**it, "url": url, "level": level_code})

        return {
            "success": True,
            "level": level,
            "category": category,
            "items": enriched,
            "source": "test-english.com",
        }

    @classmethod
    def get_liveworksheets_content(cls, level: str = "A1", category: str = "general") -> dict:
        data_file = os.path.join(cls.DATA_DIR, "liveworksheets_data.json")
        if not os.path.exists(data_file):
            return {"success": True, "level": level, "category": category, "items": [], "worksheets": []}

        import json
        with open(data_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        cat = category.lower() if category.lower() in data else "grammar"
        cat_data = data.get(cat, {})
        lw_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

        enriched = []
        if level.lower() in ("all", "any"):
            for lvl in lw_levels:
                for it in cat_data.get(lvl, []):
                    enriched.append({**it, "level": lvl})
        else:
            level_code = level.upper()
            for it in cat_data.get(level_code, []):
                enriched.append({**it, "level": level_code})

        return {
            "success": True,
            "level": level,
            "category": category,
            "items": enriched,
            "worksheets": enriched,
            "source": "liveworksheets.com",
        }
