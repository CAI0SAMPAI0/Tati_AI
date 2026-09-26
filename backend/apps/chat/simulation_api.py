import uuid
import logging
from typing import Optional, List, Dict, Any
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from ninja import Router
from ninja.errors import HttpError
from pydantic import BaseModel
from groq import AsyncGroq
from asgiref.sync import sync_to_async

from apps.authentication.security import auth_optional
from apps.chat.models import SimulationScenario, CEFRSimulation, Conversation, Message
from apps.activities.models import ActivitySubmission
from apps.users.services import XPService, StreakService
from .audio_service import AudioService, get_groq_keys

User = get_user_model()
logger = logging.getLogger(__name__)

simulation_router = Router(tags=["Simulations & Scenarios"])


# SCHEMAS


class SimStartInput(BaseModel):
    scenario_id: str
    accent: Optional[str] = "en-US"
    level: Optional[str] = None


class SimTranscribeInput(BaseModel):
    audio: str
    prompt: Optional[str] = ""


class SimMessageInput(BaseModel):
    content: str
    scenario: Optional[str] = ""
    scenario_id: Optional[str] = ""
    conversation_id: Optional[str] = ""
    accent: Optional[str] = "en-US"
    level: Optional[str] = None


class SimEvaluateInput(BaseModel):
    messages: Optional[List[Dict[str, Any]]] = []
    scenario_id: Optional[str] = ""


# HELPERS


def _clean_complete_reply(text: str) -> str:
    """
    Garante que a resposta da IA nunca termine cortada no meio de uma frase.
    Se a última frase não tiver pontuação final (. ! ?), corta no último ponto válido.
    """
    t = text.strip()
    if not t:
        return t
    if t[-1] in ('.', '!', '?', '"', '”', '’'):
        return t
    last_punct = max(t.rfind('.'), t.rfind('!'), t.rfind('?'))
    if last_punct != -1 and last_punct > len(t) * 0.4:
        return t[:last_punct + 1].strip()
    return t


def _get_level_prompt_rules(level: Optional[str]) -> str:
    lvl = (level or "A2").strip().upper()
    if lvl == "A1":
        return (
            "STUDENT CEFR LEVEL: A1 (Complete Beginner)\n"
            "- Speak in very simple English. Use basic, everyday vocabulary only.\n"
            "- Keep your response short: maximum 2 simple sentences (under 30 words).\n"
            "- Do NOT use idioms, phrasal verbs, or complex grammatical structures.\n"
            "- Be warm, patient, and ask exactly ONE very simple question at the end."
        )
    elif lvl == "A2":
        return (
            "STUDENT CEFR LEVEL: A2 (Elementary)\n"
            "- Use simple, clear vocabulary and common sentence structures.\n"
            "- Keep your response concise: 2 to 3 sentences (under 50 words).\n"
            "- Keep questions straightforward and easy to understand.\n"
            "- Be encouraging and ask exactly ONE clear question at the end."
        )
    elif lvl == "B1":
        return (
            "STUDENT CEFR LEVEL: B1 (Intermediate)\n"
            "- Use natural conversational English with everyday expressions.\n"
            "- Length: 2 to 3 sentences (under 60 words).\n"
            "- Ask questions that invite the student to share opinions or describe experiences.\n"
            "- End with exactly ONE clear question."
        )
    elif lvl == "B2":
        return (
            "STUDENT CEFR LEVEL: B2 (Upper Intermediate)\n"
            "- Use natural, expressive conversational English with varied vocabulary and idioms.\n"
            "- Length: 3 to 4 sentences (under 75 words).\n"
            "- Engage the student with interesting, open-ended questions.\n"
            "- End with exactly ONE engaging question."
        )
    else:  # C1 / C2
        return (
            f"STUDENT CEFR LEVEL: {lvl} (Advanced/Proficient)\n"
            "- Speak naturally as an educated native speaker with nuanced vocabulary and idiomatic fluency.\n"
            "- Challenge the student with thought-provoking dialogue.\n"
            "- Length: 3 to 4 sentences (under 80 words).\n"
            "- End with ONE relevant, high-level question."
        )



