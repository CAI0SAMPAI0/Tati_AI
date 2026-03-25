import os
import io
import base64
import anthropic
import httpx
from google import genai
from google.genai import types
from typing import AsyncIterator
from groq import AsyncGroq, Groq
from gtts import gTTS

# ─── Configuração ────────────────────────────────────────────────────────────

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()  # "claude" | "gemini"

CLAUDE_MODEL  = os.getenv("CLAUDE_MODEL",  "claude-3-5-sonnet-20241022")
GEMINI_MODEL  = os.getenv("GEMINI_MODEL",  "gemini-2.0-flash")

ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_API_KEY     = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GROQ_API_KEY       = os.getenv("GROQ_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID           = os.getenv("VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel (default)

# ─── Tipos ───────────────────────────────────────────────────────────────────

Message = dict


# ─── Speech-to-Text (STT) ────────────────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, filename: str = "temp.wav") -> str:
    """Converte áudio em texto usando Groq Whisper.
    
    FIX: language='en' força o Whisper a transcrever SEMPRE em inglês,
    impedindo que detecte automaticamente o PT-BR e traduza o input.
    O aluno deve falar inglês — o que for dito é mantido em inglês.
    """
    if not GROQ_API_KEY:
        return "[Erro: GROQ_API_KEY não configurada]"

    client = Groq(api_key=GROQ_API_KEY)

    try:
        transcription = client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3",
            response_format="text",
            language="en",          # FIX: força inglês — sem isso o Whisper auto-detecta PT-BR
        )
        return transcription
    except Exception as e:
        print(f"Erro no STT: {e}")
        return f"[Erro no processamento de áudio: {str(e)}]"


# ─── Text-to-Speech (TTS) ────────────────────────────────────────────────────

async def text_to_speech(text: str) -> str:
    """Converte texto em áudio (base64). ElevenLabs como principal, gTTS como fallback."""
    if ELEVENLABS_API_KEY:
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
        headers = {
            "xi-api-key": ELEVENLABS_API_KEY,
            "Content-Type": "application/json"
        }
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=data)
                if response.status_code == 200:
                    return base64.b64encode(response.content).decode("utf-8")
                else:
                    print(f"ElevenLabs error: {response.text}")
            except Exception as e:
                print(f"TTS error: {e}")

    # Fallback gTTS
    try:
        tts = gTTS(text=text, lang='en')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        return base64.b64encode(fp.getvalue()).decode("utf-8")
    except Exception as e:
        print(f"gTTS error: {e}")
        return ""


# ─── Streaming por provider ──────────────────────────────────────────────────

async def stream_claude(system: str, history: list[Message]) -> AsyncIterator[str]:
    """Gera tokens via Anthropic streaming."""
    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

    formatted_history = []
    for m in history:
        formatted_history.append({"role": m["role"], "content": m["content"]})

    async with client.messages.stream(
        model=CLAUDE_MODEL,
        max_tokens=4096,
        system=system,
        messages=formatted_history,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def stream_gemini(system: str, history: list[Message]) -> AsyncIterator[str]:
    """Gera tokens via Google Gemini streaming."""
    import asyncio
    client = genai.Client(api_key=GOOGLE_API_KEY)

    gemini_history = []
    for msg in history[:-1]:
        role = "user" if msg["role"] == "user" else "model"
        gemini_history.append({"role": role, "parts": [{"text": msg["content"]}]})

    last_message = history[-1]["content"] if history else ""

    def _sync_stream():
        chunks = []
        response = client.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=gemini_history + [{"role": "user", "parts": [{"text": last_message}]}],
            config=types.GenerateContentConfig(system_instruction=system)
        )
        for chunk in response:
            if chunk.text:
                chunks.append(chunk.text)
        return chunks

    loop = asyncio.get_event_loop()
    chunks = await loop.run_in_executor(None, _sync_stream)

    for chunk in chunks:
        yield chunk


async def stream_groq(system: str, history: list[Message]) -> AsyncIterator[str]:
    """Gera tokens via Groq streaming."""
    client = AsyncGroq(api_key=GROQ_API_KEY)

    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})

    try:
        stream = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
    except Exception as e:
        print(f"Erro no Groq LLM: {e}")
        yield f"[Erro Groq: {str(e)}]"


async def stream_llm(system: str, history: list[Message]) -> AsyncIterator[str]:
    """Roteador principal — usa o provider definido em LLM_PROVIDER."""
    if LLM_PROVIDER == "gemini":
        async for token in stream_gemini(system, history):
            yield token
    elif LLM_PROVIDER == "groq":
        async for token in stream_groq(system, history):
            yield token
    else:  # padrão: claude
        async for token in stream_claude(system, history):
            yield token