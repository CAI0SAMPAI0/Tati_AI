from supabase import Client
from app.core.database import get_client


def get_db() -> Client:
    """
    Dependência para obter uma instância do cliente Supabase.
    """
    return get_client()
