import os
import re
import json
import logging
import httpx
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from ninja import Router, File, UploadedFile, Schema
from ninja.errors import HttpError
from django.http import HttpRequest, HttpResponse
from django.contrib.auth import get_user_model
from django.conf import settings

logger = logging.getLogger(__name__)

from apps.authentication.security import auth_required, auth_optional, require_teacher
from .schemas import (
    FlashcardReviewInput,
    FlashcardReviewOut,
    PodcastOut,
    HubMaterialOut,
    GameOut,
    NewsOut,
    TrophyOut,
    RankingUserOut,
    SubmissionInput,
    PronunciationVerifyInput,
    PronunciationVerifyOut,
    CheckoutInput,
    TrimestralExamStatusOut,
    TrimestralExamStartInput,
    TrimestralExamStartOut,
    TrimestralExamSubmitInput,
    TrimestralExamResultOut,
)
from .services import (
    FlashcardService,
    PodcastService,
    RankingService,
    TrophyService,
    HubService,
    SpeechService,
    SubmissionService,
)
from .models import Game, NewsItem

User = get_user_model()

activities_router = Router(tags=["Activities & Learning"])
catalog_router = Router(tags=["Public Catalog"])
grammar_router = Router(tags=["Grammar"])
speech_router = Router(tags=["Speech & Pronunciation"])
exams_router = Router(tags=["Exams"])


# FLASHCARDS & REPETIÇÃO ESPAÇADA (SRS)                             


@activities_router.get("/flashcards/my", auth=auth_required)
def get_my_flashcards(request: HttpRequest, level: Optional[str] = None):
    """
    Retorna os baralhos completos de flashcards (Módulos e Decks CEFR por tópico).
    """
    user_level = level or request.auth.level or "A1"
    return FlashcardService.get_my_decks(user_level)


@activities_router.get("/flashcards/review/friday", auth=auth_required)
def get_friday_review(request: HttpRequest):
    """
    Retorna deck de reforço com os cards que o aluno errou durante a semana.
    """
    return FlashcardService.get_friday_review(request.auth.username)


@activities_router.post("/flashcards/progress", auth=auth_required)
@activities_router.post("/flashcards/flashcard-progress", auth=auth_required)
def save_flashcard_progress(request: HttpRequest, payload: dict):
    """
    Salva o resultado de revisão de um card (correct, wrong, unknown).
    """
    return FlashcardService.save_flashcard_progress(request.auth.username, payload)


@activities_router.get("/flashcards/{deck_id}", auth=auth_optional)
def get_flashcard_deck(request: HttpRequest, deck_id: str):
    """
    Retorna os detalhes e os cards individuais de um baralho específico.
    """
    return FlashcardService.get_deck_details(deck_id)


@activities_router.get("/modules/{module_id}", auth=auth_optional)
@activities_router.get("/modules/{module_id}/flashcards", auth=auth_optional)
def get_module_deck(request: HttpRequest, module_id: str):
    """
    Retorna os detalhes e os cards individuais de um módulo específico.
    """
    return FlashcardService.get_deck_details(module_id)


@activities_router.get("/modules", auth=auth_optional)
def get_all_modules(request: HttpRequest, level: Optional[str] = None):
    """
    Retorna todos os módulos pedagógicos disponíveis.
    """
    user_level = level or (
        request.auth.level if isinstance(getattr(request, "auth", None), User) else "A1"
    )
    return FlashcardService.get_my_decks(user_level)


@activities_router.post(
    "/flashcards/review", response=FlashcardReviewOut, auth=auth_required
)
def review_flashcard(request: HttpRequest, payload: FlashcardReviewInput):
    """
    Registra a avaliação do flashcard e computa o próximo intervalo SRS.
    """
    # Fallback endpoint
    return FlashcardReviewOut(
        success=True, next_review_days=1, xp_earned=10, total_xp=request.auth.total_xp
    )


#    PODCASTS & TREINAMENTO AUDITIVO                                    


@activities_router.get("/podcasts", response=List[PodcastOut], auth=auth_optional)
@activities_router.get(
    "/podcasts/recommendations", response=List[PodcastOut], auth=auth_optional
)
def get_podcasts(
    request: HttpRequest, level: Optional[str] = None, category: Optional[str] = None
):
    """
    Lista podcasts recomendados e episódios com transcrições.
    """
    user = request.auth if isinstance(getattr(request, "auth", None), User) else None
    user_level = level or (user.level if user and getattr(user, "level", None) else "Beginner")
    return PodcastService.get_podcasts(user_level, category)


@activities_router.get("/podcasts/warmup", auth=auth_optional)
def warmup_podcasts(request: HttpRequest):
    """
    Pré-aquece o feed de podcasts de forma assíncrona.
    """
    return {"ok": True, "message": "Podcasts feed ready"}


@activities_router.get("/podcasts/progress", auth=auth_optional)
def get_podcast_progress(request: HttpRequest):
    """
    Retorna o progresso de audição de podcasts do usuário.
    """
    return {"completed": [], "in_progress": []}


@activities_router.get(
    "/podcasts/{podcast_id}", response=PodcastOut, auth=auth_optional
)
def get_podcast_detail(request: HttpRequest, podcast_id: str):
    """
    Retorna os detalhes e segmentos de transcrição de um podcast.
    """
    return PodcastService.get_podcast(podcast_id)


#    RANKING & COMPETIÇÕES                                              


@activities_router.get("/ranking", response=List[RankingUserOut], auth=auth_optional)
def get_ranking(
    request: HttpRequest,
    year: Optional[int] = None,
    month: Optional[int] = None,
):
    """
    Retorna a tabela de líderes semanal ou mensal com base no XP acumulado.
    """
    user = request.auth or User(username="aluno", role="student")
    return RankingService.get_ranking(user, year=year, month=month)


#    TROFÉUS & CONQUISTAS                                               


@activities_router.get("/trophies", response=List[TrophyOut], auth=auth_optional)
@activities_router.get("/achievements", response=List[TrophyOut], auth=auth_optional)
@activities_router.get("/trophies/my", response=List[TrophyOut], auth=auth_optional)
@activities_router.get("/achievements/my", response=List[TrophyOut], auth=auth_optional)
def get_trophies(request: HttpRequest):
    """
    Lista todos os troféus e medalhas pedagógicas conquistadas pelo aluno.
    """
    user = request.auth if isinstance(request.auth, User) else None
    if not user:
        user = User(username="aluno", role="student")
    return TrophyService.get_trophies(user)


#    GAMES & NEWS                                                       


@activities_router.get("/games", response=List[GameOut], auth=auth_optional)
def get_games(request: HttpRequest):
    """
    Lista jogos educativos interativos (Wordwall).
    """
    qs = Game.objects.filter(is_published=True).only(
        "id", "title", "description", "wordwall_url", "levels"
    )
    return [
        GameOut(
            id=g.id,
            title=g.title,
            description=g.description or "",
            wordwall_url=g.wordwall_url,
            levels=([l for l in (g.levels or []) if l and str(l).strip().lower() != "all"] or ["all"]),
        )
        for g in qs
    ]


@activities_router.get("/news", response=List[NewsOut], auth=auth_optional)
def get_news(request: HttpRequest):
    """
    Lista notícias em inglês graduadas por nível CEFR.
    """
    qs = NewsItem.objects.filter(is_published=True).only(
        "id", "title", "url", "description", "levels", "thumbnail_url"
    )
    return [
        NewsOut(
            id=n.id,
            title=n.title,
            url=n.url,
            description=n.description or "",
            levels=([l for l in (n.levels or []) if l and str(l).strip().lower() != "all"] or ["all"]),
            thumbnail_url=n.thumbnail_url,
        )
        for n in qs
    ]


#    SUBMISSÕES DE ATIVIDADES                                           


@activities_router.get("/submissions/my", auth=auth_optional)
def list_my_submissions(request: HttpRequest):
    """
    Lista histórico de submissões e atividades concluídas pelo usuário.
    """
    username = request.auth.username if isinstance(request.auth, User) else "aluno"
    return SubmissionService.get_user_submissions(username)


