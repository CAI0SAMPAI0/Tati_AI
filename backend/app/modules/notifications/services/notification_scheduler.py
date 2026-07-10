import logging
"""
Agendador com streak style Duolingo: notificações progressivas e persistentes.
CORREÇÃO DE PERFORMANCE: __init__ não conecta mais ao banco.
A conexão só ocorre quando os jobs rodam.
"""

import random
from datetime import datetime, timedelta, timezone, date
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi.concurrency import run_in_threadpool

from app.modules.notifications.services.notification_service import NotificationService


STREAK_REMINDER_MESSAGES = [
    ("Don't break your streak! 🔥",
     "You're on a {streak}-day streak. Practice just 5 minutes to keep it alive!"),
    ("Tati is waiting for you! 🍎",
     "Your {streak}-day streak is at risk. Come chat with Tati before midnight!"),
    ("⚠️ Streak in danger!",
     "{streak} days of hard work — don't let it vanish today. One quick chat is all it takes."),
    ("Your streak misses you 🔥",
     "You haven't practiced today yet. Keep your {streak}-day streak going!"),
    ("Almost forgot? 😅",
     "Quick reminder: your {streak}-day streak ends at midnight. Let's practice!"),
    ("Is that it? Giving up so soon? 😏",
     "Prove me wrong! Chat with Tati now and save your {streak}-day streak."),
    ("Your English is crying in the corner... 😭",
     "Just 5 minutes! Don't let your {streak}-day streak fade away. Tati is waiting!"),
    ("Tati is getting lonely... 😢",
     "Are you ignoring me? Let's have a quick chat now to keep your {streak}-day streak alive!"),
    ("Your streak is about to go poof! 💨",
     "Only you can save your {streak} days of progress. Log in and chat now!"),
    ("Oops, did you lose your passion? 💔",
     "Tati remembers when you practiced every day. Save your {streak}-day streak before it's too late!"),
    ("Tatiana's avatar is looking at you 👀",
     "She's not mad, just disappointed. Keep your {streak}-day streak alive right now!"),
    ("Tati is watching your progress... 🧐",
     "Your {streak}-day streak is about to expire. Open the chat and say hello!"),
    ("Knock knock! Tati is here 🚪",
     "I won't stop reminding you until you practice! Let's keep that {streak}-day streak shining!"),
]

STREAK_BROKEN_MESSAGES = [
    ("Your streak was broken 💔",
     "You had a {streak}-day streak. Don't give up — start a new one today!"),
    ("Oops! Streak lost 😢",
     "Your {streak}-day streak ended. But every champion has a comeback. Start now!"),
    ("Streak gone... but not you! 💪",
     "You lost your {streak}-day streak. Tati believes you can build an even bigger one!"),
    ("A fresh start awaits 🌅",
     "Your {streak}-day streak ended. Today is day 1 of your next record!"),
]

STREAK_MILESTONE_MESSAGES = {
    1: ("First day done! 🌱", "You started your streak! Come back tomorrow to keep it going."),
    3: ("3-day streak! 🔥", "Three days in a row — you're building a habit. Keep it up!"),
    7: ("One week streak! 🏆", "7 days of consistent practice! You're officially on a roll."),
    14: ("2-week warrior! ⚡", "14 days straight! Your English is getting stronger every day."),
    30: ("30-day legend! 🥇", "One full month of practice! Tati is seriously impressed."),
    60: ("60 days! You're unstoppable 🚀", "Two months of dedication. You're in the top tier of learners!"),
    100: ("100-DAY STREAK! 🎉", "ONE HUNDRED DAYS. This is extraordinary. You should be very proud!"),
    365: ("365 days! One full year! 🌟", "A FULL YEAR of daily practice. You are an absolute legend."),
}

INACTIVITY_MESSAGES = [
    (2, "Tati misses you! 🍎",
     "It's been 2 days since you practiced. Come back for a quick chat!"),
    (3, "3 days without English 😮",
     "Your English skills need exercise too! Come practice with Tati."),
    (5, "5 days away... 😟",
     "Consistent practice is the secret to fluency. Tati is here for you!"),
    (7, "A whole week without practice 😢",
     "7 days is a long time. But it's never too late to restart. Let's go!"),
    (14, "Two weeks gone 😰",
     "Don't let your progress fade. Every day you practice counts. Come back!"),
    (30, "A month away... 💔",
     "Tati hasn't forgotten you. Your English journey is still waiting. Restart today!"),
]


