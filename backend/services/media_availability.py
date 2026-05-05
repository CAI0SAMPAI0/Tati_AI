"""
services/media_availability.py
Serviço para verificar a disponibilidade de URLs de mídia de forma assíncrona.
"""

import json
import httpx
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from urllib.parse import quote_plus


class MediaAvailabilityService:
    _cache: Dict[str, Dict[str, Any]] = {}
    _cache_ttl_hours = 6

    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/html',
        }

    async def check_url(self, url: str, timeout: float = 3.0) -> bool:
        """Verifica se uma URL está ativa usando httpx."""
        if not url:
            return False

        try:
            async with httpx.AsyncClient(
                headers=self.headers, follow_redirects=True
            ) as client:
                response = await client.get(url, timeout=timeout)
                if not (200 <= response.status_code < 400):
                    return False

                # Verificação específica para YouTube oEmbed
                if 'youtube.com/oembed' in url:
                    data = response.json()
                    if not data.get('title') or 'Private video' in data.get(
                        'title', ''
                    ):
                        return False

                return True
        except (
            httpx.HTTPError,
            httpx.TimeoutException,
            json.JSONDecodeError,
            Exception,
        ):
            return False

    def _is_recent(self, dt_str: Optional[str]) -> bool:
        if not dt_str:
            return False
        try:
            dt = datetime.fromisoformat(dt_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt >= (
                datetime.now(timezone.utc) - timedelta(hours=self._cache_ttl_hours)
            )
        except Exception:
            return False

    async def is_media_available(self, item: Dict[str, Any]) -> bool:
        """Verifica a disponibilidade de mídia de um podcast, com cache."""

        cache_key = str(item.get('id') or item.get('embed_url') or '')
        if not cache_key:
            return False

        cached = self._cache.get(cache_key)
        if cached and self._is_recent(cached.get('checked_at')):
            return bool(cached.get('ok'))

        source_type = str(item.get('source_type', '')).lower()
        ok = False

        if source_type == 'youtube':
            # Nota: _extract_youtube_watch_url é síncrona e rápida (apenas parse de string)
            watch_url = self._extract_youtube_watch_url_logic(item)
            if watch_url:
                oembed_url = f'https://www.youtube.com/oembed?url={quote_plus(watch_url)}&format=json'
                ok = await self.check_url(oembed_url)
        elif source_type == 'spotify':
            embed_url = str(item.get('embed_url', '')).strip()
            ok = embed_url.startswith('https://open.spotify.com/embed/')
        else:
            external_url = str(item.get('external_url', '')).strip()
            ok = await self.check_url(external_url) if external_url else False

        self._cache[cache_key] = {
            'ok': ok,
            'checked_at': datetime.now(timezone.utc).isoformat(),
        }
        return ok

    def _extract_youtube_watch_url_logic(self, item: Dict[str, Any]) -> Optional[str]:
        """Lógica extraída de podcasts.py para evitar importação circular complexa."""
        from urllib.parse import urlparse, parse_qs

        external_url = str(item.get('external_url', '')).strip()
        if external_url:
            parsed_external = urlparse(external_url)
            host = parsed_external.netloc.lower()
            if 'youtube.com' in host:
                query = parse_qs(parsed_external.query)
                video_id = (query.get('v') or [''])[0].strip()
                if video_id:
                    return f'https://www.youtube.com/watch?v={video_id}'
            elif 'youtu.be' in host:
                video_id = parsed_external.path.strip('/').split('/', 1)[0].strip()
                if video_id:
                    return f'https://www.youtube.com/watch?v={video_id}'

        embed_url = str(item.get('embed_url', '')).strip()
        if not embed_url:
            return None
        parsed = urlparse(embed_url)
        host = parsed.netloc.lower()
        if 'youtube' not in host:
            return None
        if '/embed/' not in parsed.path:
            return None
        video_id = (
            parsed.path.split('/embed/', 1)[1].split('/', 1)[0].split('?', 1)[0].strip()
        )
        if not video_id:
            return None
        return f'https://www.youtube.com/watch?v={video_id}'
