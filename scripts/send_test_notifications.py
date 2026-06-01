import logging
"""
scripts/send_test_notifications.py
Sends every notification type to target users via all channels (in-app + email).
Usage: python -m scripts.send_test_notifications
"""

from services.database import get_client
from services.email import EmailSender
from services.notification_dispatcher import dispatch_universal_notification
from services.notification_service import NotificationService
import asyncio
from dotenv import load_dotenv
import sys
import os

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(__file__),
        '..',
        'backend'))

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


TARGET_USERS = ['programador', 'caio.sampaio']

NOTIFICATIONS = [
    ('welcome', 'Welcome to Teacher Tati!',
     'Hi! Start chatting with Tati to practice your English.'),
    ('streak_reminder', 'Keep your streak alive!',
     'You are on a 5-day streak! Practice now to keep it.'),
    ('streak_broken', 'Your streak was broken',
     'Your previous streak was 5 days. Restart today!'),
    ('streak', 'Streak milestone unlocked!',
     'You reached 7 consecutive days. Keep the momentum.'),
    ('trophy', 'New trophy unlocked!', 'You earned the trophy: First Conversation'),
    ('correction', 'Exercise corrected', 'Grammar Quiz - 85/100 - Great job!'),
    ('new_activity', 'New activity available', 'Business English Vocabulary Quiz'),
    ('retention', 'Tati misses you!', 'Consistent practice is the key to fluency.'),
    ('report', 'Your Weekly Progress Report', 'Your evolution report is ready!'),
]


def _get_user_info(username: str):
    db = get_client()
    try:
        rows = db.table('users').select('email, name').eq(
            'username', username).limit(1).execute().data
        if rows:
            return rows[0].get('email'), rows[0].get('name') or username
    except Exception as exc:
        logging.info(f'  [DB] Error fetching user {username}: {exc}')
    return None, username


async def send_all_notifications():
    ns = NotificationService()
    email_sender = EmailSender()

    for username in TARGET_USERS:
        logging.info(f'\n=== Sending notifications to: {username} ===')
        user_email, user_name = _get_user_info(username)
        logging.info(f'  Email: {user_email}, Name: {user_name}')

        for category, title, body in NOTIFICATIONS:
            try:
                await ns.send_notification(username, title, body, category=category)
                logging.info(f'  [OK] In-app: [{category}] {title}')
            except Exception as exc:
                logging.info(f'  [FAIL] In-app [{category}]: {exc}')

            try:
                await dispatch_universal_notification(username, title, body, url='/chat')
                logging.info(
                    f'  [OK] Dispatch (push+email): [{category}]')
            except Exception as exc:
                logging.info(f'  [FAIL] Dispatch [{category}]: {exc}')

        if user_email:
            email_tests = [
                ('reset_password',
                 lambda: email_sender.send_reset_email(
                     user_email,
                     user_name,
                     'TempPass123!')),
                ('streak_reminder',
                 lambda: email_sender.send_streak_email(
                     user_email,
                     user_name,
                     5,
                     mode='reminder')),
                ('streak_broken',
                 lambda: email_sender.send_streak_email(
                     user_email,
                     user_name,
                     5,
                     mode='broken')),
                ('trophy',
                 lambda: email_sender.send_trophy_email(
                     user_email,
                     user_name,
                     'First Conversation')),
                ('correction',
                 lambda: email_sender.send_correction_notification(
                     user_name,
                     user_email,
                     'Grammar Quiz',
                     85,
                     'Excellent work on verb tenses!')),
                ('new_activity',
                 lambda: email_sender.send_new_activity_email(
                     user_email,
                     user_name,
                     'Business English Vocab Quiz')),
            ]

            for label, fn in email_tests:
                try:
                    success = fn()
                    status = 'OK' if success else 'FAIL (returned False)'
                    logging.info(f'  [{status}] Email [{label}]')
                except Exception as exc:
                    logging.info(f'  [FAIL] Email [{label}]: {exc}')

    logging.info('\n=== All notifications sent ===')


if __name__ == '__main__':
    asyncio.run(send_all_notifications())