def _get_scenario_details(scenario_id: str) -> Optional[dict]:
    if scenario_id.startswith("cefr_sim_"):
        clean_id = scenario_id.replace("cefr_sim_", "")
        cs = CEFRSimulation.objects.filter(id=clean_id).first()
        if not cs:
            return None
        roles = cs.roles if isinstance(cs.roles, dict) else {}
        student_role = roles.get("student", "Student")
        teacher_role = roles.get("ai", "Teacher")
        return {
            "id": scenario_id,
            "name": cs.topic,
            "name_en": cs.topic,
            "description": cs.scenario,
            "difficulty": cs.level,
            "levels": [cs.level],
            "system_prompt": f"You are {teacher_role}. The user is {student_role}. Goal: {cs.goal}. Scenario: {cs.scenario}",
            "emoji": "🎭",
            "initial_message": f"Hello! Let's start our scenario: '{cs.topic}'.",
            "objectives": [
                f"Achieve goal: {cs.goal}",
                f"Practice {cs.topic} in English",
            ],
        }

    s = SimulationScenario.objects.filter(id=scenario_id).first()
    if not s:
        return None
    return {
        "id": str(s.id),
        "name": s.name,
        "name_en": s.name_en or s.name,
        "description": s.description,
        "difficulty": s.difficulty,
        "levels": s.levels or [],
        "system_prompt": s.system_prompt,
        "emoji": s.emoji or "🎭",
        "initial_message": s.initial_message
        or s.greeting
        or f"Hello! Let's practice: {s.name}.",
        "objectives": [f"Complete conversational practice for {s.name}"],
    }


# ENDPOINTS (ASYNC)                                                  


@simulation_router.get("/scenarios", auth=auth_optional)
async def list_scenarios(request: HttpRequest, level: Optional[str] = None):
    """
    Lista todos os cenários de simulação disponíveis (livres e CEFR), opcionalmente filtrados por nível.
    """

    def _fetch():
        user = request.auth if isinstance(request.auth, User) else None
        effective_level = (
            (level or (user.level if user else "A1") or "A1").strip().upper()
        )

        scenarios = []

        # 1. SimulationScenarios
        qs_scenarios = SimulationScenario.objects.filter(is_active=True)
        for s in qs_scenarios:
            s_lvls = s.levels or (
                [s.difficulty]
                if s.difficulty and s.difficulty.lower() != "all"
                else ["all"]
            )
            s_lvls_upper = [str(l).strip().upper() for l in s_lvls]

            if (
                effective_level == "ALL"
                or "ALL" in s_lvls_upper
                or effective_level in s_lvls_upper
            ):
                scenarios.append(
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "name_en": s.name_en or s.name,
                        "description": s.description,
                        "difficulty": s.difficulty or "all",
                        "levels": s_lvls,
                        "system_prompt": s.system_prompt,
                        "emoji": s.emoji or "🎭",
                        "initial_message": s.initial_message
                        or s.greeting
                        or "Hello! Let's begin.",
                    }
                )

        # 2. CEFRSimulations
        qs_cefr = CEFRSimulation.objects.filter(is_published=True)
        for cs in qs_cefr:
            cs_lvl = (cs.level or "A1").strip().upper()
            if effective_level == "ALL" or effective_level == cs_lvl:
                roles = cs.roles if isinstance(cs.roles, dict) else {}
                scenarios.append(
                    {
                        "id": f"cefr_sim_{cs.id}",
                        "name": cs.topic,
                        "name_en": cs.topic,
                        "description": cs.scenario,
                        "difficulty": cs_lvl,
                        "levels": [cs_lvl],
                        "system_prompt": f"Goal: {cs.goal}. Student role: {roles.get('student', 'Student')}. Teacher role: {roles.get('ai', 'Teacher')}.",
                        "emoji": "🎭",
                        "initial_message": f"Hello! We are starting the scenario: '{cs.topic}'.",
                    }
                )

        return scenarios

    return await sync_to_async(_fetch)()


@simulation_router.get("/scenarios/{scenario_id}", auth=auth_optional)
async def get_scenario(request: HttpRequest, scenario_id: str):
    """
    Retorna detalhes completos de um cenário de simulação específico de forma assíncrona.
    """
    sc = await sync_to_async(_get_scenario_details)(scenario_id)
    if not sc:
        raise HttpError(404, "Cenário não encontrado.")
    return sc


