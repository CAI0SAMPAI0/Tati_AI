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


async def transcribe_audio(audio_bytes: bytes, filename: str = "temp.wav", prompt: str = "") -> str:
    """
    Transcreve áudio para texto usando Whisper Large V3.
    Detecta idioma automaticamente para melhor precisão.
    O 'prompt' ajuda o Whisper com termos específicos (nomes, contexto).
    """
    from groq import AsyncGroq
    keys = settings.groq_keys
    if not keys:
        return "[Erro: nenhuma GROQ_API_KEY configurada no .env]"

    last_error: Exception | None = None
    for key in keys:
        try:
            client = AsyncGroq(api_key=key)
            # Whisper prompt: verbatim transcription, support mixed PT/EN
            # Expanded common English verbs to improve contextual accuracy
            default_prompt = (
                "Transcreva exatamente o que foi dito, palavra por palavra. Não traduza. "
                "Suporta Português e Inglês misturados. "
                "Context: English learning practice. Phonetic accuracy is critical. "
                "Pay close attention to common verbs: 'buy' (not by/bye), 'eat', 'order', 'want', 'need', 'go', 'work', 'study', 'think', 'believe', 'understand', 'explain', 'practice', 'improve', 'learn'. "
                "Distinguish between 'can' and 'can't', 'do' and 'does', 'did' and 'done'."
            )
            effective_prompt = f"{default_prompt} {prompt}" if prompt else default_prompt

            resp = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3-turbo",
                response_format="text",
                prompt=effective_prompt
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


async def stream_llm(system: str, history: list[Message], max_tokens: int = 1500) -> AsyncIterator[str]:
    provider = settings.llm_provider
    if provider == "groq":
        async for token in _stream_groq(system, history, max_tokens=max_tokens):
            yield token

async def _stream_groq(system: str, history: list[Message], max_tokens: int = 1500) -> AsyncIterator[str]:
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
                model="llama-3.1-8b-instant",
                messages=messages,
                stream=True,
                max_tokens=max_tokens,
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
