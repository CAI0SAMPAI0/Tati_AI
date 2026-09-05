import json
import logging
import os
import re
from typing import Any, Dict

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
    def lookup(cls, raw_word: str) -> Dict[str, Any]:
        if not raw_word or not raw_word.strip():
            return {"error": "Nenhuma palavra fornecida."}

        cleaned = raw_word.strip().lower()
        cleaned_alpha = re.sub(r"[^a-zA-Z'\- ]", "", cleaned).strip()
        if not cleaned_alpha:
            cleaned_alpha = cleaned

        cache_key = f"tati_word_def_{cleaned_alpha}"

        # 1. Checa cache local e Redis
        if cleaned_alpha in _LOCAL_WORD_CACHE:
            cached = _LOCAL_WORD_CACHE[cleaned_alpha]
            if not cached.get("audio_b64"):
                cached["audio_b64"] = AudioService.text_to_speech(cleaned_alpha)
            return cached

        try:
            cached_data = cache.get(cache_key)
            if cached_data and isinstance(cached_data, dict):
                if not cached_data.get("audio_b64"):
                    cached_data["audio_b64"] = AudioService.text_to_speech(cleaned_alpha)
                _LOCAL_WORD_CACHE[cleaned_alpha] = cached_data
                return cached_data
        except Exception:
            pass

        # 2. Busca definição e tradução via IA (Groq com fallback)
        word_info = cls._fetch_ai_definition(cleaned_alpha)

        # 3. Gera áudio da pronúncia com voz da Teacher Tati
        audio_b64 = AudioService.text_to_speech(cleaned_alpha)
        word_info["audio_b64"] = audio_b64
        word_info["audio"] = audio_b64

        # 4. Salva em cache por 7 dias (604800s)
        _LOCAL_WORD_CACHE[cleaned_alpha] = word_info
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
    def _fetch_ai_definition(cls, word: str) -> Dict[str, Any]:
        system_instruction = (
            "You are an expert English-Portuguese linguistic dictionary for English learners. "
            "When given an English word, token, or expression, return a JSON object with keys:\n"
            "- \"word\": the exact word\n"
            "- \"lemma\": base dictionary form (infinitive or singular)\n"
            "- \"partOfSpeech\": e.g. \"verb\", \"noun\", \"adjective\"\n"
            "- \"phonetic\": IPA pronunciation, e.g. \"/rʌnz/\"\n"
            "- \"translation\": clear, natural Portuguese translations separated by comma\n"
            "- \"english_definition\": concise, accessible English definition\n"
            "- \"portuguese_explanation\": helpful short tip in Portuguese about its usage or grammar\n"
            "- \"example\": a short, natural example sentence in English\n"
            "- \"example_pt\": Portuguese translation of the example\n"
            "Respond with valid JSON ONLY. No markdown ticks, no emojis."
        )

        user_content = f"Define the word: {word}"

        keys = cls._get_groq_keys()

        for key in keys:
            try:
                from groq import Groq

                client = Groq(api_key=key, timeout=9.0)
                completion = client.chat.completions.create(
                    model="openai/gpt-oss-20b",
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_content},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.2,
                    max_tokens=600,
                )
                raw_json = completion.choices[0].message.content or "{}"
                data = json.loads(raw_json)
                if data.get("translation") or data.get("english_definition"):
                    return cls._sanitize_data(data, word)
            except Exception as e:
                logger.warning(f"[WordLookup] Groq key failed for '{word}': {e}")

        # Fallback para Gemini
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY_1")
        if gemini_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=gemini_key)
                model = genai.GenerativeModel("gemini-1.5-flash")
                res = model.generate_content(prompt)
                raw_text = res.text.strip()
                match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                if match:
                    data = json.loads(match.group(0))
                    return cls._sanitize_data(data, word)
            except Exception as e:
                logger.warning(f"[WordLookup] Gemini failed for '{word}': {e}")

        # Fallback offline inteligente
        return {
            "word": word,
            "lemma": word,
            "partOfSpeech": "word",
            "phonetic": f"/{word}/",
            "translation": f"termo em inglês: {word}",
            "english_definition": f"An English word or expression used in natural communication.",
            "portuguese_explanation": f"Palavra em inglês identificada no contexto da conversa.",
            "example": f"This is an example with {word}.",
            "example_pt": f"Este é um exemplo com {word}.",
        }

    @classmethod
    def _sanitize_data(cls, data: Dict[str, Any], default_word: str) -> Dict[str, Any]:
        return {
            "word": strip_emojis(str(data.get("word") or default_word)),
            "lemma": strip_emojis(str(data.get("lemma") or default_word)),
            "partOfSpeech": strip_emojis(str(data.get("partOfSpeech") or "word")),
            "phonetic": str(data.get("phonetic") or f"/{default_word}/"),
            "translation": strip_emojis(str(data.get("translation") or "")),
            "english_definition": strip_emojis(str(data.get("english_definition") or "")),
            "portuguese_explanation": strip_emojis(str(data.get("portuguese_explanation") or "")),
            "example": strip_emojis(str(data.get("example") or "")),
            "example_pt": strip_emojis(str(data.get("example_pt") or "")),
        }
