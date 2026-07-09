from __future__ import annotations

import logging

import base64
from typing import AsyncIterator

from app.core.config import settings

Message = dict[str, str]


class GroqKeyError(Exception):
    """Levantada quando todas as chaves Groq falharam."""


def _is_auth_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return 'invalid_api_key' in msg or '401' in msg or 'invalid api key' in msg


def _is_rate_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return '429' in msg or '413' in msg or 'rate_limit' in msg or 'quota' in msg or 'seconds of audio' in msg


def _should_try_next_key(exc: Exception) -> bool:
    return _is_auth_error(exc) or _is_rate_error(exc)


async def transcribe_audio(
    audio_bytes: bytes, filename: str = 'temp.wav', prompt: str = ''
) -> str:
    """
    Transcreve áudio para texto usando Whisper Large V3.
    Detecta idioma automaticamente para melhor precisão.
    O 'prompt' ajuda o Whisper com termos específicos (nomes, contexto).
    """
    from groq import AsyncGroq

    keys = settings.groq_keys
    if not keys:
        return '[Erro: nenhuma GROQ_API_KEY configurada no .env]'

    last_error: Exception | None = None
    for key in keys:
        try:
            client = AsyncGroq(api_key=key)
            # Whisper prompt: verbatim transcription, support mixed PT/EN
            # Expanded common English verbs to improve contextual
            # accuracy
            default_prompt = (
                "Transcribe the audio verbatim, word-for-word, exactly as spoken in English. "
                "Ignore background noise, clicks, breathing, or trailing silences. "
                "Context: English learning practice. Do not auto-correct grammar or pronunciation errors. "
                "Do not add extra filler words, pronouns, or prepositions if they were not fully spoken."
            )
            effective_prompt = (
                f'{default_prompt} {prompt}' if prompt else default_prompt)

            resp = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model='whisper-large-v3',
                response_format='text',
                prompt=effective_prompt,
            )
            return resp
        except Exception as exc:
            last_error = exc
            if _should_try_next_key(exc):
                continue
            break

    return f'[Erro no STT: {last_error}]'


async def transcribe_audio_verbose(
    audio_bytes: bytes, filename: str = 'temp.wav', prompt: str = ''
) -> dict:
    """
    Transcreve áudio para texto retornando metadados completos usando Whisper Large V3.
    """
    from groq import AsyncGroq
    import json

    keys = settings.groq_keys
    if not keys:
        return {"error": "Nenhuma GROQ_API_KEY configurada"}

    last_error: Exception | None = None
    for key in keys:
        try:
            client = AsyncGroq(api_key=key)
            default_prompt = (
                "Transcribe the audio verbatim, word-for-word, exactly as spoken in English. "
                "Ignore background noise, clicks, breathing, or trailing silences. "
                "Context: English learning practice. Do not auto-correct grammar or pronunciation errors. "
                "Do not add extra filler words, pronouns, or prepositions if they were not fully spoken."
            )
            effective_prompt = f'{default_prompt} {prompt}' if prompt else default_prompt

            resp = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model='whisper-large-v3',
                response_format='verbose_json',
                prompt=effective_prompt,
            )
            if isinstance(resp, str):
                return json.loads(resp)
            elif hasattr(resp, "model_dump"):
                return resp.model_dump()
            elif hasattr(resp, "dict"):
                return resp.dict()
            elif hasattr(resp, "__dict__"):
                return resp.__dict__
            else:
                return dict(resp)
        except Exception as exc:
            last_error = exc
            if _should_try_next_key(exc):
                continue
            break

    return {"error": f"Erro no STT: {last_error}"}


async def text_to_speech(text: str) -> str:
    """Converte texto em áudio base64 chamando o gerador com clonagem e fallbacks."""
    from app.modules.chat.services.audio_generator import generate_teacher_audio

    audio_b64 = await generate_teacher_audio(text)
    if audio_b64:
        return audio_b64

    # Caso crítico absoluto em que tudo falhe, retorna string vazia
    return ""


