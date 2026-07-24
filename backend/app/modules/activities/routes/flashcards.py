import logging
from datetime import datetime, timedelta, timezone

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from app.core.utils.level_utils import matches_level
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

router = APIRouter()


class FlashcardProgressPayload(BaseModel):
    deck_id: str
    card_front: str
    status: str  # 'correct' | 'wrong' | 'unknown'


@router.get("/my")
async def get_my_flashcards(
    level: str | None = Query(None), user=Depends(get_current_user)
):
    """Retorna flashcards do usuário filtrados por nível."""
    db = get_client()
    # Se um level for passado (ex: filtro do dashboard), usa-o; senão usa o nível do usuário
    user_level = level if level else user.get("level")

    try:
        res = (
            db.table("modules")
            .select("*")
            .not_.is_("flashcards", "null")
            .eq("is_published", True)
            .neq("id", "00000000-0000-0000-0000-000000000001")
            .order("created_at", desc=True)
            .execute()
        )
        data = res.data or []

        filtered = []
        for d in data:
            if matches_level(user_level, d.get("level"), d.get("levels")):
                fc = d.get("flashcards")
                d["card_count"] = len(fc) if isinstance(fc, list) else 0
                filtered.append(d)

        # Fetch and append published CEFR virtual flashcard decks
        try:
            cefr_res = (
                db.table("cefr_flashcards")
                .select("*")
                .eq("is_published", True)
                .execute()
            )
            cefr_data = cefr_res.data or []

            import re
            from collections import defaultdict

            grouped_cf = defaultdict(list)
            for row in cefr_data:
                row_level = row.get("level", "A1")
                if matches_level(user_level, row_level):
                    topic = row.get("topic") or "General Vocabulary"
                    grouped_cf[(row_level, topic)].append(row)

            for (lvl, topic), cards in grouped_cf.items():
                topic_slug = re.sub(r"[^a-zA-Z0-9]", "_", topic.lower())
                deck_id = f"cefr_fc_{lvl.lower()}_{topic_slug}"
                filtered.append(
                    {
                        "id": deck_id,
                        "title": f"CEFR {lvl}: {topic}",
                        "description": f"Vocabulary deck about {topic}.",
                        "card_count": len(cards),
                        "level": lvl,
                        "is_published": True,
                        "created_at": cards[0].get("created_at")
                        or datetime.now(timezone.utc).isoformat(),
                    }
                )
        except Exception as cefr_err:
            logging.info(
                f"[FlashcardsRouter] Erro ao buscar cefr_flashcards: {cefr_err}"
            )

        filtered.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        return filtered
    except Exception as e:
        logging.info(f"[FlashcardsRouter] Erro: {e}")
        return []


@router.post("/progress")
async def save_flashcard_progress(
    payload: FlashcardProgressPayload, user=Depends(get_current_user)
):
    """Salva o resultado de um card (correto, errado, não sei)."""
    db = get_client()
    username = user.get("username")

    # Calculate next review date using simple spaced repetition
    now = datetime.now(timezone.utc)
    if payload.status == "correct":
        next_review = None  # Correct: no forced review needed
    elif payload.status == "wrong":
        next_review = (now + timedelta(days=2)).isoformat()  # Review in 2 days
    else:  # unknown
        next_review = (now + timedelta(days=1)).isoformat()  # Review tomorrow

    try:
        # Upsert: update if exists, insert if not
        existing = (
            db.table("user_flashcard_progress")
            .select("id")
            .eq("username", username)
            .eq("deck_id", payload.deck_id)
            .eq("card_front", payload.card_front)
            .execute()
        )

        record = {
            "username": username,
            "deck_id": payload.deck_id,
            "card_front": payload.card_front,
            "status": payload.status,
            "next_review_date": next_review,
            "reviewed_at": now.isoformat(),
        }

        if existing.data:
            db.table("user_flashcard_progress").update(record).eq(
                "id", existing.data[0]["id"]
            ).execute()
        else:
            db.table("user_flashcard_progress").insert(record).execute()

        return {"ok": True}
    except Exception as e:
        logging.info(f"[FlashcardsProgress] Erro: {e}")
        return {"ok": False, "error": str(e)}


@router.get("/review/friday")
async def get_friday_review(user=Depends(get_current_user)):
    """
    Retorna um deck de revisão com os cards que o aluno errou ou não sabia.
    Usado principalmente nas sextas-feiras para reforço.
    Nunca repete cards que o aluno acertou.
    """
    db = get_client()
    username = user.get("username")

    try:
        # Get cards marked 'wrong' or 'unknown'
        res = (
            db.table("user_flashcard_progress")
            .select("*")
            .eq("username", username)
            .in_("status", ["wrong", "unknown"])
            .execute()
        )
        progress_rows = res.data or []

        if not progress_rows:
            return {"has_review": False, "cards": [], "total": 0}

        # For each failed card, try to get full card data from the deck
        # module
        review_cards = []
        deck_cache: dict = {}

        for row in progress_rows:
            deck_id = row.get("deck_id")
            card_front = row.get("card_front")

            if deck_id not in deck_cache:
                deck_res = (
                    db.table("modules")
                    .select("flashcards, title")
                    .eq("id", deck_id)
                    .execute()
                )
                deck_cache[deck_id] = deck_res.data[0] if deck_res.data else None

            deck_data = deck_cache.get(deck_id)
            if not deck_data or not deck_data.get("flashcards"):
                continue

            # Find the specific card
            matching = [
                c for c in deck_data["flashcards"] if c.get("front") == card_front
            ]
            if matching:
                card = matching[0]
                card["_deck_title"] = deck_data.get("title", "")
                card["_status"] = row.get("status")
                card["_deck_id"] = deck_id
                review_cards.append(card)

        return {
            "has_review": len(review_cards) > 0,
            "total": len(review_cards),
            "cards": review_cards,
        }
    except Exception as e:
        logging.info(f"[FridayReview] Erro: {e}")
        return {"has_review": False, "cards": [], "total": 0, "error": str(e)}
