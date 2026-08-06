"""Rota para conteúdo externo do liveworksheets.com — dados em cache local."""

import asyncio
import hashlib
import json
import logging
import os
import time

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter(prefix="/liveworksheets", tags=["LiveWorksheets Content"])

logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(os.path.dirname(__file__), "liveworksheets_data.json")
LEVEL_MAP = {"A1": "A1", "A2": "A2", "B1": "B1", "B1+": "B1", "B2": "B2", "C1": "C1", "C2": "C2"}
LEVELS = ["A1", "A2", "B1", "B1+", "B2", "C1", "C2"]
CATEGORIES = ["grammar", "vocabulary", "listening", "reading"]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.liveworksheets.com/",
}

_data: dict[str, dict[str, list[dict]]] | None = None

IMAGE_CACHE_DIR = os.path.join(os.path.dirname(__file__), "_lw_image_cache")
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
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                _data = json.load(f)
            logger.info("Loaded liveworksheets data from %s", DATA_FILE)
        except Exception as e:
            logger.error("Error reading %s: %s", DATA_FILE, e)
            _data = {cat: {lvl: [] for lvl in ["A1", "A2", "B1", "B2", "C1", "C2"]} for cat in CATEGORIES}
    else:
        logger.warning("Data file %s not found, using empty data", DATA_FILE)
        _data = {cat: {lvl: [] for lvl in ["A1", "A2", "B1", "B2", "C1", "C2"]} for cat in CATEGORIES}
    return _data


@router.get("/content")
async def get_liveworksheets_content(
    level: str = Query("A1"), category: str = Query("grammar")
):
    cat = category.lower()
    if cat not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = _load_data()

    if level.lower() == "all":
        all_items = []
        for lvl in ["A1", "A2", "B1", "B2", "C1", "C2"]:
            all_items.extend(data.get(cat, {}).get(lvl, []))
        return {"success": True, "level": "all", "category": cat, "items": all_items, "source": "liveworksheets.com"}

    level_code = level.upper()
    if level_code == "B1+":
        level_code = "B1"
    if level_code not in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        raise HTTPException(400, f"Invalid level: {level}")

    items = data.get(cat, {}).get(level_code, [])
    return {"success": True, "level": level_code, "category": cat, "items": items, "source": "liveworksheets.com"}


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
                from curl_cffi import requests as cffi_requests
                resp = await asyncio.to_thread(
                    cffi_requests.get, url, impersonate="chrome120", timeout=15
                )
                if resp.status_code in (200, 304):
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    body = resp.content
                    with open(cpath, "wb") as f:
                        f.write(body)
                    _memory_cache[url] = (body, content_type, now)
                    return Response(
                        content=body,
                        media_type=content_type,
                        headers={"Cache-Control": "public, max-age=86400"},
                    )
            except Exception as e:
                logger.warning("Image proxy failed for %s: %s", url[:60], e)
                await asyncio.sleep(0.5)

    raise HTTPException(502, "Image fetch failed after retries")
