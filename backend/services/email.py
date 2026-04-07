import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from core.config import settings


def send_reset_email(to_email: str, name: str, temp_password: str) -> bool:
    """Envia e-mail com senha temporária. Retorna True se enviado com sucesso."""
    if not settings.smtp_user or not settings.smtp_password:
        print(f"[ResetPW] SMTP não configurado. Senha temporária para {to_email}: {temp_password}")
        return False

    html = _build_email_html(name, temp_password)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Teacher Tati — Sua senha temporária"
    msg["From"] = f"Teacher Tati <{settings.smtp_from_adress}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from_adress, to_email, msg.as_string())
        return True
    except Exception as exc:
        print(f"[ResetPW] Erro ao enviar e-mail: {exc}")
        return False


def _build_email_html(name: str, temp_password: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:2rem;
                background:#0f0a1e;color:#f1f0f5;border-radius:16px;">
      <h2 style="color:#7c3aed;margin-bottom:0.5rem;">🧑‍🏫 Teacher Tati</h2>
      <p style="color:#9ca3af;margin-bottom:1.5rem;">Recuperação de senha</p>
      <p>Olá, <strong>{name}</strong>!</p>
      <p>Recebemos um pedido de recuperação de senha para a sua conta.</p>
      <div style="background:#1e1535;border:1px solid rgba(124,58,237,0.3);
                  border-radius:12px;padding:1.25rem;margin:1.5rem 0;text-align:center;">
        <p style="color:#9ca3af;font-size:0.85rem;margin-bottom:0.5rem;">Sua senha temporária:</p>
        <code style="font-size:1.6rem;font-weight:700;color:#7c3aed;
                     letter-spacing:0.15em;">{temp_password}</code>
      </div>
      <p style="color:#f87171;font-size:0.85rem;">
        ⚠️ <strong>Importante:</strong> Esta senha é temporária.
        Após entrar, vá em <strong>Perfil → Segurança</strong> e crie uma nova senha.
      </p>
      <p style="color:#9ca3af;font-size:0.8rem;margin-top:1.5rem;">
        Se você não solicitou isso, ignore este e-mail.
      </p>
    </div>
    """