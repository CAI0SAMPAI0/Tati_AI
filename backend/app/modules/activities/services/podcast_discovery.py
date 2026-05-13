import json
import re
from datetime import datetime, timezone
from fastapi.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.database import get_client
from app.modules.chat.services.llm import groq_chat
import asyncio

# ============================================================
# CONSTANTES DE DURAÇÃO
# Para todos os níveis: vídeos de até 10 minutos
# ============================================================
MIN_DURATION_SECONDS = 2 * 60   # 2 minutos (evita clips curtos demais)
MAX_DURATION_SECONDS = 10 * 60  # 10 minutos (limite máximo para todos os níveis)

BANNED_TOKENS = [
    'full course', '6 hour', '8 hour', '10 hour', 'live stream', 'livestream',
    '60 minutes', '60 mins', '45 minutes', '45 mins', '30 minutes', '30 mins',
    '25 minutes', '25 mins', '20 minutes', '20 mins', '15 minutes', '15 mins',
    '1 hour', '2 hours', '3 hours', '1 hr', '2 hr', '3 hr',
]


def _duration_to_seconds(dur_str: str) -> int:
    if not dur_str or ':' not in dur_str:
        return 0
    parts = dur_str.split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except Exception:
        return 0
    return 0


def _is_duration_valid(dur_str: str) -> bool:
    """Valida se a duração está dentro do limite permitido."""
    sec = _duration_to_seconds(dur_str)
    if sec == 0:
        return True  # duração desconhecida: deixa passar, filtra depois pelo título
    return MIN_DURATION_SECONDS <= sec <= MAX_DURATION_SECONDS


def _has_banned_token(title: str, description: str = '') -> bool:
    text = f"{title} {description}".lower()
    return any(token in text for token in BANNED_TOKENS)


