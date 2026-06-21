from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

from app.core.config import settings

resend = None
if getattr(settings, "resend_api_key", ""):
    try:
        import resend
        resend.api_key = settings.resend_api_key
    except Exception as e:
        logging.info(f"[EmailSender] Failed to import real resend: {e}")
        resend = None


class EmailSender:
    def __init__(self) -> None:
        self.smtp_host = getattr(
            settings, "smtp_host", "smtp.gmail.com")
        self.smtp_port = int(getattr(settings, "smtp_port", 465))
        self.smtp_user = getattr(settings, "smtp_user", "")
        self.smtp_password = getattr(settings, "smtp_password", "")
        self._FROM = f"Teacher Tati <{self.smtp_user}>"
        self._ready = bool(
            (self.smtp_host and self.smtp_user and self.smtp_password) or getattr(
                settings, "resend_api_key", ""))

    def _send(self, to_email: str, subject: str, html: str,
              attachments: list | None = None) -> bool:
        try:
            from app.core.database import get_client
            db = get_client()
            res = db.table('users').select('username, profile').eq('email', to_email).limit(1).execute()
            if res.data:
                profile = res.data[0].get('profile') or {}
                prefs = profile.get('notification_preferences')
                if prefs:
                    s_lower = subject.lower()
                    if 'streak' in s_lower or 'ofensiva' in s_lower or 'broken' in s_lower or 'alive' in s_lower:
                        category = 'streaks'
                    elif 'desafio' in s_lower or 'challenge' in s_lower or 'activity' in s_lower or 'submission' in s_lower:
                        category = 'challenges'
                    elif 'cefr' in s_lower or 'nível' in s_lower or 'level' in s_lower or 'report' in s_lower:
                        category = 'cefr'
                    else:
                        category = 'challenges'

                    if not prefs.get(category, {}).get('email', True):
                        logging.info(f"[EmailSender] Suppressed email to {to_email} due to preferences (category: {category})")
                        return False
        except Exception as e:
            logging.info(f"[EmailSender] Failed to check email preferences: {e}")

        if not self._ready:
            logging.info(
                f"[EmailSender] SMTP/resend not configured (Simulating Success). Email to {to_email}: {subject}")
            return True

        try:
            if "resend" in globals() and hasattr(
                    resend, "Emails") and hasattr(
                    resend.Emails, "send"):
                payload = {
                    "to": to_email,
                    "subject": subject,
                    "html": html,
                    "from": "Teacher Tati <tatiai@resend.dev>"}
                if attachments:
                    prepared = []
                    for p in attachments:
                        try:
                            if os.path.exists(p):
                                prepared.append(
                                    {"filename": os.path.basename(p), "path": p})
                        except Exception:
                            continue
                    if prepared:
                        payload["attachments"] = prepared
                resp = resend.Emails.send(payload)
                return bool(resp)
        except Exception as exc:
            logging.info(f"[EmailSender] resend service failed: {exc}")

        msg = MIMEMultipart()
        msg["From"] = self._FROM
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))

        if attachments:
            for file_path in attachments:
                if os.path.exists(file_path):
                    with open(file_path, "rb") as f:
                        part = MIMEApplication(
                            f.read(), Name=os.path.basename(file_path))
                        part["Content-Disposition"] = f'attachment; filename="{
                            os.path.basename(file_path)}"'
                        msg.attach(part)

        try:
            if self.smtp_port == 465:
                server_class = smtplib.SMTP_SSL
                use_starttls = False
            else:
                server_class = smtplib.SMTP
                use_starttls = True

            with server_class(self.smtp_host, self.smtp_port, timeout=15) as server:
                server.set_debuglevel(0)
                server.ehlo()
                if use_starttls and server.has_extn("STARTTLS"):
                    server.starttls()
                    server.ehlo()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            return True
        except Exception as exc:
            logging.info(f"[EmailSender] Error sending email: {exc}")
            return False

    def send_report_email(
            self,
            to_email: str,
            name: str,
            pdf_path: str,
            lang: str = "en-US") -> bool:
        t = {
            "subject": "📊 Your Weekly Progress Report - Teacher Tati AI",
            "title": "Your Evolution Report is Here!",
            "body": f"Hi <strong>{name}</strong>,<br/><br/>Congratulations on another week of learning! Attached is your detailed progress report generated by Tati AI.",
            "footer": "Teacher Tati Team",
        }
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
<h2 style="color:#6366f1;">{t['title']}</h2>
<p>{t['body']}</p>
<p>Review your highlights, completed goals, and learning gaps to keep evolving.</p>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">{t['footer']}</p>
</div>
"""
        return self._send(
            to_email,
            t["subject"],
            html,
            attachments=[pdf_path])

    def send_email(
            self,
            fromemail: str,
            to_email: str,
            subject: str,
            html: str) -> bool:
        return self._send(to_email, subject, html)

    def _send_smtp_email(
            self,
            fromemail: str,
            to_email: str,
            subject: str,
            html: str) -> bool:
        return self._send(to_email, subject, html)

    def send_reset_email(
            self,
            to_email: str,
            name: str,
            temp_password: str) -> bool:
        subject = "Teacher Tati — Your temporary password"
        html = self._build_email_html(name, temp_password)
        return self._send(to_email, subject, html)

    def _build_email_html(self, name: str, temp_password: str) -> str:
        return f"""
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;">
<h2 style="color:#6366f1;">Your Temporary Password</h2>
<p>Hi <strong>{name}</strong>,</p>
<p>You requested a new password for your Teacher Tati account.</p>
<div style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
<p style="margin:0;font-size:14px;color:#666;">Use the password below to log in:</p>
<p style="margin:10px 0 0;font-size:24px;font-weight:bold;color:#1f2937;">{temp_password}</p>
</div>
<p>We recommend changing your password in your profile settings after logging in.</p>
<p style="color:#ef4444;font-size:13px;">If you didn't request this change, please ignore this email.</p>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""

    def send_submission_notification(
            self,
            student_name: str,
            activity_title: str) -> bool:
        subject = f"New submission: {activity_title}"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;">
