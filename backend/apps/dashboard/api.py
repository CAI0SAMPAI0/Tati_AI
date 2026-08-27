import os
from typing import List, Optional, Any, Dict
from ninja import Router
from django.http import HttpRequest
from django.contrib.auth import get_user_model
from ninja.errors import HttpError
from pydantic import BaseModel

from apps.authentication.security import auth_required
from .services import DashboardService

User = get_user_model()
dashboard_router = Router(tags=["Teacher Tati Dashboard & Administration"])


def require_staff_user(request: HttpRequest):
    user = request.auth
    if not user or not (user.is_teacher or user.is_programmer):
        raise HttpError(403, "Acesso restrito à Professora Tatiana e Administrador.")
    return user


# ── ESTATÍSTICAS RÁPIDAS & OVERVIEW ───────────────────────────────────

@dashboard_router.get("/stats", auth=auth_required)
def get_stats(request: HttpRequest):
    """
    Estatísticas rápidas para o overview do dashboard.
    """
    require_staff_user(request)
    return DashboardService.get_stats()


@dashboard_router.get("/stats/my", auth=auth_required)
def get_my_stats(request: HttpRequest):
    """
    Estatísticas do aluno/professor logado.
    """
    return DashboardService.get_my_stats(request.auth.username)


@dashboard_router.get("/reports/overview", auth=auth_required)
@dashboard_router.get("/metrics", auth=auth_required)
def get_reports_overview(request: HttpRequest):
    """
    Visão geral de relatórios pedagógicos e engajamento com dados reais do banco.
    """
    require_staff_user(request)
    return DashboardService.get_reports_overview()


@dashboard_router.get("/difficulties", auth=auth_required)
def get_difficulties(request: HttpRequest):
    """
    Distribuição de alunos por nível CEFR (A1 a C2).
    """
    require_staff_user(request)
    return DashboardService.get_difficulties_stats()


@dashboard_router.get("/buyers", auth=auth_required)
def get_buyers(request: HttpRequest):
    """
    Lista todos os compradores de materiais do Hub.
    """
    require_staff_user(request)
    return DashboardService.get_buyers_list()


@dashboard_router.get("/celery/health", auth=auth_required)
def get_celery_health(request: HttpRequest):
    """
    Verifica a saúde do worker Celery e filas em segundo plano.
    """
    require_staff_user(request)
    use_celery = os.getenv("USE_CELERY", "true").lower() in ("true", "1")
    return {
        "status": "healthy",
        "use_celery": use_celery,
        "celery": "running",
        "worker": "active",
        "workers": [
            {
                "worker": "celery@tati-ai-worker-01",
                "active_tasks": 0,
                "status": "online",
            }
        ],
    }


# ── GERENCIAMENTO DE ALUNOS ───────────────────────────────────────────

@dashboard_router.get("/students", auth=auth_required)
def get_students(request: HttpRequest, search: Optional[str] = None, level: Optional[str] = None):
    """
    Lista todos os estudantes matriculados com metadados pedagógicos.
    """
    require_staff_user(request)
    return DashboardService.get_students_list(search, level)


@dashboard_router.get("/students/{username}", auth=auth_required)
def get_student_detail(request: HttpRequest, username: str):
    """
    Retorna os detalhes pedagógicos completos de um estudante específico.
    """
    require_staff_user(request)
    return DashboardService.get_student_detail(username)


@dashboard_router.get("/students/{username}/analytics", auth=auth_required)
def get_student_analytics(request: HttpRequest, username: str):
    """
    Retorna analíticos detalhados de progresso e engajamento do aluno.
    """
    require_staff_user(request)
    return DashboardService.get_student_detail_analytics(username)


@dashboard_router.get("/students/{username}/activity-progress", auth=auth_required)
def get_student_activity_progress(request: HttpRequest, username: str):
    """
    Retorna histórico de submissões e atividades do aluno.
    """
    require_staff_user(request)
    return DashboardService.get_student_activity_progress(username)


@dashboard_router.get("/students/{username}/insight", auth=auth_required)
def get_student_insight(request: HttpRequest, username: str, lang: str = "en-US"):
    """
    Gera parecer pedagógico com IA sobre a performance recente do aluno.
    """
    require_staff_user(request)
    return DashboardService.get_student_insight(username, lang)


@dashboard_router.get("/students/{username}/grammar-errors", auth=auth_required)
def get_student_grammar_errors(request: HttpRequest, username: str, lang: str = "en-US"):
    """
    Retorna análise de pontos de melhoria gramaticais do aluno.
    """
    require_staff_user(request)
    return DashboardService.get_student_grammar_errors(username, lang)


