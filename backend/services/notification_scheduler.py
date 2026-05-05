"""
services/notification_scheduler.py
Agendador de tarefas para notificações automáticas e lembretes de inatividade.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from services.database import get_client
from services.notification_service import NotificationService
from fastapi.concurrency import run_in_threadpool

class NotificationScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.ns = NotificationService()
        self.db = get_client()

    def start(self):
        """Inicia o agendador de tarefas."""
        # Roda a cada 12 horas para verificar inatividade
        self.scheduler.add_job(self.check_user_inactivity, 'interval', hours=12)
        
        # Sprint 8: Envio de Relatórios Pedagógicos semanais
        # Todo sábado às 15h, iniciando em 09/05/2026
        self.scheduler.add_job(
            self.send_weekly_progress_reports, 
            'cron', 
            day_of_week='sat', 
            hour=15, 
            minute=0,
            start_date='2026-05-09 15:00:00'
        )
        
        self.scheduler.start()

    async def send_weekly_progress_reports(self):
        """Gera e envia relatórios PDF por e-mail para todos os alunos ativos."""
        print("[Scheduler] Iniciando envio de relatórios semanais...")
        from services.progress_report import progress_report_service
        from services.email import EmailSender
        
        email_sender = EmailSender()
        
        def _fetch_active_students():
            # Busca alunos que interagiram nos últimos 7 dias
            seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            res = self.db.table('users').select('username, email, name').gte('last_active', seven_days_ago).execute()
            return res.data or []

        students = await run_in_threadpool(_fetch_active_students)
        
        for student in students:
            username = student['username']
            email = student.get('email')
            if not email: continue
            
            # Forçamos Inglês agora
            lang = 'en-US'

            try:
                # 1. Gera PDF no idioma do aluno (Inglês)
                pdf_path = await progress_report_service.generate_student_report(username, lang=lang)
                
                # 2. Envia E-mail com anexo no idioma do aluno
                success = email_sender.send_report_email(email, student.get('name', username), pdf_path, lang=lang)
                
                if success:
                    print(f"[Scheduler] Relatório enviado para {username} ({email})")
                else:
                    print(f"[Scheduler] Falha ao enviar e-mail para {username}")
                
            except Exception as e:
                print(f"[Scheduler] Erro ao processar relatório para {username}: {e}")


    async def check_user_inactivity(self):
        """Identifica usuários inativos há mais de 48h e envia lembrete."""
        print("[Scheduler] Verificando inatividade de usuários...")
        
        def _fetch_inactive():
            threshold = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
            # Busca usuários cuja 'last_active' é anterior a 48h e que não receberam lembrete recente
            res = self.db.table('users').select('username, name, weekly_plan').lt('last_active', threshold).execute()
            return res.data or []

        inactive_users = await run_in_threadpool(_fetch_inactive)
        
        for user in inactive_users:
            username = user['username']
            name = user.get('name') or username
            
            # Personaliza a mensagem se houver plano semanal pendente
            plan = user.get('weekly_plan') or {}
            pending_topics = [t for t in plan.get('topics', []) if t.get('status') == 'pending']
            
            if pending_topics:
                title = f"Tati misses you, {name}! 🍎"
                body = f"You still have {len(pending_topics)} goals to complete this week. Let's practice a bit?"
            else:
                title = "Time to practice! 🗣️"
                body = "Consistent practice is the key to fluency. Tati is waiting for a quick chat!"

            # Evita spam: Checa se já enviamos um lembrete nas últimas 24h
            def _already_notified():
                last_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
                check = self.db.table('notifications')\
                    .select('id')\
                    .eq('username', username)\
                    .eq('category', 'retention')\
                    .gt('created_at', last_24h)\
                    .execute()
                return len(check.data) > 0

            if not await run_in_threadpool(_already_notified):
                await self.ns.send_notification(username, title, body, category='retention')
                print(f"[Scheduler] Lembrete enviado para {username}")

notification_scheduler = NotificationScheduler()