<h2 style="color:#6366f1;">New Activity Submission</h2>
<p>The student <strong>{student_name}</strong> submitted: <strong>{activity_title}</strong>.</p>
<p>Access the dashboard to review it.</p>
</div>
"""
        admin_email = self.smtp_user or "admin@seudominio.com"
        return self._send(admin_email, subject, html)

    def send_feedback_notification(
            self,
            student_name: str,
            student_email: str,
            category: str,
            message: str) -> bool:
        category_labels = {
            "bug": "🐛 Bug",
            "feature": "💡 Feature Request",
            "feedback": "💬 General Feedback",
            "other": "📝 Other",
        }
        category_label = category_labels.get(category, "Other")
        subject = f"[{category_label}] Feedback from {student_name}"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;">
<h2 style="color:#6366f1;">New Feedback Received</h2>
<p><strong>User:</strong> {student_name}</p>
<p><strong>Email:</strong> {student_email}</p>
<p><strong>Category:</strong> {category_label}</p>
<p><strong>Message:</strong><br>{message.replace(chr(10), '<br>')}</p>
</div>
"""
        admin_email = self.smtp_user or "admin@seudominio.com"
        return self._send(admin_email, subject, html)

    def send_correction_notification(
            self,
            student_name: str,
            student_email: str,
            activity_title: str,
            score: int,
            feedback: str) -> bool:
        subject = f"Activity Graded: {activity_title}"
        if score >= 90:
            score_message = "Excellent work! 🎉"
        elif score >= 70:
            score_message = "Great job! 👍"
        elif score >= 50:
            score_message = "Keep practicing! 📚"
        else:
            score_message = "Let's study a bit more! 💪"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;">
<h2 style="color:#6366f1;">Activity Graded</h2>
<p>Hello, <strong>{student_name}</strong>!</p>
<p>Your activity <strong>"{activity_title}"</strong> has been reviewed.</p>
<div style="background:#f3f4f6;border-radius:8px;padding:1rem;margin:1rem 0;">
<p style="margin:0;color:#666;">Your score:</p>
<p style="margin:0;font-size:2rem;font-weight:700;color:#6366f1;">{score}/100</p>
<p style="margin:0.5rem 0 0;color:#4ade80;">{score_message}</p>
</div>
<div style="background:hsla(258,80%,58%,0.05);border:1px solid #6366f1;border-radius:8px;padding:1rem;">
<p style="margin:0 0 0.5rem;font-weight:600;color:#6366f1;">Teacher's Feedback:</p>
<p style="margin:0;line-height:1.6;">{feedback.replace(chr(10), '<br>')}</p>
</div>
<p style="margin-top:1.5rem;color:#666;font-size:0.9rem;">Keep up the good work and stay focused!</p>
</div>
"""
        return self._send(student_email, subject, html)

    def send_streak_email(
            self,
            to_email: str,
            name: str,
            streak_days: int,
            mode: str = "reminder") -> bool:
        if mode == "broken":
            subject = "⚠️ Your streak was broken — Teacher Tati"
            body_html = f"""
<p>Hi <strong>{name}</strong>,</p>
<p>Your streak of <strong>{streak_days} days</strong> was broken. 😔</p>
<p>Don't give up! Come back today and start a new streak.</p>
<a href="https://tati-ai.vercel.app/chat" style="display:inline-block;background:#6366f1;color:#fff;padding:0.6rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem;">Practice Now 🚀</a>
"""
        else:
            subject = "🔥 Keep your streak alive — Teacher Tati"
            body_html = f"""
