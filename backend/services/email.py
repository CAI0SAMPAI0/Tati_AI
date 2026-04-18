import resend
from core.config import settings


def send_reset_email(to_email: str, name: str, temp_password: str) -> bool:
    """Envia e-mail com senha temporária via Resend. Retorna True se enviado com sucesso."""
    if not settings.resend_api_key:
        print(f"[ResetPW] Resend não configurado. Senha temporária para {to_email}: {temp_password}")
        return False

    resend.api_key = settings.resend_api_key

    try:
        resend.Emails.send({
            "from": "Teacher Tati <onboarding@resend.dev>",
            "to": to_email,
            "subject": "Teacher Tati — Sua senha temporária",
            "html": _build_email_html(name, temp_password),
        })
        return True
    except Exception as exc:
        print(f"[ResetPW] Erro ao enviar e-mail: {exc}")
        return False


def send_submission_notification(student_name: str, activity_title: str) -> bool:
    """Envia notificação de nova submissão de atividade para cmsampaio71@gmail.com."""
    if not settings.resend_api_key: return False
    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send({
            "from": "Tati IA Notificações <onboarding@resend.dev>",
            "to": "cmsampaio71@gmail.com",
            "subject": f"Nova Atividade: {activity_title}",
            "html": f"<p>O aluno <strong>{student_name}</strong> enviou uma nova atividade: <strong>{activity_title}</strong>.</p><p>Acesse o dashboard para corrigir.</p>"
        })
        return True
    except Exception as exc:
        print(f"[SubmissionEmail] Erro: {exc}")
        return False


def send_feedback_notification(student_name: str, student_email: str, category: str, message: str) -> bool:
    """Envia notificação de feedback/bug report do usuário para cmsampaio71@gmail.com."""
    if not settings.resend_api_key:
        print(f"[FeedbackEmail] Resend não configurado. Feedback de {student_email}: {message}")
        return False

    resend.api_key = settings.resend_api_key

    category_labels = {
        "bug": "🐛 Bug",
        "feature": "💡 Sugestão de Recurso",
        "feedback": "💬 Feedback Geral",
        "other": "📝 Outros"
    }
    category_label = category_labels.get(category, "📝 Outros")

    try:
        resend.Emails.send({
            "from": "Tati IA Feedback <onboarding@resend.dev>",
            "to": "cmsampaio71@gmail.com",
            "subject": f"[{category_label}] Feedback de {student_name}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #6366f1;">Novo Feedback Recebido</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Usuário:</td>
                        <td style="padding: 8px 0;">{student_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0;">{student_email}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Categoria:</td>
                        <td style="padding: 8px 0;">{category_label}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Mensagem:</td>
                        <td style="padding: 8px 0;">{message.replace(chr(10), '<br>')}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px; color: #666; font-size: 14px;">Este feedback foi enviado através da plataforma Teacher Tati.</p>
            </div>
            """
        })
        return True
    except Exception as exc:
        print(f"[FeedbackEmail] Erro: {exc}")
        return False


def send_correction_notification(student_name: str, student_email: str, activity_title: str, score: int, feedback: str) -> bool:
    """Envia notificação de correção de atividade para o aluno."""
    if not settings.resend_api_key:
        print(f"[CorrectionEmail] Resend não configurado. Correção para {student_email}: {activity_title}")
        return False

    resend.api_key = settings.resend_api_key

    # Determina mensagem baseada na nota
    score_message = ""
    if score >= 90:
        score_message = "Excelente trabalho! 🎉"
    elif score >= 70:
        score_message = "Bom trabalho! 👍"
    elif score >= 50:
        score_message = "Continue praticando! 📚"
    else:
        score_message = "Vamos estudar mais um pouco! 💪"

    try:
        resend.Emails.send({
            "from": "Teacher Tati <onboarding@resend.dev>",
            "to": student_email,
            "subject": f"Atividade Corrigida: {activity_title}",
            "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #6366f1;">Atividade Corrigida</h2>
                <p>Olá, <strong>{student_name}</strong>!</p>
                <p>Sua atividade <strong>"{activity_title}"</strong> foi corrigida.</p>

                <div style="background: #f3f4f6; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                    <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #666;">Sua nota:</p>
                    <p style="margin: 0; font-size: 2rem; font-weight: 700; color: #6366f1;">{score}/100</p>
                    <p style="margin: 0.5rem 0 0 0; font-size: 0.85rem; color: #4ade80;">{score_message}</p>
                </div>

                <div style="background: hsla(258, 80%, 58%, 0.1); border: 1px solid hsla(258, 80%, 58%, 0.2); border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                    <p style="margin: 0 0 0.5rem 0; font-weight: 600; color: #6366f1;">Feedback do Professor:</p>
                    <p style="margin: 0; line-height: 1.6; color: #374151;">{feedback.replace(chr(10), '<br>')}</p>
                </div>

                <p style="margin-top: 1.5rem; color: #666; font-size: 0.9rem;">Continue estudando e praticando para evoluir ainda mais!</p>
            </div>
            """
        })
        return True
    except Exception as exc:
        print(f"[CorrectionEmail] Erro: {exc}")
        return False