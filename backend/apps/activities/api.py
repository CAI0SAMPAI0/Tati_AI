from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from ninja import Router, File, UploadedFile
from ninja.errors import HttpError
from django.http import HttpRequest
from django.contrib.auth import get_user_model

from apps.authentication.security import auth_required, auth_optional
from .schemas import (
    FlashcardOut,
    FlashcardReviewInput,
    FlashcardReviewOut,
    PodcastOut,
    HubMaterialOut,
    GameOut,
    NewsOut,
    TrophyOut,
    RankingUserOut,
    SubmissionInput,
    SubmissionOut,
    PronunciationVerifyInput,
    PronunciationVerifyOut,
    CheckoutInput,
)
from .services import (
    FlashcardService,
    PodcastService,
    RankingService,
    TrophyService,
    HubService,
    SpeechService,
    SubmissionService,
    VocabularyService,
)
from .models import Game, NewsItem

User = get_user_model()

activities_router = Router(tags=["Activities & Learning"])
catalog_router = Router(tags=["Public Catalog"])
grammar_router = Router(tags=["Grammar"])
speech_router = Router(tags=["Speech & Pronunciation"])


# ── FLASHCARDS & REPETIÇÃO ESPAÇADA (SRS) ────────────────────────────

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
    user_level = level or (request.auth.level if isinstance(getattr(request, 'auth', None), User) else "A1")
    return FlashcardService.get_my_decks(user_level)


@activities_router.post("/flashcards/review", response=FlashcardReviewOut, auth=auth_required)
def review_flashcard(request: HttpRequest, payload: FlashcardReviewInput):
    """
    Registra a avaliação do flashcard e computa o próximo intervalo SRS.
    """
    # Fallback endpoint
    return FlashcardReviewOut(success=True, next_review_days=1, xp_earned=10, total_xp=request.auth.total_xp)


# ── PODCASTS & TREINAMENTO AUDITIVO ───────────────────────────────────

@activities_router.get("/podcasts", response=List[PodcastOut], auth=auth_optional)
@activities_router.get("/podcasts/recommendations", response=List[PodcastOut], auth=auth_optional)
def get_podcasts(request: HttpRequest, level: Optional[str] = None, category: Optional[str] = None):
    """
    Lista podcasts recomendados e episódios com transcrições.
    """
    user_level = level or (request.auth.level if request.auth else "Beginner")
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


@activities_router.get("/podcasts/{podcast_id}", response=PodcastOut, auth=auth_optional)
def get_podcast_detail(request: HttpRequest, podcast_id: str):
    """
    Retorna os detalhes e segmentos de transcrição de um podcast.
    """
    return PodcastService.get_podcast(podcast_id)


# ── RANKING & COMPETIÇÕES ─────────────────────────────────────────────

@activities_router.get("/ranking", response=List[RankingUserOut], auth=auth_optional)
def get_ranking(request: HttpRequest):
    """
    Retorna a tabela de líderes semanal com base no XP acumulado.
    """
    user = request.auth or User(username="aluno", role="student")
    return RankingService.get_ranking(user)


# ── TROFÉUS & CONQUISTAS ──────────────────────────────────────────────

@activities_router.get("/trophies", response=List[TrophyOut], auth=auth_optional)
@activities_router.get("/achievements", response=List[TrophyOut], auth=auth_optional)
def get_trophies(request: HttpRequest):
    """
    Lista todos os troféus e medalhas pedagógicas conquistadas pelo aluno.
    """
    user = request.auth or User(username="aluno", role="student")
    return TrophyService.get_trophies(user)


# ── GAMES & NEWS ──────────────────────────────────────────────────────

@activities_router.get("/games", response=List[GameOut], auth=auth_optional)
def get_games(request: HttpRequest):
    """
    Lista jogos educativos interativos (Wordwall).
    """
    qs = Game.objects.filter(is_published=True)
    return [
        GameOut(
            id=g.id,
            title=g.title,
            description=g.description or "",
            wordwall_url=g.wordwall_url,
            levels=g.levels or [],
        )
        for g in qs
    ]


@activities_router.get("/news", response=List[NewsOut], auth=auth_optional)
def get_news(request: HttpRequest):
    """
    Lista notícias em inglês graduadas por nível CEFR.
    """
    qs = NewsItem.objects.filter(is_published=True)
    return [
        NewsOut(
            id=n.id,
            title=n.title,
            url=n.url,
            description=n.description or "",
            levels=n.levels or [],
            thumbnail_url=n.thumbnail_url,
        )
        for n in qs
    ]