async def stream_llm(
    system: str, history: list[Message], max_tokens: int = 1500
) -> AsyncIterator[str]:
    provider = settings.llm_provider
    if provider == 'groq':
        async for token in _stream_groq(system, history, max_tokens=max_tokens):
            yield token


async def _stream_groq(
    system: str, history: list[Message], max_tokens: int = 1500
) -> AsyncIterator[str]:
    from groq import AsyncGroq

    keys = settings.groq_keys
    if not keys:
        yield '[Erro: nenhuma GROQ_API_KEY configurada no .env]'
        return

    messages = [{'role': 'system', 'content': system}] + [
        {'role': m['role'], 'content': m['content']} for m in history
    ]
    last_error: Exception | None = None

    # Models to try in order: fast small model first, fallback to large if 413
    model_queue = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
    current_model_idx = 0

    while current_model_idx < len(model_queue):
        current_model = model_queue[current_model_idx]
        succeeded = False

        for idx, key in enumerate(keys):
            try:
                client = AsyncGroq(api_key=key)
                stream = await client.chat.completions.create(
                    model=current_model,
                    messages=messages,
                    stream=True,
                    max_tokens=max_tokens,
                )
                async for chunk in stream:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                succeeded = True
                return
            except Exception as exc:
                last_error = exc
                err_str = str(exc)
                logging.info(
                    f'[Groq stream] model={current_model} key {idx + 1}/{len(keys)} falhou: {err_str[:120]}')

                # 413: payload too large — don't retry other keys, jump to next model
                if '413' in err_str:
                    logging.warning(
                        f'[Groq stream] 413 Too Large for {current_model}. Tentando próximo modelo...')
                    break

                if _should_try_next_key(exc):
                    continue
                break

        if succeeded:
            return

        # If we hit 413, escalate to the next model
        if last_error and '413' in str(last_error):
            current_model_idx += 1
        else:
            break

    yield f'[Erro Groq: todas as {len(keys)} chave(s) falharam. Último: {str(last_error)[:120]}]'



async def _groq_chat_attempt(
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    model: str,
) -> str:
    from groq import AsyncGroq

    keys = settings.groq_keys
    if not keys:
        raise GroqKeyError('Nenhuma GROQ_API_KEY configurada no .env')

    last_error: Exception | None = None
    for idx, key in enumerate(keys):
        try:
            client = AsyncGroq(api_key=key)
            resp = await client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=messages,
            )
            return resp.choices[0].message.content
        except Exception as exc:
            last_error = exc
            logging.info(
                f'[Groq chat] key {idx + 1}/{len(keys)} falhou: {str(exc)[:100]}')
            if _should_try_next_key(exc):
                continue
            break

    raise GroqKeyError(
        f'Todas as chaves Groq falharam. Último: {last_error}')


async def groq_chat(
    messages: list[dict],
    max_tokens: int = 1500,
    temperature: float = 0.4,
    model: str = 'llama-3.3-70b-versatile',
) -> str:
    """Chamada simples ao Groq com fallback automático entre chaves e modelos."""
    try:
        return await _groq_chat_attempt(messages, max_tokens, temperature, model)
    except Exception as e:
        if "rate_limit" in str(e).lower() and model == 'llama-3.3-70b-versatile':
            fallback_model = 'llama-3.1-8b-instant'
            logging.warning(f"[Groq chat] Rate limit hit for {model}. Falling back to {fallback_model}...")
            return await _groq_chat_attempt(messages, max_tokens, temperature, fallback_model)
        raise e


