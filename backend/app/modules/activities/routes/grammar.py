"""
Sprint 20 – Rota de Grammar.

GET /grammar
  ?topic=past_simple
  ?level=B1
Retorna a explicação gramatical curada (regra, estrutura, dica da Teacher Tati)
e fontes de referência (DW, BBC Learning English, test-english.com).

GET /grammar (sem parâmetros) -> índice de tópicos disponíveis.
"""
from fastapi import APIRouter, Depends, Query

from app.core.dependencies.auth import get_current_user
from app.modules.activities.services.grammar_service import grammar_service

router = APIRouter()


@router.get("")
async def get_grammar(
    topic: str | None = Query(default=None, description="Tópico de gramática (ex: past_simple)"),
    level: str | None = Query(default=None, description="Nível CEFR (A1..C2)"),
    current_user: dict = Depends(get_current_user),
):
    """Busca a explicação gramatical + fontes de referência."""
    return await grammar_service.get_grammar(topic=topic, level=current_user.get("level") if not level else level)