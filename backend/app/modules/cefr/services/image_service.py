"""
Image resolution service for flashcard units.
Resolves image_search_term to actual image URLs via Unsplash/Pexels/Pixabay.
"""

import hashlib
import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Simple in-memory cache (term -> url)
_cache: dict[str, str] = {}


def _cache_key(term: str) -> str:
    return hashlib.md5(term.lower().strip().encode()).hexdigest()


async def search_unsplash(query: str) -> str | None:
    api_key = os.environ.get("UNSPLASH_ACCESS_KEY", "")
    if not api_key:
        logger.warning("[ImageService] UNSPLASH_ACCESS_KEY not set")
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 5, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {api_key}"},
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning(f"[ImageService] Unsplash {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            results = data.get("results", [])
            if results:
                url = results[0]["urls"]["raw"]
                logger.info(f"[ImageService] Unsplash OK: {url[:80]}...")
                return url
            logger.info(f"[ImageService] Unsplash: no results for '{query}'")
    except Exception as e:
        logger.warning(f"[ImageService] Unsplash failed for '{query}': {e}")
    return None


async def search_pexels(query: str) -> str | None:
    api_key = os.environ.get("PEXELS_API_KEY", "")
    if not api_key:
        logger.warning("[ImageService] PEXELS_API_KEY not set")
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": 5, "orientation": "landscape"},
                headers={"Authorization": api_key},
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning(f"[ImageService] Pexels {resp.status_code}: {resp.text[:200]}")
                return None
            data = resp.json()
            photos = data.get("photos", [])
            if photos:
                url = photos[0]["src"]["original"]
                logger.info(f"[ImageService] Pexels OK: {url[:80]}...")
                return url
            logger.info(f"[ImageService] Pexels: no results for '{query}'")
    except Exception as e:
        logger.warning(f"[ImageService] Pexels failed for '{query}': {e}")
    return None


async def search_pixabay(query: str) -> str | None:
    api_key = os.environ.get("PIXABAY_API_KEY", "")
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://pixabay.com/api/",
                params={
                    "key": api_key,
                    "q": query,
                    "image_type": "photo",
                    "orientation": "horizontal",
                    "per_page": 5,
                    "safesearch": "true",
                },
                timeout=10,
            )
            if resp.status_code != 200:
                logger.warning(f"[ImageService] Pixabay {resp.status_code}")
                return None
            data = resp.json()
            hits = data.get("hits", [])
            if hits:
                url = hits[0]["webformatURL"]
                logger.info(f"[ImageService] Pixabay OK: {url[:80]}...")
                return url
    except Exception as e:
        logger.warning(f"[ImageService] Pixabay failed for '{query}': {e}")
    return None


async def resolve_image(term: str) -> str | None:
    """
    Resolve an image_search_term to an image URL.
    Tries Unsplash -> Pexels -> Pixabay in order.
    Results are cached to avoid repeated API calls.
    """
    if not term or not term.strip():
        return None

    key = _cache_key(term)
    if key in _cache:
        return _cache[key]

    url = await search_unsplash(term)
    if not url:
        url = await search_pexels(term)
    if not url:
        url = await search_pixabay(term)

    if url:
        _cache[key] = url

    return url


async def resolve_images_batch(terms: list[str]) -> dict[str, str | None]:
    """Resolve multiple image_search_term values in parallel."""
    import asyncio

    results = {}
    tasks = {
        term: asyncio.create_task(resolve_image(term)) for term in terms if term.strip()
    }
    for term, task in tasks.items():
        results[term] = await task
    return results