# Usuários/roles admin que não devem receber notificações automáticas
ADMIN_ROLES = {'programador', 'professor', 'professora', 'Professor', 'Professora'}
ADMIN_USERNAMES = {'programador', 'professor'}


class NotificationScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.ns = NotificationService()
        # REMOVIDO: self.db = get_db() — não conectar ao banco no
        # __init__

    @property
    def _db(self):
        """Conexão lazy — só acessa o banco quando necessário."""
        from app.core.database import get_client
        return get_client()

    def _is_admin(self, row: dict) -> bool:
        """Retorna True se o usuário é admin (não deve receber notifs automáticas)."""
        username = str(row.get('username') or '').strip()
        role = str(row.get('role') or '').strip()
        return username in ADMIN_USERNAMES or role in ADMIN_ROLES

    def start(self):
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron',
            hour=9,
            minute=0,
            id='streak_morning')
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron',
            hour=18,
            minute=0,
            id='streak_afternoon')
        self.scheduler.add_job(
            self._job_streak_reminders,
            'cron',
            hour=21,
            minute=30,
            id='streak_night')
        self.scheduler.add_job(
            self._job_broken_streaks,
            'cron',
            hour=10,
            minute=0,
            id='broken_streaks')
        self.scheduler.add_job(
            self.check_user_inactivity,
            'interval',
            hours=12,
            id='inactivity_check')
        self.scheduler.add_job(
            self.send_weekly_progress_reports,
            'cron', day_of_week='sat', hour=15, minute=0,
            start_date='2026-05-09 15:00:00',
            id='weekly_reports',
        )
        self.scheduler.start()
        logging.info('[Scheduler] Todos os jobs iniciados.')

    async def _job_streak_reminders(self):
        logging.info('[Scheduler] Verificando streaks para lembrete...')

        def _fetch():
            return self._db.table('users').select(
                'username, name, role, streak_data').execute().data or []

        users = await run_in_threadpool(_fetch)
        now = datetime.now(timezone.utc)
        today = now.date()
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue
            # Admins não recebem notificações automáticas de streak
            if self._is_admin(row):
                continue
            streak_data = row.get('streak_data') or {}
            if not isinstance(streak_data, dict):
                continue
            last_study_str = str(streak_data.get(
                'last_study_date') or '').strip()
            current_streak = int(streak_data.get('current_streak') or 0)
            if not last_study_str or current_streak <= 0:
                continue
            try:
                last_date = date.fromisoformat(last_study_str)
            except Exception:
                continue
            days_since = (today - last_date).days
            if days_since != 1:
                continue
            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(
                    u, 'streak_reminder', now)
            )
            if already_sent >= 3:
                continue
            title_tpl, body_tpl = random.choice(
                STREAK_REMINDER_MESSAGES)
            body = body_tpl.format(streak=current_streak)
            await self._dispatch(username, title_tpl, body, category='streak_reminder', url='/chat')
            count += 1

        logging.info(f'[Scheduler] Streak reminders enviados: {count}')

    async def _job_broken_streaks(self):
        logging.info('[Scheduler] Verificando streaks quebrados...')

        def _fetch():
            return self._db.table('users').select(
                'username, name, role, streak_data').execute().data or []

        users = await run_in_threadpool(_fetch)
        now = datetime.now(timezone.utc)
        today = now.date()
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue
            # Admins não recebem notificações automáticas de streak
            if self._is_admin(row):
                continue
            streak_data = row.get('streak_data') or {}
            if not isinstance(streak_data, dict):
                continue
            last_study_str = str(streak_data.get(
                'last_study_date') or '').strip()
            current_streak = int(streak_data.get('current_streak') or 0)
            if not last_study_str or current_streak <= 0:
                continue
            try:
                last_date = date.fromisoformat(last_study_str)
            except Exception:
                continue
            days_since = (today - last_date).days
            if days_since != 2:
                continue

            from app.modules.users.services.streaks import apply_streak_freeze_if_needed
            freeze_applied = await apply_streak_freeze_if_needed(streak_data, username)
            if freeze_applied:
                title = "Your streak was frozen and saved today! 🧊"
                body = f"Your {current_streak}-day streak is safe. Keep learning tomorrow!"
                await self._dispatch(username, title, body, category='streak_frozen', url='/chat')
                continue

            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(
                    u, 'streak_broken', now)
            )
            if already_sent >= 1:
                continue
            title_tpl, body_tpl = random.choice(STREAK_BROKEN_MESSAGES)
            body = body_tpl.format(streak=current_streak)
            await self._dispatch(username, title_tpl, body, category='streak_broken', url='/chat')
            await run_in_threadpool(lambda u=username: self._reset_streak(u))
            count += 1

        logging.info(f'[Scheduler] Broken streaks processados: {count}')

    def _reset_streak(self, username: str):
        try:
            res = self._db.table('users').select('streak_data').eq(
                'username', username).limit(1).execute()
            if not res.data:
                return
            streak_data = res.data[0].get('streak_data') or {}
            streak_data['current_streak'] = 0
            self._db.table('users').update({'streak_data': streak_data}).eq(
                'username', username).execute()
        except Exception as e:
            logging.info(
                f'[Scheduler] Erro ao resetar streak de {username}: {e}')

    def _count_notifications_today(
            self,
            username: str,
            category: str,
            now: datetime) -> int:
        start_of_day = now.replace(
            hour=0, minute=0, second=0, microsecond=0)
        try:
            res = (
                self._db.table('notifications')
                .select('id')
                .eq('username', username)
                .eq('category', category)
                .gte('created_at', start_of_day.isoformat())
                .execute()
            )
            return len(res.data or [])
        except Exception:
            return 0

    async def check_user_inactivity(self):
        logging.info('[Scheduler] Verificando inatividade...')

        def _fetch_users_and_activity():
            try:
                users = self._db.table('users').select(
                    'username, name, role, weekly_plan').execute().data or []
                
                # Busca as últimas mensagens para mapear última atividade
                msg_rows = (
                    self._db.table('messages')
                    .select('username, created_at')
                    .eq('role', 'user')
                    .order('created_at', desc=True)
                    .limit(2000)
                    .execute()
                    .data
                    or []
                )
                
                last_activity = {}
                for r in msg_rows:
                    uname = r.get('username')
                    if uname and uname not in last_activity:
                        last_activity[uname] = r.get('created_at')
                
                return users, last_activity
            except Exception as e:
                logging.error(f"[Scheduler] Erro ao buscar atividade/usuários: {e}")
                return [], {}

        users, last_activity = await run_in_threadpool(_fetch_users_and_activity)
        now = datetime.now(timezone.utc)
        count = 0

        for row in users:
            username = str(row.get('username') or '').strip()
            if not username:
                continue
            # Admins não recebem notificações automáticas de inatividade
            if self._is_admin(row):
                continue
            
            # Se o usuário nunca enviou mensagens, não mandamos lembretes de inatividade
            last_active_str = last_activity.get(username)
            if not last_active_str:
                continue
                
            try:
                last_active = datetime.fromisoformat(
                    last_active_str.replace('Z', '+00:00'))
                if last_active.tzinfo is None:
                    last_active = last_active.replace(
                        tzinfo=timezone.utc)
            except Exception:
                continue
            days_inactive = (now - last_active).days
            selected_msg = None
            for threshold, title, body in sorted(
                    INACTIVITY_MESSAGES, key=lambda x: x[0], reverse=True):
                if days_inactive >= threshold:
                    selected_msg = (title, body)
                    break
            if not selected_msg:
                continue
            already_sent = await run_in_threadpool(
                lambda u=username: self._count_notifications_today(
                    u, 'retention', now)
            )
            if already_sent >= 1:
                continue
            title, body = selected_msg
            name = str(row.get('name') or username)
            body = body.replace('{name}', name)
            await self._dispatch(username, title, body, category='retention', url='/chat')
            count += 1

        logging.info(
            f'[Scheduler] Inatividade: {count} notificações enviadas')

    async def send_weekly_progress_reports(self):
        logging.info('[Scheduler] Enviando relatórios semanais...')
        from app.modules.users.services.progress_report import progress_report_service
        from app.shared.services.email import EmailSender

        email_sender = EmailSender()

        def _fetch_active_usernames():
            # Obtém usuários que enviaram mensagens nos últimos 7 dias
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            try:
                msg_data = self._db.table('messages').select('username').gte(
                    'created_at', seven_days_ago).execute().data or []
                return list(set(m['username'] for m in msg_data if m.get('username')))
            except Exception as e:
                logging.error(f"[Scheduler] Erro ao buscar mensagens recentes: {e}")
                return []

        active_usernames = _fetch_active_usernames()
        if not active_usernames:
            logging.info("[Scheduler] Nenhum aluno ativo nos últimos 7 dias.")
            return

        def _fetch_users():
            try:
                return self._db.table('users').select('username, email, name, role, profile').in_(
                    'username', active_usernames).execute().data or []
            except Exception as e:
                logging.error(f"[Scheduler] Erro ao carregar alunos ativos: {e}")
                return []

        students = await run_in_threadpool(_fetch_users)

        for student in students:
            username = student['username']
            # Admins não recebem relatórios semanais automáticos
            if self._is_admin(student):
                continue

            # Verifica se já recebeu relatório semanal nos últimos 6 dias para evitar spam
            six_days_ago = (datetime.now(timezone.utc) - timedelta(days=6)).isoformat()
            try:
                already_sent_res = self._db.table('notifications') \
                    .select('id') \
                    .eq('username', username) \
                    .eq('category', 'weekly_report') \
                    .gte('created_at', six_days_ago) \
                    .execute()
                if already_sent_res.data:
                    logging.info(f"[Scheduler] Relatório semanal já foi enviado para {username} nos últimos 6 dias. Pulando.")
                    continue
            except Exception as e:
                logging.error(f"[Scheduler] Erro ao checar envio anterior de relatório para {username}: {e}")

            email = student.get('email')
            profile = student.get('profile') or {}
            responsible_email = profile.get('responsible_email')

            if not email and not responsible_email:
                continue
            try:
                pdf_path = await progress_report_service.generate_student_report(username, lang='en-US')
                
                success = False
                if email:
                    success = email_sender.send_report_email(
                        email, student.get('name', username), pdf_path, lang='en-US')
                    logging.info(
                        f"[Scheduler] Relatório {'enviado' if success else 'FALHOU'} para aluno {username}")
                
                success_resp = False
                if responsible_email:
                    success_resp = email_sender.send_responsible_report_email(
                        responsible_email, student.get('name', username), pdf_path)
                    logging.info(
                        f"[Scheduler] Relatório para responsável {'enviado' if success_resp else 'FALHOU'} para {responsible_email} (aluno: {username})")

                # Sempre marca como processado/enviado para evitar novas tentativas na semana
                try:
                    self._db.table('notifications').insert({
                        'username': username,
                        'title': 'Weekly Progress Report',
                        'body': f'Your weekly progress report was processed. Status: Email: {success}, Responsible: {success_resp}',
                        'category': 'weekly_report',
                        'is_read': True
                    }).execute()
                except Exception as e:
                    logging.error(f"[Scheduler] Erro ao registrar notificação de weekly_report para {username}: {e}")
            except Exception as e:
                logging.info(
                    f'[Scheduler] Erro no relatório de {username}: {e}')

    async def _dispatch(
            self,
            username: str,
            title: str,
            body: str,
            category: str,
            url: str = '/'):
        try:
            await self.ns.send_notification(username, title, body, category=category)
            from app.modules.notifications.services.notification_dispatcher import dispatch_universal_notification
            await dispatch_universal_notification(username, title, body, url=url)
        except Exception as e:
            logging.info(
                f'[Scheduler] Erro ao despachar para {username}: {e}')


notification_scheduler = NotificationScheduler()
