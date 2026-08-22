import base64
import io
import logging

from app.core.config import settings

VOICE_ACCENT_MAP = {
    "en-US": "en-US-JennyNeural",
    "en-GB": "en-GB-SoniaNeural",
    "en-AU": "en-AU-NatashaNeural",
    "en-IN": "en-IN-NeerjaNeural",
    "en-CA": "en-CA-ClaraNeural",
    "en-IE": "en-IE-EmilyNeural",
    "en-ZA": "en-ZA-LeahNeural",
}


async def _tts_edge(text: str, accent: str = "en-US") -> str:
    """Edge TTS (Microsoft) - gratuito e boa qualidade."""
    try:
        import edge_tts

        voice = VOICE_ACCENT_MAP.get(accent, "en-US-JennyNeural")
        communicate = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        if buf.tell() == 0:
            return ""
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logging.info(f"[TTS] Edge TTS error: {exc}")
        return ""


async def _tts_gtts(text: str) -> str:
    try:
        from gtts import gTTS

        tts = gTTS(text=text, lang="en")
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logging.info(f"[TTS] gTTS error: {exc}")
        return ""


async def _tts_xtts(text: str) -> str:
    if not settings.xtts_api_url:
        return ""

    try:
        import httpx

        url = settings.xtts_api_url.strip()
        payload = {
            "text": text,
            "language": settings.xtts_language,
            "speaker_wav": settings.xtts_speaker_wav,
        }

        logging.info(f"[TTS] Enviando requisição para XTTS API: {url}")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)

            if resp.status_code != 200:
                return ""

            content_type = resp.headers.get("content-type", "")

            if any(t in content_type for t in ["audio/", "application/octet-stream", "application/x-wav"]):
                return base64.b64encode(resp.content).decode("utf-8")

            try:
                data = resp.json()
                audio_b64 = data.get("audio") or data.get("audio_b64") or data.get("audio_base64") or data.get("data")

                if audio_b64 and isinstance(audio_b64, str):
                    if "," in audio_b64:
                        audio_b64 = audio_b64.split(",")[-1]
                    return audio_b64
            except Exception:
                pass
    except Exception as e:
        logging.warning(f"[TTS] XTTS erro geral: {e}")
    return ""


async def generate_teacher_audio(texto: str, accent: str = "en-US") -> str | None:
    """
    Recebe um texto, gera áudio via Edge TTS com o sotaque selecionado e faz fallback para XTTS/gTTS se necessário.
    """
    logging.info(f"[AudioGenerator] Gerando áudio via Edge TTS com sotaque '{accent}'...")
    audio_b64 = await _tts_edge(texto, accent=accent)
    if audio_b64:
        logging.info(f"✅ [AudioGenerator] Sucesso no áudio (Edge TTS, sotaque: {accent})!")
        return audio_b64

    if settings.xtts_api_url:
        logging.info("[AudioGenerator] Tentando XTTS como fallback...")
        audio_b64 = await _tts_xtts(texto)
        if audio_b64:
            logging.info("✅ [AudioGenerator] Sucesso via XTTS!")
            return audio_b64

    logging.info("[AudioGenerator] Tentando gTTS (fallback final)...")
    audio_b64 = await _tts_gtts(texto)
    if audio_b64:
        logging.info("✅ [AudioGenerator] Sucesso via gTTS!")
        return audio_b64

    logging.info("❌ [AudioGenerator] Todos os métodos de áudio falharam.")
    return None
