from app.core.database import get_client
from supabase import Client


def get_db() -> Client:
    """
    Dependência para obter uma instância do cliente Supabase.
    """
    return get_client()
