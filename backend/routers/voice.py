from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

# Importando do seu arquivo de serviços (llm.py)
from services.llm import transcribe_audio, text_to_speech, groq_chat, generate_visemes
from services.rag_search import obter_contexto_rag

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

        contexto_rag, _ = obter_contexto_rag(user_text)
        system_msg = (
            "You are Tati, a friendly English teacher. Reply in a short, conversational, and encouraging way. "
            "Use the provided context from our library if it answers the student's question.\n\n"
            f"LIBRARY CONTEXT:\n{contexto_rag}"
        )
        # 3. LLM: Gera a resposta da Tati usando o texto do usuário e o contexto RAG
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_text}
        ]
        reply_text = await groq_chat(messages, max_tokens=150)

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