import uuid
from datetime import datetime, timezone
from services.database import get_client


def _now() -> str:
    """Retorna timestamp atual como string ISO."""
    return datetime.now(timezone.utc).isoformat()


def _make_conv_id(username: str) -> str:
    """Gera id no mesmo padrão do banco: YYYYMMDD_HHMMSS."""
    return datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S") + f"_{username[:6]}"


# ─── Conversations ────────────────────────────────────────────────────────────

async def create_conversation(username: str, title: str = "Nova conversa", model: str = "claude", is_simulation: bool = False) -> dict:
    db = get_client()
    new_id = _make_conv_id(username)
    data = {
        "id": new_id,
        "username": username,
        "title": title,
        "model": model,
        "is_simulation": is_simulation,
        "created_at": _now(),
        "updated_at": _now(),
    }
    result = db.table("conversations").insert(data).execute()
    return result.data[0]


async def list_conversations(username: str) -> list[dict]:
    db = get_client()
    result = (
        db.table("conversations")
        .select("id, title, model, created_at, updated_at")
        .eq("username", username)
        .eq("is_simulation", False)
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data


async def delete_conversation(conversation_id: str, username: str) -> bool:
    db = get_client()
    # Tenta deletar mensagens primeiro
    try:
        db.table("messages").delete().eq("session_id", conversation_id).execute()
    except:
        pass
        
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
    try:
        db = get_client()
        # O nome da coluna link no seu banco é session_id (tipo text)
        result = (
            db.table("messages")
            .select("role, content, audio_b64, created_at")
            .eq("session_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        return result.data or []
    except Exception as e:
        print(f"ERROR [load_history]: {e}")
        return []


async def save_message(conversation_id: str, username: str, role: str, content: str, audio_b64: str = None) -> dict:
    try:
        db = get_client()
        now = datetime.now(timezone.utc)
        content = content.replace("\x00", "").replace("\u0000", "")
        msg = {
            "session_id": conversation_id,
            "username": username,
            "role": role,
            "content": content,
            "date": now.strftime("%Y-%m-%d"),
        }
        
        # Salva áudio se fornecido
        if audio_b64:
            msg["audio_b64"] = audio_b64
        
        result = db.table("messages").insert(msg).execute()

        # Atualiza updated_at da conversa
        db.table("conversations").update(
            {"updated_at": _now()}
        ).eq("id", conversation_id).execute()

        return result.data[0] if result.data else {}
    except Exception as e:
        print(f"ERROR [save_message]: {e}")
        # Se falhar por FK com 'sessions', avisamos o log
        if "sessions" in str(e).lower():
            print("CRITICAL: A tabela 'messages' tem uma FK para 'sessions' mas estamos tentando linkar com 'conversations'.")
        raise e


async def auto_title(conversation_id: str, username: str, first_message: str) -> None:
    title = first_message.strip()[:60]
    if len(first_message.strip()) > 60:
        title += "…"
    await rename_conversation(conversation_id, username, title)