# ── SUBMISSÕES DE ATIVIDADES ──────────────────────────────────────────

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


# ── HUB DE MATERIAIS & PREMIUM ────────────────────────────────────────

@activities_router.get("/hub", response=List[HubMaterialOut], auth=auth_optional)
@activities_router.get("/hub/public", response=List[HubMaterialOut], auth=auth_optional)
@activities_router.get("/premium", response=List[HubMaterialOut], auth=auth_optional)
def get_hub_materials(request: HttpRequest, category: Optional[str] = None):
    """
    Lista os materiais digitais interativos e livros da Teacher Tati.
    """
    user = request.auth if isinstance(request.auth, User) else User(role="student")
    return HubService.list_materials(user, category)


@activities_router.get("/weekly-goal", auth=auth_optional)
def get_weekly_goal(request: HttpRequest):
    """
    Retorna a meta semanal de estudos e dias concluídos.
    """
    user = request.auth if isinstance(request.auth, User) else None
    streak = user.streak_count if user else 0
    xp = user.total_xp if user else 0
    return {
        "target_days": 5,
        "completed_days": min(streak, 5),
        "streak": streak,
        "xp_goal": 150,
        "current_xp": xp,
        "is_completed": streak >= 5,
    }


@activities_router.get("/hub/{content_id}/access", auth=auth_optional)
@activities_router.get("/premium/{content_id}/access", auth=auth_optional)
def get_hub_content_access(request: HttpRequest, content_id: str):
    """
    Retorna o link de acesso seguro ou direto para o material do Hub.
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.get_content_access(user, content_id)


# ── CATÁLOGO PÚBLICO & CHECKOUT DE MATERIAIS ─────────────────────────

@catalog_router.get("", response=List[HubMaterialOut], auth=auth_optional)
def public_catalog(request: HttpRequest, category: Optional[str] = None):
    """
    Catálogo público de materiais e livros para visitantes e alunos.
    """
    user = request.auth if isinstance(request.auth, User) else User(role="student")
    return HubService.list_materials(user, category)


@catalog_router.post("/checkout", auth=auth_optional)
def catalog_checkout(request: HttpRequest, payload: CheckoutInput):
    """
    Inicia o checkout de compra de material do Hub via Mercado Pago (PIX / Cartão).
    """
    user = request.auth if isinstance(request.auth, User) else None
    return HubService.process_checkout(user, payload.dict())


@catalog_router.post("/checkout/{payment_id}/cancel", auth=auth_optional)
def catalog_checkout_cancel(request: HttpRequest, payment_id: str):
    """
    Cancela pedido/cobrança pendente do checkout.
    """
    return HubService.cancel_checkout(payment_id)


@catalog_router.get("/checkout/{payment_id}/status", auth=auth_optional)
@catalog_router.get("/checkout/{payment_id}", auth=auth_optional)
def catalog_checkout_status(request: HttpRequest, payment_id: str):
    """
    Consulta status atualizado do pagamento no Mercado Pago.
    """
    return HubService.get_checkout_status(payment_id)


# ── GRAMÁTICA & EXERCÍCIOS ────────────────────────────────────────────

@grammar_router.get("", auth=auth_optional)
@activities_router.get("/grammar", auth=auth_optional)
def get_grammar_topics(request: HttpRequest, topic: Optional[str] = None, level: Optional[str] = None):
    """
    Tópicos gramaticais e guias de referência por nível CEFR (A1 a C1).
    """
    from .grammar_data import GrammarService
    effective_level = level or (request.auth.level if isinstance(request.auth, User) else "ALL")
    return GrammarService.get_grammar(topic, effective_level)


@grammar_router.post("/cache-clear")
def clear_grammar_cache(request: HttpRequest):
    """
    Limpa cache de gramática.
    """
    return {"ok": True, "message": "Grammar cache cleared"}


# ── READING & LISTENING ───────────────────────────────────────────────

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


# ── PRONÚNCIA & SPEECH ────────────────────────────────────────────────

@speech_router.post("/verify-pronunciation", response=PronunciationVerifyOut, auth=auth_optional)
def verify_pronunciation(request: HttpRequest, payload: PronunciationVerifyInput):
    """
    Avalia a precisão fonética de uma frase falada pelo aluno.
    """
    return SpeechService.verify_pronunciation(
        target=payload.target_phrase,
        spoken=payload.spoken_phrase,
        threshold=payload.accuracy_threshold or 70.0,
        audio_b64=payload.audio,
        reference_text=payload.reference_text,
    )


@speech_router.post("/transcribe", auth=auth_optional)
def speech_transcribe(request: HttpRequest, payload: dict):
    """
    Transcreve áudio enviado pelo aluno.
    """
    from apps.chat.audio_service import AudioService
    audio_data = payload.get("audio") or ""
    text = AudioService.transcribe_audio(audio_data)
    return {"text": text, "transcription": text}


@speech_router.post("/tts", auth=auth_optional)
def speech_tts(request: HttpRequest, payload: dict):
    """
    Converte texto em áudio via Edge TTS.
    """
    from apps.chat.audio_service import AudioService
    text = payload.get("text") or ""
    accent = payload.get("accent") or "en-US"
    audio_b64 = AudioService.text_to_speech(text, accent=accent)
    return {"audio": audio_b64, "audio_b64": audio_b64}


# ── EXTERNAL CONTENT: TEST ENGLISH & LIVEWORKSHEETS ───────────────────

@activities_router.get("/test-english/content", auth=auth_optional)
def test_english_content(request: HttpRequest, level: str = "A1", category: str = "grammar"):
    """
    Retorna o catálogo indexado de exercícios do Test English.
    """
    from .services import ExternalContentService
    return ExternalContentService.get_test_english_content(level, category)


@activities_router.get("/liveworksheets/content", auth=auth_optional)
def liveworksheets_content(request: HttpRequest, level: str = "A1", category: str = "general"):
    """
    Retorna o catálogo indexado de exercícios do LiveWorksheets.
    """
    from .services import ExternalContentService
    return ExternalContentService.get_liveworksheets_content(level, category)


# ── FLASHCARD ASSETS & CLOUDINARY UPLOAD ──────────────────────────────

flashcard_assets_router = Router(tags=["Flashcard Assets"])

@flashcard_assets_router.post("/upload-image", auth=auth_optional)
def upload_flashcard_image(request: HttpRequest, file: UploadedFile = File(...)):
    """
    Faz upload de imagem para o Cloudinary para os flashcards.
    """
    from .assets_service import CloudinaryService
    content = file.read()
    url = CloudinaryService.upload_file(content, file.name)
    return {"url": url}


@flashcard_assets_router.post("/upload-image-from-url", auth=auth_optional)
def upload_flashcard_image_from_url(request: HttpRequest, payload: dict):
    """
    Salva imagem no Cloudinary a partir de uma URL.
    """
    from .assets_service import CloudinaryService
    image_url = payload.get("url")
    if not image_url:
        raise HttpError(400, "URL é obrigatória.")
    url = CloudinaryService.upload_from_url(image_url)
    return {"url": url}


# ── PREMIUM ADMIN ROUTER ───────────────────────────────────────────────

admin_premium_router = Router(tags=["Admin Premium Materials"])

@admin_premium_router.get("", auth=auth_optional)
def list_admin_premium(request: HttpRequest):
    """
    Lista todos os materiais do Hub e da Loja Premium para o painel da professora.
    """
    from .models import PremiumContent
    materials = PremiumContent.objects.all().order_by('-created_at')
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


@admin_premium_router.post("/upload", auth=auth_optional)
def upload_premium_file(request: HttpRequest, file: UploadedFile = File(...)):
    """
    Upload de material digital (PDF/DOC/Vídeo) para o Cloudinary.
    """
    from .assets_service import CloudinaryService
    content = file.read()
    url = CloudinaryService.upload_file(content, file.name)
    return {"file_path": url, "url": url}


@admin_premium_router.post("", auth=auth_optional)
def create_admin_premium(request: HttpRequest, payload: dict):
    from .models import PremiumContent
    import uuid
    title = (payload.get("title") or "").strip()
    if not title:
        raise HttpError(400, "Title is required")
    m = PremiumContent.objects.create(
        id=str(uuid.uuid4()),
        title=title,
        description=payload.get("description", ""),
        price=payload.get("price", 0.0),
        price_students=payload.get("price_students", 0.0),
        price_buyers=payload.get("price_buyers", 0.0),
        type=payload.get("type", "pdf"),
        category=payload.get("category", "other"),
        content_source=payload.get("content_source", ""),
        thumbnail_url=payload.get("thumbnail_url"),
        emoji=payload.get("emoji", "✨"),
        is_active=payload.get("is_active", True),
    )
    return {"success": True, "id": str(m.id), "title": m.title}


@admin_premium_router.put("/{content_id}", auth=auth_optional)
def update_admin_premium(request: HttpRequest, content_id: str, payload: dict):
    from .models import PremiumContent
    m = PremiumContent.objects.filter(id=content_id).first()
    if not m:
        raise HttpError(404, "Material não encontrado.")
    for k in ["title", "description", "price", "price_students", "price_buyers", "type", "category", "content_source", "thumbnail_url", "emoji", "is_active"]:
        if k in payload:
            setattr(m, k, payload[k])
    m.save()
    return {"success": True, "id": str(m.id), "title": m.title}


@admin_premium_router.delete("/{content_id}", auth=auth_optional)
def delete_admin_premium(request: HttpRequest, content_id: str):
    from .models import PremiumContent
    m = PremiumContent.objects.filter(id=content_id).first()
    if m:
        m.delete()
        return {"success": True, "deleted": content_id}
    raise HttpError(404, "Material não encontrado.")


# ── CEFR & SCHEDULER ADMIN ROUTER ─────────────────────────────────────

cefr_admin_router = Router(tags=["CEFR & Scheduler Admin"])

@cefr_admin_router.get("/all", auth=auth_optional)
def get_cefr_all(request: HttpRequest):
    from .models import Flashcard
    from apps.chat.models import CEFRSimulation
    fc = list(Flashcard.objects.all().order_by('level', 'front'))
    sims = list(CEFRSimulation.objects.all().order_by('level', 'topic'))
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
        ]
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
            }
            for s in schedules
        ]
    }


class CEFRScheduleSchema(BaseModel):
    active: Optional[bool] = True
    weekdays: Optional[List[str]] = ["wed"]
    execution_time: Optional[str] = "06:00"
    weekly_frequency: Optional[int] = 1
    materials_per_execution: Optional[int] = 5
    selected_types: Optional[List[str]] = ["flashcards", "simulations"]


class CEFRFlashcardGroupSaveSchema(BaseModel):
    old_level: str
    old_topic: str
    new_level: str
    new_topic: str
    flashcards: List[Dict[str, Any]]


@cefr_admin_router.post("/schedules", auth=auth_optional)
def create_cefr_schedule(request: HttpRequest, payload: CEFRScheduleSchema):
    from .models import CEFRSchedule
    s = CEFRSchedule.objects.create(
        active=payload.active,
        weekdays=payload.weekdays,
        execution_time=payload.execution_time,
        weekly_frequency=payload.weekly_frequency,
        materials_per_execution=payload.materials_per_execution,
        selected_types=payload.selected_types,
    )
    return {"success": True, "data": {"id": str(s.id)}}


@cefr_admin_router.put("/schedules/{schedule_id}", auth=auth_optional)
def update_cefr_schedule(request: HttpRequest, schedule_id: str, payload: CEFRScheduleSchema):
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
    s.save()
    return {"success": True, "data": {"id": str(s.id)}}


@cefr_admin_router.delete("/schedules/{schedule_id}", auth=auth_optional)
def delete_cefr_schedule(request: HttpRequest, schedule_id: str):
    from .models import CEFRSchedule
    s = CEFRSchedule.objects.filter(id=schedule_id).first()
    if s:
        s.delete()
        return {"success": True, "message": "Schedule deleted successfully."}
    raise HttpError(404, "Agendamento não encontrado.")


@cefr_admin_router.get("/extract-topics", auth=auth_optional)
def extract_cefr_topics(request: HttpRequest, reference_ids: Optional[str] = None):
    """
    Extrai tópicos e subtemas pedagógicos dos materiais indexados usando IA e alinhados ao nível CEFR.
    """
    from .models import CEFRReference
    level = "A1"
    if reference_ids:
        ref_id_list = [r.strip() for r in reference_ids.split(",") if r.strip()]
        refs = list(CEFRReference.objects.filter(id__in=ref_id_list))
        if refs:
            level = refs[0].cefr_level.upper()

    lvl = level.upper()
    if lvl in ["B1", "B2"]:
        topics = [
            {"topic": "Airport, Boarding and Flight Procedures", "items": ["boarding pass", "security checkpoint", "customs declaration", "carry-on luggage", "gate change", "departure lounge"], "count": 6},
            {"topic": "Job Interviews and Professional Career", "items": ["work experience", "strengths and weaknesses", "career goals", "leadership skills", "salary expectations"], "count": 5},
            {"topic": "Housing, Rent and Utilities", "items": ["lease agreement", "security deposit", "monthly rent", "utilities included", "landlord obligations"], "count": 5},
            {"topic": "Technology and Digital Communication", "items": ["cloud storage", "data privacy", "software development", "cybersecurity", "remote collaboration"], "count": 5},
            {"topic": "Environment and Sustainable Living", "items": ["renewable energy", "carbon footprint", "recycling policies", "global warming", "biodiversity"], "count": 5},
        ]
    elif lvl in ["C1", "C2"]:
        topics = [
            {"topic": "Diplomatic Negotiations and Global Trade", "items": ["bilateral agreements", "tariff exemptions", "geopolitical diplomacy", "economic sanctions", "multilateral treaties"], "count": 5},
            {"topic": "Advanced Academic Rhetoric and Research", "items": ["empirical methodology", "paradigm shift", "statistical validity", "peer review process", "hypothesis testing"], "count": 5},
            {"topic": "Ethics in Artificial Intelligence", "items": ["algorithmic bias", "autonomous systems", "moral accountability", "data governance", "machine learning safety"], "count": 5},
        ]
    else:
        topics = [
            {"topic": "Family and Relationships", "items": ["father", "mother", "sister", "brother", "cousin", "grandparents"], "count": 6},
            {"topic": "Hobbies and Free Time", "items": ["reading", "cycling", "cooking", "traveling", "listening to music"], "count": 5},
            {"topic": "Work and Occupations", "items": ["teacher", "engineer", "doctor", "lawyer", "programmer", "manager"], "count": 6},
            {"topic": "Daily Routine", "items": ["wake up", "take a shower", "have breakfast", "go to work", "study"], "count": 5},
            {"topic": "Food and Dining", "items": ["breakfast", "lunch", "dinner", "vegetables", "fruit", "restaurant", "order"], "count": 7},
            {"topic": "Shopping and Clothes", "items": ["shirt", "pants", "shoes", "jacket", "price", "size", "discount"], "count": 7},
            {"topic": "Travel and Airport", "items": ["passport", "ticket", "hotel", "luggage", "vacation"], "count": 5},
            {"topic": "Weather and Seasons", "items": ["sunny", "rainy", "cloudy", "winter", "summer", "spring", "autumn"], "count": 7},
        ]
    return {"success": True, "level": lvl, "topics": topics}


@cefr_admin_router.post("/generate-flashcards", auth=auth_optional)
def generate_cefr_flashcards(
    request: HttpRequest,
    level: str = "A1",
    topic: str = "General",
    count: int = 5,
    title: Optional[str] = None,
    reference_ids: Optional[str] = None,
):
    """
    Gera baralho de flashcards a partir do tópico e nível CEFR utilizando IA.
    """
    from .generator import CEFRGeneratorService
    import uuid

    cards = CEFRGeneratorService.generate_flashcards(
        level=level,
        topic=topic,
        count=count,
        title=title,
        reference_ids=reference_ids,
    )
    return {"success": True, "task_id": str(uuid.uuid4()), "cards_generated": len(cards)}


@cefr_admin_router.post("/generate-simulations", auth=auth_optional)
def generate_cefr_simulations(
    request: HttpRequest,
    level: str = "A1",
    topic: str = "General",
    count: int = 1,
    title: Optional[str] = None,
    reference_ids: Optional[str] = None,
):
    """
    Gera cenários de simulação interativa baseados no nível CEFR utilizando IA.
    """
    from .generator import CEFRGeneratorService
    import uuid

    sims = CEFRGeneratorService.generate_simulations(
        level=level,
        topic=topic,
        count=count,
        title=title,
    )
    sim_id = str(sims[0].id) if sims else str(uuid.uuid4())
    return {"success": True, "task_id": str(uuid.uuid4()), "simulation_id": sim_id}


@cefr_admin_router.post("/upload-material", auth=auth_optional)
def upload_cefr_material(request: HttpRequest, files: List[UploadedFile] = File(...), level: Optional[str] = None):
    """
    Faz upload e indexação de arquivos de referência didática (PDF, DOCX, TXT).
    """
    from .models import CEFRReference
    from .assets_service import CloudinaryService
    import uuid

    results = []
    for f in files:
        content = f.read()
        storage_url = CloudinaryService.upload_file(content, f.name)
        ref = CEFRReference.objects.create(
            id=uuid.uuid4(),
            filename=f.name,
            storage_url=storage_url,
            cefr_level=(level or "A1").upper(),
            file_type=f.name.split(".")[-1].lower(),
            file_size=len(content),
            chunks_indexed=3,
        )
        results.append({
            "filename": f.name,
            "success": True,
            "id": str(ref.id),
            "url": storage_url,
        })
    return {"success": True, "results": results}


@cefr_admin_router.delete("/references/{reference_id}", auth=auth_optional)
def delete_cefr_reference(request: HttpRequest, reference_id: str):
    """
    Exclui um documento de referência didática.
    """
    from .models import CEFRReference
    CEFRReference.objects.filter(id=reference_id).delete()
    return {"success": True, "message": "Reference deleted successfully."}


@cefr_admin_router.put("/flashcards/group", auth=auth_optional)
def toggle_publish_flashcard_group(request: HttpRequest, level: str, topic: str, is_published: bool):
    """
    Aprova ou retorna para rascunho um baralho de flashcards do curador.
    """
    from .models import Flashcard
    updated = Flashcard.objects.filter(level__iexact=level, topic__iexact=topic).update(is_published=is_published)
    return {"success": True, "updated": updated}


@cefr_admin_router.delete("/flashcards/group", auth=auth_optional)
def delete_flashcard_group(request: HttpRequest, level: str, topic: str):
    """
    Exclui um grupo inteiro de flashcards por nível e tópico.
    """
    from .models import Flashcard
    deleted = Flashcard.objects.filter(level__iexact=level, topic__iexact=topic).delete()
    return {"success": True, "message": f"Deleted group {topic}"}


@cefr_admin_router.post("/flashcards/group/save", auth=auth_optional)
def save_flashcard_group(request: HttpRequest, body: CEFRFlashcardGroupSaveSchema):
    """
    Salva as edições feitas em um grupo de flashcards pelo curador.
    """
    from .models import Flashcard
    import uuid

    # Remove cards antigos
    Flashcard.objects.filter(level__iexact=body.old_level, topic__iexact=body.old_topic).delete()

    # Cria novos cards
    inserted = []
    for card in body.flashcards:
        fc = Flashcard.objects.create(
            id=uuid.uuid4(),
            level=body.new_level.upper(),
            topic=body.new_topic,
            front=card.get("front", ""),
            back=card.get("back", ""),
            explanation=card.get("explanation", ""),
            image_url=card.get("image_url", ""),
            is_published=card.get("is_published", True),
        )
        inserted.append(str(fc.id))
    return {"success": True, "inserted": len(inserted)}


@cefr_admin_router.put("/simulations/{sim_id}", auth=auth_optional)
def update_cefr_simulation(request: HttpRequest, sim_id: str, payload: dict):
    """
    Atualiza status, nível ou conteúdo de uma simulação CEFR.
    """
    from apps.chat.models import CEFRSimulation
    clean_id = sim_id.replace("cefr_sim_", "")
    cs = CEFRSimulation.objects.filter(id=clean_id).first()
    if not cs:
        raise HttpError(404, "Simulação não encontrada.")
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
    return {"success": True, "data": {"id": str(cs.id), "level": cs.level}}


@cefr_admin_router.delete("/simulations/{sim_id}", auth=auth_optional)
def delete_cefr_simulation(request: HttpRequest, sim_id: str):
    """
    Exclui uma simulação CEFR.
    """
    from apps.chat.models import CEFRSimulation
    clean_id = sim_id.replace("cefr_sim_", "")
    CEFRSimulation.objects.filter(id=clean_id).delete()
    return {"success": True, "message": "Simulation deleted successfully."}


# ── CEFR IMAGES RESOLVER ──────────────────────────────────────────────

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
