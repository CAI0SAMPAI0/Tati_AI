import logging
from celery import shared_task
from django.contrib.auth import get_user_model
from .services import NotificationSchedulerService

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task(name="apps.notifications.tasks.send_daily_streak_reminders_task")
def send_daily_streak_reminders_task():
    """
    Tarefa Celery agendada: Executa diariamente às 20:00 (Horário de Brasília).
    Dispara lembretes de ofensiva para TODOS os alunos ativos cadastrados no sistema.
    """
    logger.info("[Celery Task] Iniciando envio de lembretes diários de streak...")
    try:
        return NotificationSchedulerService.send_daily_streak_reminders_to_all_active_students()
    except Exception as e:
        logger.error(f"[Celery Task] Erro ao enviar lembretes de streak: {e}")
        return {"error": str(e)}


@shared_task(name="apps.notifications.tasks.send_weekly_progress_reports_task")
def send_weekly_progress_reports_task():
    """
    Tarefa Celery agendada: Executa aos domingos às 19:00 (Horário de Brasília).
    Dispara o relatório semanal de evolução para TODOS os alunos ativos.
    """
    logger.info("[Celery Task] Iniciando envio dos relatórios semanais de evolução...")
    try:
        return NotificationSchedulerService.send_weekly_reports_to_all_active_students()
    except Exception as e:
        logger.error(f"[Celery Task] Erro ao enviar relatórios semanais: {e}")
        return {"error": str(e)}


@shared_task(name="apps.notifications.tasks.send_inactivity_nudges_task")
def send_inactivity_nudges_task():
    """
    Tarefa Celery agendada: Executa diariamente às 14:00 (Horário de Brasília).
    Dispara incentivo de retorno para alunos inativos há mais de 3 dias.
    """
    logger.info("[Celery Task] Iniciando envio de lembretes para alunos inativos...")
    try:
        return (
            NotificationSchedulerService.send_inactivity_nudges_to_all_inactive_students()
        )
    except Exception as e:
        logger.error(f"[Celery Task] Erro ao enviar lembretes de inatividade: {e}")
        return {"error": str(e)}


@shared_task(name="apps.notifications.tasks.close_monthly_competition_task")
def close_monthly_competition_task():
    """
    Tarefa Celery agendada: Executa no dia 1 de cada mês às 00:05 (Horário de Brasília).
    Fecha o ciclo do mês anterior, calcula o Top 3 e envia o relatório para a Professora Tatiana e Administradores.
    """
    logger.info(
        "[Celery Task] Iniciando fechamento da competição mensal e envio do Top 3..."
    )
    try:
        from apps.activities.services import MonthlyCompetitionService

        return MonthlyCompetitionService.close_and_notify_admin()
    except Exception as e:
        logger.error(f"[Celery Task] Erro ao fechar competição mensal: {e}")
        return {"error": str(e)}