async def discover_personalized_podcasts(user_id: str, username: str, user_level: str):
    """
    IA que analisa conversas, busca no Tavily e salva vídeos personalizados.
    Regra: todos os níveis recebem vídeos de até 10 minutos.
    """
    if not settings.tavily_api_key:
        return

    db = get_client()

    # 1. CHECAR LIMITES (2-3 por dia ou 5 por semana)
    try:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        start_of_week = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

        def _count_recent(since_iso):
            return db.table('podcasts').select('id', count='exact').eq('user_id', username).gte('created_at', since_iso).execute()


        daily_res = await run_in_threadpool(_count_recent, start_of_day)
        if (daily_res.count or 0) >= getattr(settings, 'video_limit_per_day', 3):
            print(f'[Discovery] Limite diário atingido para {username}')
            return

        weekly_res = await run_in_threadpool(_count_recent, start_of_week)
        if (weekly_res.count or 0) >= getattr(settings, 'video_limit_per_week', 5):
            print(f'[Discovery] Limite semanal atingido para {username}')
            return
    except Exception as e:
        print(f'[Discovery] Erro ao verificar limites: {e}')

    # 1. PEGAR INTERESSES RECENTES
    try:
        def _fetch_msgs():
            return (
                db.table('messages')
                .select('content')
                .eq('username', username)
                .eq('role', 'user')
                .order('created_at', desc=True)
                .limit(15)
                .execute()
                .data
            )

        msg_data = await run_in_threadpool(_fetch_msgs)
        recent_text = ' '.join([m['content'] for m in msg_data])
    except Exception as e:
        print(f'[Discovery] Erro ao buscar mensagens: {e}')
        return

    if not recent_text:
        return

    # 2. BUSCAR NO TAVILY
    # Query atualizada: enfatiza vídeos curtos (até 10 minutos)
    from tavily import TavilyClient

    keys = settings.tavily_keys
    if not keys:
        return

    search_query = (
        'SHORT English educational YouTube videos under 10 minutes, '
        'with teachers or native speakers, quick lessons or tips, '
        'channels like "English in Brazil by Carina Fragozo", "Julia Contessoto", '
        '"English with Lucy", "mmmEnglish", "Learn English with TV Series", '
        f'for students about {recent_text[:60]} level {user_level}. '
        'NO full courses, NO hour-long videos.'
    )

    search_context = ''
    success_tavily = False

    def _tavily_search(api_key):
        tavily = TavilyClient(api_key=api_key)
        result = tavily.search(
            query=search_query,
            search_depth='advanced',
            include_domains=['youtube.com'],
            max_results=10,  # Busca mais para compensar o filtro mais restrito
        )
        results = result.get('results', [])
        return [r for r in results if 'youtube.com/watch' in r.get('url', '')]

    for key in keys:
        try:
            valid_results = await run_in_threadpool(_tavily_search, key)
            if valid_results:
                search_context = str(valid_results)
                success_tavily = True
                break
        except Exception as e:
            print(f'[Discovery] Tavily Key falhou: {e}')
            continue

    if not success_tavily:
        return

    # 3. GROQ ANALISA E FORMATA
    prompt = (
        f'You are a pedagogical curator. Analyze this search context: {search_context}\n\n'
        f'Student level: {user_level}. Student interests: {recent_text[:200]}\n\n'
        'Pick the 6 best YouTube videos following these STRICT rules:\n'
        '1. Videos MUST be under 10 minutes (600 seconds)\n'
        '2. Videos must be in English, from teachers or educational channels\n'
        '3. No full courses, no hour-long videos, no livestreams\n'
        '4. Prefer short lessons, quick tips, vocabulary drills, grammar explanations\n\n'
        'Return ONLY a JSON list:\n'
        '[{"id": "slug-unique", "title": "...", "embed_url": "https://www.youtube.com/embed/VIDEO_ID", '
        '"duration": "MM:SS", "category": "grammar|vocabulary|speaking|listening", "level": "' + user_level + '"}]'
    )

    try:
        full_resp = await groq_chat([{'role': 'user', 'content': prompt}])
        match = re.search(r'\[\s*\{.*\}\s*\]', full_resp, re.DOTALL)
        if not match:
            return

        try:
            podcasts = json.loads(match.group(0))
        except Exception:
            return

        from app.modules.activities.routes.podcasts import _http_fetch_ok
        from urllib.parse import quote_plus

        tasks_verify = []
        video_data_list = []

        for p in podcasts:
            if not all(k in p for k in ('id', 'title', 'embed_url')):
                continue

            # Filtra pelo título/duração antes mesmo de verificar disponibilidade
            if _has_banned_token(p.get('title', ''), p.get('description', '')):
                print(f"[Discovery] Vídeo bloqueado por título: {p.get('title')}")
                continue

            if not _is_duration_valid(p.get('duration', '')):
                print(f"[Discovery] Vídeo bloqueado por duração: {p.get('title')} ({p.get('duration')})")
                continue

            video_id = p['embed_url'].split('/')[-1].split('?')[0]
            watch_url = f'https://www.youtube.com/watch?v={video_id}'
            oembed_url = f'https://www.youtube.com/oembed?url={quote_plus(watch_url)}&format=json'

            tasks_verify.append(_http_fetch_ok(oembed_url))
            video_data_list.append((p, video_id))

        if not tasks_verify:
            print('[Discovery] Nenhum vídeo válido após filtragem inicial')
            return

        verifications = await asyncio.gather(*tasks_verify)

        existing_podcasts = await run_in_threadpool(
            lambda: db.table('podcasts').select('id').eq('user_id', username).execute().data or []
        )
        existing_ids = {str(r.get('id')) for r in existing_podcasts if r.get('id')}
        valid_count = 0

        for i, is_ok in enumerate(verifications):
            if not is_ok:
                continue

            p, video_id = video_data_list[i]

            p['user_id'] = username
            p['level'] = user_level
            p['description'] = p.get('description') or 'Short English lesson recommended by Tati AI'
            p['thumbnail'] = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
            p['source_name'] = 'YouTube (Tavily Discovery)'
            p['created_at'] = datetime.now(timezone.utc).isoformat()

            # Garante que o embed_url está no formato correto
            if 'youtube.com/watch' in p['embed_url']:
                vid = p['embed_url'].split('v=')[-1].split('&')[0]
                p['embed_url'] = f'https://www.youtube.com/embed/{vid}'

            await run_in_threadpool(lambda _p=p: db.table('podcasts').upsert(_p).execute())
            valid_count += 1

        if valid_count > 0:
            from app.modules.activities.routes.podcasts import invalidate_podcast_recommendations_cache
            await run_in_threadpool(invalidate_podcast_recommendations_cache, username)
            print(f'[Discovery] {valid_count} vídeos (≤10min) salvos para {username}')

    except Exception as e:
        print(f'[Discovery] Erro no processamento: {e}')