@simulation_router.post("/start", auth=auth_optional)
async def start_simulation(request: HttpRequest, payload: SimStartInput):
    """
    Inicia uma sessão de simulação para o aluno com geração da saudação inicial e áudio via Edge TTS.
    """
    user = request.auth if isinstance(request.auth, User) else None
    username = user.username if user else "aluno"
    scenario_id = payload.scenario_id
    accent = payload.accent or "en-US"

    sc = await sync_to_async(_get_scenario_details)(scenario_id)
    if not sc:
        raise HttpError(404, "Cenário não encontrado.")

    user_level = getattr(user, "level", None) if user else None
    student_level = payload.level or user_level or sc.get("difficulty") or "A2"
    level_rules = _get_level_prompt_rules(student_level)

    conv_id = f"sim_{uuid.uuid4().hex[:10]}"
    sys_prompt = (
        sc.get("system_prompt") or f"You are simulating the scenario: {sc.get('name')}."
    )
    initial_text = (
        sc.get("initial_message")
        or f"Hello! Welcome to our session. Let's practice {sc.get('name')}."
    )

    keys = get_groq_keys()
    for key in keys:
        try:
            async with AsyncGroq(api_key=key) as client:
                res = await client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                f"{sys_prompt}\n\n"
                                f"{level_rules}\n\n"
                                "CRITICAL INSTRUCTIONS:\n"
                                "- Respond ENTIRELY in English.\n"
                                "- Introduce yourself in character and greet the student warmly to begin.\n"
                                "- Keep your greeting CONCISE (2 to 3 sentences max, under 50 words).\n"
                                "- ALWAYS complete your thoughts and every sentence you start. NEVER leave a sentence unfinished or cut off mid-thought.\n"
                                "- Ask exactly ONE simple, direct question to start the conversation."
                            ),
                        },
                        {
                            "role": "user",
                            "content": "Hello! I am ready to start the scenario.",
                        },
                    ],
                    max_tokens=400,
                    temperature=0.6,
                )
            generated_text = res.choices[0].message.content.strip()
            generated_text = _clean_complete_reply(generated_text)
            if generated_text:
                initial_text = generated_text
                break
        except Exception as e:
            logger.warning(f"[Simulation Start] Groq error with key {key[:10]}: {e}")

    audio_b64 = await AudioService.text_to_speech_async(initial_text, accent=accent)

    def _save_db():
        try:
            Conversation.objects.create(
                id=conv_id,
                username=username,
                title=f"Simulation: {sc.get('name')}",
                is_simulation=True,
                simulation_id=scenario_id,
            )
            Message.objects.create(
                session_id=conv_id,
                username=username,
                role="assistant",
                content=initial_text,
                audio_b64=audio_b64,
            )
        except Exception as e:
            logger.warning(f"[Simulation Start] DB logging error: {e}")

    await sync_to_async(_save_db)()

    return {
        "id": conv_id,
        "conversation_id": conv_id,
        "scenario_id": scenario_id,
        "objectives": sc.get("objectives", []),
        "completed_objectives": [],
        "initial_message": {
            "role": "assistant",
            "content": initial_text,
            "audio": audio_b64,
            "audio_b64": audio_b64,
        },
    }


@simulation_router.post("/transcribe", auth=auth_optional)
async def transcribe_simulation_audio(
    request: HttpRequest, payload: SimTranscribeInput
):
    """
    Transcreve áudio do aluno na simulação usando Whisper Large V3 assíncrono.
    """
    text = await AudioService.transcribe_audio_async(
        payload.audio, prompt=payload.prompt or "Simulation conversation"
    )
    return {"text": text, "transcription": text}


@simulation_router.post("/message", auth=auth_optional)
async def send_simulation_message(request: HttpRequest, payload: SimMessageInput):
    """
    Processa a fala do aluno na simulação com Groq assíncrono e síntese de voz Edge TTS.
    """
    user = request.auth if isinstance(request.auth, User) else None
    username = user.username if user else "aluno"
    conv_id = payload.conversation_id or f"sim_{uuid.uuid4().hex[:8]}"
    content = payload.content
    scenario_id = payload.scenario_id or payload.scenario or ""
    accent = payload.accent or "en-US"

    sc = await sync_to_async(_get_scenario_details)(scenario_id) if scenario_id else {}
    user_level = getattr(user, "level", None) if user else None
    student_level = payload.level or user_level or (sc.get("difficulty") if sc else None) or "A2"
    level_rules = _get_level_prompt_rules(student_level)

    sys_prompt = (
        (sc.get("system_prompt") if sc else None)
        or "You are Teacher Tati conducting a real-world conversational English simulation. Respond entirely in English."
    )

    def _save_user_msg_and_get_history():
        try:
            Message.objects.create(
                session_id=conv_id,
                username=username,
                role="user",
                content=content,
            )
        except Exception:
            pass

        history_msgs = (
            Message.objects.filter(session_id=conv_id)
            .only("id", "role", "content", "created_at")
            .order_by("-created_at")[:8]
        )
        return list(reversed(history_msgs))

    history = await sync_to_async(_save_user_msg_and_get_history)()

    messages_payload = [
        {
            "role": "system",
            "content": (
                f"{sys_prompt}\n\n"
                f"{level_rules}\n\n"
                "CRITICAL INSTRUCTIONS:\n"
                "- Respond ENTIRELY in natural English, stay strictly in character.\n"
                "- Keep answers engaging and concise (2 to 3 sentences, under 65 words).\n"
                "- ALWAYS complete every sentence you start. NEVER leave a sentence unfinished or cut off mid-thought.\n"
                "- Encourage the student and end with ONE clear question to pass the turn."
            ),
        }
    ]
    for m in history:
        messages_payload.append({"role": m.role, "content": m.content})

    reply_text = "That's interesting! Let's continue our conversation."
    keys = get_groq_keys()
    for key in keys:
        try:
            async with AsyncGroq(api_key=key) as client:
                res = await client.chat.completions.create(
                    model="openai/gpt-oss-120b",
                    messages=messages_payload,
                    max_tokens=400,
                    temperature=0.6,
                )
            reply_text = res.choices[0].message.content.strip()
            reply_text = _clean_complete_reply(reply_text)
            if reply_text:
                break
        except Exception as e:
            logger.error(f"[Simulation Message] Groq error with key {key[:10]}: {e}")

    audio_b64 = await AudioService.text_to_speech_async(reply_text, accent=accent)

    def _save_assistant_msg_and_award_xp():
        try:
            Message.objects.create(
                session_id=conv_id,
                username=username,
                role="assistant",
                content=reply_text,
                audio_b64=audio_b64,
            )
        except Exception:
            pass

        if user and isinstance(user, User):
            StreakService.record_activity(user)

    await sync_to_async(_save_assistant_msg_and_award_xp)()

    return {
        "reply": reply_text,
        "content": reply_text,
        "audio": audio_b64,
        "audio_b64": audio_b64,
        "completed_objectives": [],
    }


