import os
from fastapi import APIRouter, Depends, HTTPException, Header, Query, BackgroundTasks, Request
from app.core.celery_app import celery_app
from app.core.dependencies.auth import get_current_user
from app.core.task_manager import run_task_in_background, get_local_task_status, local_tasks_status, delegate_to_worker_if_needed

router = APIRouter(tags=["Tasks"])


@router.get("/smtp-probe")
async def smtp_probe(token: str = Query(None)):
    """
    Testa quais portas SMTP são acessíveis de dentro do HF Space.
    Use: GET /tasks/smtp-probe?token=cai0_based
    """
    import socket, time
    cron_token = os.getenv("CRON_TOKEN", "cai0_based")
    if token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid token.")

    HOSTS = [
        ("smtp.gmail.com",                        465,  "Gmail SSL"),
        ("smtp.gmail.com",                        587,  "Gmail TLS"),
        ("smtp.sendgrid.net",                     587,  "SendGrid TLS"),
        ("smtp.sendgrid.net",                     2525, "SendGrid 2525"),
        ("in-v3.mailjet.com",                     587,  "Mailjet TLS"),
        ("in-v3.mailjet.com",                     443,  "Mailjet 443"),
        ("smtp-relay.brevo.com",                  587,  "Brevo TLS"),
        ("smtp-relay.brevo.com",                  2525, "Brevo 2525"),
        ("smtp.postmarkapp.com",                  587,  "Postmark TLS"),
        ("smtp.postmarkapp.com",                  2525, "Postmark 2525"),
    ]
    results = []
    for host, port, desc in HOSTS:
        try:
            t0 = time.time()
            s = socket.create_connection((host, port), timeout=1.0)
            s.close()
            ms = round((time.time() - t0) * 1000)
            results.append({"desc": desc, "host": host, "port": port, "ok": True, "ms": ms})
        except Exception as e:
            results.append({"desc": desc, "host": host, "port": port, "ok": False, "error": str(e)})

    working = [r for r in results if r["ok"]]
    return {
        "working": working,
        "all": results,
        "recommendation": working[0] if working else None,
    }
@router.get("/smtp-debug")
async def smtp_debug(token: str = Query(None)):
    """
    Retorna as configurações do SMTP atualmente ativas na aplicação.
    Use: GET /tasks/smtp-debug?token=cai0_based
    """
    import os
    cron_token = os.getenv("CRON_TOKEN", "cai0_based")
    if token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid token.")

    from app.core.config import settings

    return {
        "smtp_host": settings.smtp_host,
        "smtp_port": settings.smtp_port,
        "smtp_user": settings.smtp_user,
        "smtp_password_present": bool(settings.smtp_password),
        "smtp_from": settings.smtp_from,
        "env_smtp_port": os.getenv("SMTP_PORT"),
        "env_smtp_host": os.getenv("SMTP_HOST"),
    }