async def groq_chat_json(
    messages: list[dict],
    max_tokens: int = 1500,
    temperature: float = 0.4,
    model: str = 'llama-3.1-8b-instant',
) -> dict:
    """
    Chama o Groq, garante que a saída seja tratada como JSON,
    limpa tags markdown de código e faz o parse automático.
    Retorna um dicionário vazio em caso de falha de parse ou de rede.
    """
    import json
    import re

    # Injetamos uma instrução forte no final da última mensagem para
    # forçar saída JSON pura
    if messages and messages[-1]['role'] == 'user':
        messages[-1]['content'] += "\n\nCRITICAL: You must respond ONLY with a valid JSON object. Do not include markdown blocks like ```json. Return the raw JSON directly."

    try:
        raw_response = await groq_chat(messages, max_tokens, temperature, model)

        # Estratégia de limpeza: Tentar encontrar blocos markdown se a
        # IA ignorar o aviso
        clean_json = raw_response.strip()
        match = re.search(
            r'```(?:json)?\s*(.*?)\s*```',
            clean_json,
            re.DOTALL)
        if match:
            clean_json = match.group(1)
        else:
            # Fallback robusto: Tenta extrair qualquer coisa entre as
            # chaves principais
            match = re.search(r'\{.*\}', clean_json, re.DOTALL)
            if match:
                clean_json = match.group(0)

        return json.loads(clean_json)
    except Exception as e:
        logging.info(f"[LLM JSON] Falha severa ao extrair JSON: {e}")
        return {}


async def generate_visemes(audio_b64: str) -> list:
    """Tenta gerar visemas com Rhubarb. Retorna lista vazia em caso de falha."""
    import json
    import os
    import subprocess
    import uuid

    file_id = str(uuid.uuid4())
    temp_audio = f'/tmp/{file_id}.mp3'
    temp_json = f'/tmp/{file_id}.json'

    try:
        audio_bytes = base64.b64decode(audio_b64)
        with open(temp_audio, 'wb') as f:
            f.write(audio_bytes)

        subprocess.run(
            ['rhubarb.exe', '-f', 'json', temp_audio, '-o', temp_json],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with open(temp_json) as f:
            return json.load(f).get('mouthCues', [])
    except Exception as exc:
        logging.info(f'[Visemes] Rhubarb falhou: {exc}')
        return []
    finally:
        for path in (temp_audio, temp_json):
            if os.path.exists(path):
                os.remove(path)


async def generate_image(prompt: str) -> str:
    """
    Gera uma imagem usando OpenAI DALL-E 3 com fallback para busca na internet (Tavily).
    Retorna a URL da imagem gerada.
    """
    import httpx

    # 1. Tenta DALL-E 3 se houver chave
    if settings.openai_api_key:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/images/generations",
                    headers={
                        "Authorization": f"Bearer {settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "dall-e-3",
                        "prompt": f"A highly aesthetic, professional photograph or illustration depicting exactly this concept or scene: '{prompt}'. The image MUST be clearly recognizable and directly related to the subject. No words, no text, clean composition, minimalist background.",
                        "n": 1,
                        "size": "1024x1024",
                        "quality": "standard",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    url = data["data"][0]["url"]
                    url = data["data"][0]["url"]
                    return url
                else:
                    logging.info(
                        f"[LLM] DALL-E 3 falhou ({resp.status_code}): {resp.text}")
        except Exception as e:
            logging.info(f"[LLM] Erro excepcional no DALL-E: {e}")

    # 2. Fallback para busca na internet (Tavily)
    return await search_image_on_internet(prompt)


async def search_image_on_internet(query: str) -> str:
    """Busca uma imagem relevante na internet usando a API do Tavily, com ajuda do Groq para otimizar a busca."""
    import httpx
    try:
        # Usa Groq para gerar uma busca melhor em inglês (curta e
        # descritiva para imagens)
        optimized_query = query
        try:
            logging.info(
                f"[LLM] Requesting Groq to optimize query for: {query}")
            optimized_query = await groq_chat([
                {"role": "system", "content": "Generate a short, 3-4 word English search query to find a clear educational image for the following term. Output ONLY the query string, no quotes or explanations."},
                {"role": "user", "content": query}
            ], model='llama-3.1-8b-instant', max_tokens=100)
            optimized_query = optimized_query.strip().strip('"').strip("'")
            logging.info(
                f"[LLM] Optimized image search query: {optimized_query}")
        except Exception as groq_err:
            logging.info(f"[LLM] Groq optimization failed: {groq_err}")

        keys = settings.tavily_keys
        if not keys:
            logging.info("[LLM] Tavily API keys não configuradas.")
            return ""

        async with httpx.AsyncClient(timeout=15.0) as client:
            for key in keys:
                try:
                    logging.info(
                        f"[LLM] Trying Tavily search with query: {optimized_query}")
                    response = await client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": key,
                            "query": f"{optimized_query} high quality illustration",
                            "include_images": True,
                            "search_depth": "basic"
                        }
                    )

                    if response.status_code == 200:
                        data = response.json()
                        images = data.get('images', [])
                        logging.info(
                            f"[LLM] Tavily found {len(images)} images")
                        if images:
                            # Algumas vezes Tavily retorna objetos na
                            # lista de imagens
                            img = images[0]
                            if isinstance(img, dict) and 'url' in img:
                                return img['url']
                            return str(img)
                    else:
                        logging.info(
                            f"[LLM] Tavily API error ({
                                response.status_code}): {
                                response.text}")
                except Exception as inner_e:
                    logging.info(
                        f"[LLM] Erro com chave Tavily: {inner_e}")
                    continue

        return ""
    except Exception as e:
        logging.info(
            f"[LLM] Erro crítico ao buscar imagem na internet: {e}")
        return ""