<p>Hi <strong>{name}</strong>,</p>
<p>You are on a <strong>{streak_days}-day streak</strong>! 🔥</p>
<p>Don't lose it — practice a little today to keep the momentum going.</p>
<a href="https://tati-ai.vercel.app/chat" style="display:inline-block;background:#6366f1;color:#fff;padding:0.6rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem;">Keep Practicing 💪</a>
"""
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;">
<h2 style="color:#6366f1;">{'Streak Broken!' if mode == 'broken' else 'Daily Reminder'}</h2>
{body_html}
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_trophy_email(
            self,
            to_email: str,
            name: str,
            trophy_name: str,
            trophy_icon: str = "🏆") -> bool:
        subject = f"🏆 New trophy unlocked: {trophy_name} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;text-align:center;">
<h2 style="color:#6366f1;">New Trophy Unlocked!</h2>
<div style="font-size:4rem;margin:1.5rem 0;">{trophy_icon}</div>
<h3 style="color:#1f2937;">{trophy_name}</h3>
<p>Congratulations, <strong>{name}</strong>! You earned a new trophy.</p>
<a href="https://tati-ai.vercel.app/activities" style="display:inline-block;background:#6366f1;color:#fff;padding:0.6rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem;">View My Trophies 🏆</a>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_new_activity_email(
            self,
            to_email: str,
            name: str,
            activity_title: str,
            activity_url: str = "https://tati-ai.vercel.app/activities") -> bool:
        subject = f"📚 New activity available: {activity_title} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;">
<h2 style="color:#6366f1;">New Activity Available! 📚</h2>
<p>Hi <strong>{name}</strong>,</p>
<p>Teacher Tati published a new activity for you: <strong>{activity_title}</strong>.</p>
<a href="{activity_url}" style="display:inline-block;background:#6366f1;color:#fff;padding:0.6rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem;">Start Activity →</a>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_welcome_hub_email(
            self,
            to_email: str,
            name: str,
            username: str,
            password: str) -> bool:
        subject = "Boas-vindas ao Tati AI Hub! Suas credenciais de acesso"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;background:#0a0a0c;padding:30px;border-radius:24px;color:#ffffff;border:1px solid #222">
    <h2 style="color:#7c3aed;margin-top:0">Seja bem-vindo(a) ao Hub, {name}! 🎉</h2>
    <p style="color:#a1a1aa;line-height:1.6">Sua conta foi criada automaticamente para que você possa acessar seus materiais. Use as credenciais abaixo para entrar:</p>

    <div style="background:#111114;border:1px solid #333;border-radius:16px;padding:25px;margin:25px 0;text-align:center">
        <p style="margin:0 0 10px 0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px">Seu Usuário</p>
        <p style="margin:0 0 20px 0;font-size:18px;font-weight:bold;color:#ffffff">{username}</p>

        <p style="margin:0 0 10px 0;color:#71717a;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sua Senha Temporária</p>
        <p style="margin:0 0 0 0;font-size:24px;font-weight:bold;color:#7c3aed">{password}</p>
    </div>

    <p style="color:#f87171;font-size:14px;font-weight:bold">⚠️ IMPORTANTE: Por segurança, recomendamos que você altere sua senha imediatamente após o primeiro login nas configurações do seu perfil.</p>

    <div style="text-align:center;margin-top:30px">
        <a href="http://localhost:3001/login" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:14px 28px;border-radius:14px;text-decoration:none;font-weight:bold;box-shadow:0 10px 20px rgba(124,58,237,0.3)">Acessar o Hub agora →</a>
    </div>

    <hr style="border:0;border-top:1px solid #222;margin:30px 0">
    <p style="font-size:12px;color:#52525b;text-align:center">Equipe Teacher Tati AI</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_purchase_confirmation(
            self,
            to_email: str,
            name: str,
            item_title: str,
            download_url: str) -> bool:
        subject = f"✅ Compra confirmada: {item_title} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;background:#f8fafc;padding:20px;border-radius:16px;color:#334155;">
<h2 style="color:#6366f1;margin-top:0;">Obrigado pela sua compra! 🎉</h2>
<p>Olá <strong>{name}</strong>,</p>
<p>Seu pagamento para <strong>{item_title}</strong> foi confirmado com sucesso.</p>
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
    <h3 style="margin:0 0 10px 0;color:#1e293b;">{item_title}</h3>
    <p style="color:#64748b;font-size:14px;margin-bottom:20px;">O material já está disponível no seu Hub de Conteúdos.</p>
    <a href="{download_url}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;box-shadow:0 4px 6px -1px rgba(99, 102, 241, 0.2);">Acessar meu Hub de Conteúdo →</a>
</div>
<p style="font-size:13px;color:#64748b;">Se tiver qualquer dúvida, basta responder a este e-mail.</p>
<hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">Equipe Teacher Tati</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_payment_refused(
            self,
            to_email: str,
            name: str,
            payment_method: str,
            reason: str = "Não foi possível processar seu pagamento.") -> bool:
        subject = "❌ Pagamento não aprovado — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;background:#fef2f2;padding:20px;border-radius:16px;color:#334155;">
<h2 style="color:#dc2626;margin-top:0;">Pagamento Não Aprovado</h2>
<p>Olá <strong>{name}</strong>,</p>
<p>Infelizmente, seu pagamento via <strong>{payment_method}</strong> não foi aprovado.</p>
<div style="background:#fff;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:20px 0;">
    <p style="color:#dc2626;font-size:14px;margin:0 0 10px 0;font-weight:600;">Motivo:</p>
    <p style="color:#64748b;font-size:14px;margin:0;">{reason}</p>
</div>
<p style="font-size:14px;color:#64748b;margin-bottom:20px;">Não se preocupe! Você pode tentar novamente com outra forma de pagamento ou regularizar sua situação.</p>
<a href="https://tati-ai.vercel.app/payment" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;box-shadow:0 4px 6px -1px rgba(99, 102, 241, 0.2);">Tentar Novamente →</a>
<hr style="border:0;border-top:1px solid #fecaca;margin:20px 0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">Equipe Teacher Tati</p>
</div>
"""
        return self._send(to_email, subject, html)

    def send_offensive_notification(
            self,
            user_email: str,
            user_name: str,
            offensive_message: str) -> bool:
        subject = "Notificação de Ofensiva"
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;">
            <h2 style="color:#6366f1;">Notificação de Ofensiva</h2>
            <p>Olá, {user_name}!</p>
            <p>Nós detectamos uma ofensiva em sua conta.</p>
            <p>Mensagem ofensiva: {offensive_message}</p>
            <p>Por favor, revise sua conduta e evite comportamentos ofensivos no futuro.</p>
        </div>
        """
        return self._send(user_email, subject, html)

    def send_dispatched_file_email(
            self,
            to_email: str,
            name: str,
            file_name: str,
            file_path: str) -> bool:
        subject = f"📚 New Study Material: {file_name} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;line-height:1.6;">
<h2 style="color:#7828C8;">New Study Material from Teacher Tati! 📚</h2>
<p>Hi <strong>{name}</strong>,</p>
<p>Teacher Tati sent you a new study material: <strong>{file_name}</strong>.</p>
<p>You can find the file attached directly to this email.</p>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(
            to_email,
            subject,
            html,
            attachments=[file_path])

    def send_dispatched_files_email(
            self,
            to_email: str,
            name: str,
            file_names: list[str],
            file_paths: list[str]) -> bool:
        files_str = ", ".join(file_names)
        subject = f"📚 New Study Materials: {files_str} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;line-height:1.6;">
<h2 style="color:#7828C8;">New Study Materials from Teacher Tati! 📚</h2>
<p>Hi <strong>{name}</strong>,</p>
<p>Teacher Tati sent you new study material(s): <strong>{files_str}</strong>.</p>
<p>You can find the file(s) attached directly to this email.</p>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(
            to_email,
            subject,
            html,
            attachments=file_paths)

    def send_dispatched_quiz_email(
            self,
            to_email: str,
            name: str,
            quiz_title: str,
            quiz_url: str = "https://tati-ai.vercel.app/activities") -> bool:
        subject = f"📝 New Quiz available: {quiz_title} — Teacher Tati"
        html = f"""
<div style="font-family:Arial,sans-serif;max-width:600px;color:#333;line-height:1.6;">
<h2 style="color:#7828C8;">New Quiz Available! 📝</h2>
<p>Hi <strong>{name}</strong>,</p>
<p>Teacher Tati assigned a new quiz for you: <strong>{quiz_title}</strong>.</p>
<p>Click the link below to access your activities list and start the quiz:</p>
<a href="{quiz_url}" style="display:inline-block;background:#7828C8;color:#fff;padding:0.6rem 1.4rem;border-radius:8px;text-decoration:none;margin-top:1rem;font-weight:bold;">Start Quiz →</a>
<hr style="border:0;border-top:1px solid #eee;margin:20px 0;">
<p style="font-size:12px;color:#999;">Teacher Tati Team</p>
</div>
"""
        return self._send(to_email, subject, html)


class _ResendShim:
    class Emails:
        @staticmethod
        def send(payload: dict) -> dict:
            return {"id": "stub"}


if resend is None:
    resend = _ResendShim
