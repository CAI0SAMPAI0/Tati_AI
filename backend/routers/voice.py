from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

# Importando do seu arquivo de serviços (llm.py)
from services.llm import transcribe_audio, text_to_speech, groq_chat, generate_visemes
from services.rag_search import obter_contexto_rag
from services.database import get_client

router = APIRouter()

@router.post("/chat")
async def process_voice_chat(
    audio: UploadFile = File(...),
    username: str = Form(...)
):
    try:
        # 1. Lê os bytes do áudio enviado pelo frontend
        raw_audio = await audio.read()

        # 2. STT: Transcreve o áudio para texto
        user_text = await transcribe_audio(raw_audio)
        
        if "[Erro" in user_text:
            return JSONResponse(status_code=500, content={"error": user_text})

        user_rows = get_client().table("users") \
            .select("custom_prompt, level, focus") \
            .eq("username", username) \
            .limit(1) \
            .execute().data
            
        user_data = user_rows[0] if user_rows else {}
        extra = (user_data.get("custom_prompt") or "").strip()
        nivel_ingles = user_data.get("level") or "Intermediate"
        objetivo_aluno = user_data.get("focus") or "General Conversation"

        instrucao_perfil = (
            f"\n\n--- STUDENT PROFILE ---\n"
            f"English Level: {nivel_ingles}\n"
            f"Main Focus: {objetivo_aluno}\n\n"
            "ADAPTATION RULES:\n"
            "- If the level is 'beginner' or 'Beginner': Speak very slowly, use extremely simple words and short sentences.\n"
            "- If the level is 'Intermediate' or 'intermediate': Speak naturally, introduce some useful phrasal verbs.\n"
            "- If the level is 'Advanced' or 'advanced': Talk like a native speaker, use idioms and complex vocabulary.\n"
            "- Always align the conversation with their Main Focus."
        )
        
        contexto_rag, _ = obter_contexto_rag(user_text)
        system_msg = (
            "You are Tati, a friendly English teacher. Reply in a short, conversational, and encouraging way. "
            "Always respond in English.\n"
            f"{instrucao_perfil}\n\n"
            f"--- LIBRARY CONTEXT (RAG) ---\n"
            f"Use this context if it answers the user's question:\n{contexto_rag}"
        )
        
        if extra:
            system_msg += f"\n\nExtra instructions from user:\n{extra}"
        # 3. LLM: Gera a resposta da Tati usando o texto do usuário e o contexto RAG
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_text}
        ]
        reply_text = await groq_chat(messages, max_tokens=200)

        # 4. TTS: Converte a resposta em áudio (Base64)
        tts_b64 = await text_to_speech(reply_text)

        # 5. VISEMAS: Pega o áudio e descobre as bocas
        viseme_map = await generate_visemes(tts_b64)

        # 6. Devolve tudo mastigado pro Frontend!
        return JSONResponse(content={
            "status": "success",
            "user_said": user_text,
            "reply_text": reply_text,
            "tts_b64": tts_b64,
            "viseme_map": viseme_map
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )