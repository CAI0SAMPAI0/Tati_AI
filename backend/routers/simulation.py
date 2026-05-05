"""
Router de Simulação de Conversas Reais.
Refatorado para usar SimulationService e padrão async.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict

from routers.deps import get_current_user
from services.simulation_service import SimulationService

router = APIRouter()


class SimMessageRequest(BaseModel):
    content: str
    conversation_id: str = ''
    scenario: str


class SimStartRequest(BaseModel):
    scenario_id: str


class SimAudioRequest(BaseModel):
    audio: str  # base64


class SimEvaluateRequest(BaseModel):
    messages: List[Dict]


@router.get('/simulation/scenarios')
async def list_scenarios(
    level: str | None = None, 
    user: dict = Depends(get_current_user),
    service: SimulationService = Depends()
) -> list:
    """Lista todos os cenários disponíveis, opcionalmente filtrados por nível."""
    effective_level = level or user.get('level')
    return await service.list_scenarios(effective_level)

@router.get('/simulation/scenarios/{scenario_id}')
async def get_scenario_details(
    scenario_id: str, service: SimulationService = Depends()
) -> dict:
    """Retorna detalhes de um cenário."""
    scenario = await service.get_scenario_details(scenario_id)
    if not scenario:
        return {'error': 'Scenario not found'}
    return scenario


@router.post('/simulation/start')
async def start_simulation(
    body: SimStartRequest,
    current_user: dict = Depends(get_current_user),
    service: SimulationService = Depends(),
) -> dict:
    """Inicia uma nova sessão de simulação."""
    return await service.start_session(current_user['username'], body.scenario_id)


@router.post('/simulation/transcribe')
async def transcribe_simulation_audio(
    body: SimAudioRequest,
    current_user: dict = Depends(get_current_user),
    service: SimulationService = Depends(),
) -> dict:
    """Transcreve áudio enviado na simulação."""
    text = await service.transcribe_audio(body.audio, current_user)
    return {'text': text}


@router.post('/simulation/message')
async def send_simulation_message(
    body: SimMessageRequest,
    current_user: dict = Depends(get_current_user),
    service: SimulationService = Depends(),
) -> dict:
    """Envia mensagem para simulação e recebe resposta da IA."""
    return await service.process_message(
        current_user['username'], body.content, body.scenario, body.conversation_id
    )


@router.post('/simulation/evaluate')
async def evaluate(
    body: SimEvaluateRequest,
    current_user: dict = Depends(get_current_user),
    service: SimulationService = Depends(),
) -> dict:
    """Avalia performance na simulação."""
    return await service.evaluate(body.messages, current_user['username'])


# ── Progresso de simulações ────────────────────────────────────────────────────


@router.get('/simulation/progress')
async def get_simulation_progress(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Retorna IDs de cenários concluídos pelo usuário."""
    from services.database import get_client
    from fastapi.concurrency import run_in_threadpool

    username = current_user['username']

    def _fetch() -> list:
        db = get_client()
        # Tenta tabela simulation_sessions
        for table in ('simulation_sessions', 'simulations'):
            try:
                rows = (
                    db.table(table)
                    .select('scenario_id')
                    .eq('username', username)
                    .execute()
                    .data
                    or []
                )
                return [r.get('scenario_id') for r in rows if r.get('scenario_id')]
            except Exception:
                continue
        return []

    completed = await run_in_threadpool(_fetch)
    return {'completed': completed}


@router.post('/simulation/complete/{scenario_id}')
async def mark_simulation_complete(
    scenario_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Marca um cenário de simulação como concluído pelo usuário."""
    from services.database import get_client
    from fastapi.concurrency import run_in_threadpool
    from datetime import datetime, timezone

    username = current_user['username']

    def _save() -> None:
        db = get_client()
        payload = {
            'username': username,
            'scenario_id': scenario_id,
            'completed_at': datetime.now(timezone.utc).isoformat(),
        }
        # Tenta upsert nas tabelas possíveis
        for table in ('simulation_sessions', 'simulations'):
            try:
                db.table(table).upsert(
                    payload,
                    on_conflict='username,scenario_id',
                ).execute()
                return
            except Exception:
                continue

    await run_in_threadpool(_save)
    return {'success': True, 'scenario_id': scenario_id}
