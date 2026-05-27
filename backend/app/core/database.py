''' O cliente só é criado na primeira chamada a get_client(),
não durante o import do módulo. Isso evita problemas de conexão durante o desenvolvimento
com hot reload, onde o módulo pode ser recarregado várias vezes.
Garante que existe apenas UMA conexão durante toda a vida
do processo, com reconnect automático em caso de falha.
'''

from __future__ import annotations

from supabase import Client, create_client
from app.core.config import settings


# acessa o supabase e evita bug de reconexão
_client: Client | None = None


def get_client() -> Client:
    """
    Retorna o cliente Supabase singleton.
    Cria na primeira chamada, reutiliza nas seguintes.
    Thread-safe para leitura (FastAPI é single-threaded no event loop).
    """
    global _client
    if _client is None:
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_key or settings.supabase_key,
        )
    return _client

def reset_client() -> None:
    """
    Reseta o cliente Supabase, forçando a criação de um novo na próxima chamada.
    Útil para testes ou em casos de falha de conexão.
    """
    global _client
    _client = None


async def keep_alive_ping() -> bool:
    """
    Query mínima para manter a conexão TCP viva.
    Retorna True se a conexão está saudável.
    """
    try:
        get_client().table('users').select('username').limit(1).execute()
        return True
    except Exception as exc:
        print(f'[DB Keepalive] Falha, resetando cliente: {exc}')
        reset_client()
        return False