@router.get("/send-inactivity-report")
async def send_inactivity_report(token: str = Query(None)):
    """
    Busca todas as notificações de retenção enviadas hoje e envia um relatório detalhado
    para o e-mail do programador (cmsampaio135@gmail.com) direto do Hugging Face.
    Use: GET /tasks/send-inactivity-report?token=cai0_based
    """
    import os
    from datetime import datetime, timezone, timedelta
    from app.core.database import get_client
    from app.shared.services.email import EmailSender

    cron_token = os.getenv("CRON_TOKEN", "cai0_based")
    if token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid token.")

    db = get_client()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    tomorrow_start = (now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat()

    try:
        # Busca notificações
        notifs = db.table('notifications').select(
            'username, title, body, created_at'
        ).eq('category', 'retention').gte('created_at', today_start).lt('created_at', tomorrow_start).execute().data or []

        # Busca dados adicionais de e-mail dos usuários
        users = db.table('users').select('username, email, name').execute().data or []
        user_map = {u['username']: u for u in users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar banco: {e}")

    sent_rows = ""
    for n in notifs:
        username = n['username']
        # Ignora administradores no relatório de inatividade
        if username in ('programador', 'professor'):
            continue
        u_info = user_map.get(username, {"email": "N/A", "name": username})
        sent_rows += f"""
        <tr>
            <td style="padding:10px;border-bottom:1px solid #eee;"><strong>{username}</strong> ({u_info.get('name') or username})</td>
            <td style="padding:10px;border-bottom:1px solid #eee;">{u_info.get('email') or 'N/A'}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;color:#4f46e5;">{n['title']}</td>
            <td style="padding:10px;border-bottom:1px solid #eee;font-size:13px;color:#555;">{n['body']}</td>
        </tr>"""

    html = f"""
    <html><body style="font-family:sans-serif;color:#333;line-height:1.6;padding:20px;">
    <h2 style="color:#7c3aed;">📊 Relatório Detalhado de Envios (Inatividade)</h2>
    <p>Olá Programador,</p>
    <p>Segue abaixo a relação dos alunos que receberam a notificação de inatividade hoje e as respectivas mensagens enviadas.</p>

    <table style="width:100%;border-collapse:collapse;margin-top:20px;">
      <thead><tr style="background:#7c3aed;color:white;">
        <th style="padding:12px;text-align:left;">Aluno</th>
        <th style="padding:12px;text-align:left;">E-mail</th>
        <th style="padding:12px;text-align:left;">Assunto / Título</th>
        <th style="padding:12px;text-align:left;">Mensagem Enviada</th>
      </tr></thead>
      <tbody>{sent_rows or '<tr><td colspan=4 style="padding:20px;text-align:center;">Nenhuma notificação enviada hoje.</td></tr>'}</tbody>
    </table>

    <p style="margin-top:40px;font-size:12px;color:#999;border-top:1px solid #eee;padding-top:10px;">
        Teacher Tati AI System Hub - Relatório Automático (Brevo SMTP 2525)
    </p>
    </body></html>"""

    try:
        from app.core.tasks import send_email_task
        send_email_task.delay(
            to_email="cmsampaio135@gmail.com",
            subject=f"📊 Relatório Detalhado de Notificações - {now.strftime('%d/%m/%Y')}",
            html=html
        )
        success = True
    except Exception as e:
        success = False

    return {
        "success": success,
        "notifs_count": len(notifs),
        "recipient": "cmsampaio135@gmail.com"
    }


@router.get("/health")

async def celery_health(token: str = Query(None)):
    """
    Verifica se o Celery Beat está ativo e mostra o status de cada task agendada.
    Use: GET /tasks/health?token=cai0_based
    """
    import os
    import httpx
    from datetime import datetime, timezone
    from app.core.celery_app import celery_app, USE_CELERY

    cron_token = os.getenv("CRON_TOKEN", "cai0_based")
    if token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid token.")

    # Testa conexão com o broker Celery
    broker_ok = False
    broker_error = None
    try:
        celery_app.control.inspect(timeout=3).ping()
        broker_ok = True
    except Exception as e:
        broker_error = str(e)

    # Testa o WAHA diretamente
    waha_status = None
    waha_error = None
    try:
        from app.core.config import settings
        waha_url = f"{settings.waha_api_url}/api/server/status"
        waha_headers = {"X-Api-Key": settings.waha_api_key}
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(waha_url, headers=waha_headers)
            waha_status = r.status_code
            waha_ok = r.status_code == 200
    except Exception as e:
        waha_ok = False
        waha_error = str(e)

    # Lista as tasks agendadas
    schedule = {name: str(conf["schedule"]) for name, conf in celery_app.conf.beat_schedule.items()}

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "celery_enabled": USE_CELERY,
        "broker_connected": broker_ok,
        "broker_error": broker_error,
        "waha": {
            "ok": waha_ok,
            "http_status": waha_status,
            "error": waha_error,
        },
        "beat_schedule": schedule,
        "tip": "Se broker_connected=false, o Celery worker pode estar inativo ou o broker (CloudAMQP/Redis) inacessível.",
    }


async def verify_cron_token(
    x_cron_token: str = Header(None, alias="X-Cron-Token"),
    token: str = Query(None)
):
    cron_token = os.getenv("CRON_TOKEN")
    if not cron_token:
        return True
    if x_cron_token != cron_token and token != cron_token:
        raise HTTPException(status_code=403, detail="Invalid CRON_TOKEN.")
    return True


@router.get("/status/{task_id}")
async def get_task_status(task_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """
    Rota para o front-end monitorar o progresso de PDFs ou Relatorios pesados.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    if task_id.startswith("local_") or task_id in local_tasks_status:
        return get_local_task_status(task_id)

    task_result = celery_app.AsyncResult(task_id)
    
    if task_result.state == "PENDING":
        return {"status": "processing", "result": None}
        
    elif task_result.state == "SUCCESS":
        # Retorna o valor de retorno da sua funcao do celery (ex: a URL do PDF no Supabase Storage)
        return {"status": "success", "result": task_result.result}
        
    elif task_result.state == "FAILURE":
        return {"status": "failed", "error": str(task_result.info)}
        
    return {"status": task_result.state.lower(), "result": None}


@router.api_route("/trigger/{task_name}", methods=["GET", "POST"])
async def trigger_task(
    task_name: str,
    request: Request,
    background_tasks: BackgroundTasks,
    verified: bool = Depends(verify_cron_token)
):
    """
    Triggers a background Celery task securely. Used to support sleep mode on Railway by delegating cron schedules.
    """
    delegate_res = await delegate_to_worker_if_needed(request)
    if delegate_res is not None:
        return delegate_res
    if task_name == "streak_reminders":
        from app.modules.notifications.tasks import streak_reminders
        task_id = run_task_in_background(background_tasks, streak_reminders)
    elif task_name == "broken_streaks":
        from app.modules.notifications.tasks import broken_streaks
        task_id = run_task_in_background(background_tasks, broken_streaks)
    elif task_name == "check_inactivity":
        from app.modules.notifications.tasks import check_inactivity
        task_id = run_task_in_background(background_tasks, check_inactivity)
    elif task_name == "weekly_reports":
        from app.modules.notifications.tasks import weekly_reports
        task_id = run_task_in_background(background_tasks, weekly_reports)
    elif task_name == "cefr_weekly_gen":
        from app.modules.cefr.tasks import cefr_weekly_gen
        task_id = run_task_in_background(background_tasks, cefr_weekly_gen)
    elif task_name == "trigger-test-notif":
        # Dispara todas as notificações de teste para caio.sampaio
        from app.modules.notifications.services.notification_dispatcher import dispatch_universal_notification
        # Dispara
        await dispatch_universal_notification(
            username="caio.sampaio",
            title="Teacher Tati 👩‍🏫",
            body="Hey Caio! This is a test notification. It should arrive on WhatsApp, Email and App without Spam! 🚀",
            url="/chat",
            sender_username="programador"
        )
        task_id = "test_run_success"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown cron task: {task_name}")
        
    return {
        "success": True, 
        "message": f"Task '{task_name}' triggered in background.", 
        "task_id": task_id
    }

