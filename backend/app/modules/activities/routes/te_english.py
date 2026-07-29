"""Rota para conteúdo externo do test-english.com — dados em cache local."""

import asyncio
import hashlib
import json
import logging
import os
import time

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter(prefix="/test-english", tags=["Test English Content"])

logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "te_english_data.json")
LEVEL_MAP = {"A1": "a1", "A2": "a2", "B1": "b1", "B1+": "b1-b2", "B2": "b2", "C1": "c1"}
LEVELS = ["A1", "A2", "B1", "B1+", "B2", "C1"]
CATEGORIES = {"grammar": "grammar-points", "vocabulary": "vocabulary", "listening": "listening", "reading": "reading"}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://test-english.com/",
}

_data: dict[str, dict[str, list[dict]]] | None = None

IMAGE_CACHE_DIR = os.path.join(os.path.dirname(__file__), "_image_cache")
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

_image_semaphore = asyncio.Semaphore(3)

_memory_cache: dict[str, tuple[bytes, str, float]] = {}
_MEMORY_CACHE_TTL = 3600


def _cache_path(url: str) -> str:
    h = hashlib.md5(url.encode()).hexdigest()
    ext = ".img"
    if ".png" in url:
        ext = ".png"
    elif ".jpg" in url or ".jpeg" in url:
        ext = ".jpg"
    elif ".webp" in url:
        ext = ".webp"
    elif ".gif" in url:
        ext = ".gif"
    elif ".svg" in url:
        ext = ".svg"
    return os.path.join(IMAGE_CACHE_DIR, h + ext)


def _load_data() -> dict[str, dict[str, list[dict]]]:
    global _data
    if _data is not None:
        return _data
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            _data = json.load(f)
        logger.info("Loaded test-english data from %s", DATA_FILE)
    else:
        logger.warning("Data file %s not found, using empty data", DATA_FILE)
        _data = {cat: {lvl: [] for lvl in LEVELS} for cat in CATEGORIES}
    return _data


def _build_url(cat_slug: str, level_slug: str, item_slug: str) -> str:
    return f"https://test-english.com/{cat_slug}/{level_slug}/{item_slug}/"


def _enrich_items(items: list[dict], cat_slug: str, level_slug: str) -> list[dict]:
    enriched = []
    for item in items:
        if item["slug"] == cat_slug:
            continue
        url = _build_url(cat_slug, level_slug, item["slug"])
        enriched.append({**item, "url": url, "level": level_slug.upper().replace("-", "+")})
    return enriched


@router.get("/content")
async def get_test_english_content(
    level: str = Query("A1"), category: str = Query("grammar"),
):
    if category.lower() not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = _load_data()
    cat = category.lower()
    cat_slug = CATEGORIES[cat]
    if level.lower() == "all":
        all_items = []
        for lvl in LEVELS:
            level_slug = LEVEL_MAP[lvl]
            raw = data.get(cat, {}).get(lvl, [])
            all_items.extend(_enrich_items(raw, cat_slug, level_slug))
        return {"success": True, "level": "all", "category": cat, "items": all_items, "source": "test-english.com"}
    level_code = level.upper()
    if level_code not in LEVEL_MAP:
        raise HTTPException(400, f"Invalid level: {level}")
    level_slug = LEVEL_MAP[level_code]
    raw = data.get(cat, {}).get(level_code, [])
    items = _enrich_items(raw, cat_slug, level_slug)
    return {"success": True, "level": level_code, "category": cat, "items": items, "source": "test-english.com"}


@router.get("/levels")
async def get_available_levels():
    return {"levels": LEVELS}


@router.get("/image-proxy")
async def proxy_image(url: str = Query(...)):
    now = time.time()
    cached = _memory_cache.get(url)
    if cached and (now - cached[2]) < _MEMORY_CACHE_TTL:
        return Response(
            content=cached[0],
            media_type=cached[1],
            headers={"Cache-Control": "public, max-age=86400"},
        )

    cpath = _cache_path(url)
    if os.path.exists(cpath):
        age = now - os.path.getmtime(cpath)
        if age < 86400:
            with open(cpath, "rb") as f:
                body = f.read()
            ct = "image/webp" if cpath.endswith(".webp") else "image/png" if cpath.endswith(".png") else "image/jpeg"
            _memory_cache[url] = (body, ct, now)
            return Response(
                content=body,
                media_type=ct,
                headers={"Cache-Control": "public, max-age=86400"},
            )

    async with _image_semaphore:
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(headers=HEADERS, timeout=15, follow_redirects=True) as client:
                    resp = await client.get(url)
                    if resp.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning("Rate limited on %s, retrying in %ds", url[:60], wait)
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                content_type = resp.headers.get("content-type", "image/webp")
                body = resp.content

                with open(cpath, "wb") as f:
                    f.write(body)

                _memory_cache[url] = (body, content_type, now)
                return Response(
                    content=body,
                    media_type=content_type,
                    headers={"Cache-Control": "public, max-age=86400"},
                )
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                    continue
                logger.warning("Image proxy failed for %s: %s", url[:60], e)
                raise HTTPException(502, "Image fetch failed")
            except Exception as e:
                logger.warning("Image proxy failed for %s: %s", url[:60], e)
                raise HTTPException(502, "Image fetch failed")

    raise HTTPException(502, "Image fetch failed after retries")
