"""
Gerencia histórico de conversas no Supabase.

Schema real:
  conversations: id (text PK), username (text PK), created_at (text),
                 title (text), model (text), updated_at (text)

  messages: id (int8 PK autoincrement), conv_id (text), username (text),
            role (text), content (text), audio (bool), is_file (bool),
            tts_b64 (text), time (text), date (text), timestamp (text)
"""

from datetime import datetime, timezone
from services.database import get_client


def _now() -> str:
    """Retorna timestamp atual como string ISO, igual ao padrão já usado no banco."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")


def _make_conv_id(username: str) -> str:
    """Gera id no mesmo padrão do banco: YYYYMMDD_HHMMSS."""
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + f"_{username[:6]}"


# ─── Conversations ────────────────────────────────────────────────────────────

async def create_conversation(username: str, title: str = "Nova conversa", model: str = "claude") -> dict:
    db = get_client()
    now = _now()
    data = {
        "id": _make_conv_id(username),
        "username": username,
        "title": title,
        "model": model,
        "created_at": now,
        "updated_at": now,
    }
    result = db.table("conversations").insert(data).execute()
    return result.data[0]


async def list_conversations(username: str) -> list[dict]:
    db = get_client()
    result = (
        db.table("conversations")
        .select("id, title, model, created_at, updated_at")
        .eq("username", username)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


async def delete_conversation(conversation_id: str, username: str) -> bool:
    db = get_client()
    result = (
        db.table("conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("username", username)
        .execute()
    )
    return len(result.data) > 0


async def rename_conversation(conversation_id: str, username: str, new_title: str) -> dict | None:
    db = get_client()
    result = (
        db.table("conversations")
        .update({"title": new_title, "updated_at": _now()})
        .eq("id", conversation_id)
        .eq("username", username)
        .execute()
    )
    return result.data[0] if result.data else None


# ─── Messages ─────────────────────────────────────────────────────────────────

async def load_history(conversation_id: str) -> list[dict]:
    """Carrega mensagens no formato esperado pela LLM: role + content."""
    db = get_client()
    result = (
        db.table("messages")
        .select("role, content")
        .eq("conv_id", conversation_id)
        .order("id", desc=False)   # id int8 autoincrement = ordem de inserção
        .execute()
    )
    return result.data


async def save_message(conversation_id: str, username: str, role: str, content: str) -> dict:
    db = get_client()
    now = datetime.now(timezone.utc)
    msg = {
        "conv_id": conversation_id,
        "username": username,
        "role": role,
        "content": content,
        "audio": False,
        "is_file": False,
        "time": now.strftime("%H:%M:%S"),
        "date": now.strftime("%Y-%m-%d"),
        "timestamp": now.strftime("%Y-%m-%dT%H:%M:%S.%f"),
    }
    result = db.table("messages").insert(msg).execute()

    # Atualiza updated_at da conversa
    db.table("conversations").update(
        {"updated_at": _now()}
    ).eq("id", conversation_id).execute()

    return result.data[0]


async def auto_title(conversation_id: str, username: str, first_message: str) -> None:
    title = first_message.strip()[:60]
    if len(first_message.strip()) > 60:
        title += "…"
    await rename_conversation(conversation_id, username, title)