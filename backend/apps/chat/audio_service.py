import os
import io
import re
import base64
import logging
import asyncio
from typing import List
from groq import AsyncGroq
import edge_tts

logger = logging.getLogger(__name__)

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


EMOJI_REGEX = re.compile(
    "["
    "\U00010000-\U0010ffff"
    "\u2600-\u27bf"
    "\u2300-\u23ff"
    "\u2b50\u2b55\u2934\u2935"
    "\u200d\ufe0f"
    "]+",
    flags=re.UNICODE,
)


def strip_emojis(text: str) -> str:
    """
    Remove todos os emojis, símbolos pictográficos e dingbats do texto
    para evitar que o TTS (Edge-TTS) tente lê-los ou pronunciá-los.
    """
    if not text:
        return ""
    cleaned = EMOJI_REGEX.sub("", text)
    return re.sub(r" {2,}", " ", cleaned).strip()


def clean_tts_text(text: str) -> str:
    if not text:
        return ""
    clean = strip_emojis(text.strip())
    if clean.startswith("```"):
        clean = re.sub(r"^```[\w]*\n?", "", clean)
        clean = re.sub(r"\n?```$", "", clean.strip())

    clean = re.sub(r"\{[\s\S]*\}", "", clean).strip()
    clean = re.sub(
        r"\"(reply|correction|drill|report)\"\s*:\s*(null|\"[^\"]*\")", "", clean
    ).strip()
    clean = (
        clean.replace("*", "")
        .replace("#", "")
        .replace("_", "")
        .replace("{", "")
        .replace("}", "")
    )
    return strip_emojis(clean.strip())


def get_groq_keys() -> List[str]:
    keys = []
    if os.getenv("GROQ_KEYS"):
        keys.extend([k.strip() for k in os.getenv("GROQ_KEYS").split(",") if k.strip()])
    for env_var in [
        "GROQ_API_KEY",
        "GROQ_API_KEY_1",
        "GROQ_API_KEY_2",
        "GROQ_API_KEY_3",
        "GROQ_API_KEY_4",
    ]:
        val = os.getenv(env_var)
        if val and val.strip() and val.strip() not in keys:
            keys.append(val.strip())
    return keys


class AudioService:
    @classmethod
    async def text_to_speech_async(cls, text: str, accent: str = "en-US") -> str:
        """
        Gera áudio MP3 em base64 nativamente assíncrono via Edge TTS.
        """
        cleaned = clean_tts_text(text)
        if not cleaned:
            return ""

        norm_accent = (accent or "en-US").strip()
        if norm_accent.lower() in ["en-uk", "uk", "en_gb", "en-gb", "british"]:
            norm_accent = "en-GB"
        elif norm_accent.lower() in ["en-us", "us", "en_us", "american"]:
            norm_accent = "en-US"
        elif norm_accent.lower() in ["en-au", "au", "en_au", "australian"]:
            norm_accent = "en-AU"
        elif norm_accent.lower() in ["en-ca", "ca", "en_ca", "canadian"]:
            norm_accent = "en-CA"
        elif norm_accent.lower() in ["en-ie", "ie", "irish"]:
            norm_accent = "en-IE"
        elif norm_accent.lower() in ["en-in", "in", "indian"]:
            norm_accent = "en-IN"

        voice = VOICE_ACCENT_MAP.get(norm_accent)
        if not voice:
            for k, v in VOICE_ACCENT_MAP.items():
                if k.lower() == norm_accent.lower():
                    voice = v
                    break
        if not voice:
            voice = "en-US-JennyNeural"
        try:
            communicate = edge_tts.Communicate(cleaned, voice)
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            if buf.tell() == 0:
                return ""
            return base64.b64encode(buf.getvalue()).decode()
        except Exception as e:
            logger.error(f"[AudioService] Erro no TTS Assíncrono: {e}")
            return ""

    @classmethod
    def text_to_speech(cls, text: str, accent: str = "en-US") -> str:
        """
        Fallback síncrono para conversão de texto em áudio.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import nest_asyncio

                nest_asyncio.apply()
                return loop.run_until_complete(cls.text_to_speech_async(text, accent))
            else:
                return asyncio.run(cls.text_to_speech_async(text, accent))
        except RuntimeError:
            return asyncio.run(cls.text_to_speech_async(text, accent))
        except Exception as e:
            logger.error(f"[AudioService] Erro no TTS síncrono: {e}")
            return ""

    @classmethod
    async def transcribe_audio_async(
        cls, audio_data: str | bytes, prompt: str = ""
    ) -> str:
        """
        Transcreve áudio com Groq Whisper de forma nativamente assíncrona e com failover multi-chaves.
        """
        keys = get_groq_keys()
        if not keys:
            logger.error("[AudioService] Nenhuma GROQ_API_KEY encontrada.")
            return ""

        if isinstance(audio_data, str):
            if "," in audio_data:
                audio_data = audio_data.split(",")[-1]
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception as e:
                logger.error(f"[AudioService] Erro ao decodificar base64: {e}")
                return ""
        else:
            audio_bytes = audio_data

        if not audio_bytes or len(audio_bytes) < 200:
            return ""

        noise_pattern = re.compile(
            r"^(t+s+h+|s+h+|tsh+|t+c+h+|ps+h+|[.\s?!,-]+|\[.*\]|\(.*\)|\{.*\})+$",
            re.IGNORECASE,
        )

        for key in keys:
            try:
                client = AsyncGroq(api_key=key)
                create_kwargs = {
                    "file": ("input.webm", audio_bytes),
                    "model": "whisper-large-v3-turbo",
                    "response_format": "text",
                    "temperature": 0.0,
                    "language": "en",
                }
                if prompt:
                    create_kwargs["prompt"] = prompt

                resp = await client.audio.transcriptions.create(**create_kwargs)
                if resp:
                    text = str(resp).strip()
                    if noise_pattern.match(text) or text.lower() in (
                        "tshh",
                        "tshh.",
                        "tshhhhhh.",
                        "shh",
                        "shhh",
                        "...",
                        "you",
                        "[blank_audio]",
                        "thank you.",
                        "thank you",
                    ):
                        logger.info(
                            f"[AudioService] Ignorando ruído de fundo/alucinação: {text}"
                        )
                        return ""
                    return text
            except Exception as e:
                logger.warning(
                    f"[AudioService] Whisper falhou na chave {key[:10]}: {e}"
                )

        return ""

    @classmethod
    def transcribe_audio(cls, audio_data: str | bytes, prompt: str = "") -> str:
        """
        Fallback síncrono para transcrição.
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                import nest_asyncio

                nest_asyncio.apply()
                return loop.run_until_complete(
                    cls.transcribe_audio_async(audio_data, prompt)
                )
            else:
                return asyncio.run(cls.transcribe_audio_async(audio_data, prompt))
        except RuntimeError:
            return asyncio.run(cls.transcribe_audio_async(audio_data, prompt))
        except Exception as e:
            logger.error(f"[AudioService] Erro no STT síncrono: {e}")
            return ""
