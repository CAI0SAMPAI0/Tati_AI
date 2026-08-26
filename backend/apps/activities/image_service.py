import os
import logging
import hashlib
import requests
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

# Cache em memória (termo -> url)
_cache: Dict[str, str] = {}


def _cache_key(term: str) -> str:
    return hashlib.md5(term.lower().strip().encode()).hexdigest()


class ImageResolverService:
    @staticmethod
    def search_unsplash(query: str) -> Optional[str]:
        api_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
        if not api_key:
            return None
        try:
            resp = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {api_key}"},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    url = results[0].get("urls", {}).get("regular") or results[0].get("urls", {}).get("small")
                    if url:
                        logger.info(f"[ImageResolver] Unsplash encontrado para '{query}': {url[:60]}...")
                        return url
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Unsplash para '{query}': {e}")
        return None

    @staticmethod
    def search_pexels(query: str) -> Optional[str]:
        api_key = os.environ.get("PEXELS_API_KEY", "")
        if not api_key:
            return None
        try:
            resp = requests.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": 1, "orientation": "landscape"},
                headers={"Authorization": api_key},
                timeout=6,
            )
            if resp.status_code == 200:
                data = resp.json()
                photos = data.get("photos", [])
                if photos:
                    url = photos[0].get("src", {}).get("medium") or photos[0].get("src", {}).get("large")
                    if url:
                        logger.info(f"[ImageResolver] Pexels encontrado para '{query}': {url[:60]}...")
                        return url
        except Exception as e:
            logger.warning(f"[ImageResolver] Falha no Pexels para '{query}': {e}")
        return None

    @classmethod
    def resolve_image(cls, term: str) -> str:
        """
        Busca uma imagem relevante para o termo em inglês.
        Tenta Unsplash -> Pexels -> Fallback temático.
        """
        if not term or not term.strip():
            return "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80"

        clean_term = term.strip()
        key = _cache_key(clean_term)
        if key in _cache:
            return _cache[key]

        # 1. Tenta Unsplash
        url = cls.search_unsplash(clean_term)

        # 2. Tenta Pexels se Unsplash não encontrar
        if not url:
            url = cls.search_pexels(clean_term)

        # 3. Se o termo for composto ou longo, tenta com a palavra principal
        if not url and " " in clean_term:
            words = [w for w in clean_term.split() if len(w) > 3]
            if words:
                simplified = " ".join(words[:2])
                url = cls.search_unsplash(simplified) or cls.search_pexels(simplified)

        # 4. Fallback temático
        if not url:
            url = f"https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=600&q=80"

        _cache[key] = url
        return url

    @classmethod
    def resolve_batch(cls, terms: List[str]) -> Dict[str, str]:
        results = {}
        for t in terms:
            if t and t.strip():
                results[t] = cls.resolve_image(t)
        return results
