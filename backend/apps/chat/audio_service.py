import os
import io
import re
import base64
import logging
import asyncio
from asgiref.sync import async_to_sync
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
    "en-CN": "zh-CN-XiaoxiaoNeural",
    "en-HK": "en-HK-YanNeural",
    "en-KR": "ko-KR-SunHiNeural",
    "en-JP": "ko-KR-SunHiNeural",
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


_gemini_client = None


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            try:
                from google import genai
                _gemini_client = genai.Client(api_key=api_key.strip())
            except Exception as e:
                logger.error(f"[AudioService] Erro ao instanciar genai.Client: {e}")
    return _gemini_client


def detect_audio_mime_type(audio_bytes: bytes) -> str:
    """
    Detecta o MIME type a partir dos magic bytes do arquivo de áudio.
    """
    if audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    elif audio_bytes.startswith(b"OggS"):
        return "audio/ogg"
    elif audio_bytes.startswith(b"RIFF"):
        return "audio/wav"
    elif audio_bytes.startswith((b"\x00\x00\x00\x18ftypmp42", b"\x00\x00\x00\x20ftypM4A ", b"\x00\x00\x00\x1cftypM4A ")):
        return "audio/m4a"
    elif b"ftyp" in audio_bytes[:16]:
        return "audio/mp4"
    elif audio_bytes.startswith((b"ID3", b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
        return "audio/mp3"
    return "audio/webm"


NOISE_PATTERN = re.compile(
    r"^(t+s+h+|s+h+|tsh+|t+c+h+|ps+h+|[.\s?!,-]+|\[.*\]|\(.*\)|\{.*\})+$",
    re.IGNORECASE,
)
NOISE_STRINGS = {
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
    "subtitles by",
}


def is_noise_or_hallucination(text: str) -> bool:
    if not text:
        return True
    cleaned = text.strip()
    return bool(NOISE_PATTERN.match(cleaned) or cleaned.lower() in NOISE_STRINGS)


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
        lower_acc = norm_accent.lower().replace("_", "-")
        if lower_acc in ["en-uk", "uk", "en-gb", "british"]:
            norm_accent = "en-GB"
        elif lower_acc in ["en-us", "us", "american"]:
            norm_accent = "en-US"
        elif lower_acc in ["en-au", "au", "australian"]:
            norm_accent = "en-AU"
        elif lower_acc in ["en-ca", "ca", "canadian"]:
            norm_accent = "en-CA"
        elif lower_acc in ["en-ie", "ie", "irish"]:
            norm_accent = "en-IE"
        elif lower_acc in ["en-in", "in", "indian"]:
            norm_accent = "en-IN"
        elif lower_acc in ["en-za", "za", "south-african", "south-africa"]:
            norm_accent = "en-ZA"
        elif lower_acc in ["en-nz", "nz", "new-zealand"]:
            norm_accent = "en-NZ"
        elif lower_acc in ["en-sg", "sg", "singapore"]:
            norm_accent = "en-SG"
        elif lower_acc in ["en-ph", "ph", "philippines"]:
            norm_accent = "en-PH"
        elif lower_acc in ["en-ng", "ng", "nigerian", "nigeria"]:
            norm_accent = "en-NG"
        elif lower_acc in ["en-cn", "cn", "chinese", "chines", "zh-cn"]:
            norm_accent = "en-CN"
        elif lower_acc in ["en-hk", "hk", "hong-kong", "hong kong"]:
            norm_accent = "en-HK"
        elif lower_acc in ["en-kr", "kr", "korean", "coreano", "ko-kr"]:
            norm_accent = "en-KR"
        elif lower_acc in ["en-jp", "jp", "japanese", "japones", "ja-jp"]:
            norm_accent = "en-KR"

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
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(lambda: asyncio.run(cls.text_to_speech_async(text, accent)))
                    return future.result(timeout=30)
            else:
                return async_to_sync(cls.text_to_speech_async)(text, accent)
        except Exception as e:
            logger.error(f"[AudioService] Erro no TTS síncrono: {e}")
            return ""

    @classmethod
    async def _transcribe_gemini_async(
        cls, audio_bytes: bytes, mime_type: str, prompt: str = ""
    ) -> str:
        """
        Transcreve áudio via Google Gemini STT em memória (Inline Data).
        """
        client = get_gemini_client()
        if not client:
            return ""

        try:
            from google.genai import types

            model = os.getenv("GEMINI_AUDIO_MODEL", "gemini-3.5-transcribe")
            contents = [
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
            ]
            instruction = (
                prompt
                or "Transcribe the audio speech accurately. Preserve the language spoken (English or Portuguese). "
                "Output only the verbatim transcription without markdown, introductions or commentary."
            )
            contents.append(instruction)

            resp = await client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(temperature=0.0),
            )
            if not resp or not resp.candidates:
                return ""

            cand = resp.candidates[0]
            if cand.content and cand.content.parts:
                for part in cand.content.parts:
                    if hasattr(part, "audio_transcription") and part.audio_transcription:
                        return (part.audio_transcription.text or "").strip()
                    elif getattr(part, "text", None):
                        return (part.text or "").strip()
            return ""
        except Exception as e:
            logger.warning(f"[AudioService] Gemini STT falhou ({os.getenv('GEMINI_AUDIO_MODEL', 'gemini-3.5-transcribe')}): {e}")
            # Fallback secundário para gemini-3.5-flash
            try:
                from google.genai import types
                resp = await client.aio.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=[
                        types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                        prompt or "Transcribe audio speech verbatim. Output text only."
                    ],
                    config=types.GenerateContentConfig(temperature=0.0),
                )
                if resp and resp.candidates:
                    cand = resp.candidates[0]
                    if cand.content and cand.content.parts:
                        for part in cand.content.parts:
                            if getattr(part, "text", None):
                                return (part.text or "").strip()
            except Exception as e2:
                logger.warning(f"[AudioService] Fallback Gemini Flash também falhou: {e2}")
            return ""

    @classmethod
    async def _transcribe_groq_async(
        cls, audio_bytes: bytes, prompt: str = ""
    ) -> str:
        """
        Transcreve áudio com Groq Whisper com failover multi-chaves.
        """
        keys = get_groq_keys()
        if not keys:
            logger.warning("[AudioService] Nenhuma GROQ_API_KEY para fallback.")
            return ""

        for key in keys:
            try:
                async with AsyncGroq(api_key=key) as client:
                    create_kwargs = {
                        "file": ("input.webm", audio_bytes),
                        "model": "whisper-large-v3",
                        "response_format": "text",
                        "temperature": 0.0,
                        "language": "en",
                    }
                    if prompt:
                        create_kwargs["prompt"] = prompt

                    resp = await client.audio.transcriptions.create(**create_kwargs)
                    if resp:
                        text = str(resp).strip()
                        if is_noise_or_hallucination(text):
                            logger.info(f"[AudioService] Whisper ruído ignorado: {text}")
                            return ""
                        return text
            except Exception as e:
                logger.warning(f"[AudioService] Whisper falhou na chave {key[:10]}: {e}")
        return ""

    @classmethod
    async def transcribe_audio_async(
        cls, audio_data: str | bytes, prompt: str = ""
    ) -> str:
        """
        Transcreve áudio de forma nativamente assíncrona.
        Motor Primário: Groq Whisper Large v3 Turbo (ultrarrápido, ~0.7s, sem latência em áudios longos).
        Motor Fallback: Google Gemini STT (inline em memória, alta precisão).
        """
        if isinstance(audio_data, str):
            if "," in audio_data:
                audio_data = audio_data.split(",")[-1]
            try:
                audio_bytes = base64.b64decode(audio_data, validate=True)
            except Exception as e:
                logger.error(f"[AudioService] Erro ao decodificar base64: {e}")
                return ""
        else:
            audio_bytes = audio_data

        if not audio_bytes or len(audio_bytes) < 200:
            return ""

        if len(audio_bytes) > 15 * 1024 * 1024:
            logger.warning("[AudioService] Áudio rejeitado por exceder 15 MB")
            return ""

        known_audio_headers = (b"\x1a\x45\xdf\xa3", b"OggS", b"RIFF", b"\x00\x00\x00", b"ID3", b"\xff\xfb")
        if not (audio_bytes.startswith(known_audio_headers) or b"ftyp" in audio_bytes[:16]):
            logger.warning("[AudioService] Áudio rejeitado por formato inválido")
            return ""

        # 1. Tentar Groq Whisper como motor primário (< 1 segundo até em áudios longos)
        groq_text = await cls._transcribe_groq_async(audio_bytes=audio_bytes, prompt=prompt)
        if groq_text and not is_noise_or_hallucination(groq_text):
            logger.info(f"[AudioService] Transcrito com Groq Whisper: '{groq_text[:40]}...'")
            return groq_text

        # 2. Fallback resiliente para Google Gemini STT
        if get_gemini_client():
            mime_type = detect_audio_mime_type(audio_bytes)
            logger.info("[AudioService] Utilizando Gemini STT como fallback de transcrição...")
            gemini_text = await cls._transcribe_gemini_async(
                audio_bytes=audio_bytes, mime_type=mime_type, prompt=prompt
            )
            if gemini_text and not is_noise_or_hallucination(gemini_text):
                logger.info(f"[AudioService] Transcrito com Gemini STT: '{gemini_text[:40]}...'")
                return gemini_text

        return ""

    @classmethod
    def transcribe_audio(cls, audio_data: str | bytes, prompt: str = "") -> str:
        """
        Fallback síncrono para transcrição.
        """
        try:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                    future = pool.submit(lambda: asyncio.run(cls.transcribe_audio_async(audio_data, prompt)))
                    return future.result(timeout=30)
            else:
                return async_to_sync(cls.transcribe_audio_async)(audio_data, prompt)
        except Exception as e:
            logger.error(f"[AudioService] Erro no STT síncrono: {e}")
            return ""
