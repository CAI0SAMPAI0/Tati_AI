from __future__ import annotations

import asyncio
import base64
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel, Field

from routers.deps import get_current_user
from services.database import get_client
from services.media_availability import MediaAvailabilityService
from services.podcast_exercise import PodcastExerciseService
from services.podcast_recommender import PodcastRecommender

router = APIRouter()

ALLOWED_EMBED_HOSTS = {
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
    'open.spotify.com',
    'w.soundcloud.com',
    'embed.ted.com',
    'www.dailymotion.com',
}


class TranscriptSegment(BaseModel):
    start: str
    source_text: str
    translated_text: str = ''


class Podcast(BaseModel):
    id: str
    title: str
    description: str
    level: str
    thumbnail: str
    embed_url: str
    duration: Optional[str] = '--:--'
    category: str
    source_name: str = 'YouTube'
    source_type: str = 'youtube'
    media_type: str = 'video'
    external_url: Optional[str] = None
    transcript_segments: List[TranscriptSegment] = Field(default_factory=list)
    has_full_transcript: bool = False
    translation_language: str = 'en-US'
    recommendation_reason: Optional[str] = None
    recommendation_score: Optional[float] = None


class EvaluationRequest(BaseModel):
    podcast_id: str
    type: str
    user_answer: str
    correct_answer: str = ''


class PronunciationRequest(BaseModel):
    audio: str  # base64
    reference_text: str
    podcast_id: Optional[str] = None


def _normalize_ui_lang(accept_language: Optional[str]) -> str:
    value = (accept_language or '').strip().lower()
    if not value:
        return 'pt-BR'
    first_token = value.split(',')[0].strip()
    if 'en-gb' in first_token or 'en-uk' in first_token:
        return 'en-UK'
    return 'en-US' if first_token.startswith('en') else 'pt-BR'


