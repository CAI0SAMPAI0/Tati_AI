"""
LLM: streaming, chat simples, STT e TTS.
Fallback automático entre chaves Groq.
"""
from __future__ import annotations

import base64
import io
from typing import AsyncIterator

from core.config import settings

Message = dict[str, str]

class GroqKeyError(Exception):
    """Levantada quando todas as chaves Groq falharam."""


def _is_auth_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "invalid_api_key" in msg or "401" in msg or "invalid api key" in msg


def _is_rate_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate_limit" in msg or "quota" in msg


def _should_try_next_key(exc: Exception) -> bool:
    return _is_auth_error(exc) or _is_rate_error(exc)


async def transcribe_audio(audio_bytes: bytes, filename: str = "temp.wav") -> str:
    """
    Transcreve áudio para texto usando Whisper Large V3.
    Detecta idioma automaticamente para melhor precisão.
    """
    from groq import AsyncGroq
    keys = settings.groq_keys
    if not keys:
        return "[Erro: nenhuma GROQ_API_KEY configurada no .env]"

    last_error: Exception | None = None
    for key in keys:
        try:
            client = AsyncGroq(api_key=key)
            resp = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",
                response_format="text",
            )
            return resp
        except Exception as exc:
            last_error = exc
            if _should_try_next_key(exc):
                continue
            break

    return f"[Erro no STT: {last_error}]"


async def text_to_speech(text: str) -> str:
    """Converte texto em audio base64. Edge TTS ou gTTS."""
    print("[TTS] Tentando Edge TTS...")
    result = await _tts_edge(text)
    if result:
        return result
    print("[TTS] Usando gTTS como fallback final.")
    return await _tts_gtts(text)

async def _tts_edge(text: str) -> str:
    """Edge TTS (Microsoft) - gratuito e boa qualidade."""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, "en-US-JennyNeural")
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        if buf.tell() == 0:
            return ""
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        print(f"[TTS] Edge TTS error: {exc}")
        return ""
async def _tts_gtts(text: str) -> str:
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang="en")
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        print(f"[TTS] gTTS error: {exc}")
        return ""


async def stream_llm(system: str, history: list[Message]) -> AsyncIterator[str]:
    provider = settings.llm_provider
    if provider == "groq":
        async for token in _stream_groq(system, history):
            yield token
    '''elif provider == "gemini":
        async for token in _stream_gemini(system, history):
            yield token
    else:
        async for token in _stream_claude(system, history):
            yield token'''


'''async def _stream_claude(system: str, history: list[Message]) -> AsyncIterator[str]:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    formatted = [{"role": m["role"], "content": m["content"]} for m in history]
    async with client.messages.stream(
        model=settings.claude_model,
        max_tokens=4096,
        system=system,
        messages=formatted,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _stream_gemini(system: str, history: list[Message]) -> AsyncIterator[str]:
    import asyncio
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    gemini_history = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in history[:-1]
    ]
    last_msg = history[-1]["content"] if history else ""

    def _sync_stream() -> list[str]:
        return [
            chunk.text
            for chunk in client.models.generate_content_stream(
                model=settings.gemini_model,
                contents=gemini_history + [{"role": "user", "parts": [{"text": last_msg}]}],
                config=types.GenerateContentConfig(system_instruction=system),
            )
            if chunk.text
        ]

    for chunk in await asyncio.get_event_loop().run_in_executor(None, _sync_stream):
        yield chunk'''


async def _stream_groq(system: str, history: list[Message]) -> AsyncIterator[str]:
    from groq import AsyncGroq
    keys = settings.groq_keys
    if not keys:
        yield "[Erro: nenhuma GROQ_API_KEY configurada no .env]"
        return

    messages = [{"role": "system", "content": system}] + [
        {"role": m["role"], "content": m["content"]} for m in history
    ]
    last_error: Exception | None = None

    for idx, key in enumerate(keys):
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
            return
        except Exception as exc:
            last_error = exc
            print(f"[Groq stream] key {idx + 1}/{len(keys)} falhou: {str(exc)[:100]}")
            if _should_try_next_key(exc):
                continue
            break

    yield f"[Erro Groq: todas as {len(keys)} chave(s) falharam. Ãšltimo: {str(last_error)[:120]}]"


# â”€â”€ Chat simples (nÃ£o-streaming) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


async def groq_chat(
    messages: list[dict],
    max_tokens: int = 1500,
    temperature: float = 0.4,
) -> str:
    """Chamada simples ao Groq com fallback automÃ¡tico entre chaves."""
    from groq import AsyncGroq
    keys = settings.groq_keys
    if not keys:
        raise GroqKeyError("Nenhuma GROQ_API_KEY configurada no .env")

    last_error: Exception | None = None
    for idx, key in enumerate(keys):
        try:
            client = AsyncGroq(api_key=key)
            resp = await client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            last_error = exc
            print(f"[Groq chat] key {idx + 1}/{len(keys)} falhou: {str(exc)[:100]}")
            if _should_try_next_key(exc):
                continue
            break

    raise GroqKeyError(f"Todas as chaves Groq falharam. Ãšltimo: {last_error}")


# â”€â”€ Visemas (animaÃ§Ã£o labial) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


async def generate_visemes(audio_b64: str) -> list:
    """Tenta gerar visemas com Rhubarb. Retorna lista vazia em caso de falha."""
    import json
    import os
    import subprocess
    import uuid

    file_id = str(uuid.uuid4())
    temp_audio = f"/tmp/{file_id}.mp3"
    temp_json = f"/tmp/{file_id}.json"

    try:
        audio_bytes = base64.b64decode(audio_b64)
        with open(temp_audio, "wb") as f:
            f.write(audio_bytes)

        subprocess.run(
            ["rhubarb.exe", "-f", "json", temp_audio, "-o", temp_json],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with open(temp_json) as f:
            return json.load(f).get("mouthCues", [])
    except Exception as exc:
        print(f"[Visemes] Rhubarb falhou: {exc}")
        return []
    finally:
        for path in (temp_audio, temp_json):
            if os.path.exists(path):
                os.remove(path)
