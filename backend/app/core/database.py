from __future__ import annotations

import logging

import httpx
from app.core.config import settings
from supabase import Client, ClientOptions, create_client

# acessa o supabase e evita bug de reconexão
_client: Client | None = None


def get_client() -> Client:
    """
    Retorna o cliente Supabase singleton com HTTP/2 desabilitado para evitar bugs de concorrência do httpx.
    """
    global _client
    if _client is None:
        custom_client = httpx.Client(http2=False, timeout=30.0)
        options = ClientOptions(httpx_client=custom_client)
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_key or settings.supabase_key,
            options=options,
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
        get_client().table("users").select("username").limit(1).execute()
        return True
    except Exception as exc:
        logging.info(f"[DB Keepalive] Falha, resetando cliente: {exc}")
        reset_client()
        return False
