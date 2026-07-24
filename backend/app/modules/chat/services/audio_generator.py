import base64
import io
import logging

from app.core.config import settings


# tirado de llm e transportado para o gerador de áudio
async def _tts_edge(text: str) -> str:
    """Edge TTS (Microsoft) - gratuito e boa qualidade."""
    try:
        import edge_tts

        # JennyNeural é geralmente mais rápida e estável que Ava
        communicate = edge_tts.Communicate(text, "en-US-JennyNeural")
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
    """
    Gera áudio usando um endpoint de XTTS (como um Hugging Face Space).
    Suporta tanto retorno de bytes brutos (WAV/MP3) quanto JSON com base64.
    """
    if not settings.xtts_api_url:
        return ""

    import base64

    import httpx

    url = settings.xtts_api_url.strip()
    payload = {
        "text": text,
        "language": settings.xtts_language,
        "speaker_wav": settings.xtts_speaker_wav,
    }

    try:
        logging.info(f"[TTS] Enviando requisição para XTTS API: {url}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=12.0)

            if resp.status_code != 200:
                logging.warning(
                    f"[TTS] XTTS API retornou status {resp.status_code}: {resp.text[:200]}"
                )
                return ""

            content_type = resp.headers.get("content-type", "").lower()

            if (
                "audio/" in content_type
                or resp.content.startswith(b"RIFF")
                or resp.content.startswith(b"ID3")
                or resp.content.startswith(b"\xff\xfb")
            ):
                logging.info(
                    "[TTS] XTTS retornou áudio binário bruto. Convertendo para base64."
                )
                return base64.b64encode(resp.content).decode("utf-8")

            try:
                data = resp.json()
                for key in ["audio", "audio_base64", "data", "wav_base64"]:
                    if key in data and isinstance(data[key], str):
                        val = data[key]
                        if "," in val:
                            val = val.split(",")[-1]
                        return val.strip()

                if (
                    "data" in data
                    and isinstance(data["data"], list)
                    and len(data["data"]) > 0
                ):
                    val = data["data"][0]
                    if isinstance(val, dict) and "data" in val:
                        val = val["data"]
                    if isinstance(val, str):
                        if "," in val:
                            val = val.split(",")[-1]
                        return val.strip()
            except Exception as json_err:
                logging.warning(
                    f"[TTS] Falha ao parsear resposta JSON do XTTS: {json_err}"
                )

            if len(resp.content) > 1000:
                logging.info(
                    "[TTS] Fallback: assumindo áudio binário do XTTS devido ao tamanho."
                )
                return base64.b64encode(resp.content).decode("utf-8")

    except Exception as exc:
        logging.warning(f"[TTS] Erro ao chamar XTTS API: {exc}")

    return ""


async def generate_teacher_audio(texto: str) -> str | None:
    """
    Recebe um texto (gerado pelo Groq), faz fallback automático para XTTS, Edge TTS e, em seguida, para gTTS.
    """
    if settings.xtts_api_url:
        logging.info("[AudioGenerator] Tentando XTTS (Hugging Face Space)...")
        audio_b64 = await _tts_xtts(texto)
        if audio_b64:
            logging.info("✅ [AudioGenerator] Sucesso na geração de áudio via XTTS!")
            return audio_b64
        logging.warning(
            "[AudioGenerator] XTTS falhou. Tentando Edge TTS de fallback..."
        )

    # Usando Edge TTS
    logging.info("[AudioGenerator] Tentando Edge TTS (JennyNeural)...")
    audio_b64 = await _tts_edge(texto)
    if audio_b64:
        logging.info("✅ [AudioGenerator] Sucesso na geração de áudio via Edge TTS!")
        return audio_b64

    # Usando gTTS caso o Edge falhe
    logging.info("[AudioGenerator] Tentando gTTS (Fallback final)...")
    audio_b64 = await _tts_gtts(texto)
    if audio_b64:
        logging.info("✅ [AudioGenerator] Sucesso na geração de áudio via gTTS!")
        return audio_b64

    logging.info(
        "❌ [AudioGenerator] CRÍTICO: Todos os métodos de geração de áudio falharam."
    )
    return None
