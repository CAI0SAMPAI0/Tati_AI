import json
import re
from datetime import datetime, timezone
from fastapi.concurrency import run_in_threadpool

from core.config import settings
from services.database import get_client
from services.llm import groq_chat
import asyncio

async def discover_personalized_podcasts(user_id: str, username: str, user_level: str):
    """
    IA que analisa conversas, busca na internet via TAVILY
    e salva podcasts personalizados reais no Supabase.
    Versão OTIMIZADA: Totalmente non-blocking para não travar o chat.
    """
    if not settings.tavily_api_key:
        return

    db = get_client()

    # 1. PEGAR INTERESSES RECENTES (Threadpool para não travar)
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

    # 2. BUSCAR NO TAVILY (Threadpool para não travar o loop do chat)
    from tavily import TavilyClient

    keys = settings.tavily_keys
    if not keys:
        return

    search_query = (
        'REAL English educational YouTube videos in English, with teachers/native speakers, '
        'between 5 and 25 minutes (never long/full course), including channels like '
        '"English in Brazil by Carina Fragozo" and "Julia Contessoto", '
        f'for students about {recent_text[:60]} level {user_level}'
    )
    search_context = ''
    success_tavily = False

    def _tavily_search(api_key):
        tavily = TavilyClient(api_key=api_key)
        search_result = tavily.search(
            query=search_query,
            search_depth='advanced',
            include_domains=['youtube.com'],
            max_results=8,
        )
        results = search_result.get('results', [])
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
        f'Based on student interests and English level {user_level}, pick the 6 best REAL AND ACTIVE YouTube videos.\n'
        'STRICT RULES: videos must be in English, from teachers/educational channels, and between 5 and 25 minutes; avoid full courses and multi-hour videos.\n'
        'Return ONLY a JSON list of objects: [{"id": "slug", "title": "...", "embed_url": "...", "duration": "MM:SS or HH:MM:SS"}].'
    )

    try:
        full_resp = await groq_chat([{'role': 'user', 'content': prompt}])
        match = re.search(r'\[\s*{.*}\s*\]', full_resp, re.DOTALL)
        if not match:
            return

        try:
            podcasts = json.loads(match.group(0))
        except Exception:
            return

        from routers.activities.podcasts import _http_fetch_ok
        from urllib.parse import quote_plus

        tasks_verify = []
        video_data_list = []

        for p in podcasts:
            if not all(k in p for k in ('id', 'title', 'embed_url')):
                continue

            video_id = p['embed_url'].split('/')[-1].split('?')[0]
            watch_url = f'https://www.youtube.com/watch?v={video_id}'
            oembed_url = f'https://www.youtube.com/oembed?url={quote_plus(watch_url)}&format=json'
            
            tasks_verify.append(_http_fetch_ok(oembed_url))
            video_data_list.append((p, video_id))

        verifications = await asyncio.gather(*tasks_verify)
        
        existing_podcasts = await run_in_threadpool(
            lambda: db.table('podcasts').select('id').eq('user_id', username).execute().data or []
        )
        existing_ids = {str(r.get('id')) for r in existing_podcasts if r.get('id')}
        created_titles: list[str] = []
        valid_count = 0
        notifiable_titles: list[str] = []
        
        # Filtros de visibilidade (sincronizados com podcasts.py)
        MIN_DURATION_SECONDS = 5 * 60
        MAX_DURATION_SECONDS = 25 * 60
        BANNED_TOKENS = [
            'full course', '6 hour', '8 hour', '10 hour', 'live stream', 'livestream',
            '60 minutes', '60 mins', '45 minutes', '45 mins', '30 minutes', '30 mins',
            '1 hour', '2 hours', '3 hours', '1 hr', '2 hr', '3 hr'
        ]

        def _duration_to_seconds(dur_str: str) -> int:
            if not dur_str or ':' not in dur_str: return 0
            parts = dur_str.split(':')
            try:
                if len(parts) == 2: return int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3: return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            except: return 0
            return 0

        for i, is_ok in enumerate(verifications):
            if not is_ok:
                continue
            
            p, video_id = video_data_list[i]
            
            # Checa se o vídeo passaria pelos filtros de visibilidade do router
            title_desc = f"{p.get('title', '')} {p.get('description', '')}".lower()
            dur_sec = _duration_to_seconds(p.get('duration', ''))
            
            is_visible = True
            if any(token in title_desc for token in BANNED_TOKENS):
                is_visible = False
            if dur_sec > 0 and (dur_sec < MIN_DURATION_SECONDS or dur_sec > MAX_DURATION_SECONDS):
                is_visible = False

            p['user_id'] = username
            p['level'] = user_level  # Garante que o nível não seja nulo
            p['description'] = p.get('description') or 'Video recommended by Tati AI'
            p['thumbnail'] = f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg'
            p['source_name'] = 'YouTube (Tavily Discovery)'
            p['created_at'] = datetime.now(timezone.utc).isoformat()

            # Upsert em threadpool
            await run_in_threadpool(lambda: db.table('podcasts').upsert(p).execute())
            valid_count += 1
            
            if str(p['id']) not in existing_ids and is_visible:
                # notifiable_titles.append(p.get('title') or 'New podcast')
                pass

        # Desabilitado conforme solicitação do usuário: Notificações apenas para troféus e ofensiva
        """
        try:
            from services.notifications import notify_new_activity
            ...
        except Exception as e:
            print(f'[Discovery] Erro ao notificar podcast: {e}')
        """

        if valid_count > 0:
            from routers.activities.podcasts import (
                invalidate_podcast_recommendations_cache,
            )

            await run_in_threadpool(invalidate_podcast_recommendations_cache, username)

        #print(f'[Discovery] ✅ Tavily achou {valid_count} vídeos para {username}!')
    except Exception as e:
        print(f'[Discovery] Erro no processamento: {e}')
