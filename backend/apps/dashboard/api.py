import json
import os
from typing import List, Optional, Any, Dict
from ninja import Router
from django.http import HttpRequest as DjangoHttpRequest
from ninja.errors import HttpError
from pydantic import BaseModel

from apps.authentication.models import User
from apps.authentication.security import auth_required
from .services import DashboardService


class HttpRequest(DjangoHttpRequest):
    auth: User


dashboard_router = Router(tags=["Teacher Tati Dashboard & Administration"])


def require_staff_user(request: HttpRequest):
    user = request.auth
    if not user or not (user.is_teacher or user.is_programmer):
        raise HttpError(403, "Acesso restrito à Professora Tatiana e Administrador.")
    return user


#    ESTATÍSTICAS RÁPIDAS & OVERVIEW                                    


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


#    GERENCIAMENTO DE ALUNOS                                            


@dashboard_router.get("/students", auth=auth_required)
def get_students(
    request: HttpRequest, search: Optional[str] = None, level: Optional[str] = None
):
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
def get_student_grammar_errors(
    request: HttpRequest, username: str, lang: str = "en-US"
):
    """
    Retorna análise de pontos de melhoria gramaticais do aluno.
    """
    require_staff_user(request)
    return DashboardService.get_student_grammar_errors(username, lang)


@dashboard_router.get("/students/{username}/recommendations", auth=auth_required)
def get_student_recommendations(
    request: HttpRequest, username: str, lang: str = "en-US"
):
    """
    Retorna tópicos e módulos recomendados para o perfil do estudante.
    """
    require_staff_user(request)
    return DashboardService.get_student_recommendations(username, lang)

@dashboard_router.get("/students/{username}/pronunciation-practice", auth=auth_required)
def get_student_pronunciation_practice(
    request: HttpRequest, username: str
):
    """
    Retorna se o estudante praticou pelo Pronunciation Practice no dia.
    """
    require_staff_user(request)
    return DashboardService.get_student_pronunciation_practice(username)


class StudentUpdateInput(BaseModel):
    level: Optional[str] = None
    custom_prompt: Optional[str] = None
    whatsapp_number: Optional[str] = None
    phone: Optional[str] = None
    allow_whatsapp_notifications: Optional[bool] = None


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
    return DashboardService.nudge_student(username, payload.message, sender_user=request.auth)


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


#    FLASHCARDS ADMIN                                                   


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
def update_flashcard_deck(
    request: HttpRequest, deck_id: str, payload: FlashcardDeckInput
):
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


#    SIMULAÇÕES ADMIN                                                   


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
def update_simulation(
    request: HttpRequest, simulation_id: str, payload: SimulationInput
):
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


#    GAMES ADMIN (WORDWALL)                                             


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


#    NEWS ADMIN (NOTÍCIAS EM INGLÊS)                                    


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


#    WAHA (WHATSAPP SESSIONS)                                           


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
    body = {}
    if request.body:
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            pass

    user = request.auth
    session_name = body.get("session") or (
        getattr(user, "username", "default") if user else "default"
    )
    return WahaService.start_session(session_name)


@dashboard_router.post("/waha/session/restart", auth=auth_required)
def restart_waha_session(request: HttpRequest):
    """
    Reinicia forçadamente uma sessão do WhatsApp no WAHA para gerar novo QR Code limpo.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    body = {}
    if request.body:
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            pass

    user = request.auth
    session_name = body.get("session") or (
        getattr(user, "username", "default") if user else "default"
    )
    return WahaService.restart_session(session_name)


@dashboard_router.post("/waha/session/stop", auth=auth_required)
def stop_waha_session(request: HttpRequest):
    """
    Para uma sessão do WhatsApp no WAHA.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    body = {}
    if request.body:
        try:
            body = json.loads(request.body.decode("utf-8"))
        except Exception:
            pass

    user = request.auth
    session_name = body.get("session") or (
        getattr(user, "username", "default") if user else "default"
    )
    return WahaService.stop_session(session_name)


