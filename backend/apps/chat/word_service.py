import json
import logging
import os
import re
from typing import Any, Dict, Optional

try:
    from django.core.cache import cache
except Exception:
    cache = None

from .audio_service import AudioService, strip_emojis

logger = logging.getLogger(__name__)

# Cache em memória para palavras frequentes
_LOCAL_WORD_CACHE: Dict[str, Dict[str, Any]] = {}


class WordLookupService:
    """
    Serviço pedagógico de busca de palavras em inglês da Teacher Tati.
    Fornece tradução concisa em português, explicação gramatical/de uso,
    definição em inglês (English Meaning) e pronúncia fonética e em áudio.
    Garante que formas flexionadas (ex: 'runs', 'took', 'written', 'better')
    e expressões nunca fiquem sem definição.
    """

    @classmethod
    def lookup(cls, raw_word: str, accent: Optional[str] = "en-US") -> Dict[str, Any]:
        if not raw_word or not raw_word.strip():
            return {"error": "Nenhuma palavra fornecida."}

        cleaned = raw_word.strip().lower()
        cleaned_alpha = re.sub(r"[^a-zA-Z'\- ]", "", cleaned).strip()
        if not cleaned_alpha:
            cleaned_alpha = cleaned

        resolved_accent = accent or "en-US"
        cache_key = f"tati_word_def_{cleaned_alpha}_{resolved_accent}"

        # 1. Checa cache local e Redis
        if cleaned_alpha in _LOCAL_WORD_CACHE:
            cached = _LOCAL_WORD_CACHE[cleaned_alpha]
            if not cached.get("audio_b64") or cached.get("accent") != resolved_accent:
                cached["audio_b64"] = AudioService.text_to_speech(cleaned_alpha, accent=resolved_accent)
                cached["accent"] = resolved_accent
            return cached

        if cache is not None:
            try:
                cached_data = cache.get(cache_key)
                if cached_data and isinstance(cached_data, dict):
                    if not cached_data.get("audio_b64") or cached_data.get("accent") != resolved_accent:
                        cached_data["audio_b64"] = AudioService.text_to_speech(cleaned_alpha, accent=resolved_accent)
                        cached_data["accent"] = resolved_accent
                    _LOCAL_WORD_CACHE[cleaned_alpha] = cached_data
                    return cached_data
            except Exception:
                pass

        # 2. Busca definição e tradução via IA (Groq com fallback)
        word_info = cls._fetch_ai_definition(cleaned_alpha)

        # 3. Gera áudio da pronúncia com voz da Teacher Tati
        audio_b64 = AudioService.text_to_speech(cleaned_alpha, accent=resolved_accent)
        word_info["audio_b64"] = audio_b64
        word_info["audio"] = audio_b64
        word_info["accent"] = resolved_accent

        # 4. Salva em cache por 7 dias (604800s)
        _LOCAL_WORD_CACHE[cleaned_alpha] = word_info
        if cache is not None:
            try:
                cache.set(cache_key, word_info, timeout=604800)
            except Exception:
                pass

        return word_info

    @staticmethod
    def _get_groq_keys() -> list[str]:
        keys = []
        for k in ["GROQ_API_KEY", "GROQ_API_KEY_1", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4"]:
            val = os.getenv(k)
            if val and val.strip() and val.strip() not in keys:
                keys.append(val.strip())
        return keys

    @classmethod
    def _fetch_google_translation(cls, text: str) -> Optional[str]:
        import urllib.parse
        import urllib.request
        try:
            url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q={urllib.parse.quote(text)}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=4.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                        translated = "".join([part[0] for part in data[0] if part and len(part) > 0 and part[0]])
                        if translated and translated.strip():
                            return translated.strip()
        except Exception as e:
            logger.warning(f"[WordLookup] Google Translate fallback failed for '{text}': {e}")
        return None

    @classmethod
    def _fetch_ai_definition(cls, word: str) -> Dict[str, Any]:
        from django.conf import settings
        from shared.prompt_manager import PromptManager
        from shared.ai_cache import AICache

        clean_word = word.lower().strip()
        cached = AICache.get_llm_response(f"word_definition:{clean_word}")
        if cached:
            try:
                cached_data = json.loads(cached)
                return cls._sanitize_data(cached_data, word)
            except Exception:
                pass

        is_sentence = len(word.split()) > 1

        if is_sentence:
            system_instruction = (
                "You are an expert English-to-Portuguese translator for language learners. "
                "Translate the given English sentence or expression into natural, idiomatic Brazilian Portuguese. "
                "Return a JSON object with keys: "
                "'word' (the exact sentence), "
                "'translation' (natural Brazilian Portuguese translation of the whole sentence), "
                "'portuguese_explanation' (optional short usage/grammar tip in Portuguese or empty string), "
                "'partOfSpeech' ('sentence'), "
                "'phonetic' (''). "
                "Respond with valid JSON ONLY. No markdown ticks, no emojis."
            )
            user_content = f"Translate to Brazilian Portuguese: \"{word}\""
        else:
            system_instruction = PromptManager.get_prompt("word_analysis", section="System Instruction")
            if not system_instruction:
                system_instruction = (
                    "You are an expert English-Portuguese linguistic dictionary for English learners. "
                    "Respond with valid JSON ONLY with keys: 'word', 'lemma', 'partOfSpeech', 'phonetic', 'translation', 'portuguese_explanation'."
                )
            user_content = f"Define and translate the English word: \"{word}\""

        # 1. Tentativa via Groq
        groq_models = [
            getattr(settings, "GROQ_MODEL", None),
            os.getenv("GROQ_MODEL"),
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.8-27b",
        ]
        valid_groq_models = [m for m in groq_models if m]
        keys = cls._get_groq_keys()

        for key in keys:
            for model_name in valid_groq_models:
                try:
                    from groq import Groq

                    client = Groq(api_key=key, timeout=7.0)
                    completion = client.chat.completions.create(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_content},
                        ],
                        response_format={"type": "json_object"},
                        temperature=0.2,
                        max_tokens=500,
                    )
                    raw_json = completion.choices[0].message.content or "{}"
                    data = json.loads(raw_json)
                    if data.get("translation") and data.get("translation") != word:
                        sanitized = cls._sanitize_data(data, word)
                        AICache.set_llm_response(f"word_definition:{clean_word}", json.dumps(sanitized), ttl=604800)
                        return sanitized
                except Exception as e:
                    logger.debug(f"[WordLookup] Groq model '{model_name}' failed for '{word}': {e}")

        # 2. Fallback para Gemini
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
        if gemini_key:
            gemini_models = [
                "models/gemini-3.8-flash",
                "models/gemini-3.7-flash",
                "models/gemini-3.5-flash",
                "gemini-flash-latest",
                "gemini-2.5-flash",
            ]
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)

                for g_model in gemini_models:
                    try:
                        model = genai.GenerativeModel(g_model)
                        prompt = f"{system_instruction}\n\n{user_content}"
                        res = model.generate_content(prompt)
                        raw_text = res.text.strip()
                        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                        if match:
                            data = json.loads(match.group(0))
                            if data.get("translation") and data.get("translation") != word:
                                sanitized = cls._sanitize_data(data, word)
                                AICache.set_llm_response(f"word_definition:{clean_word}", json.dumps(sanitized), ttl=604800)
                                return sanitized
                    except Exception as e:
                        logger.debug(f"[WordLookup] Gemini model '{g_model}' failed for '{word}': {e}")
            except Exception as e:
                logger.warning(f"[WordLookup] Gemini init failed for '{word}': {e}")

        # 3. Fallback garantido com Google Translate
        gt_translation = cls._fetch_google_translation(word) or word
        fallback_data = {
            "word": word,
            "lemma": word,
            "partOfSpeech": "sentence" if is_sentence else "word",
            "phonetic": "" if is_sentence else f"/{word}/",
            "translation": gt_translation,
            "portuguese_explanation": "",
            "english_definition": "",
            "example": "",
            "example_pt": "",
        }
        return cls._sanitize_data(fallback_data, word)

    @classmethod
    def _sanitize_data(cls, data: Dict[str, Any], default_word: str) -> Dict[str, Any]:
        translation = strip_emojis(str(data.get("translation") or "")).strip()
        # Se tradução veio vazia ou genérica, usa Google Translate
        if not translation or translation.lower() == default_word.lower() or "termo em ingl" in translation.lower():
            gt_trans = cls._fetch_google_translation(default_word)
            if gt_trans:
                translation = gt_trans

        is_sentence = len(default_word.split()) > 1
        phonetic = str(data.get("phonetic") or "").strip()
        if not phonetic and not is_sentence:
            phonetic = f"/{default_word}/"

        return {
            "word": strip_emojis(str(data.get("word") or default_word)),
            "lemma": strip_emojis(str(data.get("lemma") or default_word)),
            "partOfSpeech": strip_emojis(str(data.get("partOfSpeech") or ("sentence" if is_sentence else "word"))),
            "phonetic": phonetic,
            "translation": translation,
            "english_definition": strip_emojis(str(data.get("english_definition") or "")),
            "portuguese_explanation": strip_emojis(str(data.get("portuguese_explanation") or "")),
            "example": strip_emojis(str(data.get("example") or "")),
            "example_pt": strip_emojis(str(data.get("example_pt") or "")),
        }
