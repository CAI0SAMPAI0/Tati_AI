"""
Listening content ingestor for DW, BBC Learning English, and test-english.com.
Fetches content from external sources and stores in Supabase podcasts table.
"""

import logging
import asyncio
import re
from datetime import datetime, timezone
from typing import List, Dict, Optional

import httpx

from app.core.config import settings
from app.core.database import get_client

logger = logging.getLogger(__name__)

# CEFR level classification based on source URL patterns
LEVEL_MAP = {
    'a1': 'A1', 'a2': 'A2', 'b1': 'B1', 'b2': 'B2', 'c1': 'C1', 'c2': 'C2',
    'beginner': 'A1', 'elementary': 'A2', 'intermediate': 'B1',
    'upper-intermediate': 'B2', 'advanced': 'C1',
    'easy': 'A2', 'medium': 'B1', 'hard': 'B2',
}


def _classify_level(text: str) -> str:
    text_lower = text.lower()
    for key, level in LEVEL_MAP.items():
        if key in text_lower:
            return level
    return 'A2'


async def _fetch_url(client: httpx.AsyncClient, url: str) -> Optional[str]:
    try:
        resp = await client.get(url, timeout=15, follow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        logger.warning(f"Failed to fetch {url}: {e}")
        return None


# ============================================================
# BBC Learning English
# ============================================================

BBC_BASE = "https://www.bbc.co.uk/learningenglish"
BBC_FEATURES = [
    f"{BBC_BASE}/features/6-minute-english",
    f"{BBC_BASE}/features/the-english-we-speak",
    f"{BBC_BASE}/features/easy_english_conversations",
    f"{BBC_BASE}/english-grammar",
]

BBC_SECTIONS = [
    ("6 Minute English", "B1", "Short conversations on interesting topics"),
    ("The English We Speak", "B2", "Common English expressions and idioms"),
    ("Easy English Conversations", "A2", "Simple everyday conversations"),
    ("Grammar Reference", "B1", "Grammar explanations with examples"),
]


async def ingest_bbc_learning_english() -> List[Dict]:
    from bs4 import BeautifulSoup
    items = []
    async with httpx.AsyncClient() as client:
        for url in BBC_BASE + "/features/6-minute-english",:
            html = await _fetch_url(client, url)
            if not html:
                continue
            soup = BeautifulSoup(html, 'html.parser')
            links = soup.select('a[href*="/learningenglish/"]')
            for link in links[:15]:
                href = link.get('href', '')
                title = link.get_text(strip=True)
                if not title or len(title) < 5:
                    continue
                full_url = href if href.startswith('http') else f"https://www.bbc.co.uk{href}"
                level = _classify_level(title + ' ' + full_url)
                items.append({
                    'title': title,
                    'description': f"BBC Learning English: {title}",
                    'level': level,
                    'category': 'listening',
                    'source_name': 'BBC Learning English',
                    'source_type': 'bbc',
                    'media_type': 'audio',
                    'external_url': full_url,
                    'embed_url': '',
                    'thumbnail': '',
                    'has_full_transcript': False,
                    'transcript_segments': [],
                    'translation_language': 'en',
                })

    if not items:
        for name, level, desc in BBC_SECTIONS:
            items.append({
                'title': name,
                'description': desc,
                'level': level,
                'category': 'listening',
                'source_name': 'BBC Learning English',
                'source_type': 'bbc',
                'media_type': 'audio',
                'external_url': BBC_BASE,
                'embed_url': '',
                'thumbnail': '',
                'has_full_transcript': False,
                'transcript_segments': [],
                'translation_language': 'en',
            })

    logger.info(f"[BBC] Ingested {len(items)} items")
    return items


# ============================================================
# DW (Deutsche Welle) English Learning
# ============================================================

DW_BASES = [
    ("https://www.dw.com/en/top-stories/s-9097", "A2", "DW English News - everyday topics"),
    ("https://www.dw.com/pt-br/noticias/s-7111", "A2", "DW Noticias em Português"),
    ("https://www.dw.com/learn-english/s-2297", "B1", "DW Learn English"),
]


async def ingest_dw_content() -> List[Dict]:
    from bs4 import BeautifulSoup
    items = []
    async with httpx.AsyncClient() as client:
        for url, level, desc in DW_BASES:
            html = await _fetch_url(client, url)
            if not html:
                continue
            soup = BeautifulSoup(html, 'html.parser')
            articles = soup.select('a[href*="/a-"]') or soup.select('h3 a, h2 a')
            for article in articles[:10]:
                href = article.get('href', '')
                title = article.get_text(strip=True)
                if not title or len(title) < 5:
                    continue
                full_url = href if href.startswith('http') else f"https://www.dw.com{href}"
                article_level = _classify_level(title + ' ' + full_url)
                if article_level == 'A1':
                    article_level = level
                items.append({
                    'title': title,
                    'description': desc,
                    'level': article_level,
                    'category': 'reading',
                    'source_name': 'DW News',
                    'source_type': 'dw',
                    'media_type': 'text',
                    'external_url': full_url,
                    'embed_url': '',
                    'thumbnail': '',
                    'has_full_transcript': False,
                    'transcript_segments': [],
                    'translation_language': 'en',
                })

    if not items:
        for _, level, desc in DW_BASES:
            items.append({
                'title': desc,
                'description': desc,
                'level': level,
                'category': 'reading',
                'source_name': 'DW News',
                'source_type': 'dw',
                'media_type': 'text',
                'external_url': 'https://www.dw.com/en/top-stories/s-9097',
                'embed_url': '',
                'thumbnail': '',
                'has_full_transcript': False,
                'transcript_segments': [],
                'translation_language': 'en',
            })

    logger.info(f"[DW] Ingested {len(items)} items")
    return items


# ============================================================
# test-english.com
# ============================================================

TEST_ENGLISH_LEVELS = ['a1', 'a2', 'b1', 'b2']
TEST_ENGLISH_CATEGORIES = {
    'grammar': 'grammar',
    'vocabulary': 'vocabulary',
    'listening': 'listening',
    'reading': 'reading',
    'pronunciation': 'pronunciation',
}


async def ingest_test_english() -> List[Dict]:
    from bs4 import BeautifulSoup
    items = []
    async with httpx.AsyncClient() as client:
        for level in TEST_ENGLISH_LEVELS:
            for category in TEST_ENGLISH_CATEGORIES:
                url = f"https://test-english.com/{category}/{level}/"
                html = await _fetch_url(client, url)
                if not html:
                    continue
                soup = BeautifulSoup(html, 'html.parser')
                links = soup.select('a[href*="test-english.com"]')
                for link in links[:8]:
                    href = link.get('href', '')
                    title = link.get_text(strip=True)
                    if not title or len(title) < 5:
                        continue
                    full_url = href if href.startswith('http') else f"https://test-english.com{href}"
                    items.append({
                        'title': title,
                        'description': f"test-english.com - {level.upper()} {category}",
                        'level': level.upper(),
                        'category': category,
                        'source_name': 'test-english.com',
                        'source_type': 'test_english',
                        'media_type': 'text',
                        'external_url': full_url,
                        'embed_url': '',
                        'thumbnail': '',
                        'has_full_transcript': False,
                        'transcript_segments': [],
                        'translation_language': 'en',
                    })

    if not items:
        for level in TEST_ENGLISH_LEVELS:
            for cat_name, cat_type in TEST_ENGLISH_CATEGORIES.items():
                items.append({
                    'title': f"{level.upper()} {cat_name.title()} Practice",
                    'description': f"test-english.com - {level.upper()} {cat_name}",
                    'level': level.upper(),
                    'category': cat_type,
                    'source_name': 'test-english.com',
                    'source_type': 'test_english',
                    'media_type': 'text',
                    'external_url': f"https://test-english.com/{cat_name}/{level}/",
                    'embed_url': '',
                    'thumbnail': '',
                    'has_full_transcript': False,
                    'transcript_segments': [],
                    'translation_language': 'en',
                })

    logger.info(f"[test-english] Ingested {len(items)} items")
    return items


# ============================================================
# Save to Supabase
# ============================================================

async def save_listening_items(items: List[Dict]) -> int:
    client = get_client()
    saved = 0
    for item in items:
        try:
            existing = client.table('podcasts').select('id').eq(
                'external_url', item['external_url']
            ).execute()
            if existing.data:
                continue
            item['created_at'] = datetime.now(timezone.utc).isoformat()
            item['user_id'] = None
            item['easy_words'] = []
            item['theme_tags'] = []
            client.table('podcasts').insert(item).execute()
            saved += 1
        except Exception as e:
            logger.error(f"Error saving item: {e}")
    return saved


# ============================================================
# Main entry point
# ============================================================

async def run_listening_ingestion() -> Dict[str, int]:
    results = {}
    try:
        bbc_items = await ingest_bbc_learning_english()
        results['bbc'] = await save_listening_items(bbc_items)
    except Exception as e:
        logger.error(f"BBC ingestion error: {e}")
        results['bbc'] = 0

    try:
        dw_items = await ingest_dw_content()
        results['dw'] = await save_listening_items(dw_items)
    except Exception as e:
        logger.error(f"DW ingestion error: {e}")
        results['dw'] = 0

    try:
        te_items = await ingest_test_english()
        results['test_english'] = await save_listening_items(te_items)
    except Exception as e:
        logger.error(f"test-english ingestion error: {e}")
        results['test_english'] = 0

    total = sum(results.values())
    logger.info(f"[Listening Ingestion] Total saved: {total} items from {results}")
    return results