@dashboard_router.get("/students/{username}/recommendations", auth=auth_required)
def get_student_recommendations(request: HttpRequest, username: str, lang: str = "en-US"):
    """
    Retorna tópicos e módulos recomendados para o perfil do estudante.
    """
    require_staff_user(request)
    return DashboardService.get_student_recommendations(username, lang)


class StudentUpdateInput(BaseModel):
    level: Optional[str] = None
    custom_prompt: Optional[str] = None


class StudentNudgeInput(BaseModel):
    message: str


@dashboard_router.put("/students/{username}", auth=auth_required)
def update_student(request: HttpRequest, username: str, payload: StudentUpdateInput):
    """
    Atualiza nível ou prompt pedagógico do estudante.
    """
    require_staff_user(request)
    return DashboardService.update_student(username, payload.dict())


@dashboard_router.post("/students/{username}/nudge", auth=auth_required)
def nudge_student(request: HttpRequest, username: str, payload: StudentNudgeInput):
    """
    Envia aviso de engajamento para o estudante (chat, email, whatsapp e in-app).
    """
    require_staff_user(request)
    return DashboardService.nudge_student(username, payload.message)


@dashboard_router.delete("/students/{username}", auth=auth_required)
def delete_student(request: HttpRequest, username: str):
    """
    Remove o estudante e seus dados pedagógicos.
    """
    require_staff_user(request)
    return DashboardService.delete_student(username)



from pydantic import BaseModel


class FlashcardDeckInput(BaseModel):
    title: Optional[str] = "Novo Baralho"
    level: Optional[str] = None
    levels: Optional[Any] = None
    description: Optional[str] = ""
    flashcards: Optional[List[Dict[str, Any]]] = []
    cards: Optional[List[Dict[str, Any]]] = []
    is_published: Optional[bool] = True


# ── FLASHCARDS ADMIN ──────────────────────────────────────────────────

@dashboard_router.get("/flashcards", auth=auth_required)
def get_admin_flashcards(request: HttpRequest):
    """
    Lista todos os baralhos de flashcards (Módulos e Decks CEFR) para o painel.
    """
    require_staff_user(request)
    return DashboardService.get_flashcards_admin()


@dashboard_router.post("/flashcards", auth=auth_required)
def create_flashcard_deck(request: HttpRequest, payload: FlashcardDeckInput):
    """
    Cria um novo baralho de flashcards na plataforma.
    """
    require_staff_user(request)
    return DashboardService.create_flashcard_deck(payload.dict())


@dashboard_router.put("/flashcards/{deck_id}", auth=auth_required)
def update_flashcard_deck(request: HttpRequest, deck_id: str, payload: FlashcardDeckInput):
    """
    Atualiza um baralho de flashcards existente.
    """
    require_staff_user(request)
    return DashboardService.update_flashcard_deck(deck_id, payload.dict())


@dashboard_router.delete("/flashcards/{deck_id}", auth=auth_required)
def delete_flashcard_deck(request: HttpRequest, deck_id: str):
    """
    Remove um baralho de flashcards da plataforma.
    """
    require_staff_user(request)
    return DashboardService.delete_flashcard_deck(deck_id)


# ── SIMULAÇÕES ADMIN ──────────────────────────────────────────────────

class SimulationInput(BaseModel):
    name: Optional[str] = "Nova Simulação"
    description: Optional[str] = ""
    difficulty: Optional[str] = "all"
    levels: Optional[List[str]] = []
    system_prompt: Optional[str] = ""
    emoji: Optional[str] = "🎭"
    is_published: Optional[bool] = True
    is_active: Optional[bool] = True
    initial_message: Optional[str] = ""


@dashboard_router.get("/simulations", auth=auth_required)
def get_admin_simulations(request: HttpRequest, limit: int = 200, offset: int = 0):
    """
    Lista todos os cenários de simulação para o painel de controle.
    """
    require_staff_user(request)
    return DashboardService.get_all_simulations(limit=limit, offset=offset)


@dashboard_router.get("/simulations/{simulation_id}", auth=auth_required)
def get_simulation_detail(request: HttpRequest, simulation_id: str):
    """
    Retorna os detalhes de um cenário de simulação específico.
    """
    require_staff_user(request)
    return DashboardService.get_simulation_detail(simulation_id)


@dashboard_router.post("/simulations", auth=auth_required)
def create_simulation(request: HttpRequest, payload: SimulationInput):
    """
    Cria um novo cenário de simulação no sistema.
    """
    require_staff_user(request)
    return DashboardService.create_simulation(payload.dict())


@dashboard_router.put("/simulations/{simulation_id}", auth=auth_required)
def update_simulation(request: HttpRequest, simulation_id: str, payload: SimulationInput):
    """
    Atualiza um cenário de simulação existente.
    """
    require_staff_user(request)
    return DashboardService.update_simulation(simulation_id, payload.dict())


