import logging
import io
import base64
import os
from typing import Optional
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings


# Cache global do pipeline do Kokoro para não recarregar em cada requisição
_kokoro_pipeline = None


def _generate_kokoro_local(text: str) -> str:
    """Função síncrona executada na threadpool para rodar o modelo Kokoro local."""
    global _kokoro_pipeline
    try:
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline
        
        if _kokoro_pipeline is None:
            logging.info("[TTS] Inicializando KPipeline para Kokoro local...")
            _kokoro_pipeline = KPipeline(lang_code='a')
            
        voice = os.getenv("KOKORO_VOICE", "af_bella")
        logging.info(f"[TTS] Gerando áudio via Kokoro local com a voz: {voice}")
        generator = _kokoro_pipeline(text, voice=voice, speed=1.0)
        
        audio_chunks = []
        for _, _, audio in generator:
            audio_chunks.append(audio)
            
        if not audio_chunks:
            return ''
            
        full_audio = np.concatenate(audio_chunks)
        buf = io.BytesIO()
        sf.write(buf, full_audio, 24000, format='WAV')
        return base64.b64encode(buf.getvalue()).decode('utf-8')
    except Exception as e:
        logging.warning(f'[TTS] Erro no Kokoro local: {e}')
        return ''


async def _tts_kokoro(text: str) -> str:
    """
    Tenta gerar áudio com Kokoro-TTS.
    1. Se KOKORO_API_URL estiver definido, tenta via API remota.
    2. Fallback: tenta rodar o Kokoro localmente se a biblioteca 'kokoro' estiver instalada.
    """
    kokoro_api_url = os.getenv("KOKORO_API_URL")
    if kokoro_api_url:
        import httpx
        logging.info(f"[TTS] Tentando Kokoro via API remota: {kokoro_api_url}")
        try:
            voice = os.getenv("KOKORO_VOICE", "af_bella")
            endpoint = kokoro_api_url.rstrip('/')
            
            # Formato OpenAI padrão /v1/audio/speech
            if not (endpoint.endswith('/speech') or endpoint.endswith('/tts') or endpoint.endswith('/speech')):
                endpoint_url = f"{endpoint}/v1/audio/speech"
            else:
                endpoint_url = endpoint

            payload = {
                "model": "kokoro",
                "input": text,
                "voice": voice,
                "response_format": "mp3"
            }
            
            headers = {}
            api_key = os.getenv("KOKORO_API_KEY")
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
                
            async with httpx.AsyncClient() as client:
                resp = await client.post(endpoint_url, json=payload, headers=headers, timeout=20.0)
                if resp.status_code == 200:
                    return base64.b64encode(resp.content).decode('utf-8')
                
                # Tenta formato simples de fallback /tts
                resp_simple = await client.post(
                    f"{endpoint}/tts" if not endpoint.endswith('/tts') else endpoint,
                    json={"text": text, "voice": voice},
                    timeout=20.0
                )
                if resp_simple.status_code == 200:
                    return base64.b64encode(resp_simple.content).decode('utf-8')
        except Exception as api_err:
            logging.warning(f"[TTS] Erro na API do Kokoro: {api_err}")

    # Fallback local (biblioteca kokoro)
    try:
        import kokoro
        import soundfile
        logging.info("[TTS] Biblioteca 'kokoro' instalada. Iniciando inferência local...")
        return await run_in_threadpool(_generate_kokoro_local, text)
    except ImportError:
        logging.info("[TTS] Biblioteca 'kokoro' não está instalada localmente.")
        
    return ''


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


async def _tts_xtts(text: str) -> str:
    """
    Gera áudio usando um endpoint de XTTS (como um Hugging Face Space).
    Suporta tanto retorno de bytes brutos (WAV/MP3) quanto JSON com base64.
    """
    if not settings.xtts_api_url:
        return ''

    import httpx
    import base64

    url = settings.xtts_api_url.strip()
    payload = {
        "text": text,
        "language": settings.xtts_language,
        "speaker_wav": settings.xtts_speaker_wav
    }

    try:
        logging.info(f"[TTS] Enviando requisição para XTTS API: {url}")
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=12.0)
            
            if resp.status_code != 200:
                logging.warning(f"[TTS] XTTS API retornou status {resp.status_code}: {resp.text[:200]}")
                return ''
            
            content_type = resp.headers.get("content-type", "").lower()
            
            if "audio/" in content_type or resp.content.startswith(b"RIFF") or resp.content.startswith(b"ID3") or resp.content.startswith(b"\xff\xfb"):
                logging.info("[TTS] XTTS retornou áudio binário bruto. Convertendo para base64.")
                return base64.b64encode(resp.content).decode("utf-8")
            
            try:
                data = resp.json()
                for key in ["audio", "audio_base64", "data", "wav_base64"]:
                    if key in data and isinstance(data[key], str):
                        val = data[key]
                        if "," in val:
                            val = val.split(",")[-1]
                        return val.strip()
                
                if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                    val = data["data"][0]
                    if isinstance(val, dict) and "data" in val:
                        val = val["data"]
                    if isinstance(val, str):
                        if "," in val:
                            val = val.split(",")[-1]
                        return val.strip()
            except Exception as json_err:
                logging.warning(f"[TTS] Falha ao parsear resposta JSON do XTTS: {json_err}")
                
            if len(resp.content) > 1000:
                logging.info("[TTS] Fallback: assumindo áudio binário do XTTS devido ao tamanho.")
                return base64.b64encode(resp.content).decode("utf-8")

    except Exception as exc:
        logging.warning(f"[TTS] Erro ao chamar XTTS API: {exc}")
    
    return ''


async def generate_teacher_audio(texto: str) -> Optional[str]:
    """
    Recebe um texto (gerado pelo Groq), faz fallback automático na seguinte ordem:
    Kokoro-TTS -> XTTS -> Edge TTS -> gTTS.
    """
    # 1. Tentando Kokoro-TTS (Preferencial)
    logging.info("[AudioGenerator] Tentando Kokoro-TTS...")
    audio_b64 = await _tts_kokoro(texto)
    if audio_b64:
        logging.info("✅ [AudioGenerator] Sucesso na geração de áudio via Kokoro-TTS!")
        return audio_b64
    logging.warning("[AudioGenerator] Kokoro-TTS não pôde ser gerado (não configurado ou falhou).")

    # 2. Tentando XTTS
    if settings.xtts_api_url:
        logging.info("[AudioGenerator] Tentando XTTS (Hugging Face Space)...")
        audio_b64 = await _tts_xtts(texto)
        if audio_b64:
            logging.info("✅ [AudioGenerator] Sucesso na geração de áudio via XTTS!")
            return audio_b64
        logging.warning("[AudioGenerator] XTTS falhou. Tentando Edge TTS de fallback...")

    # 3. Usando Edge TTS
    logging.info("[AudioGenerator] Tentando Edge TTS (JennyNeural)...")
    audio_b64 = await _tts_edge(texto)
    if audio_b64:
        logging.info(
            "✅ [AudioGenerator] Sucesso na geração de áudio via Edge TTS!")
        return audio_b64

    # 4. Usando gTTS caso o Edge falhe
    logging.info("[AudioGenerator] Tentando gTTS (Fallback final)...")
    audio_b64 = await _tts_gtts(texto)
    if audio_b64:
        logging.info(
            "✅ [AudioGenerator] Sucesso na geração de áudio via gTTS!")
        return audio_b64

    logging.info(
        "❌ [AudioGenerator] CRÍTICO: Todos os métodos de geração de áudio falharam.")
    return None
