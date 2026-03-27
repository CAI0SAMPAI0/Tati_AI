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

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()  # "claude" | "gemini" | "groq"

CLAUDE_MODEL  = os.getenv("CLAUDE_MODEL",  "claude-3-5-sonnet-20241022")
GEMINI_MODEL  = os.getenv("GEMINI_MODEL",  "gemini-2.0-flash")

ANTHROPIC_API_KEY  = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_API_KEY     = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
VOICE_ID           = os.getenv("VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # Rachel (default)

# ─── Groq: coleta todas as chaves disponíveis no .env ────────────────────────
# Lê GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2, ... (sem limite)

def _load_groq_keys() -> list[str]:
    keys = []
    # Chave principal
    base = os.getenv("GROQ_API_KEY", "").strip()
    if base:
        keys.append(base)
    # Chaves numeradas: _1, _2, _3, ...
    i = 1
    while True:
        k = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
        if not k:
            break
        keys.append(k)
        i += 1
    return keys

GROQ_KEYS: list[str] = _load_groq_keys()

# ─── Tipos ───────────────────────────────────────────────────────────────────

Message = dict

# ─── Groq: cliente com fallback automático ───────────────────────────────────

class GroqKeyError(Exception):
    """Levantada quando todas as chaves Groq falharam."""
    pass


def _is_key_error(e: Exception) -> bool:
    """Retorna True se o erro indica chave inválida/expirada (não vale tentar de novo)."""
    msg = str(e).lower()
    return "invalid_api_key" in msg or "401" in msg or "invalid api key" in msg


def _is_rate_error(e: Exception) -> bool:
    """Retorna True se o erro é de quota/rate-limit (vale tentar próxima chave)."""
    msg = str(e).lower()
    return "429" in msg or "rate_limit" in msg or "rate limit" in msg or "quota" in msg


# ─── Speech-to-Text (STT) ────────────────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, filename: str = "temp.wav") -> str:
    """Converte áudio em texto usando Groq Whisper com fallback de chaves."""
    if not GROQ_KEYS:
        return "[Erro: nenhuma GROQ_API_KEY configurada no .env]"

    last_error = None
    for key in GROQ_KEYS:
        try:
            client = Groq(api_key=key)
            transcription = client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                response_format="text",
                language="en",
            )
            return transcription
        except Exception as e:
            last_error = e
            print(f"[STT] Chave falhou ({str(e)[:80]}), tentando próxima...")
            if _is_key_error(e):
                continue  # chave inválida → tenta a próxima
            if _is_rate_error(e):
                continue  # quota → tenta a próxima
            # Erro inesperado → para aqui
            break

    return f"[Erro no STT: {str(last_error)}]"


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

    formatted_history = [{"role": m["role"], "content": m["content"]} for m in history]

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
    """Gera tokens via Groq streaming com fallback automático entre chaves."""
    if not GROQ_KEYS:
        yield "[Erro: nenhuma GROQ_API_KEY configurada no .env]"
        return

    messages = [{"role": "system", "content": system}]
    for m in history:
        messages.append({"role": m["role"], "content": m["content"]})

    last_error = None
    for idx, key in enumerate(GROQ_KEYS):
        try:
            client = AsyncGroq(api_key=key)
            stream = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                stream=True,
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
            return  # sucesso — para aqui

        except Exception as e:
            last_error = e
            label = f"chave {idx + 1}/{len(GROQ_KEYS)}"
            print(f"[Groq stream] {label} falhou: {str(e)[:100]}")

            if _is_key_error(e) or _is_rate_error(e):
                continue  # tenta a próxima chave
            # Erro inesperado → não tenta mais
            break

    yield f"[Erro Groq: todas as {len(GROQ_KEYS)} chave(s) falharam. Último erro: {str(last_error)[:120]}]"


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


# ─── Groq não-streaming com fallback (usado pelo dashboard/insight) ──────────

async def groq_chat(messages: list[dict], max_tokens: int = 1500, temperature: float = 0.4) -> str:
    """
    Chamada simples (não-streaming) ao Groq com fallback de chaves.
    Lança GroqKeyError se todas as chaves falharem.
    """
    if not GROQ_KEYS:
        raise GroqKeyError("Nenhuma GROQ_API_KEY configurada no .env")

    last_error = None
    for idx, key in enumerate(GROQ_KEYS):
        try:
            client = AsyncGroq(api_key=key)
            response = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
            )
            return response.choices[0].message.content

        except Exception as e:
            last_error = e
            label = f"chave {idx + 1}/{len(GROQ_KEYS)}"
            print(f"[Groq chat] {label} falhou: {str(e)[:100]}")

            if _is_key_error(e) or _is_rate_error(e):
                continue
            break

    raise GroqKeyError(f"Todas as chaves Groq falharam. Último erro: {str(last_error)}")