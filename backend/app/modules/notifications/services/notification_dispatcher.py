import logging
import resend
from app.core.database import get_client
from app.modules.notifications.services.push_notifications import send_push_to_user
from app.shared.services.email import EmailSender


email_sender = EmailSender()


async def dispatch_universal_notification(
    username: str, title: str, body: str, url: str = '/'
):
    """
    Envia notificação para todos os canais disponíveis: Email + Push no Dispositivo.
    """
    db = get_client()

    # 1. BUSCAR EMAIL DO USUÁRIO
    user_email = None
    student_name = username
    try:
        res = (
            db.table('users')
            .select('email, name')
            .eq('username', username)
            .limit(1)
            .execute()
        )
        if res.data:
            user_email = res.data[0].get('email')
            student_name = res.data[0].get('name') or username
    except Exception as e:
        logging.info(f'[Dispatcher] Erro ao buscar email: {e}')

    # 2. ENVIAR PUSH (Dispositivo)
    push_res = send_push_to_user(username, title, body, url)
    logging.info(
        f'[Dispatcher] Push enviado para {username}: {push_res}')

    # 3. ENVIAR EMAIL
    if user_email:
        try:
            html = f"""
            <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                <h2 style="color: #6366f1;">{title}</h2>
                <p>Hello, <strong>{student_name}</strong>!</p>
                <p>{body}</p>
                <div style="margin-top: 20px;">
                    <a href="https://tati-ai.vercel.app{url}"
                       style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                       Check it out in the App
                    </a>
                </div>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">
                    Keep practicing every day to reach fluency! <br>
                    Teacher Tati Team
                </p>
            </div>
            """
            email_sender.send_email(
                fromemail="Teacher Tati <tatiai@resend.dev>",
                to_email=user_email,
                subject=title,
                html=html
            )
            logging.info(
                f'[Dispatcher] Email enviado para {user_email}')
        except Exception as e:
            logging.info(f'[Dispatcher] Erro no email: {e}')
    else:
        logging.info(
            '[Dispatcher] Email não enviado (Email null ou Resend sem API Key)')
