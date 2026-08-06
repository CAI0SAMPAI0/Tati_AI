"""
Metadados de links (News) — busca título/thumbnail via OpenGraph quando não fornecidos.
"""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def _domain(url: str) -> str:
    try:
        return urlparse(url).netloc or urlparse("//" + url).netloc or url
    except Exception:
        return url


def _text(url: str) -> str:
    """Fallback de título: o domínio do link."""
    return _domain(url)


def fetch_link_metadata(url: str, timeout: float = 8.0) -> dict:
    """Busca og:title / og:image / title de uma URL externa.

    Nunca lança exceção: em caso de falha, retorna titulo = domínio e sem thumbnail.
    """
    fallback: dict = {"title": _text(url), "thumbnail": None}
    if not url or not url.startswith(("http://", "https://")):
        return fallback

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=_HEADERS) as client:
            resp = client.get(url)
            html = resp.text or ""
            if len(html) > 2_000_000:
                html = html[:2_000_000]
    except Exception as exc:
        logger.info(f"[News meta] fetch failed for {url[:60]}: {exc}")
        return fallback

    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        og_title = soup.find("meta", property="og:title")
        og_image = soup.find("meta", property="og:image")
        og_desc = soup.find("meta", property="og:description")

        title = ""
        img_tag = og_image.get("content") if og_image else None
        if og_title and (og_title.get("content") or "").strip():
            title = og_title["content"].strip()
        elif soup.title and (soup.title.string or "").strip():
            title = soup.title.string.strip()
        title = (title[:200] if len(title) > 200 else title) if title else _text(url)

        thumbnail = None
        if img_tag and (img_tag or "").strip():
            thumbnail = img_tag.strip()
        desc = None
        if og_desc and (og_desc.get("content") or "").strip():
            desc = og_desc["content"].strip()[:300]

        return {"title": title, "thumbnail": thumbnail, "description": desc}
    except Exception as exc:
        logger.info(f"[News meta] parse failed for {url[:60]}: {exc}")
        return fallback