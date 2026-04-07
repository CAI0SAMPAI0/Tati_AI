from functools import lru_cache
from supabase import Client, create_client
from core.config import settings

# acessa o supabase e evita bug de reconexão 
 
@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)