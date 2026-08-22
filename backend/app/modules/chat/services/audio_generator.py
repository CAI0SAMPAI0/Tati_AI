import base64
import io
import json
import logging
import re

from app.core.config import settings

VOICE_ACCENT_MAP = {
    "en-US": "en-US-JennyNeural",
    "en-GB": "en-GB-SoniaNeural",
    "en-AU": "en-AU-NatashaNeural",
    "en-CA": "en-CA-ClaraNeural",
    "en-IE": "en-IE-EmilyNeural",
    "en-IN": "en-IN-NeerjaNeural",
    "en-ZA": "en-ZA-LeahNeural",
    "en-NZ": "en-NZ-MollyNeural",
    "en-SG": "en-SG-LunaNeural",
    "en-PH": "en-PH-RosaNeural",
    "en-NG": "en-NG-EzinneNeural",
}


def normalize_accent(accent: str | None) -> str:
    """Normaliza o código do sotaque para uma chave válida no VOICE_ACCENT_MAP."""
    if not accent:
        return "en-US"
    cleaned = accent.strip().replace("_", "-")
    for key in VOICE_ACCENT_MAP:
        if key.lower() == cleaned.lower() or key.split("-")[-1].lower() == cleaned.lower():
            return key
    return "en-US"


def clean_tts_text(text: str) -> str:
    """Extrai apenas o texto falável em linguagem natural para o TTS,
    garantindo que NUNCA leia chaves JSON (reply, drill, correction, null, etc)
    e NUNCA repita o texto caso a IA tenha enviado o texto e o JSON juntos."""
    if not text:
        return "Please, repeat."

    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```[\w]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())

    json_match = re.search(r"\{[\s\S]*\"reply\"[\s\S]*\}", clean)
    reply_from_json = ""
    pre_text = ""

    if json_match:
        json_str = json_match.group(0)
        pre_text = clean[: clean.find(json_str)].strip()
        try:
            data = json.loads(json_str)
            if isinstance(data, dict):
                reply_from_json = (data.get("reply") or "").strip()
        except Exception:
            r_match = re.search(r'"reply"\s*:\s*"([^"]*)"', json_str)
            if r_match:
                reply_from_json = r_match.group(1).strip()

    final_tts = ""
    if pre_text and reply_from_json:
        if reply_from_json in pre_text:
            final_tts = pre_text
        elif pre_text in reply_from_json:
            final_tts = reply_from_json
        else:
            final_tts = f"{pre_text}. {reply_from_json}"
    elif pre_text:
        final_tts = pre_text
    elif reply_from_json:
        final_tts = reply_from_json
    else:
        cleaned = re.sub(r"\{[\s\S]*\}", "", clean).strip()
        cleaned = re.sub(
            r"\{?\s*\"(reply|correction|drill|report)\"\s*:[\s\S]*$", "", cleaned
        ).strip()
        final_tts = cleaned or clean

    final_tts = re.sub(
        r"\{?\s*\"(reply|correction|drill|report)\"\s*:[\s\S]*$", "", final_tts
    ).strip()
    final_tts = re.sub(
        r"\"(reply|correction|drill|report)\"\s*:\s*(null|\"[^\"]*\")",
        "",
        final_tts,
    ).strip()
    final_tts = (
        final_tts.replace("*", "")
        .replace("#", "")
        .replace("_", "")
        .replace("{", "")
        .replace("}", "")
    )

    return final_tts.strip() or "Please, repeat."


async def _tts_edge(text: str, accent: str = "en-US") -> str:
    """Edge TTS (Microsoft) - gratuito e boa qualidade com suporte a múltiplos sotaques em inglês."""
    try:
        import edge_tts

        normalized_accent = normalize_accent(accent)
        voice = VOICE_ACCENT_MAP.get(normalized_accent, "en-US-JennyNeural")
        communicate = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        if buf.tell() == 0:
            logging.warning(f"[TTS] Edge TTS produced empty audio buffer for voice {voice}")
            return ""
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:
        logging.error(f"[TTS] Edge TTS error for accent '{accent}': {exc}")
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
    Recebe um texto, limpa de metadados e gera áudio via Edge TTS com o sotaque selecionado.
    Faz fallback para XTTS/gTTS se necessário.
    """
    cleaned_text = clean_tts_text(texto)
    normalized_accent = normalize_accent(accent)
    logging.info(f"[AudioGenerator] Gerando áudio via Edge TTS com sotaque '{normalized_accent}' ({VOICE_ACCENT_MAP.get(normalized_accent)})...")
    audio_b64 = await _tts_edge(cleaned_text, accent=normalized_accent)
    if audio_b64:
        logging.info(f"✅ [AudioGenerator] Sucesso no áudio (Edge TTS, sotaque: {normalized_accent})!")
        return audio_b64

    if settings.xtts_api_url:
        logging.info("[AudioGenerator] Tentando XTTS como fallback...")
        audio_b64 = await _tts_xtts(cleaned_text)
        if audio_b64:
            logging.info("✅ [AudioGenerator] Sucesso via XTTS!")
            return audio_b64

    logging.info("[AudioGenerator] Tentando gTTS (fallback final)...")
    audio_b64 = await _tts_gtts(cleaned_text)
    if audio_b64:
        logging.info("✅ [AudioGenerator] Sucesso via gTTS!")
        return audio_b64

    logging.info("❌ [AudioGenerator] Todos os métodos de áudio falharam.")
    return None
