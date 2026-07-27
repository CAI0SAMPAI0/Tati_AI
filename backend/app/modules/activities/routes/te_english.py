"""Rota para conteúdo externo do test-english.com — dados em cache local."""

import json
import logging
import os
from typing import Any

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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

_data: dict[str, dict[str, list[dict]]] | None = None

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

@router.get("/content")
async def get_test_english_content(
    level: str = Query("A1"), category: str = Query("grammar"),
):
    if category.lower() not in CATEGORIES:
        raise HTTPException(400, "Invalid category")
    data = _load_data()
    cat = category.lower()
    if level.lower() == "all":
        all_items = []
        for lvl in LEVELS:
            all_items.extend(data.get(cat, {}).get(lvl, []))
        return {"success": True, "level": "all", "category": cat, "items": all_items, "source": "test-english.com"}
    level_code = level.upper()
    if level_code not in LEVEL_MAP:
        raise HTTPException(400, f"Invalid level: {level}")
    items = data.get(cat, {}).get(level_code, [])
    return {"success": True, "level": level_code, "category": cat, "items": items, "source": "test-english.com"}

@router.get("/levels")
async def get_available_levels():
    return {"levels": LEVELS}

@router.get("/image-proxy")
async def proxy_image(url: str = Query(...)):
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/webp")
        return Response(content=resp.content, media_type=content_type)
    except Exception as e:
        logger.warning("Image proxy failed for %s: %s", url[:60], e)
        raise HTTPException(502, f"Image fetch failed")