@activities_router.get("/submissions", auth=auth_optional)
def list_submissions(request: HttpRequest):
    """
    Lista submissões do usuário ou histórico geral.
    """
    username = request.auth.username if isinstance(request.auth, User) else "aluno"
    return SubmissionService.get_user_submissions(username)


@activities_router.post("/submissions", auth=auth_optional)
def submit_activity(request: HttpRequest, payload: SubmissionInput):
    """
    Registra a conclusão de qualquer atividade ou quiz, concedendo XP e streak.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return SubmissionService.submit_activity(user, payload.dict())


class StudentFeedbackInput(BaseModel):
    area: str = "general"
    activity_id: Optional[str] = ""
    activity_title: Optional[str] = ""
    rating: int = 5
    comment: str
    cefr_level: Optional[str] = "A1"
    student_name: Optional[str] = ""


class DeveloperBugReportInput(BaseModel):
    title: str
    description: str
    image_urls: Optional[List[str]] = []
    page_url: Optional[str] = ""
    user_agent: Optional[str] = ""


@activities_router.post("/student-feedback", auth=auth_optional)
def submit_student_feedback(request: HttpRequest, payload: StudentFeedbackInput):
    """
    Permite que o aluno envie feedback sobre qualquer atividade diretamente para a Professora Tatiana.
    """
    from .services import StudentFeedbackService

    username = "anonymous"
    student_name = payload.student_name or ""
    if hasattr(request, "auth") and request.auth and isinstance(request.auth, User):
        username = getattr(request.auth, "username", "anonymous")
        if not student_name:
            first = getattr(request.auth, "first_name", "")
            last = getattr(request.auth, "last_name", "")
            student_name = f"{first} {last}".strip() or username

    return StudentFeedbackService.create_feedback(
        student_username=username,
        data={
            **payload.dict(),
            "student_name": student_name,
        },
    )


@activities_router.get("/my-feedbacks", auth=auth_required)
def get_my_feedbacks(request: HttpRequest):
    """
    Retorna todos os feedbacks enviados pelo aluno autenticado e as respostas da Professora Tatiana.
    """
    from .services import StudentFeedbackService

    username = getattr(request.auth, "username", "")
    return StudentFeedbackService.list_student_feedbacks(username)


@activities_router.post("/developer-bug-report", auth=auth_optional)
def submit_developer_bug_report(request: HttpRequest, payload: DeveloperBugReportInput):
    """
    Permite que o aluno reporte um bug ou problema técnico diretamente para o programador.
    Envia email detalhado contendo screenshots para o email configurado na variável EMAIL_FEEDBACK.
    """
    from .services import DeveloperBugService

    user_info = {
        "username": "anonymous",
        "name": "Aluno Anônimo",
        "email": "",
    }
    if hasattr(request, "auth") and request.auth and isinstance(request.auth, User):
        user_info["username"] = getattr(request.auth, "username", "anonymous")
        first = getattr(request.auth, "first_name", "")
        last = getattr(request.auth, "last_name", "")
        user_info["name"] = f"{first} {last}".strip() or user_info["username"]
        user_info["email"] = getattr(request.auth, "email", "")

    return DeveloperBugService.create_bug_report(user_info, payload.dict())



#    HUB DE MATERIAIS & PREMIUM                                         


@activities_router.get("/hub", response=List[HubMaterialOut], auth=auth_optional)
@activities_router.get("/hub/public", response=List[HubMaterialOut], auth=auth_optional)
@activities_router.get("/premium", response=List[HubMaterialOut], auth=auth_optional)
def get_hub_materials(request: HttpRequest, category: Optional[str] = None):
    """
    Lista os materiais digitais interativos e livros da Teacher Tati.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.list_materials(user, category)


@activities_router.get("/weekly-goal", auth=auth_optional)
def get_weekly_goal(request: HttpRequest):
    """
    Retorna o Objetivo da Semana (8 categorias obrigatórias, reset aos domingos e bônus multiplicador).
    """
    from apps.users.services import GoalService
    user = request.auth if isinstance(request.auth, User) else None
    if not user:
        return {
            "week_start": None,
            "total_categories": 8,
            "completed_categories": 0,
            "is_completed": False,
            "multiplier": 1,
            "categories": {
                c: {"name": c.capitalize(), "target": 1, "progress": 0, "is_completed": False}
                for c in ["grammar", "vocabulary", "listening", "reading", "music", "flashcards", "simulations", "games"]
            },
        }
    return GoalService.get_weekly_goal_summary(user)


@activities_router.get("/hub/{content_id}/access", auth=auth_optional)
@activities_router.get("/premium/{content_id}/access", auth=auth_optional)
def get_hub_content_access(request: HttpRequest, content_id: str):
    """
    Retorna o link de acesso seguro ou direto para o material do Hub.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.get_content_access(user, content_id)


#    CATÁLOGO PÚBLICO & CHECKOUT DE MATERIAIS                          


@catalog_router.get("", response=List[HubMaterialOut], auth=auth_optional)
def public_catalog(request: HttpRequest, category: Optional[str] = None):
    """
    Catálogo público de materiais e livros para visitantes e alunos.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.list_materials(user, category)