async def _http_fetch_ok(url: str) -> bool:
    """Verifica se uma URL está acessível de forma assíncrona."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(url)
            return resp.status_code == 200
    except Exception as e:
        print(f'[podcast] Fetch OK failed for {url}: {e}')
        return False


def invalidate_podcast_recommendations_cache(username: str) -> None:
    """Invalida o cache de recomendações no perfil do usuário."""
    if not username:
        return
    from services.database import get_client
    from services.podcast_recommender import PodcastRecommender

    db = get_client()
    try:
        res = (
            db.table('users')
            .select('profile')
            .eq('username', username)
            .limit(1)
            .execute()
        )
        if res.data:
            profile = res.data[0].get('profile') or {}
            profile.pop(PodcastRecommender.AUTO_RECO_PROFILE_KEY, None)
            db.table('users').update({'profile': profile}).eq(
                'username', username
            ).execute()
    except Exception:
        pass


def _extract_json_blob(raw_text: str) -> str:
    """Extrai JSON de blocos de texto (Markdown)."""
    clean_text = raw_text.strip()
    if '```json' in clean_text:
        return clean_text.split('```json', 1)[1].split('```', 1)[0].strip()
    if '```' in clean_text:
        return clean_text.split('```', 1)[1].split('```', 1)[0].strip()
    first_brace, last_brace = clean_text.find('{'), clean_text.rfind('}')
    return (
        clean_text[first_brace : last_brace + 1]
        if (first_brace >= 0 and last_brace > first_brace)
        else clean_text
    )


def _extract_youtube_watch_url(item: Dict[str, Any]) -> Optional[str]:
    """Extrai URL de visualização do YouTube a partir de embed ou external."""
    ext = str(item.get('external_url', '')).strip()
    if 'youtube.com' in ext or 'youtu.be' in ext:
        return ext
    embed = str(item.get('embed_url', '')).strip()
    if '/embed/' in embed:
        video_id = embed.split('/embed/')[1].split('?')[0].split('/')[0]
        return f'https://www.youtube.com/watch?v={video_id}'
    return None


def _sanitize_podcast_entry(raw_entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    embed_url = str(raw_entry.get('embed_url', '')).strip()
    try:
        if urlparse(embed_url).netloc.lower() not in ALLOWED_EMBED_HOSTS:
            return None
    except Exception:
        return None
    return {**raw_entry, 'embed_url': embed_url}


@router.get('/recommendations', response_model=List[Podcast])
async def get_podcast_recommendations(
    user: dict = Depends(get_current_user),
    lang: str | None = None,
    accept_language: str | None = Header(default=None),
):
    recommender = PodcastRecommender()
    availability_service = MediaAvailabilityService()

    username = user.get('username')
    user_level_raw = str(user.get('level', 'A1'))
    user_level = recommender._normalize_user_level(user_level_raw)
    ui_lang = _normalize_ui_lang(lang or accept_language)

    db = get_client()

    # 1. Carregar Catálogo
    catalog = []
    try:
        rows = (
            db.table('podcasts').select('*').eq('user_id', username).execute().data
            or []
        )
        for row in rows:
            sanitized = _sanitize_podcast_entry(row)
            if sanitized:
                catalog.append(sanitized)
    except Exception as exc:
        print(f'[podcast] DB load failed: {exc}')

    # 2. Filtragem por Nível
    level_map = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
    idx = level_map.index(user_level) if user_level in level_map else 0
    visible_catalog = [
        item
        for item in catalog
        if item.get('level') in level_map[max(0, idx - 1) : idx + 2]
    ] or catalog[:6]

    # 3. Disponibilidade
    tasks = [availability_service.is_media_available(item) for item in visible_catalog]
    results = await asyncio.gather(*tasks)
    visible_catalog = [item for item, ok in zip(visible_catalog, results) if ok]

    # Filtrar vídeos muito longos com base no nível do usuário
    def _duration_to_seconds(dur_str: str) -> int:
        if not dur_str or ':' not in dur_str: return 0
        parts = dur_str.split(':')
        try:
            if len(parts) == 2:
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        except (ValueError, IndexError):
            return 0
        return 0

    # Beginner / Pre-Intermediate: máx 15 minutos
    # Intermediate / Advanced: máx 20 minutos
    is_high_level = user_level in ['B1', 'B2', 'C1', 'C2', 'Intermediate', 'Advanced']
    MAX_DURATION_SECONDS = (20 * 60) if is_high_level else (15 * 60)
    
    filtered_duration = []
    for item in visible_catalog:
        dur = _duration_to_seconds(str(item.get("duration", "")))
        if dur > MAX_DURATION_SECONDS:
            continue
        filtered_duration.append(item)
    
    visible_catalog = filtered_duration if filtered_duration else visible_catalog[:6]

    # 4. Rankeamento
    recommendations = recommender.rank_recommendations(
        visible_catalog, user_level, [], ui_lang, display_level=user_level_raw
    )

    return recommendations[:6]


@router.get('/{podcast_id}', response_model=Podcast)
async def get_podcast_details(podcast_id: str):
    """Retorna detalhes de um podcast específico."""
    db = get_client()
    rows = db.table('podcasts').select('*').eq('id', podcast_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail='Podcast not found')
    return rows[0]


@router.get('/{podcast_id}/exercises')
async def generate_podcast_exercises(podcast_id: str, lang: str = 'en-US'):
    """Alias para compatibilidade (GET com query param)."""
    exercise_service = PodcastExerciseService()
    db = get_client()
    rows = db.table('podcasts').select('*').eq('id', podcast_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail='Podcast not found')
    return await exercise_service.generate_exercises(rows[0], lang)


@router.post('/evaluate')
async def evaluate_podcast_exercise(
    req: EvaluationRequest, user: dict = Depends(get_current_user)
) -> dict:
    """Avalia exercício de podcast e salva a resposta do usuário."""
    from datetime import datetime, timezone

    exercise_service = PodcastExerciseService()
    username = user.get('username', '')
    result = await exercise_service.evaluate_exercise(req, user.get('level', 'A1'), 'pt-BR')

    # Salvar resposta no banco (gracioso — não bloqueia em caso de erro)
    if username and result:
        try:
            from fastapi.concurrency import run_in_threadpool

            answer_row = {
                'username': username,
                'podcast_id': req.podcast_id,
                'exercise_type': req.type,
                'user_answer': req.user_answer,
                'score': result.get('score', 0),
                'feedback': result.get('feedback', ''),
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            await run_in_threadpool(
                lambda: get_client().table('podcast_answers').insert(answer_row).execute()
            )
        except Exception as exc:
            print(f'[Podcast] Erro ao salvar resposta: {exc}')

    return result


@router.post('/evaluate-pronunciation')
async def evaluate_pronunciation(
    req: PronunciationRequest,
    user: dict = Depends(get_current_user)
) -> dict:
    """Avalia a pronúncia de uma frase curta e salva a tentativa."""
    from services.pronunciation_matcher import pronunciation_matcher
    from datetime import datetime, timezone
    from fastapi.concurrency import run_in_threadpool

    try:
        audio_bytes = base64.b64decode(req.audio)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid audio format (base64 expected)")

    result = await pronunciation_matcher.evaluate(audio_bytes, req.reference_text)
    
    # Salvar tentativa no perfil do usuário
    username = user.get('username')
    if username:
        def _save_attempt():
            db = get_client()
            # Busca histórico atual
            user_data = db.table('users').select('pronunciation_challenges').eq('username', username).single().execute().data
            history = user_data.get('pronunciation_challenges') if user_data else []
            if not isinstance(history, list): history = []
            
            # Adiciona nova tentativa
            new_attempt = {
                'podcast_id': req.podcast_id,
                'phrase': req.reference_text,
                'score': result.get('score', 0),
                'transcription': result.get('transcription', ''),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            history.append(new_attempt)
            
            # Limita histórico aos últimos 100 para performance
            history = history[-100:]
            
            db.table('users').update({'pronunciation_challenges': history}).eq('username', username).execute()

        try:
            await run_in_threadpool(_save_attempt)
        except Exception as e:
            print(f"[Podcast] Erro ao salvar tentativa de pronúncia: {e}")

    return result


# --- Progresso de podcasts ---


@router.get('/progress')
async def get_podcast_progress(
    user: dict = Depends(get_current_user),
) -> dict:
    """Retorna IDs de podcasts concluídos pelo usuário."""
    from fastapi.concurrency import run_in_threadpool

    username = user.get('username', '')

    def _fetch() -> list:
        db = get_client()
        try:
            rows = (
                db.table('podcast_completions')
                .select('podcast_id')
                .eq('username', username)
                .execute()
                .data
                or []
            )
            return [r.get('podcast_id') for r in rows if r.get('podcast_id')]
        except Exception:
            return []

    completed = await run_in_threadpool(_fetch)
    return {'completed': completed}


@router.post('/{podcast_id}/complete')
async def mark_podcast_complete(
    podcast_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Marca um podcast como concluído pelo usuário."""
    from fastapi.concurrency import run_in_threadpool
    from datetime import datetime, timezone

    username = user.get('username', '')

    def _save() -> None:
        db = get_client()
        try:
            db.table('podcast_completions').upsert(
                {
                    'username': username,
                    'podcast_id': podcast_id,
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                },
                on_conflict='username,podcast_id',
            ).execute()
        except Exception as exc:
            print(f'[Podcast] Erro ao salvar conclusão: {exc}')

    await run_in_threadpool(_save)
    
    # 🏆 Gamification
    try:
        from services.gamification_service import GamificationService
        gs = GamificationService()
        # Podcast completion is like a simulation/video lesson
        asyncio.create_task(gs.award_xp(username, gs.XP_REWARDS.get('simulation_complete', 50), 'Podcast completed'))
    except:
        pass

    return {'success': True, 'podcast_id': podcast_id}
