from __future__ import annotations

import asyncio
import base64
import logging
import re
from typing import Any
from urllib.parse import urlparse

from app.core.database import get_client
from app.core.dependencies.auth import get_current_user
from app.core.enums import cefr_window, normalize_level
from app.core.exceptions import BusinessLogicError, ContentNotFoundError
from app.modules.activities.services.podcast_exercise import PodcastExerciseService
from app.modules.activities.services.podcast_recommender import PodcastRecommender
from app.shared.services.media_availability import MediaAvailabilityService
from fastapi import APIRouter, BackgroundTasks, Depends, Header
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

router = APIRouter()


@router.get("/warmup")
async def warmup_podcasts(
    background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)
):
    """
    Endpoint isolado para pré-carregar podcasts personalizados via Tavily.
    Dessa forma, o login fica mais rápido e o carregamento pesado ocorre
    em background após a entrada no dashboard.
    """
    username = current_user["username"]
    level = normalize_level(current_user.get("level"))

    from app.modules.activities.services.podcast_discovery import (
        discover_personalized_podcasts,
    )

    # Dispara em background
    background_tasks.add_task(discover_personalized_podcasts, username, username, level)

    return {"ok": True, "message": "Warmup initiated"}


# Expose the profiler key constant for tests and external modules
AUTO_RECO_PROFILE_KEY = PodcastRecommender.AUTO_RECO_PROFILE_KEY

ALLOWED_EMBED_HOSTS = {
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "player.vimeo.com",
    "open.spotify.com",
    "w.soundcloud.com",
    "embed.ted.com",
    "www.dailymotion.com",
    "www.dw.com",
}


class TranscriptSegment(BaseModel):
    start: str
    source_text: str
    translated_text: str = ""


class Podcast(BaseModel):
    id: str
    title: str
    description: str
    level: str
    thumbnail: str
    embed_url: str
    duration: str | None = "--:--"
    category: str
    source_name: str = "YouTube"
    source_type: str = "youtube"
    media_type: str = "video"
    external_url: str | None = None
    transcript_segments: list[TranscriptSegment] = Field(default_factory=list)
    has_full_transcript: bool = False
    translation_language: str = "en-US"
    recommendation_reason: str | None = None
    recommendation_score: float | None = None


class EvaluationRequest(BaseModel):
    podcast_id: str
    type: str
    user_answer: str
    correct_answer: str = ""


class PronunciationRequest(BaseModel):
    audio: str  # base64
    reference_text: str
    podcast_id: str | None = None


def _normalize_ui_lang(accept_language: str | None) -> str:
    value = (accept_language or "").strip().lower()
    if not value:
        return "pt-BR"
    first_token = value.split(",")[0].strip()
    if "en-gb" in first_token or "en-uk" in first_token:
        return "en-UK"
    return "en-US" if first_token.startswith("en") else "pt-BR"


