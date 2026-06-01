from __future__ import annotations

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
            # Expanded common English verbs to improve contextual accuracy
            default_prompt = (
                'Transcreva exatamente o que foi dito, palavra por palavra. Ignore ruídos de fundo, cliques ou respiração. '
                'Se não houver fala clara, não transcreva nada. '
                'Context: English learning practice. Phonetic accuracy is critical. '
                "Pay close attention to common verbs: 'buy', 'eat', 'order', 'want', 'need', 'go', 'work', 'study', 'think', 'believe', 'understand', 'explain', 'practice', 'improve', 'learn'. "
                "Distinguish between 'can' and 'can't', 'do' and 'does', 'did' and 'done'."
            )
            effective_prompt = (
                f'{default_prompt} {prompt}' if prompt else default_prompt
            )

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

    for idx, key in enumerate(keys):
        try:
            client = AsyncGroq(api_key=key)
            stream = await client.chat.completions.create(
                model='llama-3.1-8b-instant',
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
            print(f'[Groq stream] key {idx + 1}/{len(keys)} falhou: {str(exc)[:100]}')
            if _should_try_next_key(exc):
                continue
            break

    yield f'[Erro Groq: todas as {len(keys)} chave(s) falharam. Ãšltimo: {str(last_error)[:120]}]'


async def groq_chat(
    messages: list[dict],
    max_tokens: int = 1500,
    temperature: float = 0.4,
    model: str = 'llama-3.3-70b-versatile',
) -> str:
    """Chamada simples ao Groq com fallback automático entre chaves."""
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
            print(f'[Groq chat] key {idx + 1}/{len(keys)} falhou: {str(exc)[:100]}')
            if _should_try_next_key(exc):
                continue
            break

    raise GroqKeyError(f'Todas as chaves Groq falharam. Ãšltimo: {last_error}')


async def groq_chat_json(
    messages: list[dict],
    max_tokens: int = 1500,
    temperature: float = 0.4,
    model: str = 'llama-3.3-70b-versatile',
) -> dict:
    """
    Chama o Groq, garante que a saída seja tratada como JSON,
    limpa tags markdown de código e faz o parse automático.
    Retorna um dicionário vazio em caso de falha de parse ou de rede.
    """
    import json
    import re
    
    # Injetamos uma instrução forte no final da última mensagem para forçar saída JSON pura
    if messages and messages[-1]['role'] == 'user':
        messages[-1]['content'] += "\n\nCRITICAL: You must respond ONLY with a valid JSON object. Do not include markdown blocks like ```json. Return the raw JSON directly."
    
    try:
        raw_response = await groq_chat(messages, max_tokens, temperature, model)
        
        # Estratégia de limpeza: Tentar encontrar blocos markdown se a IA ignorar o aviso
        clean_json = raw_response.strip()
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', clean_json, re.DOTALL)
        if match:
            clean_json = match.group(1)
        else:
            # Fallback robusto: Tenta extrair qualquer coisa entre as chaves principais
            match = re.search(r'\{.*\}', clean_json, re.DOTALL)
            if match:
                clean_json = match.group(0)
                
        return json.loads(clean_json)
    except Exception as e:
        print(f"[LLM JSON] Falha severa ao extrair JSON: {e}")
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
        print(f'[Visemes] Rhubarb falhou: {exc}')
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
                    print(f"[LLM] DALL-E 3 falhou ({resp.status_code}): {resp.text}")
        except Exception as e:
            print(f"[LLM] Erro excepcional no DALL-E: {e}")

    # 2. Fallback para busca na internet (Tavily)
    return await search_image_on_internet(prompt)

async def search_image_on_internet(query: str) -> str:
    """Busca uma imagem relevante na internet usando a API do Tavily, com ajuda do Groq para otimizar a busca."""
    import httpx
    try:
        # Usa Groq para gerar uma busca melhor em inglês (curta e descritiva para imagens)
        optimized_query = query
        try:
            print(f"[LLM] Requesting Groq to optimize query for: {query}")
            optimized_query = await groq_chat([
                {"role": "system", "content": "Generate a short, 3-4 word English search query to find a clear educational image for the following term. Output ONLY the query string, no quotes or explanations."},
                {"role": "user", "content": query}
            ], model='llama-3.1-8b-instant', max_tokens=100)
            optimized_query = optimized_query.strip().strip('"').strip("'")
            print(f"[LLM] Optimized image search query: {optimized_query}")
        except Exception as groq_err:
            print(f"[LLM] Groq optimization failed: {groq_err}")

        keys = settings.tavily_keys
        if not keys:
            print("[LLM] Tavily API keys não configuradas.")
            return ""

        async with httpx.AsyncClient(timeout=15.0) as client:
            for key in keys:
                try:
                    print(f"[LLM] Trying Tavily search with query: {optimized_query}")
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
                        print(f"[LLM] Tavily found {len(images)} images")
                        if images:
                            # Algumas vezes Tavily retorna objetos na lista de imagens
                            img = images[0]
                            if isinstance(img, dict) and 'url' in img:
                                return img['url']
                            return str(img)
                    else:
                        print(f"[LLM] Tavily API error ({response.status_code}): {response.text}")
                except Exception as inner_e:
                    print(f"[LLM] Erro com chave Tavily: {inner_e}")
                    continue
        
        return ""
    except Exception as e:
        print(f"[LLM] Erro crítico ao buscar imagem na internet: {e}")
        return ""