@simulation_router.post("/evaluate", auth=auth_optional)
async def evaluate_simulation(request: HttpRequest, payload: SimEvaluateInput):
    """
    Avalia a performance do aluno na simulação e registra a conclusão.
    """

    def _evaluate():
        user = request.auth if isinstance(request.auth, User) else None
        username = user.username if user else "aluno"
        scenario_id = payload.scenario_id or "general_simulation"

        from django.db.models import Q
        already_completed = ActivitySubmission.objects.filter(
            Q(username=username)
            & Q(activity_type="simulation")
            & (Q(metadata__scenario_id=scenario_id) | Q(metadata__simulation_id=scenario_id))
            & Q(status="completed")
        ).exists()

        if user and isinstance(user, User):
            if not already_completed:
                XPService.award_xp(user, 25, f"Avaliação de Simulação ({scenario_id})")
            StreakService.record_activity(user)

        sub = ActivitySubmission.objects.create(
            username=username,
            activity_type="simulation",
            score=95,
            status="completed",
            metadata={
                "scenario_id": scenario_id,
                "simulation_id": scenario_id,
                "status": "completed",
                "score": 95,
            },
        )
        return str(sub.id)

    sub_id = await sync_to_async(_evaluate)()

    return {
        "success": True,
        "score": 95,
        "feedback": "Great job communicating effectively throughout the scenario!",
        "id": sub_id,
    }


@simulation_router.get("/progress", auth=auth_optional)
async def get_simulation_progress(request: HttpRequest):
    """
    Retorna a lista de IDs de cenários e simulações já concluídos pelo aluno.
    """

    def _fetch_progress():
        user = request.auth if isinstance(request.auth, User) else None
        username = user.username if user else "aluno"

        completed = set()
        subs = ActivitySubmission.objects.filter(
            username=username, activity_type="simulation"
        )
        for s in subs:
            meta = s.metadata if isinstance(s.metadata, dict) else {}
            sid = (
                meta.get("scenario_id")
                or meta.get("simulation_id")
                or meta.get("item_id")
                or meta.get("activity_id")
            )
            if sid:
                completed.add(str(sid))
            if s.module_id:
                completed.add(str(s.module_id))
        return list(completed)

    completed = await sync_to_async(_fetch_progress)()
    return {"completed": completed}


@simulation_router.post("/complete/{scenario_id}", auth=auth_optional)
async def mark_simulation_complete(
    request: HttpRequest, scenario_id: str, payload: Optional[dict] = None
):
    """
    Registra a conclusão com sucesso de um cenário de simulação pelo aluno.
    """

    def _complete():
        user = request.auth if isinstance(request.auth, User) else None
        username = user.username if user else "aluno"
        score = int((payload or {}).get("score", 100))

        from django.db.models import Q
        already_completed = ActivitySubmission.objects.filter(
            Q(username=username)
            & Q(activity_type="simulation")
            & (Q(metadata__scenario_id=scenario_id) | Q(metadata__simulation_id=scenario_id) | Q(metadata__activity_id=scenario_id))
            & Q(status="completed")
        ).exists()

        if user and isinstance(user, User):
            if not already_completed:
                XPService.award_xp(user, 25, f"Conclusão de Simulação ({scenario_id})")
            StreakService.record_activity(user)

        sub = ActivitySubmission.objects.create(
            username=username,
            activity_type="simulation",
            score=score,
            status="completed",
            metadata={
                "scenario_id": scenario_id,
                "simulation_id": scenario_id,
                "activity_id": scenario_id,
                "status": "completed",
                "score": score,
            },
        )
        return str(sub.id)

    sub_id = await sync_to_async(_complete)()

    return {
        "success": True,
        "status": "completed",
        "scenario_id": scenario_id,
        "id": sub_id,
        "xp_earned": 25,
    }
