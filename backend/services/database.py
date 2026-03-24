import os
import hashlib
import bcrypt
from supabase import create_client, Client


def get_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    return create_client(url, key)


async def authenticate_user(identifier: str, password: str) -> dict | None:
    """
    Aceita username OU email como identificador.
    Também bloqueia login com senha para contas Google.
    """
    db = get_client()

    # Tenta pelo username primeiro
    rows = (
        db.table("users")
        .select("username, name, email, password, role, level, focus")
        .eq("username", identifier.lower())
        .limit(1)
        .execute()
        .data
    )

    # Se não achou pelo username, tenta pelo email
    if not rows:
        rows = (
            db.table("users")
            .select("username, name, email, password, role, level, focus")
            .eq("email", identifier.lower())
            .limit(1)
            .execute()
            .data
        )

    if not rows:
        return None

    user = rows[0]
    stored = user["password"]

    # Conta criada via Google não tem senha local
    if stored == "google_authenticated":
        return None

    # Aceita bcrypt (novo) e SHA-256 (legado do Streamlit)
    if stored.startswith("$2"):
        valid = bcrypt.checkpw(password.encode(), stored.encode())
    else:
        valid = hashlib.sha256(password.encode()).hexdigest() == stored

    if not valid:
        return None

    return {k: v for k, v in user.items() if k != "password"}