@catalog_router.post("/checkout", auth=auth_optional)
def catalog_checkout(request: HttpRequest, payload: CheckoutInput):
    """
    Inicia o checkout de compra de material do Hub via Mercado Pago (PIX / Cartão).
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.process_checkout(user, payload.dict())


@catalog_router.post("/checkout/{payment_id}/cancel", auth=auth_required)
def catalog_checkout_cancel(request: HttpRequest, payment_id: str):
    """
    Cancela pedido/cobrança pendente do checkout pertencente ao usuário autenticado.
    """
    return HubService.cancel_checkout(request.auth, payment_id)


@catalog_router.get("/checkout/{payment_id}/status", auth=auth_optional)
@catalog_router.get("/checkout/{payment_id}", auth=auth_optional)
def catalog_checkout_status(request: HttpRequest, payment_id: str):
    """
    Consulta status atualizado do pagamento no Mercado Pago.
    """
    return HubService.get_checkout_status(payment_id)


#    GRAMÁTICA & EXERCÍCIOS                                             


@grammar_router.get("", auth=auth_optional)
@activities_router.get("/grammar", auth=auth_optional)
def get_grammar_topics(
    request: HttpRequest, topic: Optional[str] = None, level: Optional[str] = None
):
    """
    Tópicos gramaticais e guias de referência por nível CEFR (A1 a C1).
    """
    from .grammar_data import GrammarService

    effective_level = level or (
        request.auth.level if isinstance(request.auth, User) else "ALL"
    )
    return GrammarService.get_grammar(topic, effective_level)


@grammar_router.post("/cache-clear")
def clear_grammar_cache(request: HttpRequest):
    """
    Limpa cache de gramática.
    """
    return {"ok": True, "message": "Grammar cache cleared"}


#    READING & LISTENING                                                


@activities_router.get("/reading", auth=auth_optional)
def get_reading_materials(request: HttpRequest, level: str = "A1"):
    """
    Retorna materiais de leitura graduados (News + Test English Reading).
    """
    from .services import ExternalContentService

    return ExternalContentService.get_test_english_content(level, "reading")


@activities_router.get("/listening", auth=auth_optional)
def get_listening_materials(request: HttpRequest, level: str = "A1"):
    """
    Retorna materiais de compreensão auditiva (Podcasts + Test English Listening).
    """
    from .services import ExternalContentService

    return ExternalContentService.get_test_english_content(level, "listening")


#    PRONÚNCIA & SPEECH                                                 


@speech_router.post(
    "/verify-pronunciation", response=PronunciationVerifyOut, auth=auth_optional
)
async def verify_pronunciation(request: HttpRequest, payload: PronunciationVerifyInput):
    """
    Avalia a precisão fonética de uma frase falada pelo aluno.
    Registra a ofensiva (streak diário) para o aluno sem alterar o XP de ranking.
    """
    try:
        user = getattr(request, "auth", None)
        streak_info = None
        if user and hasattr(user, "username"):
            try:
                from apps.users.services import StreakService
                from asgiref.sync import sync_to_async
                rec = await sync_to_async(StreakService.record_activity)(user)
                streak_info = {
                    "current_streak": rec.current_streak,
                    "streak_extended": rec.streak_extended,
                }
            except Exception as streak_err:
                logger.debug(f"[SpeechAPI] Erro ao registrar ofensiva/streak: {streak_err}")

        user_accent = payload.accent
        if not user_accent and user and hasattr(user, "profile"):
            prof = user.profile if isinstance(user.profile, dict) else {}
            user_accent = prof.get("preferred_accent") or prof.get("accent")
        user_accent = user_accent or "en-US"

        res = await SpeechService.verify_pronunciation_async(
            target=payload.target_phrase,
            spoken=payload.spoken_phrase,
            threshold=payload.accuracy_threshold or 70.0,
            audio_b64=payload.audio,
            reference_text=payload.reference_text,
            accent=user_accent,
        )

        if streak_info and res.metadata is not None:
            res.metadata["streak"] = streak_info

        return res
    except Exception as e:
        logger.error(f"[SpeechAPI] Erro ao verificar pronúncia: {e}", exc_info=True)
        target = payload.target_phrase or payload.reference_text or ""
        return PronunciationVerifyOut(
            score=0.0,
            transcription=payload.spoken_phrase or "",
            words=[],
            feedback="Could not process pronunciation at this moment. Please try again.",
            correct_audio="",
            target=target,
            recognized=payload.spoken_phrase or "",
            is_correct=False,
            metadata={"accuracy_score": 0.0, "fluency_score": 0.0},
        )


@speech_router.post("/transcribe", auth=auth_optional)
async def speech_transcribe(request: HttpRequest, payload: dict):
    """
    Transcreve áudio enviado pelo aluno.
    """
    from apps.chat.audio_service import AudioService

    audio_data = payload.get("audio") or ""
    text = await AudioService.transcribe_audio_async(audio_data)
    return {"text": text, "transcription": text}


@speech_router.post("/tts", auth=auth_optional)
async def speech_tts(request: HttpRequest, payload: dict):
    """
    Converte texto em áudio via Edge TTS.
    """
    from apps.chat.audio_service import AudioService

    text = payload.get("text") or ""
    accent = payload.get("accent") or "en-US"
    audio_b64 = await AudioService.text_to_speech_async(text, accent=accent)
    return {"audio": audio_b64, "audio_b64": audio_b64}


#    EXTERNAL CONTENT: TEST ENGLISH & LIVEWORKSHEETS                    


@activities_router.get("/test-english/content", auth=auth_optional)
def test_english_content(
    request: HttpRequest, level: str = "A1", category: str = "grammar"
):
    """
    Retorna o catálogo indexado de exercícios do Test English.
    """
    from .services import ExternalContentService

    return ExternalContentService.get_test_english_content(level, category)


@activities_router.get("/liveworksheets/content", auth=auth_optional)
def liveworksheets_content(
    request: HttpRequest, level: str = "A1", category: str = "general"
):
    """
    Retorna o catálogo indexado de exercícios do LiveWorksheets.
    """
    from .services import ExternalContentService

    return ExternalContentService.get_liveworksheets_content(level, category)


@activities_router.get("/musics", auth=auth_optional)
def list_musics(request: HttpRequest):
    """
    Retorna o catálogo de músicas e letras do LingoClip com os 3 modos de jogo
    (Múltipla Escolha, Digitação e Karaokê).
    """
    from .services import ExternalContentService

    return ExternalContentService.get_musics_content()


import ipaddress
import socket
from urllib.parse import urlparse

# Cache em memória para os proxies de imagem das atividades
_ACTIVITY_IMAGE_CACHE = {}
_ALLOWED_ACTIVITY_DOMAINS = ("test-english.com", "liveworksheets.com")


def _is_safe_activity_image_url(url: str) -> bool:
    """
    Valida rigorosamente a URL de imagem para evitar SSRF:
    1. Esquema estritamente http ou https.
    2. Hostname restrito a domínios de worksheets educacionais autorizados.
    3. Bloqueia resolução para IPs privados, loopback, link-local e metadados de nuvem.
    """
    if not url:
        return False
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False

        is_allowed = False
        for domain in _ALLOWED_ACTIVITY_DOMAINS:
            if hostname == domain or hostname.endswith("." + domain):
                is_allowed = True
                break
        if not is_allowed:
            return False

        # Prevenção contra SSRF e DNS rebinding para redes internas / metadados
        addr_info = socket.getaddrinfo(hostname, None)
        for item in addr_info:
            ip_str = item[4][0]
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return False
        return True
    except Exception:
        return False


@activities_router.get("/test-english/image-proxy", auth=auth_optional)
@activities_router.get("/liveworksheets/image-proxy", auth=auth_optional)
def proxy_activity_image(request: HttpRequest, url: str):
    """
    Proxy de imagens para TestEnglish e LiveWorksheets evitando bloqueio de CORS/hotlinking.
    Protegido contra SSRF por whitelist de domínios e bloqueio de IPs privados/loopback.
    """
    if not url or not _is_safe_activity_image_url(url):
        return HttpResponse("URL inválida ou não permitida.", status=400)

    if url in _ACTIVITY_IMAGE_CACHE:
        body, content_type = _ACTIVITY_IMAGE_CACHE[url]
        return HttpResponse(
            body,
            content_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        "Referer": "https://www.liveworksheets.com/"
        if "liveworksheets" in url
        else "https://test-english.com/",
    }
    try:
        with httpx.Client(
            headers=headers, follow_redirects=False, timeout=10.0
        ) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                ct = resp.headers.get(
                    "content-type", "image/webp" if "webp" in url else "image/jpeg"
                )
                _ACTIVITY_IMAGE_CACHE[url] = (resp.content, ct)
                if len(_ACTIVITY_IMAGE_CACHE) > 2000:
                    _ACTIVITY_IMAGE_CACHE.pop(next(iter(_ACTIVITY_IMAGE_CACHE)))
                return HttpResponse(
                    resp.content,
                    content_type=ct,
                    headers={"Cache-Control": "public, max-age=86400"},
                )
    except Exception as e:
        logger.warning(f"[ImageProxy] Erro ao buscar imagem {url}: {e}")

    # Fallback transparente SVG para evitar erro quebrado no frontend
    fallback_svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="16">Activity Worksheet</text></svg>'
    return HttpResponse(
        fallback_svg,
        content_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


def _hub_page_unavailable(retry_after: int = 5) -> HttpResponse:
    """
    Página ainda não disponível (conversão em andamento ou falha temporária).
    Nunca devolve placeholder/imagem falsa: o visualizador mostra "carregando" e re-tenta.
    `no-store` impede que o navegador/CDN guarde a resposta de indisponibilidade.
    """
    return HttpResponse(
        status=503,
        headers={
            "Retry-After": str(retry_after),
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
    )


@activities_router.get("/hub/{content_id}/pages/{page_index}", auth=auth_optional)
def get_hub_page(
    request: HttpRequest, content_id: str, page_index: int, token: Optional[str] = None
):
    """
    Retorna a página de um documento seguro do Hub com marca d'água do email.
    Se a página real ainda não existir, regenera sob demanda; enquanto não houver imagem real
    responde 503 (re-tentável), nunca uma página placeholder.
    """
    email = "Aluno Tati AI"
    title = "Material Didático"
    user = None
    if token:
        from apps.authentication.security import decode_token

        payload = decode_token(token)
        if not payload:
            return HttpResponse(
                json.dumps({"detail": "Token de visualização inválido ou expirado."}),
                status=401,
                content_type="application/json",
            )

        # Validação estrita de isolamento: o token DEVE pertencer exatamente a este content_id
        token_cid = str(payload.get("cid") or "")
        token_scope = str(payload.get("scope") or "")
        expected_scope = f"hub_read:{content_id}"

        if (token_cid and token_cid != str(content_id)) or (
            token_scope and token_scope != expected_scope
        ):
            return HttpResponse(
                json.dumps(
                    {
                        "detail": "Acesso negado: este token não é válido para este material."
                    },
                    ensure_ascii=False,
                ),
                status=403,
                content_type="application/json; charset=utf-8",
            )

        if not token_cid and not token_scope:
            return HttpResponse(
                json.dumps(
                    {
                        "detail": "Acesso negado: token sem autorização para este material."
                    },
                    ensure_ascii=False,
                ),
                status=403,
                content_type="application/json; charset=utf-8",
            )

        username = payload.get("sub")
        if username:
            user = User.objects.filter(username=username).first()
        if payload.get("email"):
            email = payload.get("email")
    if (
        not user
        and getattr(request, "auth", None)
        and isinstance(request.auth, User)
    ):
        user = request.auth
    if (
        not user
        and getattr(request, "user", None)
        and getattr(request.user, "is_authenticated", False)
    ):
        user = request.user

    is_cover = (page_index == 0)
    if not is_cover:
        # Validação obrigatória de autorização para páginas internas (1, 2, ...)
        try:
            HubService.get_content_access(user, content_id)
        except HttpError as auth_err:
            return HttpResponse(
                json.dumps({"detail": getattr(auth_err, "message", "Acesso bloqueado.")}),
                status=getattr(auth_err, "status_code", 403),
                content_type="application/json",
            )

    if user:
        email = getattr(user, "email", "") or getattr(user, "username", "Tati AI")
    elif is_cover:
        email = "Taty's Materials · Preview"

    try:

        from apps.activities.secure_document_service import (
            get_client,
            apply_watermark,
            _RAW_IMAGE_CACHE,
            safe_download_supabase_storage,
        )

        raw_pages = []
        preview_path = None
        content_source = None
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT secure_pages, title, preview_path, content_source FROM premium_content WHERE id = %s",
                [content_id],
            )
            row = cursor.fetchone()
            if row:
                if row[0]:
                    raw_pages = row[0]
                    if isinstance(raw_pages, str):
                        try:
                            raw_pages = json.loads(raw_pages)
                        except Exception:
                            raw_pages = []
                if row[1]:
                    title = str(row[1])
                if row[2]:
                    preview_path = str(row[2])
                if len(row) > 3 and row[3]:
                    content_source = str(row[3])

        if (
            raw_pages
            and isinstance(raw_pages[-1], str)
            and raw_pages[-1].startswith('{"')
        ):
            raw_pages = raw_pages[:-1]

        file_data = None
        storage_path = (
            raw_pages[page_index]
            if 0 <= page_index < len(raw_pages)
            else f"{content_id}/page_{page_index + 1}.webp"
        )

        # 1. Verifica no cache em memória
        file_data = _RAW_IMAGE_CACHE.get(storage_path)

        media_root = getattr(settings, "MEDIA_ROOT", "/app/media")
        local_dir = os.path.join(media_root, "hub_pages", content_id)
        local_file = os.path.join(local_dir, f"page_{page_index + 1}.webp")

        # 2. Se for URL remota (Cloudinary/Supabase/CDN), baixa diretamente e armazena em cache
        if not file_data and str(storage_path).startswith("http"):
            try:
                import httpx
                with httpx.Client(timeout=15.0) as client:
                    resp = client.get(storage_path)
                    if resp.status_code == 200:
                        file_data = resp.content
                        _RAW_IMAGE_CACHE[storage_path] = file_data
                        try:
                            os.makedirs(local_dir, exist_ok=True)
                            with open(local_file, "wb") as f:
                                f.write(file_data)
                        except Exception:
                            pass
            except Exception as net_err:
                logger.warning(f"[Hub] Erro ao baixar página remota {storage_path}: {net_err}")

        # 3. Verifica no disco local persistente (MEDIA_ROOT/hub_pages/{content_id}/page_{page_index+1}.webp)
        if not file_data and os.path.exists(local_file):
            try:
                with open(local_file, "rb") as f:
                    file_data = f.read()
                    _RAW_IMAGE_CACHE[storage_path] = file_data
            except Exception:
                pass

        # 4. Se não houver arquivo no disco do volume e existir content_source, sincroniza sob demanda.
        if not file_data and content_source:
            try:
                from .tasks import sync_material_pages
                from .models import PremiumContent

                m = PremiumContent.objects.filter(id=content_id).first()
                if m and sync_material_pages(m, wait_timeout=100.0):
                    file_data = _RAW_IMAGE_CACHE.get(
                        f"{content_id}/page_{page_index + 1}.webp"
                    ) or _RAW_IMAGE_CACHE.get(storage_path)
                    if not file_data and os.path.exists(local_file):
                        with open(local_file, "rb") as f:
                            file_data = f.read()
                        _RAW_IMAGE_CACHE[storage_path] = file_data
            except Exception as sync_err:
                logger.warning(
                    f"[Hub] Erro no auto-sync sob demanda para {content_id}: {sync_err}"
                )

        # 5. Sem imagem real: nunca devolve placeholder. Responde 503 (sem cache) para o
        # visualizador exibir "carregando" e re-tentar até a página real ficar pronta.
        if not file_data:
            return _hub_page_unavailable()

        cache_header = "public, max-age=86400" if is_cover else "private, max-age=3600"
        try:
            watermarked = apply_watermark(file_data, email)
            return HttpResponse(
                watermarked,
                content_type="image/webp",
                headers={"Cache-Control": cache_header},
            )
        except Exception as e:
            logger.warning(f"[Hub] Erro ao aplicar watermark: {e}")
            return HttpResponse(
                file_data,
                content_type="image/webp",
                headers={"Cache-Control": cache_header},
            )

    except Exception as fatal_err:
        logger.error(
            f"[Hub] Erro inesperado em get_hub_page para {content_id} pág {page_index}: {fatal_err}"
        )
        return _hub_page_unavailable()


#    FLASHCARD ASSETS & CLOUDINARY UPLOAD                               

flashcard_assets_router = Router(tags=["Flashcard Assets"])


@flashcard_assets_router.post("/upload-image", auth=auth_required)
def upload_flashcard_image(request: HttpRequest, file: UploadedFile = File(...)):
    """
    Faz upload de imagem para o Cloudinary para os flashcards.
    """
    require_teacher(request.auth)
    from .assets_service import CloudinaryService

    content = file.read()
    url = CloudinaryService.upload_file(content, file.name)
    return {"url": url}


@flashcard_assets_router.post("/upload-image-from-url", auth=auth_required)
def upload_flashcard_image_from_url(request: HttpRequest, payload: dict):
    """
    Salva imagem no Cloudinary a partir de uma URL ou retorna a própria URL se Cloudinary falhar.
    """
    require_teacher(request.auth)
    from .assets_service import CloudinaryService

    image_url = (payload.get("url") or "").strip()
    if not image_url:
        raise HttpError(400, "URL é obrigatória.")
    try:
        url = CloudinaryService.upload_from_url(image_url)
        return {"url": url or image_url}
    except Exception as e:
        logger.warning(f"[Cloudinary] Falha ao persistir imagem externa '{image_url}': {e}. Usando URL original.")
        return {"url": image_url}


@flashcard_assets_router.post("/ai-image", auth=auth_required)
def generate_flashcard_ai_image(request: HttpRequest, payload: dict):
    """
    Gera imagem específica e direta com IA (FLUX.1-dev / Unsplash) sem spoilers e sem imagens aleatórias.
    """
    require_teacher(request.auth)
    from .image_service import ImageResolverService

    prompt = (payload.get("prompt") or "").strip()
    front = (payload.get("front") or "").strip()
    back = (payload.get("back") or "").strip()
    topic = (payload.get("topic") or "").strip() or None
    explanation = (payload.get("explanation") or "").strip() or None

    term = front or prompt
    if not term:
        raise HttpError(400, "Termo ou prompt é obrigatório.")

    # Constrói visual_prompt específico e direto
    visual_subject = term
    clean_lower = f"{term} {back} {topic or ''}".lower()
    is_diet_or_food = any(k in clean_lower for k in ["diet", "food", "nutrition", "salad", "meal", "eating", "fruit", "vegetable", "snack"])

    if is_diet_or_food:
        visual_prompt = (
            f"A realistic, appetizing, educational photograph of {term} with fresh healthy food, "
            f"salad, fruits and vegetables on a wooden kitchen table, bright natural sunlight, "
            f"clean background, strictly NO stethoscope, NO doctor, NO hospital, NO medicine, NO medical equipment, NO text"
        )
    elif back and len(back) > 5:
        visual_prompt = (
            f"A clear, realistic educational photography illustrating {term} ({back}), "
            f"bright natural lighting, highly pedagogical, clean background, strictly NO visible text, NO letters, NO words"
        )
    else:
        visual_prompt = (
            f"A clear, realistic educational photography illustrating {term}, "
            f"bright natural lighting, highly pedagogical, clean background, strictly NO visible text, NO letters, NO words"
        )

    # 1. Tenta gerar via FLUX.1-dev com visual_prompt
    url = ImageResolverService.generate_flux_image(term, topic=topic, visual_prompt=visual_prompt)

    # 2. Se FLUX falhar ou não estiver disponível, busca imagem direta e específica
    if not url:
        url = ImageResolverService.resolve_image(
            term=term,
            topic=topic,
            search_query=term if is_diet_or_food else None,
            visual_prompt=visual_prompt,
            explanation=explanation or back
        )

    return {"url": url}



#    PREMIUM ADMIN ROUTER                                                

admin_premium_router = Router(tags=["Admin Premium Materials"])


class AdminPremiumIn(Schema):
    title: Optional[str] = None
    description: Optional[str] = ""
    price: Optional[float] = 0.0
    price_students: Optional[float] = 0.0
    price_buyers: Optional[float] = 0.0
    type: Optional[str] = "pdf"
    category: Optional[str] = "other"
    content_source: Optional[str] = ""
    thumbnail_url: Optional[str] = None
    emoji: Optional[str] = "✨"
    is_active: Optional[bool] = True


@admin_premium_router.get("", auth=auth_required)
def list_admin_premium(request: HttpRequest):
    """
    Lista todos os materiais do Hub e da Loja Premium para o painel da professora.
    """
    require_teacher(request.auth)
    from .models import PremiumContent

    materials = PremiumContent.objects.all().order_by("-created_at")
    return [
        {
            "id": str(m.id),
            "title": m.title,
            "description": m.description or "",
            "price": float(m.price or 0.0),
            "price_students": float(m.price_students or m.price or 0.0),
            "price_buyers": float(m.price_buyers or m.price or 0.0),
            "type": m.type or "pdf",
            "category": m.category or "other",
            "content_source": m.content_source or m.preview_path or "",
            "thumbnail_url": m.thumbnail_url or "",
            "emoji": m.emoji or "✨",
            "is_active": m.is_active,
            "created_at": m.created_at.isoformat() if m.created_at else "",
        }
        for m in materials
    ]


@admin_premium_router.post("/upload", auth=auth_required)
def upload_premium_file(request: HttpRequest, file: UploadedFile = File(...)):
    """
    Upload de material digital (PDF/DOC/Vídeo) para o Cloudinary.
    """
    require_teacher(request.auth)
    from .assets_service import CloudinaryService

    content = file.read()
    url = CloudinaryService.upload_file(content, file.name)
    return {"file_path": url, "url": url}


@admin_premium_router.post("/sync", auth=auth_required)
def sync_all_premium_materials(request: HttpRequest):
    """
    Sincroniza e garante o cache local em disco de todos os materiais do Hub.
    """
    require_teacher(request.auth)
    from .tasks import sync_hub_materials_task

    result = sync_hub_materials_task()
    return {"success": True, "result": result}


@admin_premium_router.post("/{content_id}/sync", auth=auth_required)
def sync_single_premium_material(request: HttpRequest, content_id: str):
    """
    Força a sincronização e extração de links de um material específico.
    """
    require_teacher(request.auth)
    from .models import PremiumContent
    from .tasks import sync_material_pages

    m = PremiumContent.objects.filter(id=content_id).first()
    if not m:
        raise HttpError(404, "Material não encontrado.")
    ok = sync_material_pages(m, force=True)
    return {"success": ok, "id": str(m.id), "title": m.title}


@admin_premium_router.post("", auth=auth_required)
def create_admin_premium(request: HttpRequest, payload: AdminPremiumIn):
    require_teacher(request.auth)
    from .models import PremiumContent
    import uuid

    title = (payload.title or "").strip()
    if not title:
        raise HttpError(400, "Title is required")
    m = PremiumContent.objects.create(
        id=str(uuid.uuid4()),
        title=title,
        description=payload.description or "",
        price=payload.price or 0.0,
        price_students=payload.price_students or 0.0,
        price_buyers=payload.price_buyers or 0.0,
        type=payload.type or "pdf",
        category=payload.category or "other",
        content_source=payload.content_source or "",
        thumbnail_url=payload.thumbnail_url,
        emoji=payload.emoji or "✨",
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    if m.content_source and m.content_source.startswith("http"):
        try:
            from .tasks import sync_material_pages

            sync_material_pages(m, force=True)
        except Exception as sync_err:
            logger.warning(f"[Admin] Erro ao sincronizar material novo: {sync_err}")

    return {"success": True, "id": str(m.id), "title": m.title}


@admin_premium_router.put("/{content_id}", auth=auth_required)
def update_admin_premium(
    request: HttpRequest, content_id: str, payload: AdminPremiumIn
):
    require_teacher(request.auth)
    from .models import PremiumContent

    m = PremiumContent.objects.filter(id=content_id).first()
    if not m:
        raise HttpError(404, "Material não encontrado.")
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        if v is not None and hasattr(m, k):
            setattr(m, k, v)
    m.save()

    if m.content_source and m.content_source.startswith("http"):
        try:
            from .tasks import sync_material_pages

            sync_material_pages(m, force=True)
        except Exception as sync_err:
            logger.warning(
                f"[Admin] Erro ao sincronizar material atualizado: {sync_err}"
            )

    return {"success": True, "id": str(m.id), "title": m.title}


@admin_premium_router.delete("/{content_id}", auth=auth_required)
def delete_admin_premium(request: HttpRequest, content_id: str):
    require_teacher(request.auth)
    from .models import PremiumContent

    m = PremiumContent.objects.filter(id=content_id).first()
    if m:
        m.delete()
        return {"success": True, "deleted": content_id}
    raise HttpError(404, "Material não encontrado.")


#    CEFR & SCHEDULER ADMIN ROUTER                                      

cefr_admin_router = Router(tags=["CEFR & Scheduler Admin"])


@cefr_admin_router.get("/all", auth=auth_optional)
def get_cefr_all(request: HttpRequest):
    from .models import Flashcard
    from apps.chat.models import CEFRSimulation

    fc = list(Flashcard.objects.all().order_by("level", "front"))
    sims = list(CEFRSimulation.objects.all().order_by("level", "topic"))
    return {
        "success": True,
        "flashcards": [
            {
                "id": str(f.id),
                "level": f.level,
                "front": f.front,
                "back": f.back,
                "explanation": f.explanation or "",
                "image_url": f.image_url or "",
                "topic": f.topic or "General",
                "options": f.options or [],
                "is_published": f.is_published,
            }
            for f in fc
        ],
        "simulations": [
            {
                "id": str(s.id),
                "level": s.level,
                "topic": s.topic,
                "scenario": s.scenario,
                "roles": s.roles or {},
                "goal": s.goal or "",
                "is_published": s.is_published,
            }
            for s in sims
        ],
    }


@cefr_admin_router.get("/references", auth=auth_optional)
def get_cefr_references(request: HttpRequest):
    from .models import CEFRReference

    refs = list(CEFRReference.objects.all())
    return {
        "success": True,
        "references": [
            {
                "id": str(r.id),
                "filename": r.filename,
                "storage_url": r.storage_url,
                "cefr_level": r.cefr_level,
                "file_type": r.file_type,
                "file_size": r.file_size,
                "chunks_indexed": r.chunks_indexed,
            }
            for r in refs
        ],
    }


@cefr_admin_router.get("/schedules", auth=auth_optional)
def get_cefr_schedules(request: HttpRequest):
    from .models import CEFRSchedule

    schedules = list(CEFRSchedule.objects.all())
    return {
        "success": True,
        "schedules": [
            {
                "id": str(s.id),
                "active": s.active,
                "weekdays": s.weekdays if isinstance(s.weekdays, list) else ["wed"],
                "execution_time": str(s.execution_time),
                "weekly_frequency": s.weekly_frequency,
                "materials_per_execution": s.materials_per_execution,
                "selected_types": s.selected_types or ["flashcards", "simulations"],
                "reference_ids": s.reference_ids if isinstance(s.reference_ids, list) else [],
                "topic_plan": s.topic_plan if isinstance(s.topic_plan, list) else [],
            }
            for s in schedules
        ],
    }


class CEFRScheduleSchema(BaseModel):
    active: Optional[bool] = True
    weekdays: Optional[List[str]] = ["wed"]
    execution_time: Optional[str] = "06:00"
    weekly_frequency: Optional[int] = 1
    materials_per_execution: Optional[int] = 5
    selected_types: Optional[List[str]] = ["flashcards", "simulations"]
    reference_ids: Optional[List[str]] = []
    topic_plan: Optional[List[Dict[str, Any]]] = []


class CEFRFlashcardGroupSaveSchema(BaseModel):
    old_level: str
    old_topic: str
    new_level: str
    new_topic: str
    flashcards: List[Dict[str, Any]]


@cefr_admin_router.post("/schedules", auth=auth_required)
def create_cefr_schedule(request: HttpRequest, payload: CEFRScheduleSchema):
    require_teacher(request.auth)
    from .models import CEFRSchedule

    s = CEFRSchedule.objects.create(
        active=payload.active,
        weekdays=payload.weekdays,
        execution_time=payload.execution_time,
        weekly_frequency=payload.weekly_frequency,
        materials_per_execution=payload.materials_per_execution,
        selected_types=payload.selected_types,
        reference_ids=payload.reference_ids or [],
        topic_plan=payload.topic_plan or [],
    )
    return {"success": True, "data": {"id": str(s.id)}}


@cefr_admin_router.put("/schedules/{schedule_id}", auth=auth_required)
def update_cefr_schedule(
    request: HttpRequest, schedule_id: str, payload: CEFRScheduleSchema
):
    require_teacher(request.auth)
    from .models import CEFRSchedule

    s = CEFRSchedule.objects.filter(id=schedule_id).first()
    if not s:
        raise HttpError(404, "Agendamento não encontrado.")
    s.active = payload.active
    s.weekdays = payload.weekdays
    s.execution_time = payload.execution_time
    s.weekly_frequency = payload.weekly_frequency
    s.materials_per_execution = payload.materials_per_execution
    s.selected_types = payload.selected_types
    s.reference_ids = payload.reference_ids or []
    if payload.topic_plan is not None:
        s.topic_plan = payload.topic_plan
    s.save()
    return {"success": True, "data": {"id": str(s.id)}}


@cefr_admin_router.delete("/schedules/{schedule_id}", auth=auth_required)
def delete_cefr_schedule(request: HttpRequest, schedule_id: str):
    require_teacher(request.auth)
    from .models import CEFRSchedule

    s = CEFRSchedule.objects.filter(id=schedule_id).first()
    if s:
        s.delete()
        return {"success": True, "message": "Schedule deleted successfully."}
    raise HttpError(404, "Agendamento não encontrado.")


@cefr_admin_router.get("/extract-topics", auth=auth_required)
def extract_cefr_topics(request: HttpRequest, reference_ids: Optional[str] = None):
    """
    Extrai tópicos e subtemas pedagógicos reais dos materiais indexados usando IA e alinhados ao nível CEFR.
    """
    require_teacher(request.auth)
    from .generator import CEFRGeneratorService
    from .models import CEFRReference

    # 1. Coleta IDs passados via múltiplos parâmetros (?reference_ids=A&reference_ids=B) ou string separada por vírgula
    raw_list = request.GET.getlist("reference_ids")
    all_ref_ids = []
    for item in raw_list:
        for part in str(item).split(","):
            if part.strip():
                all_ref_ids.append(part.strip())
    if not all_ref_ids and reference_ids:
        all_ref_ids = [r.strip() for r in reference_ids.split(",") if r.strip()]

    # Se require_selected=true ou referências vazias forem explicitamente passadas, não injeta tópicos padrão
    require_selected = request.GET.get("require_selected", "false").lower() in ("true", "1")
    if require_selected and not all_ref_ids:
        return {"success": True, "level": "", "topics": []}

    # 2. Se referências foram fornecidas, extrai tópicos diretamente dos arquivos usando IA
    if all_ref_ids:
        res = CEFRGeneratorService.extract_topics_from_references(all_ref_ids)
        if res and isinstance(res.get("topics"), list):
            # Garante que só retornem tópicos pertencentes aos arquivos selecionados
            cleaned_set = set(all_ref_ids)
            filtered_topics = [
                t for t in res["topics"]
                if not t.get("reference_id") or str(t.get("reference_id")) in cleaned_set
            ]
            res["topics"] = filtered_topics
            return res
        return {"success": True, "level": "", "topics": []}

    # 3. Se não houver IDs específicos e require_selected não estiver ativo, busca os materiais mais recentes do nível solicitado
    level = request.GET.get("level") or "A1"
    refs = list(CEFRReference.objects.filter(cefr_level__iexact=level)[:3])
    if refs:
        res = CEFRGeneratorService.extract_topics_from_references([str(r.id) for r in refs])
        if res and res.get("topics"):
            return res

    # 4. Fallback contextualizado se não houver referências
    return CEFRGeneratorService.extract_topics_from_references([], fallback_level=level)


@cefr_admin_router.post("/schedules/{schedule_id}/run-now", auth=auth_required)
def run_cefr_schedule_now(request: HttpRequest, schedule_id: str):
    """
    Executa imediatamente um agendamento específico (disparo manual para testes e validação).
    """
    require_teacher(request.auth)
    from .models import CEFRSchedule
    from .generator import CEFRGeneratorService

    sched = CEFRSchedule.objects.filter(id=schedule_id).first()
    if not sched:
        raise HttpError(404, "Agendamento não encontrado.")

    res = CEFRGeneratorService.run_single_schedule(sched)
    return res


@cefr_admin_router.post("/generate-flashcards", auth=auth_required)
def generate_cefr_flashcards(
    request: HttpRequest,
    level: str = "A1",
    topic: str = "General",
    count: int = 5,
    title: Optional[str] = None,
    reference_ids: Optional[str] = None,
    items: Optional[str] = None,
):
    """
    Gera baralho de flashcards a partir do tópico e nível CEFR utilizando IA.
    """
    require_teacher(request.auth)
    from .generator import CEFRGeneratorService
    import uuid

    topic_context = None
    if items:
        sub_items = [i.strip() for i in items.split(",") if i.strip()]
        topic_context = {"topic": topic, "items": sub_items}

    cards = CEFRGeneratorService.generate_flashcards(
        level=level,
        topic=topic,
        count=count,
        title=title,
        reference_ids=reference_ids,
        topic_context=topic_context,
    )
    return {
        "success": True,
        "task_id": str(uuid.uuid4()),
        "cards_generated": len(cards),
    }


@cefr_admin_router.post("/generate-simulations", auth=auth_required)
def generate_cefr_simulations(
    request: HttpRequest,
    level: str = "A1",
    topic: str = "General",
    count: int = 1,
    title: Optional[str] = None,
    reference_ids: Optional[str] = None,
    items: Optional[str] = None,
):
    """
    Gera cenários de simulação interativa baseados no nível CEFR utilizando IA.
    """
    require_teacher(request.auth)
    from .generator import CEFRGeneratorService
    import uuid

    topic_context = None
    if items:
        sub_items = [i.strip() for i in items.split(",") if i.strip()]
        topic_context = {"topic": topic, "items": sub_items}

    sims = CEFRGeneratorService.generate_simulations(
        level=level,
        topic=topic,
        count=count,
        title=title,
        topic_context=topic_context,
    )
    sim_id = str(sims[0].id) if sims else str(uuid.uuid4())
    return {"success": True, "task_id": str(uuid.uuid4()), "simulation_id": sim_id}


def extract_cefr_level_from_filename(filename: str, fallback_level: Optional[str] = None) -> str:
    match = re.search(r'(?:^|[\s_\-\.()[\]])([A-C][1-2])(?:$|[\s_\-\.()[\]])', filename, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    if fallback_level and fallback_level.strip().upper() in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        return fallback_level.strip().upper()
    return "A1"


class CEFRReferenceUpdateSchema(BaseModel):
    cefr_level: Optional[str] = None
    filename: Optional[str] = None


@cefr_admin_router.post("/upload-material", auth=auth_required)
def upload_cefr_material(
    request: HttpRequest,
    files: List[UploadedFile] = File(...),
    level: Optional[str] = None,
):
    """
    Faz upload e indexação de arquivos de referência didática (PDF, DOCX, TXT).
    Extrai e indexa os chunks imediatamente no banco (cefr_documents) para extração de tópicos com IA.
    """
    require_teacher(request.auth)
    from .models import CEFRReference
    from .assets_service import CloudinaryService
    from django.db import connection
    from psycopg2.extras import Json
    import uuid, io, pypdf

    results = []
    for f in files:
        content = f.read()
        storage_url = CloudinaryService.upload_file(content, f.name)
        ref_level = extract_cefr_level_from_filename(f.name, fallback_level=level)

        full_text = ""
        if f.name.lower().endswith(".pdf"):
            try:
                reader = pypdf.PdfReader(io.BytesIO(content))
                full_text = "\n".join(p.extract_text() or "" for p in reader.pages)
            except Exception as e:
                logger.warning(f"Erro ao extrair PDF {f.name}: {e}")
        else:
            try:
                full_text = content.decode("utf-8", errors="ignore")
            except Exception:
                pass

        chunk_size = 1200
        chunks = [
            full_text[i : i + chunk_size]
            for i in range(0, len(full_text), chunk_size)
            if full_text[i : i + chunk_size].strip()
        ]

        ref_id = uuid.uuid4()
        ref = CEFRReference.objects.create(
            id=ref_id,
            filename=f.name,
            storage_url=storage_url,
            cefr_level=ref_level,
            file_type=f.name.split(".")[-1].lower(),
            file_size=len(content),
            chunks_indexed=len(chunks),
        )

        # Salva o arquivo original diretamente no volume persistente
        try:
            cefr_dir = os.path.join(settings.MEDIA_ROOT, "cefr_references")
            os.makedirs(cefr_dir, exist_ok=True)
            local_ref_path = os.path.join(cefr_dir, f"{ref_id}_{f.name}")
            with open(local_ref_path, "wb") as rf:
                rf.write(content)
        except Exception as write_err:
            logger.warning(f"Erro ao salvar arquivo CEFR no volume local: {write_err}")

        if chunks:
            try:
                with connection.cursor() as cur:
                    for idx, chunk in enumerate(chunks):
                        cur.execute(
                            """
                            INSERT INTO cefr_documents (id, level, source_file, content, metadata, created_at)
                            VALUES (%s, %s, %s, %s, %s, now());
                            """,
                            (
                                str(uuid.uuid4()),
                                ref.cefr_level,
                                ref.filename,
                                chunk,
                                Json(
                                    {
                                        "original_name": ref.filename,
                                        "reference_id": str(ref.id),
                                        "chunk_index": idx,
                                    }
                                ),
                            ),
                        )
            except Exception as e:
                logger.warning(f"Erro ao salvar chunks de {f.name} em cefr_documents: {e}")

        results.append(
            {
                "filename": f.name,
                "success": True,
                "id": str(ref.id),
                "url": storage_url,
                "cefr_level": ref.cefr_level,
                "chunks_indexed": len(chunks),
            }
        )
    return {"success": True, "results": results}


@cefr_admin_router.patch("/references/{reference_id}", auth=auth_required)
@cefr_admin_router.put("/references/{reference_id}", auth=auth_required)
def update_cefr_reference(
    request: HttpRequest, reference_id: str, body: CEFRReferenceUpdateSchema
):
    """
    Atualiza metadados (como cefr_level e filename) de um documento de referência didática.
    """
    require_teacher(request.auth)
    from .models import CEFRReference

    ref = CEFRReference.objects.filter(id=reference_id).first()
    if not ref:
        raise HttpError(404, "Reference not found")

    if body.cefr_level:
        lvl = body.cefr_level.strip().upper()
        if lvl in ["A1", "A2", "B1", "B2", "C1", "C2"]:
            ref.cefr_level = lvl
    if body.filename:
        ref.filename = body.filename.strip()

    ref.save()
    return {
        "success": True,
        "reference": {
            "id": str(ref.id),
            "filename": ref.filename,
            "cefr_level": ref.cefr_level,
            "storage_url": ref.storage_url,
            "file_type": ref.file_type,
            "file_size": ref.file_size,
            "chunks_indexed": ref.chunks_indexed,
        },
    }


@cefr_admin_router.delete("/references/{reference_id}", auth=auth_required)
def delete_cefr_reference(request: HttpRequest, reference_id: str):
    """
    Exclui um documento de referência didática.
    """
    require_teacher(request.auth)
    from .models import CEFRReference

    CEFRReference.objects.filter(id=reference_id).delete()
    return {"success": True, "message": "Reference deleted successfully."}


@cefr_admin_router.put("/flashcards/group", auth=auth_required)
def toggle_publish_flashcard_group(
    request: HttpRequest, level: str, topic: str, is_published: bool
):
    """
    Aprova ou retorna para rascunho um baralho de flashcards do curador.
    """
    require_teacher(request.auth)
    from .models import Flashcard

    updated = Flashcard.objects.filter(level__iexact=level, topic__iexact=topic).update(
        is_published=is_published
    )
    return {"success": True, "updated": updated}


@cefr_admin_router.delete("/flashcards/group", auth=auth_required)
def delete_flashcard_group(request: HttpRequest, level: str, topic: str):
    """
    Exclui um grupo inteiro de flashcards por nível e tópico.
    """
    require_teacher(request.auth)
    from .models import Flashcard

    deleted = Flashcard.objects.filter(
        level__iexact=level, topic__iexact=topic
    ).delete()
    return {"success": True, "message": f"Deleted group {topic}"}


@cefr_admin_router.post("/flashcards/group/save", auth=auth_required)
def save_flashcard_group(request: HttpRequest, body: CEFRFlashcardGroupSaveSchema):
    """
    Salva as edições feitas em um grupo de flashcards pelo curador.
    """
    require_teacher(request.auth)
    from .models import Flashcard
    import uuid

    # Remove cards antigos
    Flashcard.objects.filter(
        level__iexact=body.old_level, topic__iexact=body.old_topic
    ).delete()

    # Cria novos cards
    inserted = []
    has_published = False
    for card in body.flashcards:
        is_pub = card.get("is_published", True)
        if is_pub:
            has_published = True
        raw_opts = card.get("options") or []
        cleaned_opts = [str(o).strip() for o in raw_opts if str(o).strip()]
        card_front = card.get("front", "").strip()
        if card_front and card_front not in cleaned_opts:
            cleaned_opts.insert(0, card_front)

        fc = Flashcard.objects.create(
            id=uuid.uuid4(),
            level=body.new_level.upper(),
            topic=body.new_topic,
            front=card_front,
            back=card.get("back", ""),
            explanation=card.get("explanation", ""),
            image_url=card.get("image_url", ""),
            options=cleaned_opts[:4],
            is_published=is_pub,
        )
        inserted.append(str(fc.id))

    if has_published:
        try:
            from apps.notifications.services import NotificationDispatcher

            NotificationDispatcher.notify_students_for_activity(
                activity_type="Flashcards CEFR",
                title=body.new_topic,
                levels=body.new_level.upper(),
                is_published=True,
                url="/activities",
            )
        except Exception as exc:
            logger.warning(
                f"[CEFR Admin] Erro ao notificar alunos de flashcards: {exc}"
            )

    return {"success": True, "inserted": len(inserted)}


@cefr_admin_router.put("/simulations/{sim_id}", auth=auth_required)
def update_cefr_simulation(request: HttpRequest, sim_id: str, payload: dict):
    """
    Atualiza status, nível ou conteúdo de uma simulação CEFR.
    """
    require_teacher(request.auth)
    from apps.chat.models import CEFRSimulation

    clean_id = sim_id.replace("cefr_sim_", "")
    cs = CEFRSimulation.objects.filter(id=clean_id).first()
    if not cs:
        raise HttpError(404, "Simulação não encontrada.")
    was_published = cs.is_published
    if "level" in payload:
        cs.level = str(payload["level"]).strip().upper()
    if "difficulty" in payload:
        cs.level = str(payload["difficulty"]).strip().upper()
    if "topic" in payload or "name" in payload:
        cs.topic = payload.get("topic") or payload.get("name")
    if "scenario" in payload or "description" in payload:
        cs.scenario = payload.get("scenario") or payload.get("description")
    if "goal" in payload:
        cs.goal = payload["goal"]
    if "is_published" in payload:
        cs.is_published = payload["is_published"]
    cs.save()

    if cs.is_published and not was_published:
        try:
            from apps.notifications.services import NotificationDispatcher

            NotificationDispatcher.notify_students_for_activity(
                activity_type="Simulação CEFR",
                title=cs.topic,
                levels=cs.level,
                is_published=True,
                url="/voice",
            )
        except Exception as exc:
            logger.warning(f"[CEFR Admin] Erro ao notificar alunos de simulação: {exc}")

    return {"success": True, "data": {"id": str(cs.id), "level": cs.level}}


@cefr_admin_router.delete("/simulations/{sim_id}", auth=auth_required)
def delete_cefr_simulation(request: HttpRequest, sim_id: str):
    """
    Exclui uma simulação CEFR.
    """
    require_teacher(request.auth)
    from apps.chat.models import CEFRSimulation

    clean_id = sim_id.replace("cefr_sim_", "")
    CEFRSimulation.objects.filter(id=clean_id).delete()
    return {"success": True, "message": "Simulation deleted successfully."}


#    CEFR IMAGES RESOLVER                                               

cefr_images_router = Router(tags=["CEFR Images"])


@cefr_images_router.get("/resolve", auth=auth_optional)
def resolve_cefr_image(request: HttpRequest, query: Optional[str] = "study"):
    """
    Resolve e retorna imagem ilustrativa real para palavras e tópicos CEFR via Unsplash/Pexels.
    """
    from .image_service import ImageResolverService

    term = query or "study"
    url = ImageResolverService.resolve_image(term)
    return {
        "success": True,
        "query": term,
        "url": url,
        "image_url": url,
    }


@cefr_images_router.post("/resolve-batch", auth=auth_optional)
@cefr_images_router.get("/resolve-batch", auth=auth_optional)
def resolve_cefr_images_batch(request: HttpRequest, payload: Optional[dict] = None):
    """
    Resolve imagens em lote para flashcards via Unsplash/Pexels.
    """
    from .image_service import ImageResolverService

    terms = (payload or {}).get("terms", [])
    results = ImageResolverService.resolve_batch(terms)
    return {"success": True, "results": results}


# EXAMES TRIMESTRAIS (QUARTERLY EXAMS - A CADA 3 MESES)


@exams_router.get("/trimestral/status", response=TrimestralExamStatusOut, auth=auth_required)
@exams_router.get("/exams/trimestral/status", response=TrimestralExamStatusOut, auth=auth_required)
def get_trimestral_status(request: HttpRequest):
    """
    Retorna a elegibilidade do aluno para realizar o teste trimestral.
    Disponível exatamente após 3 meses desde o último teste concluído.
    Acesso temporariamente restrito aos usuários autorizados (programador e caio.sampaio).
    """
    from .trimestral_exams import TrimestralExamService
    return TrimestralExamService.get_status(request.auth)


@exams_router.post("/trimestral/start", response=TrimestralExamStartOut, auth=auth_required)
@exams_router.post("/exams/trimestral/start", response=TrimestralExamStartOut, auth=auth_required)
def start_trimestral_exam(request: HttpRequest, payload: Optional[TrimestralExamStartInput] = None):
    """
    Inicia um novo exame trimestral com 8 a 15 questões balanceadas (reading, grammar, vocabulary).
    Se o aluno já tiver um exame em andamento, recupera o mesmo sem gerar novo.
    """
    from .trimestral_exams import TrimestralExamService, is_user_authorized

    if not is_user_authorized(request.auth.username):
        raise HttpError(403, "Os exames trimestrais estão em fase de testes e serão liberados em breve para todos os alunos.")

    data = payload or TrimestralExamStartInput()
    num_questions = int(getattr(data, "num_questions", 10) or 10)
    force = bool(getattr(data, "force", False))

    try:
        return TrimestralExamService.start_or_get_exam(request.auth, num_questions=num_questions, force=force)
    except PermissionError as pe:
        raise HttpError(403, str(pe))
    except ValueError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        logger.error(f"[ExamsAPI] Erro ao iniciar exame trimestral: {e}", exc_info=True)
        raise HttpError(500, f"Erro ao gerar exame trimestral: {e}")


@exams_router.get("/trimestral/current", response=TrimestralExamStartOut, auth=auth_required)
@exams_router.get("/exams/trimestral/current", response=TrimestralExamStartOut, auth=auth_required)
def get_current_trimestral_exam(request: HttpRequest):
    """
    Recupera o exame em andamento do aluno se ele atualizar a tela.
    """
    from .trimestral_exams import TrimestralExamService, is_user_authorized

    if not is_user_authorized(request.auth.username):
        raise HttpError(403, "Acesso restrito.")

    current = TrimestralExamService.get_current_active_exam(request.auth)
    if not current:
        raise HttpError(404, "Nenhum exame trimestral em andamento no momento.")
    return current


@exams_router.post("/trimestral/submit", response=TrimestralExamResultOut, auth=auth_required)
@exams_router.post("/exams/trimestral/submit", response=TrimestralExamResultOut, auth=auth_required)
def submit_trimestral_exam(request: HttpRequest, payload: TrimestralExamSubmitInput):
    """
    Submete as respostas do exame trimestral, efetua a correção, pontua e agenda o próximo para 3 meses.
    """
    from .trimestral_exams import TrimestralExamService, is_user_authorized

    if not is_user_authorized(request.auth.username):
        raise HttpError(403, "Acesso restrito.")

    try:
        answers_list = [a.dict() for a in payload.answers]
        return TrimestralExamService.submit_exam(request.auth, payload.exam_id, answers_list)
    except PermissionError as pe:
        raise HttpError(403, str(pe))
    except ValueError as ve:
        raise HttpError(400, str(ve))
    except Exception as e:
        logger.error(f"[ExamsAPI] Erro ao submeter exame trimestral: {e}", exc_info=True)
        raise HttpError(500, f"Erro ao processar submissão do exame: {e}")


@exams_router.get("/trimestral/history", auth=auth_required)
@exams_router.get("/exams/trimestral/history", auth=auth_required)
def get_trimestral_history(request: HttpRequest):
    """
    Retorna o histórico de exames trimestrais concluídos pelo aluno.
    """
    from .trimestral_exams import TrimestralExamService
    return TrimestralExamService.get_history(request.auth)


@exams_router.post("/trimestral/reset", auth=auth_required)
@exams_router.post("/exams/trimestral/reset", auth=auth_required)
def reset_trimestral_exam(request: HttpRequest):
    """
    Endpoint de teste para desenvolvedores: reseta os exames do usuário para testar novamente.
    """
    from .trimestral_exams import TrimestralExamService, is_user_authorized

    if not is_user_authorized(request.auth.username):
        raise HttpError(403, "Acesso restrito.")

    TrimestralExamService.reset_user_exams(request.auth)
    return {"success": True, "message": "Exames trimestrais resetados com sucesso para testes."}

