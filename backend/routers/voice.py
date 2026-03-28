from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

# Importando do seu arquivo de serviços (llm.py)
from services.llm import transcribe_audio, text_to_speech, groq_chat, generate_visemes

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

        # 3. LLM: Manda pro Groq gerar a resposta da Tati
        # Aqui montamos um histórico simples. Depois você pode puxar do banco de dados!
        messages = [
            {"role": "system", "content": "You are Tati, a friendly English teacher. Reply in a short, conversational, and encouraging way."},
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