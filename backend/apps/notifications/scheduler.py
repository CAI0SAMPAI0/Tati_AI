import os
import time
import logging
import threading
from datetime import datetime
from zoneinfo import ZoneInfo
from django.core.cache import cache

logger = logging.getLogger(__name__)

_scheduler_started = False
_scheduler_lock = threading.Lock()


class BackgroundNotificationRunner:
    """
    Executa um daemon leve em segundo plano no processo do Django para:
    1. Manter o WAHA (Render) acordado com ping periódico (evita suspensão no Render).
    2. Disparar notificações agendadas pontualmente no Horário de Brasília (BRT):
       - 20:00 BRT: Lembrete diário de ofensiva (Streak) via Email, Push e WhatsApp.
       - 14:00 BRT: Lembrete de inatividade para alunos ausentes.
       - Domingos 19:00 BRT: Relatório semanal de evolução.
       - Dia 1 de cada mês 09:00 BRT: Fechamento da competição mensal e premiação.
    Utiliza cache atômico (cache.add) para garantir idempotência mesmo em múltiplos workers gunicorn.
    """

    @classmethod
    def start(cls):
        global _scheduler_started
        with _scheduler_lock:
            if _scheduler_started:
                return
            _scheduler_started = True

        t = threading.Thread(target=cls._loop, name="TatiNotificationScheduler", daemon=True)
        t.start()
        logger.info("[Scheduler] TatiNotificationScheduler iniciado em background.")

    @classmethod
    def _loop(cls):
        # Aguarda inicialização completa do Django antes da primeira checagem
        time.sleep(10)
        tick = 0

        while True:
            try:
                tick += 1
                now_brt = datetime.now(ZoneInfo("America/Sao_Paulo"))

                # 1. Keepalive do WAHA na Render (a cada 10 minutos / ticks)
                if tick % 10 == 1:
                    cls._ping_waha()

                # 2. Lembrete diário de ofensiva (20:00 BRT)
                if now_brt.hour == 20 and now_brt.minute == 0:
                    cls._run_daily_streak(now_brt)

                # 3. Incentivo de inatividade (14:00 BRT)
                if now_brt.hour == 14 and now_brt.minute == 0:
                    cls._run_inactivity_nudges(now_brt)

                # 4. Relatório semanal de evolução (Domingos 19:00 BRT)
                if now_brt.weekday() == 6 and now_brt.hour == 19 and now_brt.minute == 0:
                    cls._run_weekly_report(now_brt)

                # 5. Competição mensal (Dia 1 às 09:00 BRT)
                if now_brt.day == 1 and now_brt.hour == 9 and now_brt.minute == 0:
                    cls._run_monthly_competition(now_brt)

            except Exception as e:
                logger.error(f"[Scheduler] Erro no loop de agendamento: {e}", exc_info=True)

            # Dorme por 60 segundos antes da próxima checagem
            time.sleep(60)

    @classmethod
    def _ping_waha(cls):
        try:
            from apps.notifications.waha_service import WahaService
            WahaService.ping_keepalive()
        except Exception as e:
            logger.debug(f"[Scheduler] Erro no ping keepalive: {e}")

    @classmethod
    def _run_daily_streak(cls, now_brt):
        lock_key = f"cron_lock_streak_{now_brt.date().isoformat()}"
        if cache.add(lock_key, "locked", timeout=7200):
            try:
                from apps.notifications.services import NotificationSchedulerService
                logger.info("[Scheduler] Disparando lembretes de streak das 20:00 BRT...")
                res = NotificationSchedulerService.send_daily_streak_reminders_to_all_active_students()
                logger.info(f"[Scheduler] Streak concluído: {res}")
            except Exception as e:
                logger.error(f"[Scheduler] Erro ao enviar lembretes de streak: {e}")

    @classmethod
    def _run_inactivity_nudges(cls, now_brt):
        lock_key = f"cron_lock_inactivity_{now_brt.date().isoformat()}"
        if cache.add(lock_key, "locked", timeout=7200):
            try:
                from apps.notifications.services import NotificationSchedulerService
                logger.info("[Scheduler] Disparando avisos de inatividade das 14:00 BRT...")
                res = NotificationSchedulerService.send_inactivity_nudges_to_all_inactive_students()
                logger.info(f"[Scheduler] Inatividade concluído: {res}")
            except Exception as e:
                logger.error(f"[Scheduler] Erro ao enviar avisos de inatividade: {e}")

    @classmethod
    def _run_weekly_report(cls, now_brt):
        lock_key = f"cron_lock_weekly_{now_brt.date().isoformat()}"
        if cache.add(lock_key, "locked", timeout=7200):
            try:
                from apps.notifications.services import NotificationSchedulerService
                logger.info("[Scheduler] Disparando relatórios semanais de domingo às 19:00 BRT...")
                res = NotificationSchedulerService.send_weekly_reports_to_all_active_students()
                logger.info(f"[Scheduler] Relatórios semanais concluídos: {res}")
            except Exception as e:
                logger.error(f"[Scheduler] Erro ao enviar relatórios semanais: {e}")

    @classmethod
    def _run_monthly_competition(cls, now_brt):
        lock_key = f"cron_lock_monthly_comp_{now_brt.year}_{now_brt.month}"
        if cache.add(lock_key, "locked", timeout=86400):
            try:
                from apps.activities.services import MonthlyCompetitionService
                logger.info("[Scheduler] Fechando ciclo da competição mensal...")
                res = MonthlyCompetitionService.close_and_notify_admin()
                logger.info(f"[Scheduler] Competição mensal concluída: {res}")
            except Exception as e:
                logger.error(f"[Scheduler] Erro ao processar competição mensal: {e}")
