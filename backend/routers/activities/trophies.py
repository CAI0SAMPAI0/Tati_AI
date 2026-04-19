"""
Troféus conquistados pelo aluno.
"""
from fastapi import APIRouter, Depends
from routers.deps import get_current_user, require_staff
from services.database import get_client
from services.upstash import cache_get, cache_set

router = APIRouter()


@router.get("/")
async def my_trophies(current_user: dict = Depends(get_current_user)):
    """Troféus do aluno logado."""
    username = current_user["username"]
    cache_key = f"trophies:{username}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    db = get_client()
    
    # Busca troféus conquistados pelo mapeamento user_trophies -> trophies
    try:
        res = db.table("user_trophies").select(
            "earned_at, trophies(name, description, icon, category)"
        ).eq("username", username).order("earned_at", desc=True).execute()
        
        # Formata para facilitar o frontend
        trophies = []
        for row in res.data:
            t = row.get("trophies", {})
            trophies.append({
                "title": t.get("name"),
                "description": t.get("description"),
                "icon": t.get("icon"),
                "category": t.get("category"),
                "earned_at": row.get("earned_at")
            })
        await cache_set(cache_key, trophies, ttl=300)  # 5 minutos
        return trophies
    except Exception as e:
        print(f"[Trophies Router] Erro: {e}")
        return []


@router.get("/admin/{username}")
async def student_trophies(username: str, current_user: dict = Depends(require_staff)):
    """Admin: troféus de um aluno específico."""
    db = get_client()
    try:
        res = db.table("user_trophies").select(
            "earned_at, trophies(name, description, icon, category)"
        ).eq("username", username).order("earned_at", desc=True).execute()

        trophies = []
        for row in res.data:
            t = row.get("trophies", {})
            trophies.append({
                "title": t.get("name"),
                "description": t.get("description"),
                "icon": t.get("icon"),
                "category": t.get("category"),
                "earned_at": row.get("earned_at")
            })
        return trophies
    except Exception as e:
        print(f"[Admin Trophies] Erro: {e}")
        return []
