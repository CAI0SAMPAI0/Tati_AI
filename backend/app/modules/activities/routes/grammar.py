"""
Sprint 20 – Grammar route.

GET /grammar
  ?topic=past_simple
  ?level=B1
Returns grammar explanation (rule, key structure, Teacher Tati tip) and
source links (DW, BBC Learning English, test-english.com).

GET /grammar (no params) -> topic index.
"""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.grammar_service import grammar_service

router = APIRouter()


@router.get("")
async def get_grammar(
    topic: str | None = Query(default=None, description="Grammar topic (e.g. past_simple)"),
    level: str | None = Query(default=None, description="CEFR level (A1..C2)"),
    current_user: dict = Depends(get_current_user),
):
    """Fetch grammar explanation + source links."""
    effective_level = level or current_user.get("level", "A1")
    return await grammar_service.get_grammar(topic=topic, level=effective_level)