from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, Optional

from services.database import get_client
from services.push_notifications import send_push_to_user

STREAK_MILESTONES = {1, 3, 7, 14, 30, 60, 100, 365}


def _safe_payload(payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    safe: Dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[str(key)] = value
    return safe


def _render_notification_copy(
    title: str,
    message: str,
    payload: Optional[Dict[str, Any]] = None,
) -> tuple[str, str]:
    """Renderiza cópias de notificação exclusivamente em Inglês."""
    params = _safe_payload(payload)
    streak = int(params.get('streak') or 0)
    trophy_name = str(params.get('trophy_name') or '').strip()

    if title == 'notif.streak_reminder.title':
        localized_title = 'Do not break your streak!'
    elif title == 'notif.streak_milestone.title':
        localized_title = 'Streak milestone unlocked!'
    elif title == 'notif.streak_broken.title':
        localized_title = 'Your streak was broken'
    elif title == 'notif.trophy_earned.title':
        localized_title = 'New trophy unlocked!'
    else:
        localized_title = title

    if message == 'notif.streak_reminder.message':
        localized_message = f'You are on a {streak}-day streak. Practice now to keep it.'
    elif message == 'notif.streak_milestone.message':
        localized_message = f'You reached {streak} consecutive days. Keep the momentum.'
    elif message == 'notif.streak_broken.message':
        localized_message = f'Your previous streak was {streak} days. Restart today.'
    elif message == 'notif.trophy_earned.message':
        localized_message = f'You earned the trophy: {trophy_name}'
    else:
        localized_message = message

    return localized_title, localized_message


def create_notification(
    username: str,
    category: str,
    title: str,
    message: str,
    payload: Optional[Dict[str, Any]] = None,
    send_push: bool = False,
    push_url: str = '/activities.html',
) -> None:
    if not username:
        return

    db = get_client()
    safe_payload = _safe_payload(payload)

    rendered_title, rendered_body = _render_notification_copy(title, message, safe_payload)

    try:
        db.table('notifications').insert(
            {
                'username': username,
                'category': category,
                'title': rendered_title,
                'body': rendered_body,
                'payload': safe_payload,
            }
        ).execute()
    except Exception:
        try:
            db.table('notifications').insert(
                {
                    'username': username,
                    'category': category,
                    'title': rendered_title,
                    'body': rendered_body,
                }
            ).execute()
        except Exception as exc:
            print(f'[Notif] Error creating notification: {exc}')
            return

    if send_push:
        try:
            send_push_to_user(username, title=rendered_title, body=rendered_body, url=push_url)
        except Exception as exc:
            print(f'[Notif] Falha no push: {exc}')


def _has_notification_today(username: str, notif_category: str, now_utc: datetime) -> bool:
    db = get_client()
    start_day = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        rows = (
            db.table('notifications')
            .select('id')
            .eq('username', username)
            .eq('category', notif_category)
            .gte('created_at', start_day.isoformat())
            .limit(1)
            .execute()
            .data
        )
        return bool(rows)
    except Exception:
        return False


def should_notify_streak_milestone(previous_streak: int, new_streak: int) -> bool:
    return int(new_streak or 0) in STREAK_MILESTONES and int(new_streak or 0) > int(
        previous_streak or 0
    )


def notify_streak_milestone(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        category='streak',
        title='notif.streak_milestone.title',
        message='notif.streak_milestone.message',
        payload={'streak': int(streak_days or 0)},
        send_push=True,
        push_url='/activities',
    )


def notify_streak_reminder(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        category='streak_reminder',
        title='notif.streak_reminder.title',
        message='notif.streak_reminder.message',
        payload={'streak': int(streak_days or 0)},
        send_push=True,
        push_url='/chat',
    )


def notify_streak_broken(username: str, streak_days: int) -> None:
    create_notification(
        username=username,
        category='streak_broken',
        title='notif.streak_broken.title',
        message='notif.streak_broken.message',
        payload={'streak': int(streak_days or 0)},
        send_push=True,
        push_url='/chat',
    )


def notify_trophy_earned(username: str, trophy_name: str, trophy_icon: str = '🏆') -> None:
    create_notification(
        username=username,
        category='trophy',
        title='notif.trophy_earned.title',
        message='notif.trophy_earned.message',
        payload={'trophy_name': str(trophy_name or '').strip()},
        send_push=True,
        push_url='/activities',
    )
    # Envia e-mail de parabéns
    try:
        db = get_client()
        row = (
            db.table('users')
            .select('email, name')
            .eq('username', username)
            .limit(1)
            .execute()
            .data
        )
        if row:
            email = str(row[0].get('email') or '').strip()
            name = str(row[0].get('name') or username).strip()
            if email:
                from services.email import EmailSender
                EmailSender().send_trophy_email(email, name, trophy_name, trophy_icon)
    except Exception as exc:
        print(f'[Notif] Erro ao enviar e-mail de troféu: {exc}')


def notify_correction(
    username: str,
    student_name: str,
    student_email: str,
    activity_title: str,
    score: int,
    feedback: str,
) -> None:
    score_msg = (
        'Excellent! 🎉'
        if score >= 90
        else 'Good job! 👍'
        if score >= 70
        else 'Keep practicing! 💪'
    )

    create_notification(
        username=username,
        category='correction',
        title='Exercise corrected',
        message=f'{activity_title} · {score}/100 · {score_msg}',
    )
    from services.email import EmailSender
    EmailSender().send_correction_notification(
        student_name, student_email, activity_title, score, feedback
    )


def notify_new_activity(
    username: str,
    student_name: str,
    student_email: str,
    activity_title: str,
    activity_url: str = 'https://tati-ai.vercel.app/activities',
) -> None:
    create_notification(
        username=username,
        category='new_activity',
        title='📚 New activity available',
        message=activity_title,
        send_push=True,
        push_url=activity_url,
    )
    try:
        if student_email:
            from services.email import EmailSender
            EmailSender().send_new_activity_email(
                student_email, student_name, activity_title, activity_url
            )
    except Exception as exc:
        print(f'[Notif] Erro ao enviar e-mail de nova atividade: {exc}')


def notify_all_students(
    category: str,
    title: str,
    message: str,
    url: str = '/activities',
    send_email: bool = False
) -> None:
    """
    Notifica todos os alunos sobre novos conteúdos (Simulações, Quizzes, etc).
    Evita duplicados baseados na mensagem e categoria.
    """
    import asyncio
    from services.database import get_client
    
    db = get_client()
    try:
        res = db.table('users').select('username, name, email').execute()
        users = res.data or []
        
        for u in users:
            username = u.get('username')
            if not username: continue
            
            # Verificação de duplicados (mesma categoria e mensagem nas últimas 24h)
            try:
                check = db.table('notifications')\
                    .select('id')\
                    .eq('username', username)\
                    .eq('category', category)\
                    .eq('body', message)\
                    .limit(1)\
                    .execute()
                if check.data:
                    continue
            except:
                pass

            create_notification(
                username=username,
                category=category,
                title=title,
                message=message,
                send_push=True,
                push_url=url
            )
            
            if send_email and u.get('email'):
                try:
                    from services.email import EmailSender
                    EmailSender().send_new_activity_email(
                        u['email'], u.get('name', username), message, f'https://tati-ai.vercel.app{url}'
                    )
                except:
                    pass
                    
    except Exception as e:
        print(f'[Notif] Erro ao notificar todos: {e}')


def notify_welcome(username: str, name: str) -> None:
    create_notification(
        username=username,
        category='welcome',
        title='Welcome to Teacher Tati!',
        message=f'Hi {name}! Start chatting with Tati to practice your English.',
    )


def dispatch_streak_engagement_notifications(
    mode: str = 'all', now_utc: Optional[datetime] = None
) -> Dict[str, int]:
    summary = {'processed': 0, 'reminder': 0, 'broken': 0}
    ref = now_utc or datetime.now(timezone.utc)
    today = ref.date()

    db = get_client()
    try:
        users = db.table('users').select('username, streak_data').execute().data or []
    except Exception as exc:
        print(f'[Notif] Falha ao carregar usuários para job: {exc}')
        return summary

    for row in users:
        username = str(row.get('username') or '').strip()
        if not username:
            continue
        streak_data = row.get('streak_data') or {}
        if not isinstance(streak_data, dict):
            continue

        last_study_date = str(streak_data.get('last_study_date') or '').strip()
        current_streak = int(streak_data.get('current_streak') or 0)
        if not last_study_date or current_streak <= 0:
            continue

        try:
            last_date = date.fromisoformat(last_study_date)
        except Exception:
            continue

        days_since = (today - last_date).days
        summary['processed'] += 1

        if days_since == 1 and mode in {'all', 'reminder'}:
            if not _has_notification_today(username, 'streak_reminder', ref):
                notify_streak_reminder(username, current_streak)
                summary['reminder'] += 1
            continue

        if days_since == 2 and mode in {'all', 'broken'}:
            if not _has_notification_today(username, 'streak_broken', ref):
                notify_streak_broken(username, current_streak)
                summary['broken'] += 1
            continue

    return summary