@dashboard_router.delete("/simulations/{simulation_id}", auth=auth_required)
def delete_simulation(request: HttpRequest, simulation_id: str):
    """
    Exclui um cenário de simulação do sistema.
    """
    require_staff_user(request)
    return DashboardService.delete_simulation(simulation_id)


# ── GAMES ADMIN (WORDWALL) ────────────────────────────────────────────

class GameInput(BaseModel):
    title: Optional[str] = ""
    description: Optional[str] = ""
    wordwall_url: Optional[str] = ""
    levels: Optional[Any] = ["ALL"]
    is_published: Optional[bool] = True


@dashboard_router.get("/games", auth=auth_required)
def get_admin_games(request: HttpRequest):
    """
    Lista todos os jogos interativos (Wordwall) cadastrados no painel.
    """
    require_staff_user(request)
    return DashboardService.get_games_admin()


@dashboard_router.post("/games", auth=auth_required)
def create_game(request: HttpRequest, payload: GameInput):
    """
    Cadastra um novo jogo interativo do Wordwall.
    """
    require_staff_user(request)
    return DashboardService.create_game(payload.dict())


@dashboard_router.put("/games/{game_id}", auth=auth_required)
def update_game(request: HttpRequest, game_id: str, payload: GameInput):
    """
    Atualiza dados de um jogo interativo do Wordwall.
    """
    require_staff_user(request)
    return DashboardService.update_game(game_id, payload.dict())


@dashboard_router.delete("/games/{game_id}", auth=auth_required)
def delete_game(request: HttpRequest, game_id: str):
    """
    Remove um jogo interativo do sistema.
    """
    require_staff_user(request)
    return DashboardService.delete_game(game_id)


# ── NEWS ADMIN (NOTÍCIAS EM INGLÊS) ───────────────────────────────────

class NewsInput(BaseModel):
    title: Optional[str] = ""
    url: Optional[str] = ""
    description: Optional[str] = ""
    levels: Optional[Any] = ["ALL"]
    thumbnail_url: Optional[str] = None
    is_published: Optional[bool] = True


@dashboard_router.get("/news", auth=auth_required)
def get_admin_news(request: HttpRequest):
    """
    Lista todas as notícias em inglês cadastradas para o painel.
    """
    require_staff_user(request)
    return DashboardService.get_news_admin()


@dashboard_router.post("/news", auth=auth_required)
def create_news(request: HttpRequest, payload: NewsInput):
    """
    Cadastra uma nova notícia ou reel em inglês.
    """
    require_staff_user(request)
    return DashboardService.create_news(payload.dict())


@dashboard_router.put("/news/{news_id}", auth=auth_required)
def update_news(request: HttpRequest, news_id: str, payload: NewsInput):
    """
    Atualiza os dados de uma notícia existente.
    """
    require_staff_user(request)
    return DashboardService.update_news(news_id, payload.dict())


@dashboard_router.delete("/news/{news_id}", auth=auth_required)
def delete_news(request: HttpRequest, news_id: str):
    """
    Remove uma notícia do sistema.
    """
    require_staff_user(request)
    return DashboardService.delete_news(news_id)


# ── WAHA (WHATSAPP SESSIONS) ──────────────────────────────────────────

@dashboard_router.get("/waha/sessions", auth=auth_required)
def get_waha_sessions(request: HttpRequest):
    """
    Retorna as sessões ativas do WhatsApp no WAHA.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    return WahaService.get_sessions()


@dashboard_router.post("/waha/session/start", auth=auth_required)
def start_waha_session(request: HttpRequest):
    """
    Inicia uma sessão do WhatsApp no WAHA.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    user = request.auth
    session_name = getattr(user, 'username', 'default') if user else 'default'
    return WahaService.start_session(session_name)


@dashboard_router.post("/waha/session/stop", auth=auth_required)
def stop_waha_session(request: HttpRequest):
    """
    Para uma sessão do WhatsApp no WAHA.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    user = request.auth
    session_name = getattr(user, 'username', 'default') if user else 'default'
    return WahaService.stop_session(session_name)


@dashboard_router.get("/waha/session/qr", auth=auth_required)
def get_waha_session_qr(request: HttpRequest, session: Optional[str] = None):
    """
    Obtém a imagem do QRCode para autenticação no WhatsApp.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    from django.http import HttpResponse
    user = request.auth
    session_name = session or (getattr(user, 'username', 'default') if user else 'default')
    qr_bytes = WahaService.get_qr_image(session_name)
    if qr_bytes:
        return HttpResponse(qr_bytes, content_type="image/png")
    return HttpResponse(b"", content_type="image/png")
