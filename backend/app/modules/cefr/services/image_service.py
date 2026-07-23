"""
Image resolution service for flashcard units.
Resolves image_search_term to actual image URLs via Unsplash/Pexels/Pixabay.
"""

import logging
import os
import hashlib
from typing import Optional, Dict

import httpx

logger = logging.getLogger(__name__)

# Simple in-memory cache (term -> url)
_cache: Dict[str, str] = {}


def _cache_key(term: str) -> str:
    return hashlib.md5(term.lower().strip().encode()).hexdigest()


async def search_unsplash(query: str) -> Optional[str]:
    api_key = os.environ.get('UNSPLASH_ACCESS_KEY', '')
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                'https://api.unsplash.com/search/photos',
                params={'query': query, 'per_page': 1, 'orientation': 'landscape'},
                headers={'Authorization': f'Client-ID {api_key}'},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            results = data.get('results', [])
            if results:
                return results[0]['urls']['regular']
    except Exception as e:
        logger.warning(f"Unsplash search failed for '{query}': {e}")
    return None


async def search_pexels(query: str) -> Optional[str]:
    api_key = os.environ.get('PEXELS_API_KEY', '')
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                'https://api.pexels.com/v1/search',
                params={'query': query, 'per_page': 1},
                headers={'Authorization': api_key},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            photos = data.get('photos', [])
            if photos:
                return photos[0]['src']['large']
    except Exception as e:
        logger.warning(f"Pexels search failed for '{query}': {e}")
    return None


async def search_pixabay(query: str) -> Optional[str]:
    api_key = os.environ.get('PIXABAY_API_KEY', '')
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                'https://pixabay.com/api/',
                params={'key': api_key, 'q': query, 'image_type': 'photo', 'per_page': 3},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            hits = data.get('hits', [])
            if hits:
                return hits[0]['largeImageURL']
    except Exception as e:
        logger.warning(f"Pixabay search failed for '{query}': {e}")
    return None


async def resolve_image(term: str) -> Optional[str]:
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


async def resolve_images_batch(terms: list[str]) -> Dict[str, Optional[str]]:
    """Resolve multiple image_search_term values in parallel."""
    import asyncio
    results = {}
    tasks = {term: asyncio.create_task(resolve_image(term)) for term in terms if term.strip()}
    for term, task in tasks.items():
        results[term] = await task
    return results
