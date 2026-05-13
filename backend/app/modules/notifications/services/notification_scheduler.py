"""
services/notification_scheduler.py
Agendador com streak style Duolingo: notificações progressivas e persistentes.
"""

import random
from datetime import datetime, timedelta, timezone, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi.concurrency import run_in_threadpool

from app.core.database import get_client
from app.modules.notifications.services.notification_service import NotificationService


# ============================================================
# BANCO DE MENSAGENS — ESTILO DUOLINGO
# Variação para não parecer spam robótico
# ============================================================

STREAK_REMINDER_MESSAGES = [
    ("Don't break your streak! 🔥", "You're on a {streak}-day streak. Practice just 5 minutes to keep it alive!"),
    ("Tati is waiting for you! 🍎",  "Your {streak}-day streak is at risk. Come chat with Tati before midnight!"),
    ("⚠️ Streak in danger!",         "{streak} days of hard work — don't let it vanish today. One quick chat is all it takes."),
    ("Your streak misses you 🔥",    "You haven't practiced today yet. Keep your {streak}-day streak going!"),
    ("Almost forgot? 😅",            "Quick reminder: your {streak}-day streak ends at midnight. Let's practice!"),
]

STREAK_BROKEN_MESSAGES = [
    ("Your streak was broken 💔",     "You had a {streak}-day streak. Don't give up — start a new one today!"),
    ("Oops! Streak lost 😢",          "Your {streak}-day streak ended. But every champion has a comeback. Start now!"),
    ("Streak gone... but not you! 💪","You lost your {streak}-day streak. Tati believes you can build an even bigger one!"),
    ("A fresh start awaits 🌅",       "Your {streak}-day streak ended. Today is day 1 of your next record!"),
]

STREAK_MILESTONE_MESSAGES = {
    1:   ("First day done! 🌱",        "You started your streak! Come back tomorrow to keep it going."),
    3:   ("3-day streak! 🔥",          "Three days in a row — you're building a habit. Keep it up!"),
    7:   ("One week streak! 🏆",        "7 days of consistent practice! You're officially on a roll."),
    14:  ("2-week warrior! ⚡",         "14 days straight! Your English is getting stronger every day."),
    30:  ("30-day legend! 🥇",          "One full month of practice! Tati is seriously impressed."),
    60:  ("60 days! You're unstoppable 🚀", "Two months of dedication. You're in the top tier of learners!"),
    100: ("100-DAY STREAK! 🎉",         "ONE HUNDRED DAYS. This is extraordinary. You should be very proud!"),
    365: ("365 days! One full year! 🌟", "A FULL YEAR of daily practice. You are an absolute legend."),
}

INACTIVITY_MESSAGES = [
    # (days_inactive, title, body_template)
    (2,  "Tati misses you! 🍎",            "It's been 2 days since you practiced. Come back for a quick chat!"),
    (3,  "3 days without English 😮",       "Your English skills need exercise too! Come practice with Tati."),
    (5,  "5 days away... 😟",              "Consistent practice is the secret to fluency. Tati is here for you!"),
    (7,  "A whole week without practice 😢","7 days is a long time. But it's never too late to restart. Let's go!"),
    (14, "Two weeks gone 😰",              "Don't let your progress fade. Every day you practice counts. Come back!"),
    (30, "A month away... 💔",             "Tati hasn't forgotten you. Your English journey is still waiting. Restart today!"),
]


class NotificationScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.ns = NotificationService()
        self.db = get_client()

    def start(self):
        """Inicia todos os jobs agendados."""

        # Verifica streaks 3x por dia (horários estratégicos)
        # Manhã: lembra quem ainda não praticou
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron', hour=9, minute=0,
            id='streak_morning'
        )
        # Tarde: segundo aviso para quem ainda não praticou
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron', hour=18, minute=0,
            id='streak_afternoon'
        )
        # Noite: aviso urgente (estilo "vai acabar à meia-noite")
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron', hour=21, minute=30,
            id='streak_night'
        )

        # Verifica streaks quebrados 1x por dia
        self.scheduler.add_job(
            self._job_broken_streaks,
            'cron', hour=10, minute=0,
            id='broken_streaks'
        )

        # Verifica inatividade a cada 12h
        self.scheduler.add_job(
            self.check_user_inactivity,
            'interval', hours=12,
            id='inactivity_check'
        )

        # Relatórios semanais (todo sábado às 15h)
        self.scheduler.add_job(
            self.send_weekly_progress_reports,
            'cron', day_of_week='sat', hour=15, minute=0,
            start_date='2026-05-09 15:00:00',
            id='weekly_reports'
        )

        self.scheduler.start()
        print("[Scheduler] Todos os jobs iniciados.")

    # ============================================================
    # JOBS DE STREAK
    # ============================================================

    async def _job_streak_reminders(self):
        """Envia lembretes para quem ainda não praticou hoje."""
        print("[Scheduler] Verificando streaks para lembrete...")

        def _fetch():
            return self.db.table('users').select('username, name, streak_data').execute().data or []

        users = await run_in_threadpool(_fetch)
        now = datetime.now(timezone.utc)
        today = now.date()
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue

            streak_data = row.get('streak_data') or {}
            if not isinstance(streak_data, dict):
                continue

            last_study_str = str(streak_data.get('last_study_date') or '').strip()
            current_streak = int(streak_data.get('current_streak') or 0)

            if not last_study_str or current_streak <= 0:
                continue

            try:
                last_date = date.fromisoformat(last_study_str)
            except Exception:
                continue

            days_since = (today - last_date).days

            # Só lembra quem praticou ontem mas não praticou hoje ainda
            if days_since != 1:
                continue

            # Evita spam: máximo 3 lembretes por dia por usuário
            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(u, 'streak_reminder', now)
            )
            if already_sent >= 3:
                continue

            # Escolhe mensagem aleatória para não parecer robótico
            title_tpl, body_tpl = random.choice(STREAK_REMINDER_MESSAGES)
            title = title_tpl
            body = body_tpl.format(streak=current_streak)

            await self._dispatch(username, title, body, category='streak_reminder', url='/chat')
            count += 1

        print(f"[Scheduler] Streak reminders enviados: {count}")

    async def _job_broken_streaks(self):
        """Detecta e notifica streaks quebrados (2+ dias sem praticar)."""
        print("[Scheduler] Verificando streaks quebrados...")

        def _fetch():
            return self.db.table('users').select('username, name, streak_data').execute().data or []

        users = await run_in_threadpool(_fetch)
        now = datetime.now(timezone.utc)
        today = now.date()
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue

            streak_data = row.get('streak_data') or {}
            if not isinstance(streak_data, dict):
                continue

            last_study_str = str(streak_data.get('last_study_date') or '').strip()
            current_streak = int(streak_data.get('current_streak') or 0)

            if not last_study_str or current_streak <= 0:
                continue

            try:
                last_date = date.fromisoformat(last_study_str)
            except Exception:
                continue

            days_since = (today - last_date).days

            # Streak quebrado = 2 dias sem praticar
            if days_since != 2:
                continue

            # Evita notificar duas vezes no mesmo dia
            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(u, 'streak_broken', now)
            )
            if already_sent >= 1:
                continue

            title_tpl, body_tpl = random.choice(STREAK_BROKEN_MESSAGES)
            title = title_tpl
            body = body_tpl.format(streak=current_streak)

            await self._dispatch(username, title, body, category='streak_broken', url='/chat')

            # Zera o streak no banco
            await run_in_threadpool(
                lambda u=username: self._reset_streak(u)
            )
            count += 1

        print(f"[Scheduler] Broken streaks processados: {count}")

    def _reset_streak(self, username: str):
        """Zera o streak do usuário no banco."""
        try:
            res = self.db.table('users').select('streak_data').eq('username', username).limit(1).execute()
            if not res.data:
                return
            streak_data = res.data[0].get('streak_data') or {}
            streak_data['current_streak'] = 0
            self.db.table('users').update({'streak_data': streak_data}).eq('username', username).execute()
        except Exception as e:
            print(f"[Scheduler] Erro ao resetar streak de {username}: {e}")

    def _count_notifications_today(self, username: str, category: str, now: datetime) -> int:
        """Conta quantas notificações de uma categoria foram enviadas hoje."""
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        try:
            res = (
                self.db.table('notifications')
                .select('id')
                .eq('username', username)
                .eq('category', category)
                .gte('created_at', start_of_day.isoformat())
                .execute()
            )
            return len(res.data or [])
        except Exception:
            return 0

    # ============================================================
    # JOB DE INATIVIDADE (estilo "temos sentido sua falta")
    # ============================================================

    async def check_user_inactivity(self):
        """Notificações progressivas para usuários inativos."""
        print("[Scheduler] Verificando inatividade...")

        def _fetch():
            return self.db.table('users').select('username, name, last_active, weekly_plan').execute().data or []

        users = await run_in_threadpool(_fetch)
        now = datetime.now(timezone.utc)
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue

            last_active_str = str(row.get('last_active') or '').strip()
            if not last_active_str:
                continue

            try:
                last_active = datetime.fromisoformat(last_active_str.replace('Z', '+00:00'))
                if last_active.tzinfo is None:
                    last_active = last_active.replace(tzinfo=timezone.utc)
            except Exception:
                continue

            days_inactive = (now - last_active).days

            # Encontra a mensagem correta para o nível de inatividade
            selected_msg = None
            for threshold, title, body in sorted(INACTIVITY_MESSAGES, key=lambda x: x[0], reverse=True):
                if days_inactive >= threshold:
                    selected_msg = (title, body)
                    break

            if not selected_msg:
                continue

            # Evita spam: 1 notificação de inatividade por dia
            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(u, 'retention', now)
            )
            if already_sent >= 1:
                continue

            title, body = selected_msg
            name = str(row.get('name') or username)
            body = body.replace('{name}', name)

            await self._dispatch(username, title, body, category='retention', url='/chat')
            count += 1

        print(f"[Scheduler] Inatividade: {count} notificações enviadas")

    # ============================================================
    # RELATÓRIOS SEMANAIS
    # ============================================================

    async def send_weekly_progress_reports(self):
        """Gera e envia relatórios PDF semanais."""
        print("[Scheduler] Enviando relatórios semanais...")
        from app.modules.users.services.progress_report import progress_report_service
        from app.shared.services.email import EmailSender

        email_sender = EmailSender()

        def _fetch_active():
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            return self.db.table('users').select('username, email, name').gte('last_active', seven_days_ago).execute().data or []

        students = await run_in_threadpool(_fetch_active)

        for student in students:
            username = student['username']
            email = student.get('email')
            if not email:
                continue

            try:
                pdf_path = await progress_report_service.generate_student_report(username, lang='en-US')
                success = email_sender.send_report_email(email, student.get('name', username), pdf_path, lang='en-US')
                print(f"[Scheduler] Relatório {'enviado' if success else 'FALHOU'} para {username}")
            except Exception as e:
                print(f"[Scheduler] Erro no relatório de {username}: {e}")

    # ============================================================
    # DISPATCHER INTERNO
    # ============================================================

    async def _dispatch(self, username: str, title: str, body: str, category: str, url: str = '/'):
        """Salva notificação no banco e envia push."""
        try:
            await self.ns.send_notification(username, title, body, category=category)
            from app.modules.notifications.services.push_notifications import send_push_to_user
            send_push_to_user(username, title=title, body=body, url=url)
        except Exception as e:
            print(f"[Scheduler] Erro ao despachar para {username}: {e}")


notification_scheduler = NotificationScheduler()