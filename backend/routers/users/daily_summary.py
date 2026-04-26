"""
Router de resumo diário/semanal de progresso — alimenta o badge flutuante do chat.

Endpoints:
  GET /users/progress/daily-summary
    → words_today: int   (palavras únicas novas aprendidas hoje)
    → messages_week: int (mensagens do usuário nos últimos 7 dias)
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from routers.deps import get_current_user
from services.database import get_client
from services.upstash import cache_get, cache_set

router = APIRouter()


@router.get("/users/progress/daily-summary")
async def get_daily_summary(current_user: dict = Depends(get_current_user)):
    """
    Resumo leve de progresso diário/semanal para o badge flutuante.
    Cache curto (2 min) para parecer quase real-time sem sobrecarregar o banco.
    """
    username = current_user["username"]
    cache_key = f"daily_summary:{username}"

    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # ── Mensagens da semana ───────────────────────────────────────────────────
    try:
        msgs = (
            db.table("messages")
            .select("id")
            .eq("username", username)
            .eq("role", "user")
            .gte("created_at", week_ago.isoformat())
            .execute()
            .data
        )
        messages_week = len(msgs) if msgs else 0
    except Exception:
        messages_week = 0

    # ── Palavras novas hoje ───────────────────────────────────────────────────
    # Tenta tabela de vocabulário primeiro
    words_today = 0
    try:
        vocab = (
            db.table("user_vocabulary")
            .select("word")
            .eq("username", username)
            .gte("created_at", today_start.isoformat())
            .execute()
            .data
        )
        if vocab:
            words_today = len({row["word"].lower() for row in vocab if row.get("word")})
    except Exception:
        # Fallback: conta palavras únicas das mensagens de hoje do assistente
        try:
            bot_msgs = (
                db.table("messages")
                .select("content")
                .eq("username", username)
                .eq("role", "assistant")
                .gte("created_at", today_start.isoformat())
                .execute()
                .data
            )
            # Heurística simples: estima palavras novas como 10% das palavras únicas
            # do assistente (sem acesso ao histórico completo aqui)
            if bot_msgs:
                all_words: set[str] = set()
                for msg in bot_msgs:
                    content = msg.get("content", "") or ""
                    for w in content.split():
                        clean = w.strip(".,!?;:\"'()[]").lower()
                        if len(clean) > 3:  # ignora palavras muito curtas
                            all_words.add(clean)
                words_today = max(0, len(all_words) // 10)
        except Exception:
            words_today = 0

    result = {
        "words_today": words_today,
        "messages_week": messages_week,
    }

    await cache_set(cache_key, result, ttl=120)  # 2 minutos
    return result