import os
import hashlib
import bcrypt
from supabase import create_client, Client


def get_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    return create_client(url, key)


async def authenticate_user(username: str, password: str) -> dict | None:
    db = get_client()

    rows = (
        db.table("users")
        .select("username, name, password, role, level, focus")
        .eq("username", username.lower())
        .limit(1)
        .execute()
        .data
    )

    if not rows:
        return None

    user = rows[0]
    stored = user["password"]

    # Aceita bcrypt (novo) e SHA-256 (legado do Streamlit)
    if stored.startswith("$2"):
        valid = bcrypt.checkpw(password.encode(), stored.encode())
    else:
        valid = hashlib.sha256(password.encode()).hexdigest() == stored

    if not valid:
        return None

    # Remove a senha antes de retornar
    return {k: v for k, v in user.items() if k != "password"}