@dashboard_router.get("/waha/session/qr", auth=auth_required)
def get_waha_session_qr(request: HttpRequest, session: Optional[str] = None):
    """
    Obtém a imagem do QRCode para autenticação no WhatsApp sem cache.
    """
    require_staff_user(request)
    from apps.notifications.waha_service import WahaService
    from django.http import HttpResponse

    user = request.auth
    session_name = session or (
        getattr(user, "username", "default") if user else "default"
    )
    qr_bytes = WahaService.get_qr_image(session_name)
    if qr_bytes:
        resp = HttpResponse(qr_bytes, content_type="image/png")
        resp["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        resp["Pragma"] = "no-cache"
        resp["Expires"] = "0"
        return resp
    return HttpResponse(b"", content_type="image/png", status=404)


#    GERENCIAMENTO DE WHATSAPP DE ALUNOS                               


class StudentWhatsAppUpdateInput(BaseModel):
    whatsapp_number: Optional[str] = ""
    allow_whatsapp_notifications: Optional[bool] = True


@dashboard_router.get("/whatsapp/students", auth=auth_required)
def get_whatsapp_students(
    request: HttpRequest,
    search: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    Lista estudantes com seus números de WhatsApp e status de notificações.
    """
    require_staff_user(request)
    return DashboardService.get_whatsapp_students(search=search, status_filter=status)


@dashboard_router.put("/whatsapp/students/{username}", auth=auth_required)
def update_student_whatsapp(
    request: HttpRequest, username: str, payload: StudentWhatsAppUpdateInput
):
    """
    Atualiza número de WhatsApp e preferência de notificações do estudante.
    """
    require_staff_user(request)
    return DashboardService.update_student(username, payload.dict())


@dashboard_router.post("/whatsapp/students/{username}/test", auth=auth_required)
def test_student_whatsapp(request: HttpRequest, username: str):
    """
    Dispara mensagem de teste para o WhatsApp do estudante via sessão @professor.
    """
    require_staff_user(request)
    return DashboardService.send_test_whatsapp_to_student(
        username, sender_user=request.auth
    )


#    FEEDBACKS DOS ALUNOS                                              


@dashboard_router.get("/feedbacks", auth=auth_required)
def get_student_feedbacks(
    request: HttpRequest,
    level: Optional[str] = None,
    area: Optional[str] = None,
    student: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    Retorna feedbacks recebidos dos alunos filtrados por nível CEFR, área/categoria e aluno.
    """
    require_staff_user(request)
    from apps.activities.services import StudentFeedbackService
    return StudentFeedbackService.list_feedbacks(
        level=level,
        area=area,
        student=student,
        status=status,
    )


class FeedbackUpdateInput(BaseModel):
    status: Optional[str] = None
    teacher_reply: Optional[str] = None


@dashboard_router.patch("/feedbacks/{feedback_id}", auth=auth_required)
def update_student_feedback(
    request: HttpRequest,
    feedback_id: str,
    payload: FeedbackUpdateInput,
):
    """
    Atualiza status (ex: reviewed, resolved) ou adiciona resposta da professora Tatiana.
    """
    require_staff_user(request)
    from apps.activities.services import StudentFeedbackService
    return StudentFeedbackService.update_feedback(feedback_id, payload.dict(exclude_unset=True))


#    EXAMES TRIMESTRAIS: VERIFICAÇÃO, IA EM TEMPO REAL & RESPOSTAS      


class ExamSyncInput(BaseModel):
    force_refresh: Optional[bool] = False


class ExamGenerateInput(BaseModel):
    num_questions: Optional[int] = 10


class ExamResetInput(BaseModel):
    mode: Optional[str] = "clear_all"
    exam_id: Optional[str] = None


class QuestionApprovalInput(BaseModel):
    approval_status: str
    admin_notes: Optional[str] = None


class BulkApprovalInput(BaseModel):
    approval_status: Optional[str] = "approved"


class QuestionAIImproveInput(BaseModel):
    suggestion: str


class QuestionManualUpdateInput(BaseModel):
    question: Optional[str] = None
    reading_text: Optional[str] = None
    audio_text: Optional[str] = None
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    approval_status: Optional[str] = None
    admin_notes: Optional[str] = None


@dashboard_router.get("/exams/overview", auth=auth_required)
def get_dashboard_exams_overview(
    request: HttpRequest,
    level: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    Lista alunos filtrados por nível CEFR (A1..C2) com contagem de atividades Grammar..Reading
    verificadas via Playwright, exames pendentes de aprovação e histórico de respostas.
    """
    require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    return AdminExamReviewService.list_students_and_exams(level=level, search=search)


@dashboard_router.get("/exams/students/{username}", auth=auth_required)
def get_dashboard_student_exam_detail(request: HttpRequest, username: str):
    """
    Retorna detalhes completos de exames, questões para aprovação, atividades extraídas pelo Playwright
    e respostas completas de um aluno específico.
    """
    require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        return AdminExamReviewService.get_student_exam_detail(username)
    except ValueError as e:
        raise HttpError(404, str(e))


@dashboard_router.post("/exams/students/{username}/sync-activities", auth=auth_required)
def sync_dashboard_student_activities(
    request: HttpRequest,
    username: str,
    payload: Optional[ExamSyncInput] = None,
):
    """
    Aciona o Playwright para verificar e salvar no banco as questões, respostas corretas e textos
    das atividades concluídas pelo aluno no nível atual (Grammar até Reading).
    """
    require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        force = bool(payload.force_refresh) if payload else False
        return AdminExamReviewService.sync_student_activities(username, force_refresh=force)
    except ValueError as e:
        raise HttpError(404, str(e))


@dashboard_router.post("/exams/students/{username}/generate", auth=auth_required)
def generate_dashboard_student_exam(
    request: HttpRequest,
    username: str,
    payload: Optional[ExamGenerateInput] = None,
):
    """
    Sincroniza atividades concluídas do aluno via Playwright e gera/regenera o exame personalizado do nível atual.
    """
    require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        count = int(payload.num_questions or 10) if payload else 10
        return AdminExamReviewService.generate_student_exam(username, num_questions=count)
    except ValueError as e:
        raise HttpError(404, str(e))


@dashboard_router.post("/exams/students/{username}/reset", auth=auth_required)
def reset_dashboard_student_exam(
    request: HttpRequest,
    username: str,
    payload: Optional[ExamResetInput] = None,
):
    """
    Reseta o exame de um aluno caso a professora deseje liberar nova tentativa
    (mode='reopen' mantém questões aprovadas e libera refazer; mode='clear_all' zera ciclo; mode='delete_one' remove tentativa).
    """
    staff = require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        mode = (payload.mode or "clear_all") if payload else "clear_all"
        ex_id = payload.exam_id if payload else None
        return AdminExamReviewService.reset_student_exams(
            username=username,
            mode=mode,
            exam_id=ex_id,
            reviewer=staff.username,
        )
    except ValueError as e:
        raise HttpError(400, str(e))


@dashboard_router.patch("/exams/{exam_id}/questions/{question_id}/status", auth=auth_required)
def update_exam_question_status(
    request: HttpRequest,
    exam_id: str,
    question_id: str,
    payload: QuestionApprovalInput,
):
    """
    Aprova ou reprova uma questão específica de um exame no Dashboard.
    """
    staff = require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        return AdminExamReviewService.set_question_approval(
            exam_id=exam_id,
            question_id=question_id,
            approval_status=payload.approval_status,
            admin_notes=payload.admin_notes,
            reviewer=staff.username,
        )
    except ValueError as e:
        raise HttpError(400, str(e))


@dashboard_router.post("/exams/{exam_id}/approve-all", auth=auth_required)
def approve_all_exam_questions(
    request: HttpRequest,
    exam_id: str,
    payload: Optional[BulkApprovalInput] = None,
):
    """
    Aprova todas as questões de um exame em lote.
    """
    staff = require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        st = (payload.approval_status or "approved") if payload else "approved"
        return AdminExamReviewService.approve_all_questions(
            exam_id=exam_id,
            approval_status=st,
            reviewer=staff.username,
        )
    except ValueError as e:
        raise HttpError(400, str(e))


@dashboard_router.post("/exams/{exam_id}/questions/{question_id}/ai-improve", auth=auth_required)
def ai_improve_exam_question(
    request: HttpRequest,
    exam_id: str,
    question_id: str,
    payload: QuestionAIImproveInput,
):
    """
    Recebe o que alterar/melhorar sugerido pela admin, pede para a IA atualizar a questão na hora,
    persiste no banco e retorna imediatamente a questão atualizada.
    """
    staff = require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        return AdminExamReviewService.improve_question_realtime(
            exam_id=exam_id,
            question_id=question_id,
            suggestion=payload.suggestion,
            reviewer=staff.username,
        )
    except ValueError as e:
        raise HttpError(400, str(e))
    except RuntimeError as e:
        raise HttpError(502, str(e))


@dashboard_router.patch("/exams/{exam_id}/questions/{question_id}", auth=auth_required)
def manual_edit_exam_question(
    request: HttpRequest,
    exam_id: str,
    question_id: str,
    payload: QuestionManualUpdateInput,
):
    """
    Permite edição manual direta da questão pela admin caso deseje ajustar texto/opções manualmente.
    """
    staff = require_staff_user(request)
    from apps.activities.admin_exam_review import AdminExamReviewService
    try:
        return AdminExamReviewService.manual_update_question(
            exam_id=exam_id,
            question_id=question_id,
            updates=payload.dict(exclude_unset=True),
            reviewer=staff.username,
        )
    except ValueError as e:
        raise HttpError(400, str(e))