async def _http_fetch_ok(url: str) -> bool:
    """Verifica se uma URL está acessível de forma assíncrona."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(url)
            return resp.status_code == 200
    except Exception as e:
        logging.info(f"[podcast] Fetch OK failed for {url}: {e}")
        return False


def invalidate_podcast_recommendations_cache(username: str) -> None:
    """Invalida o cache de recomendações no perfil do usuário."""
    if not username:
        return
    from app.core.database import get_client
    from app.modules.activities.services.podcast_recommender import PodcastRecommender

    db = get_client()
    try:
        res = (
            db.table("users")
            .select("profile")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if res.data:
            profile = res.data[0].get("profile") or {}
            profile.pop(PodcastRecommender.AUTO_RECO_PROFILE_KEY, None)
            db.table("users").update({"profile": profile}).eq(
                "username", username
            ).execute()
    except Exception:
        pass


def _extract_json_blob(raw_text: str) -> str:
    """Extrai JSON de blocos de texto (Markdown)."""
    clean_text = raw_text.strip()
    if "```json" in clean_text:
        return clean_text.split("```json", 1)[1].split("```", 1)[0].strip()
    if "```" in clean_text:
        return clean_text.split("```", 1)[1].split("```", 1)[0].strip()
    first_brace, last_brace = clean_text.find("{"), clean_text.rfind("}")
    return (
        clean_text[first_brace : last_brace + 1]
        if (first_brace >= 0 and last_brace > first_brace)
        else clean_text
    )


def _extract_youtube_watch_url(item: dict[str, Any]) -> str | None:
    """Extrai URL de visualização do YouTube a partir de embed ou external."""
    ext = str(item.get("external_url", "")).strip()
    if "youtube.com" in ext or "youtu.be" in ext:
        return ext
    embed = str(item.get("embed_url", "")).strip()
    if "/embed/" in embed:
        video_id = embed.split("/embed/")[1].split("?")[0].split("/")[0]
        return f"https://www.youtube.com/watch?v={video_id}"
    return None


def _format_seconds_to_mmss(total_seconds: int) -> str:
    """Formata segundos para MM:SS."""
    if total_seconds <= 0:
        return "--:--"
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"


def _is_allowed_embed_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        return parsed.scheme == "https" and parsed.netloc.lower() in ALLOWED_EMBED_HOSTS
    except Exception:
        return False


def _duration_to_seconds(duration: str) -> int | None:
    try:
        parts = duration.split(":")
        parts = [int(p) for p in parts]
        if len(parts) == 2:
            m, s = parts
            return m * 60 + s
        if len(parts) == 3:
            h, m, s = parts
            return h * 3600 + m * 60 + s
        return None
    except Exception:
        return None


def _normalize_transcript_segments(payload: list) -> list:
    out = []
    if not isinstance(payload, list):
        return []
    for row in payload:
        if not isinstance(row, dict):
            continue
        start = str(row.get("start", "")).strip()
        source_text = str(row.get("source_text", "")).strip()
        if start and source_text:
            out.append(
                {
                    "start": start,
                    "source_text": source_text,
                    "translated_text": row.get("translated_text", ""),
                }
            )
    return out


def _normalize_exercises_payload(payload: dict, podcast_title: str) -> dict:
    exercises = []
    try:
        if isinstance(payload, dict) and isinstance(payload.get("exercises"), list):
            for ex in payload["exercises"]:
                if not isinstance(ex, dict):
                    continue
                exercises.append(ex)
    except Exception:
        exercises = []

    # fallback: generate 3 simple placeholder exercises
    if not exercises:
        exercises = [
            {
                "type": "choice",
                "question": f"What is mentioned in {podcast_title}?",
                "options": ["A", "B", "C", "D"],
                "correct_index": 0,
            },
            {"type": "voice", "phrase": f"Practice saying a line from {podcast_title}"},
            {
                "type": "writing",
                "question": f"Summarize {podcast_title} in one sentence.",
            },
        ]

    return {"exercises": exercises}


def _normalize_evaluation_payload(payload: dict) -> dict:
    score = int(payload.get("score", 0)) if isinstance(payload, dict) else 0
    score = max(score, 0)
    score = min(score, 100)
    feedback = (
        (payload.get("feedback") or "").strip() if isinstance(payload, dict) else ""
    )
    if not feedback:
        feedback = "Thanks for your feedback."
    return {"score": score, "feedback": feedback}


def _podcast_text_terms(podcast: dict) -> list:
    terms = []
    for k in ("title", "description", "category"):
        v = podcast.get(k)
        if v:
            terms.extend([t.strip().lower() for t in str(v).split() if t])
    for t in podcast.get("theme_tags", []) or []:
        terms.append(str(t).lower())
    return list(dict.fromkeys(terms))


def _tokenize_interest_keywords(messages: list[str]) -> list[str]:
    kws = []
    for m in messages:
        for w in re.findall(r"[a-zA-Z]+", m.lower()):
            kws.append(w)
    # simple stopword removal
    stop = {"the", "and", "to", "for", "we", "i", "a", "in", "of", "can", "be", "is"}
    kws = [k for k in kws if k not in stop]
    return list(dict.fromkeys(kws))


def _compose_recommendation_reason(
    podcast: dict, terms: list, user_level: str, ui_lang: str
) -> str:
    if ui_lang and ui_lang.startswith("pt"):
        return f"Recomendado para seu nível ({user_level}) e por temas como {
            ', '.join(
                terms[
                    :3])}."
    return f"Recommended for your level ({user_level}) and topics like {
        ', '.join(
            terms[
                :3])}."


def _load_cached_recommendations(
    profile: dict, user_level: str, ui_lang: str
) -> list | None:
    try:
        entry = (profile or {}).get(PodcastRecommender.AUTO_RECO_PROFILE_KEY)
        if not entry:
            return None
        gen = entry.get("generated_at")
        if not gen:
            return None
        from datetime import datetime, timezone

        gen_dt = datetime.fromisoformat(gen)
        from datetime import timedelta

        if (datetime.now(timezone.utc) - gen_dt) > timedelta(hours=24):
            return None
        return entry.get("items")
    except Exception:
        return None


def _visible_levels_for_user(user_level: str) -> list:
    """Retorna janela CEFR ±1 ao redor do nível do usuário."""
    return cefr_window(normalize_level(user_level), radius=1)


def _normalize_user_level(label: str) -> str:
    """Delega para core.enums.normalize_level."""
    return normalize_level(label)


def _rank_personalized_recommendations(
    catalog: list, user_level: str, interest_keywords: list, ui_lang: str
) -> list:
    scored = []
    for item in catalog:
        score = 0.0
        # level match
        if str(item.get("level", "")).upper() == str(user_level).upper():
            score += 2.0
        # interest keywords
        text_terms = set(_podcast_text_terms(item))
        for k in interest_keywords:
            if k.lower() in text_terms:
                score += 1.5
        item["recommendation_score"] = score
        item["recommendation_reason"] = _compose_recommendation_reason(
            item, interest_keywords, user_level, ui_lang
        )
        scored.append(item)
    return sorted(scored, key=lambda x: x.get("recommendation_score", 0), reverse=True)


def _filter_unavailable_video_items(catalog: list, availability_checker=None) -> list:
    out = []
    for item in catalog:
        if item.get("media_type") == "video" and item.get("source_type") == "youtube":
            if availability_checker:
                try:
                    if availability_checker(item):
                        out.append(item)
                except Exception:
                    continue
            else:
                out.append(item)
        else:
            out.append(item)
    return out


def _focus_terms_for_profile(profile_label: str) -> list:
    if not profile_label:
        return []
    pl = profile_label.lower()
    if "business" in pl:
        return ["business", "news"]
    if "travel" in pl:
        return ["travel", "airport"]
    return [pl]


def _apply_level_playback_constraints(catalog: list, product_level_label: str) -> list:
    visible = _visible_levels_for_user(product_level_label)
    out = []
    for item in catalog:
        lvl = str(item.get("level", "")).upper()
        if lvl not in visible:
            continue
        duration = _duration_to_seconds(str(item.get("duration") or "0")) or 0
        easy = bool(item.get("easy_words", False))
        # keep only short items (<=5 minutes) and easy words
        if duration <= 5 * 60 and easy:
            out.append(item)
    return out


async def _fetch_youtube_duration_seconds(item: dict[str, Any]) -> int:
    import httpx

    watch_url = _extract_youtube_watch_url(item)
    if not watch_url:
        return 0
    try:
        async with httpx.AsyncClient(
            timeout=6.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        ) as client:
            resp = await client.get(watch_url)
        if resp.status_code != 200:
            return 0
        match = re.search(r'"lengthSeconds":"(\d+)"', resp.text)
        return int(match.group(1)) if match else 0
    except Exception:
        return 0


def _sanitize_podcast_entry(raw_entry: dict[str, Any]) -> dict[str, Any] | None:
    embed_url = str(raw_entry.get("embed_url", "")).strip()
    try:
        if urlparse(embed_url).netloc.lower() not in ALLOWED_EMBED_HOSTS:
            return None
    except Exception:
        return None
    return {**raw_entry, "embed_url": embed_url}


@router.get("/progress")
async def get_podcast_progress(
    user: dict = Depends(get_current_user),
) -> dict:
    """Retorna IDs de podcasts concluídos pelo usuário."""
    from fastapi.concurrency import run_in_threadpool

    username = user.get("username", "")

    def _fetch() -> list:
        db = get_client()
        try:
            rows = (
                db.table("activity_submissions")
                .select("metadata")
                .eq("username", username)
                .eq("activity_type", "podcast")
                .execute()
                .data
                or []
            )
            completed = []
            for r in rows:
                meta = r.get("metadata") or {}
                pid = meta.get("podcast_id") or meta.get("item_id")
                if pid:
                    completed.append(str(pid))
            return completed
        except Exception:
            return []

    completed = await run_in_threadpool(_fetch)
    return {"completed": completed}


@router.get("/recommendations", response_model=list[Podcast])
async def get_podcast_recommendations(
    user: dict = Depends(get_current_user),
    level: str | None = None,
    lang: str | None = None,
    accept_language: str | None = Header(default=None),
):
    recommender = PodcastRecommender()
    availability_service = MediaAvailabilityService()

    username = user.get("username")
    is_staff = user.get("is_staff", False)

    user_level_raw = level or str(user.get("level", "A1"))
    user_level = recommender._normalize_user_level(user_level_raw)
    ui_lang = _normalize_ui_lang(lang or accept_language)

    def _fetch_db():
        db = get_client()
        query = db.table("podcasts").select(
            "id, title, description, level, thumbnail, embed_url, duration, category, source_name, source_type, media_type, external_url, has_full_transcript"
        )
        if not is_staff:
            query = query.eq("user_id", username)
        return query.execute().data or []

    try:
        rows = await run_in_threadpool(_fetch_db)
    except Exception as exc:
        logging.info(f"[podcast] DB load failed: {exc}")
        rows = []

    # 1. Carregar Catálogo
    catalog = []
    for row in rows:
        sanitized = _sanitize_podcast_entry(row)
        if sanitized:
            catalog.append(sanitized)

    # 2. Filtrar por nível CEFR (mantém podcasts 'all' levels)
    def _levels_match(podcast_level: str, u_level: str) -> bool:
        pl = (podcast_level or "").lower().strip()
        ul = u_level.lower().strip()
        if is_staff and (level is None or level.lower() == "all"):
            return True
        return pl in ("", "all", "todos", ul)

    visible_catalog = [
        item for item in catalog if _levels_match(item.get("level", ""), user_level)
    ]
    # fallback: se o filtro excluir tudo, mostra todos
    if not visible_catalog:
        visible_catalog = catalog

    # 3. Disponibilidade (Desativado temporariamente por causar lentidão severa de ~1 min)
    # tasks = [availability_service.is_media_available(item) for item in visible_catalog]
    # results = await asyncio.gather(*tasks)
    # visible_catalog = [item for item, ok in zip(visible_catalog, results) if ok]

    # 4. Rankeamento
    recommendations = recommender.rank_recommendations(
        visible_catalog, user_level, [], ui_lang, display_level=user_level_raw
    )

    return recommendations[:50]


@router.get("/{podcast_id}", response_model=Podcast)
async def get_podcast_details(podcast_id: str, background_tasks: BackgroundTasks):
    """Retorna detalhes de um podcast específico."""

    def _fetch_podcast():
        db = get_client()
        return (
            db.table("podcasts")
            .select("*")
            .eq("id", podcast_id)
            .limit(1)
            .execute()
            .data
            or []
        )

    rows = await run_in_threadpool(_fetch_podcast)
    if not rows:
        raise ContentNotFoundError(detail="Podcast not found")
    item = rows[0]

    async def _async_update_duration(podcast_item):
        exact_seconds = await _fetch_youtube_duration_seconds(item)
        if exact_seconds > 0:
            exact_duration = _format_seconds_to_mmss(exact_seconds)
            if str(item.get("duration") or "") != exact_duration:

                def _update_db():
                    get_client().table("podcasts").update(
                        {"duration": exact_duration}
                    ).eq("id", podcast_id).execute()

                await run_in_threadpool(_update_db)
                # item['duration'] = exact_duration
                # try:
                #     db.table('podcasts').update({'duration': exact_duration}).eq(
                #         'id', podcast_id).execute()
                # except Exception:
                #     pass

    background_tasks.add_task(_async_update_duration, item)
    return item


@router.get("/{podcast_id}/exercises")
async def generate_podcast_exercises(podcast_id: str, lang: str = "en-US"):
    """Alias para compatibilidade (GET com query param)."""
    exercise_service = PodcastExerciseService()
    db = get_client()
    rows = db.table("podcasts").select("*").eq("id", podcast_id).limit(1).execute().data
    if not rows:
        raise ContentNotFoundError(detail="Podcast not found")
    return await exercise_service.generate_exercises(rows[0], lang)


@router.post("/evaluate")
async def evaluate_podcast_exercise(
    req: EvaluationRequest, user: dict = Depends(get_current_user)
) -> dict:
    """Avalia exercício de podcast e salva a resposta do usuário."""
    from datetime import datetime, timezone

    exercise_service = PodcastExerciseService()
    username = user.get("username", "")
    result = await exercise_service.evaluate_exercise(
        req, normalize_level(user.get("level")), "en-US"
    )

    # Salvar resposta no banco (gracioso — não bloqueia em caso de erro)
    if username and result:
        try:
            from fastapi.concurrency import run_in_threadpool

            answer_row = {
                "username": username,
                "podcast_id": req.podcast_id,
                "exercise_type": req.type,
                "user_answer": req.user_answer,
                "score": result.get("score", 0),
                "feedback": result.get("feedback", ""),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await run_in_threadpool(
                lambda: get_client()
                .table("podcast_answers")
                .insert(answer_row)
                .execute()
            )
        except Exception as exc:
            logging.info(f"[Podcast] Erro ao salvar resposta: {exc}")

    return result


@router.post("/evaluate-pronunciation")
async def evaluate_pronunciation(
    req: PronunciationRequest, user: dict = Depends(get_current_user)
) -> dict:
    """Avalia a pronúncia de uma frase curta e salva a tentativa."""
    from datetime import datetime, timezone

    from app.modules.activities.services.pronunciation_matcher import (
        pronunciation_matcher,
    )
    from fastapi.concurrency import run_in_threadpool

    try:
        audio_bytes = base64.b64decode(req.audio)
    except Exception:
        raise BusinessLogicError(detail="Invalid audio format (base64 expected)")

    result = await pronunciation_matcher.evaluate(
        audio_bytes, req.reference_text, normalize_level(user.get("level"))
    )

    # Salvar tentativa no perfil do usuário
    username = user.get("username")
    if username:

        def _save_attempt():
            db = get_client()
            # Busca histórico atual
            user_data = (
                db.table("users")
                .select("pronunciation_challenges")
                .eq("username", username)
                .single()
                .execute()
                .data
            )
            history = user_data.get("pronunciation_challenges") if user_data else []
            if not isinstance(history, list):
                history = []

            # Adiciona nova tentativa
            new_attempt = {
                "podcast_id": req.podcast_id,
                "phrase": req.reference_text,
                "score": result.get("score", 0),
                "transcription": result.get("transcription", ""),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            history.append(new_attempt)

            # Limita histórico aos últimos 100 para performance
            history = history[-100:]

            db.table("users").update({"pronunciation_challenges": history}).eq(
                "username", username
            ).execute()

        try:
            await run_in_threadpool(_save_attempt)
        except Exception as e:
            logging.info(f"[Podcast] Erro ao salvar tentativa de pronúncia: {e}")

    return result


@router.post("/{podcast_id}/complete")
async def mark_podcast_complete(
    podcast_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Marca um podcast como concluído pelo usuário."""
    from datetime import datetime, timezone

    from fastapi.concurrency import run_in_threadpool

    username = user.get("username", "")

    def _save() -> None:
        db = get_client()
        try:
            payload = {
                "username": username,
                "activity_type": "podcast",
                "module_id": None,
                "score": 100,
                "metadata": {
                    "podcast_id": podcast_id,
                    "item_id": podcast_id,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "status": "completed",
                },
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            db.table("activity_submissions").insert(payload).execute()
        except Exception as exc:
            logging.info(f"[Podcast] Erro ao salvar conclusão: {exc}")

    await run_in_threadpool(_save)

    # 🏆 Gamification
    try:
        from app.modules.activities.services.gamification_service import (
            GamificationService,
        )
        from app.modules.users.services.streaks import record_study_day

        gs = GamificationService()
        # Podcast completion is like a simulation/video lesson
        asyncio.create_task(
            gs.award_xp(
                username,
                gs.XP_REWARDS.get("simulation_complete", 50),
                "Podcast completed",
            )
        )
        asyncio.create_task(record_study_day(username, is_activity=True))
    except BaseException:
        pass

    return {"success": True, "podcast_id": podcast_id}
