"""
Serviço centralizado para verificação e entrega de troféus.
"""
from datetime import datetime, timezone
from services.database import get_client

def award_trophy(username: str, trophy_name: str) -> bool:
    """Premia um usuário com um troféu pelo NOME, se ele ainda não tiver."""
    db = get_client()
    try:
        # 1. Busca o ID do troféu pelo nome
        trophy = db.table("trophies").select("id").eq("name", trophy_name).single().execute().data
        if not trophy:
            print(f"[Trophy Service] Troféu não encontrado: {trophy_name}")
            return False
        
        trophy_id = trophy["id"]
        
        # 2. Tenta inserir na tabela user_trophies (UNIQUE constraint username+trophy_id evita duplicata)
        db.table("user_trophies").insert({
            "username": username,
            "trophy_id": trophy_id,
            "earned_at": datetime.now(timezone.utc).isoformat()
        }).execute()
        
        print(f"[Trophy Service] Troféu '{trophy_name}' concedido a {username}")
        
        # Invalida caches relacionados
        try:
            import asyncio
            from services.upstash import cache_delete
            
            async def _invalidate():
                await cache_delete(f"trophies:{username}")
                await cache_delete(f"trophies_all:{username}")
                await cache_delete(f"streak:{username}")
                
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(_invalidate())
                else:
                    loop.run_until_complete(_invalidate())
            except Exception:
                pass
        except Exception:
            pass
            
        return True
    except Exception as e:
        # Se cair aqui, provavelmente já tem o troféu (Unique constraint violation) ou erro de banco
        if "duplicate key" not in str(e).lower():
            print(f"[Trophy Service] Erro ao premiar '{trophy_name}' para {username}: {e}")
        return False

def check_chat_trophies(username: str):
    """Verifica troféus relacionados ao chat (ex: Primeira Mensagem)."""
    db = get_client()
    try:
        # Conta mensagens do usuário
        res = db.table("messages").select("id", count="exact").eq("username", username).eq("role", "user").execute()
        count = res.count or 0
        
        if count >= 1:
            award_trophy(username, "Primeira Mensagem")
        if count >= 100:
            award_trophy(username, "100 Mensagens")
        if count >= 500:
            award_trophy(username, "500 Mensagens")
            
    except Exception as e:
        print(f"[Trophy Service] Erro check_chat_trophies: {e}")

def check_streak_trophies(username: str, streak_days: int):
    """Verifica troféus baseados em dias seguidos (streak)."""
    # Nomes exatos do Banco de Dados
    if streak_days >= 1: award_trophy(username, "Primeiro Dia")
    if streak_days >= 3: award_trophy(username, "Ofensiva de 3 Dias")
    if streak_days >= 7: award_trophy(username, "Ofensiva de 7 Dias")
    if streak_days >= 14: award_trophy(username, "Ofensiva de 14 Dias")
    if streak_days >= 30: award_trophy(username, "Ofensiva de 30 Dias")
    if streak_days >= 60: award_trophy(username, "Ofensiva de 60 Dias")
    if streak_days >= 100: award_trophy(username, "Ofensiva de 100 Dias")
    if streak_days >= 365: award_trophy(username, "Ofensiva de 365 Dias")

def check_all_trophies(username: str):
    """Roda uma verificação completa (útil para migrações ou quando o usuário reclama)."""
    db = get_client()
    
    # 1. Chat
    check_chat_trophies(username)
    
    # 2. Streak/Dias
    from services.streaks import get_streak
    streak_data = get_streak(username)
    # Verificamos tanto o current quanto o longest para garantir que se ele teve 40 dias no passado ele ganhe
    longest = streak_data.get("longest_streak", 0)
    check_streak_trophies(username, longest)
    
    # 3. Quizzes (Mestre dos Quizzes, etc)
    try:
        res = db.table("user_progress").select("id", count="exact").eq("username", username).execute()
        q_count = res.count or 0
        if q_count >= 1: award_trophy(username, "Primeiro Quiz")
        if q_count >= 5: award_trophy(username, "Quizzer Iniciante")
        if q_count >= 10: award_trophy(username, "Quizzer")
        if q_count >= 25: award_trophy(username, "Quizzer Avançado")
        if q_count >= 50: award_trophy(username, "Mestre dos Quizzes")
        if q_count >= 100: award_trophy(username, "Mestre Supremo")
    except: pass
