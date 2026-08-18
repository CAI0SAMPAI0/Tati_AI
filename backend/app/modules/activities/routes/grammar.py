from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.grammar_service import grammar_service
from app.shared.services.upstash import cache_delete
from fastapi import APIRouter, Depends, Query

router = APIRouter()


@router.get("")
async def get_grammar(
    topic: str | None = Query(
        default=None, description="Grammar topic (e.g. past_simple)"
    ),
    level: str | None = Query(default=None, description="CEFR level (A1..C2)"),
    current_user: dict = Depends(get_current_user),
):
    """Fetch grammar explanation + source links."""
    effective_level = level or "ALL"
    if topic:
        effective_level = level or current_user.get("level", "A1")
    return await grammar_service.get_grammar(topic=topic, level=effective_level)


@router.post("/cache-clear")
async def clear_grammar_cache():
    """Clear all grammar cache entries. Admin endpoint."""
    levels = ["", "ALL", "A1", "A2", "B1", "B2", "C1", "C2"]
    cleared = 0
    for level in levels:
        key = f"grammar:index:{level}"
        if await cache_delete(key):
            cleared += 1
    return {"cleared": cleared, "message": f"Cleared {cleared} grammar cache entries"}
