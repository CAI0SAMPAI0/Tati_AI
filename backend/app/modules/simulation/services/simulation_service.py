"""
services/simulation_service.py
Serviço para gerenciamento de simulações de conversas.
"""

import base64
from typing import List, Dict, Any, Optional
from fastapi.concurrency import run_in_threadpool
from fastapi import Depends
from app.core.dependencies.db import get_db

from app.modules.simulation.services.simulation import get_all_scenarios, get_scenario, evaluate_simulation
from app.modules.chat.services.llm import groq_chat, transcribe_audio, text_to_speech
from app.shared.services.history import save_message


class SimulationService:
    def __init__(self, db: Any = Depends(get_db)) -> None:
        if db is None or str(type(db)).find('Depends') != -1:
            from app.core.database import get_client
            self.db = get_client()
        else:
            self.db = db

    async def list_scenarios(self, level: Optional[str] = None) -> List[Dict[str, Any]]:
        return await run_in_threadpool(get_all_scenarios, level)

    async def get_scenario_details(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        return await run_in_threadpool(get_scenario, scenario_id)

    async def start_session(self, username: str, scenario_id: str, user_level: str = 'Beginner') -> Dict[str, Any]:
        """Inicializa uma nova sessão de simulação e retorna o ID da conversa com a primeira mensagem da IA."""
        import uuid
        conv_id = f"sim_{uuid.uuid4().hex[:8]}"
        
        scenario = await self.get_scenario_details(scenario_id)
        if not scenario:
            return {"error": "Scenario not found"}

        # Log do início
        def _log():
            try:
                self.db.table('simulation_sessions').insert({
                    'username': username,
                    'scenario_id': scenario_id,
                    'conversation_id': conv_id,
                    'status': 'started'
                }).execute()
            except:
                pass
        
        await run_in_threadpool(_log)

        # Gerar primeira mensagem da IA
        system_prompt = scenario.get('system_prompt', '')
        
        # REFORÇO DE PERSONA TATI
        tati_instruction = (
            "CRITICAL: YOUR NAME IS TATI (or Tatiana). "
            "Introduce yourself as Tati. Stay in character but keep your identity as Tati. "
        )
        if 'TATI' not in system_prompt.upper() and 'TATIANA' not in system_prompt.upper():
            system_prompt = f"{tati_instruction}\n{system_prompt}"
            
        level_rule = (
            f"STUDENT LEVEL: {user_level}. "
            "Adapt your vocabulary and sentence length to this level. "
            "If Beginner or Pre-Intermediate, use short simple sentences and slower pacing."
        )
        system_prompt = f"{system_prompt}\n\n{level_rule}"

        if 'ENGLISH ONLY' not in system_prompt.upper():
            system_prompt += '\n\nCRITICAL: Respond ENTIRELY in English.'

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': 'Start the scenario and greet me.'},
        ]

        from app.modules.chat.services.llm import groq_chat, text_to_speech
        from app.shared.services.history import save_message

        reply_text = await groq_chat(messages, model='llama-3.1-8b-instant')
        tts_b64 = await text_to_speech(reply_text) if reply_text else None

        if reply_text:
            await save_message(conv_id, username, 'assistant', reply_text, audio_b64=tts_b64)

        return {
            "id": conv_id,
            "username": username,
            "scenario_id": scenario_id,
            "initial_message": {
                "role": "assistant",
                "content": reply_text,
                "audio": tts_b64
            }
        }

    async def transcribe_audio(self, audio_b64: str, user_info: Dict[str, Any]) -> str:
        username = user_info['username']
        user_name = user_info.get('name', username)
        user_focus = user_info.get('focus', '')
        stt_prompt = (
            f'User name: {user_name}. Focus: {user_focus}. Simulation practice.'
        )

        audio_bytes = base64.b64decode(audio_b64)
        return await transcribe_audio(
            audio_bytes, filename='sim_input.webm', prompt=stt_prompt
        )

    async def process_message(
        self,
        username: str,
        content: str,
        scenario_id: str,
        conversation_id: Optional[str] = None,
        user_level: str = 'Beginner',
    ) -> Dict[str, Any]:
        conv_id = conversation_id or f'sim_{username}_{scenario_id}'

        # Salva e registra atividade
        await save_message(conv_id, username, 'user', content)

        from app.modules.users.services.streaks import record_study_day

        await run_in_threadpool(record_study_day, username)

        def _track_session():
            self.db.table('study_sessions').insert(
                {
                    'username': username,
                    'activity_type': 'simulation',
                    'duration_minutes': 3,
                }
            ).execute()

        await run_in_threadpool(_track_session)

        scenario = await self.get_scenario_details(scenario_id)
        if not scenario:
            return {'error': 'Scenario not found'}

        system_prompt = scenario.get('system_prompt', '')

        # REFORÇO DE PERSONA TATI
        tati_instruction = (
            "CRITICAL: YOUR NAME IS TATI (or Tatiana). "
            "Introduce yourself as Tati. Stay in character but keep your identity as Tati. "
        )
        if 'TATI' not in system_prompt.upper() and 'TATIANA' not in system_prompt.upper():
            system_prompt = f"{tati_instruction}\n{system_prompt}"
            
        level_rule = (
            f"STUDENT LEVEL: {user_level}. "
            "Adapt your vocabulary and sentence length to this level. "
            "If Beginner or Pre-Intermediate, keep language simple."
        )
        system_prompt = f"{system_prompt}\n\n{level_rule}"

        if 'ENGLISH ONLY' not in system_prompt.upper():
            system_prompt += '\n\nCRITICAL: Respond ENTIRELY in English.'

        messages = [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': content},
        ]

        reply_text = await groq_chat(messages, model='llama-3.1-8b-instant')
        tts_b64 = await text_to_speech(reply_text) if reply_text else None

        await save_message(
            conv_id, username, 'assistant', reply_text, audio_b64=tts_b64
        )

        # 🏆 Error Logging e Atividade em Background
        try:
            from app.modules.activities.services.error_log_service import error_log_service
            import asyncio
            asyncio.create_task(error_log_service.extract_and_log_errors(username, content, reply_text))
        except:
            pass

        return {
            'reply': reply_text,
            'scenario': scenario_id,
            'audio_b64': tts_b64,
            'conversation_id': conv_id,
        }

    async def evaluate(
        self, messages: List[Dict[str, Any]], username: str
    ) -> Dict[str, Any]:
        from app.modules.users.services.streaks import record_study_day

        await run_in_threadpool(record_study_day, username)
        return await run_in_threadpool(evaluate_simulation, messages)
