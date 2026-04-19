"""
Router de Simulação de Conversas Reais.
"""
import asyncio
import base64
import io
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from routers.deps import get_current_user
from services.database import get_client
from services.simulation import get_all_scenarios, get_scenario, get_scenario_prompt, evaluate_simulation
from services.llm import groq_chat, transcribe_audio, text_to_speech
from services.email import send_feedback_notification

router = APIRouter()


class SimMessageRequest(BaseModel):
    content: str
    conversation_id: str = ""
    scenario: str


class SimAudioRequest(BaseModel):
    audio: str  # base64


class SimEvaluateRequest(BaseModel):
    messages: list[dict]


class FeedbackRequest(BaseModel):
    category: str  # bug, feature, feedback, other
    message: str
    title: str = ""
    page: str = ""


@router.get("/simulation/scenarios")
async def list_scenarios(current_user: dict = Depends(get_current_user)):
    """Lista todos os cenários disponíveis. Requer autenticação."""
    return get_all_scenarios()


@router.get("/simulation/scenarios/{scenario_id}")
async def get_scenario_details(scenario_id: str):
    """Retorna detalhes de um cenário."""
    scenario = get_scenario(scenario_id)
    if not scenario:
        return {"error": "Scenario not found"}
    return scenario


@router.post("/simulation/transcribe")
async def transcribe_simulation_audio(body: SimAudioRequest):
    """Transcreve áudio enviado na simulação."""
    try:
        audio_bytes = base64.b64decode(body.audio)
        text = await transcribe_audio(audio_bytes, filename="sim_input.webm")
        return {"text": text}
    except Exception as e:
        print(f"[Sim Transcribe] Erro: {e}")
        return {"text": "", "error": str(e)}


@router.post("/simulation/message")
async def send_simulation_message(
    body: SimMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Envia mensagem para simulação e recebe resposta da IA (com TTS)."""
    username = current_user["username"]
    conv_id = body.conversation_id or f"sim_{username}_{body.scenario}"

    # Salva mensagem do usuário no histórico real
    from services.history import save_message
    await save_message(conv_id, username, "user", body.content)

    # Registra atividade (agora com regra de 3 mensagens)
    from services.streaks import record_study_day
    record_study_day(username)

    try:
        get_client().table("study_sessions").insert({
            "username": username,
            "activity_type": "simulation",
            "duration_minutes": 3
        }).execute()
    except Exception as e:
        print(f"[StudyTime] Erro: {e}")

    scenario = get_scenario(body.scenario)
    if not scenario:
        return {"error": "Scenario not found", "reply": "Cenário não encontrado"}
    
    system_prompt = scenario.get("system_prompt", "")
    
    # Força instrução de English-only
    if "ENGLISH ONLY" not in system_prompt.upper() and "english" not in system_prompt.lower():
        system_prompt += "\n\nCRITICAL: You MUST respond ENTIRELY in English. Never use Portuguese."
    
    # Monta mensagens para a LLM
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": body.content}
    ]
    
    try:
        reply_text = await groq_chat(messages)
        
        if not reply_text:
            reply_text = "(I couldn't generate a response)"
        
        # Gera áudio TTS automaticamente
        tts_b64 = None
        try:
            tts_b64 = await text_to_speech(reply_text)
        except Exception as e:
            print(f"[Sim TTS] Erro: {e}")
        
        # Salva resposta da IA no histórico real
        await save_message(conv_id, username, "assistant", reply_text, audio_b64=tts_b64)
        
        return {"reply": reply_text, "scenario": body.scenario, "audio_b64": tts_b64, "conversation_id": conv_id}
    except Exception as e:
        error_msg = str(e)
        print(f"[Simulation] Erro LLM: {error_msg}")
        return {"error": error_msg, "reply": f"(Erro ao processar)"}


@router.post("/simulation/evaluate")
async def evaluate(
    body: SimEvaluateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Avalia performance na simulação."""
    # Também registra atividade na avaliação
    from services.streaks import record_study_day
    record_study_day(current_user["username"])

    return evaluate_simulation(body.messages)


@router.post("/feedback/send")
async def send_feedback(
    body: FeedbackRequest,
    current_user: dict = Depends(get_current_user)
):
    """Envia feedback/bug report do usuário para o administrador."""
    student_name = current_user.get("name") or current_user.get("username")
    student_email = current_user.get("email", "")

    full_message = body.message
    if body.title:
        full_message = f"[{body.title}]\n\n{full_message}"
    if body.page:
        full_message += f"\n\nPágina: {body.page}"

    success = send_feedback_notification(
        student_name=student_name,
        student_email=student_email,
        category=body.category,
        message=full_message
    )

    if success:
        return {"success": True, "message": "Feedback enviado com sucesso!"}
    else:
        return {"success": False, "message": "Erro ao enviar feedback. Tente novamente."}