async def describe_image_with_gemini(image_bytes: bytes) -> str:
    """Usa o Gemini 2.0 Flash para descrever uma imagem ou extrair seu texto (OCR)."""
    from app.core.config import settings
    import google.generativeai as genai
    from PIL import Image
    import io
    
    keys = [k for k in settings.gemini_keys() if k]
    if not keys:
        logging.info("[Gemini Vision] Nenhuma API Key do Gemini configurada.")
        return "[Erro: Nenhuma API Key do Gemini configurada.]"

    last_err = None
    for key in keys:
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel('gemini-2.0-flash')
            
            image = Image.open(io.BytesIO(image_bytes))
            
            prompt = (
                "You are an AI assistant. Analyze this image. "
                "If it contains text, perform OCR and extract the exact text in its original language. "
                "If it is an image/photo, describe what is in the image, any details, labels, or activities depicted. "
                "Output ONLY the extracted text or description, no pleasantries or meta-explanations. English preferred for descriptions, unless text is in another language."
            )
            
            def _generate():
                response = model.generate_content([prompt, image])
                return response.text
                
            text = await run_in_threadpool(_generate)
            return text.strip()
        except Exception as e:
            logging.info(f"[Gemini Vision] Falha ao chamar Gemini com chave: {e}")
            last_err = e
            
    return f"[Erro ao processar imagem via Gemini: {last_err}]"


def preprocess_image_with_opencv(image_bytes: bytes) -> bytes:
    """Usa OpenCV para decodificar, validar e redimensionar a imagem se necessário."""
    import cv2
    import numpy as np
    
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            logging.info("[OpenCV Preprocess] Não foi possível decodificar a imagem com OpenCV.")
            return image_bytes
            
        h, w = img.shape[:2]
        max_dim = 1024
        
        if max(h, w) > max_dim:
            if w > h:
                new_w = max_dim
                new_h = int(h * (max_dim / w))
            else:
                new_h = max_dim
                new_w = int(w * (max_dim / h))
                
            img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            logging.info(f"[OpenCV Preprocess] Imagem redimensionada de {w}x{h} para {new_w}x{new_h}")
            
            _, encoded_img = cv2.imencode('.jpg', img_resized)
            return encoded_img.tobytes()
            
        return image_bytes
    except Exception as e:
        logging.info(f"[OpenCV Preprocess] Erro no preprocessamento OpenCV: {e}")
        return image_bytes
