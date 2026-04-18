from functools import lru_cache
from supabase import Client, create_client
from core.config import settings

# acessa o supabase e evita bug de reconexão

_client: Client = None

def get_client() -> Client:
    global _client
    if _client is None:
        try:
            _client = create_client(settings.supabase_url, settings.supabase_key)
        except Exception as e:
            print(f"[Database] Erro ao criar cliente: {e}")
            _client = create_client(settings.supabase_url, settings.supabase_key)
    return _client
