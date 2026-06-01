import logging
import io
import base64
from typing import Optional
from app.core.config import settings


# tirado de llm e transportado para o gerador de áudio
async def _tts_edge(text: str) -> str:
    """Edge TTS (Microsoft) - gratuito e boa qualidade."""
    try:
        import edge_tts

        # JennyNeural é geralmente mais rápida e estável que Ava
        communicate = edge_tts.Communicate(text, 'en-US-JennyNeural')
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk['type'] == 'audio':
                buf.write(chunk['data'])
        if buf.tell() == 0:
            return ''
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logging.info(f'[TTS] Edge TTS error: {exc}')
        return ''


async def _tts_gtts(text: str) -> str:
    try:
        from gtts import gTTS

        tts = gTTS(text=text, lang='en')
        buf = io.BytesIO()
        tts.write_to_fp(buf)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logging.info(f'[TTS] gTTS error: {exc}')
        return ''


async def generate_teacher_audio(texto: str) -> Optional[str]:
    """
    Recebe um texto (gerado pelo Groq), faz fallback automático para Edge TTS e, em seguida, para gTTS.
    """

    # Usando Edge TTS
    logging.info("[AudioGenerator] Tentando Edge TTS (JennyNeural)...")
    audio_b64 = await _tts_edge(texto)
    if audio_b64:
        logging.info(
            "✅ [AudioGenerator] Sucesso na geração de áudio via Edge TTS!")
        return audio_b64

    # Usando gTTS caso o Edge falhe
    logging.info("[AudioGenerator] Tentando gTTS (Fallback final)...")
    audio_b64 = await _tts_gtts(texto)
    if audio_b64:
        logging.info(
            "✅ [AudioGenerator] Sucesso na geração de áudio via gTTS!")
        return audio_b64

    logging.info(
        "❌ [AudioGenerator] CRÍTICO: Todos os métodos de geração de áudio falharam.")
    return None
