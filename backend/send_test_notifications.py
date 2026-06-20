import sys
import os
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add backend dir to python path
backend_dir = Path(__file__).parent.resolve()
sys.path.insert(0, str(backend_dir))

# Load .env
env_path = backend_dir.parent / '.env'
load_dotenv(dotenv_path=env_path)

from app.core.database import get_client
from app.modules.notifications.services.push_notifications import send_push_to_user
from app.shared.services.email import EmailSender
from app.modules.users.services.progress_report import progress_report_service

async def main():
    username = "caio.sampaio"
    db = get_client()
    
    # 1. Fetch user info
    res = db.table('users').select('name, email').eq('username', username).single().execute()
    if not res.data:
        print(f"Error: User {username} not found in DB.")
        return
    
    user_info = res.data
    name = user_info.get('name') or "Caio Sampaio"
    email = user_info.get('email')
    
    if not email:
        print(f"Error: User {username} does not have an email set.")
        return
    
    print(f"User found: {name} <{email}>")
    
    email_sender = EmailSender()
    
    # Helper to insert Web/In-App notification
    def insert_db_notification(category, title, body):
        try:
            db.table('notifications').insert({
                'username': username,
                'category': category,
                'title': title,
                'body': body,
                'is_read': False,
                'created_at': datetime.now(timezone.utc).isoformat()
            }).execute()
            return True
        except Exception as e:
            print(f"   [Webapp DB] Error: {e}")
            return False

    # List of notification definitions
    # Format: (name, category, title, body, push_url, email_func_or_custom)
    
    notifications = []
    
    # 1. Streak Reminder
    notifications.append({
        'name': 'Streak Reminder',
        'category': 'streak_reminder',
        'title': "Don't break your streak! 🔥",
        'body': "You're on a 5-day streak. Practice just 5 minutes to keep it alive!",
        'url': '/chat',
        'send_email': lambda: email_sender.send_streak_email(email, name, 5, "reminder")
    })
    
    # 2. Streak Broken
    notifications.append({
        'name': 'Streak Broken',
        'category': 'streak_broken',
        'title': "Your streak was broken 💔",
        'body': "You had a 5-day streak. Don't give up — start a new one today!",
        'url': '/chat',
        'send_email': lambda: email_sender.send_streak_email(email, name, 5, "broken")
    })
    
    # 3. Streak Milestone
    notifications.append({
        'name': 'Streak Milestone',
        'category': 'streak',
        'title': "Streak milestone unlocked! 🏆",
        'body': "7 days of consistent practice! You're officially on a roll.",
        'url': '/activities',
        'send_email': lambda: email_sender.send_email(
            "Teacher Tati <tatiai@resend.dev>",
            email,
            "Streak milestone unlocked! 🏆",
            f"""
            <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                <h2 style="color: #6366f1;">Streak milestone unlocked! 🏆</h2>
                <p>Hello, <strong>{name}</strong>!</p>
                <p>You reached 7 consecutive days of practice! You are building a powerful habit.</p>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">Teacher Tati Team</p>
            </div>
            """
        )
    })
    
    # 4. Trophy Earned
    notifications.append({
        'name': 'Trophy Earned',
        'category': 'trophy',
        'title': "New trophy unlocked! 🥇",
        'body': "You earned the trophy: Grammar Master",
        'url': '/activities',
        'send_email': lambda: email_sender.send_trophy_email(email, name, "Grammar Master", "🏆")
    })
    
    # 5. Exercise Corrected
    notifications.append({
        'name': 'Exercise Corrected',
        'category': 'correction',
        'title': "Exercise corrected",
        'body': "Present Simple Quiz · 95/100 · Excellent! 🎉",
        'url': '/activities',
        'send_email': lambda: email_sender.send_correction_notification(
            name, email, "Present Simple Quiz", 95, "Great job on the present simple exercise! Keep it up."
        )
    })
    
    # 6. New Activity Available
    notifications.append({
        'name': 'New Activity Available',
        'category': 'new_activity',
        'title': "📚 New activity available",
        'body': "Future Tense Practice",
        'url': 'https://tati-ai.vercel.app/activities',
        'send_email': lambda: email_sender.send_new_activity_email(email, name, "Future Tense Practice", "https://tati-ai.vercel.app/activities")
    })
    
    # 7. Welcome
    notifications.append({
        'name': 'Welcome',
        'category': 'welcome',
        'title': "Welcome to Teacher Tati! 🚀",
        'body': f"Hi {name}! Start chatting with Tati to practice your English.",
        'url': '/',
        'send_email': lambda: email_sender.send_email(
            "Teacher Tati <tatiai@resend.dev>",
            email,
            "Welcome to Teacher Tati! 🚀",
            f"""
            <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                <h2 style="color: #6366f1;">Welcome to Teacher Tati! 🚀</h2>
                <p>Hi <strong>{name}</strong>,</p>
                <p>Welcome to Teacher Tati! Start chatting with Tati to practice your English every day and gain confidence.</p>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">Teacher Tati Team</p>
            </div>
            """
        )
    })
    
    # 8. Inactivity / Retention
    notifications.append({
        'name': 'Inactivity / Retention',
        'category': 'retention',
        'title': "Tati misses you! 🍎",
        'body': "It's been 2 days since you practiced. Come back for a quick chat!",
        'url': '/chat',
        'send_email': lambda: email_sender.send_email(
            "Teacher Tati <tatiai@resend.dev>",
            email,
            "Tati misses you! 🍎",
            f"""
            <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                <h2 style="color: #6366f1;">Tati misses you! 🍎</h2>
                <p>Hi <strong>{name}</strong>,</p>
                <p>It's been 2 days since you practiced. Consistency is key to learning a language! Let's have a quick chat today.</p>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">Teacher Tati Team</p>
            </div>
            """
        )
    })
    
    # 9. AI Generation
    notifications.append({
        'name': 'AI Generation',
        'category': 'ai_generation',
        'title': "AI Content Generated",
        'body': "Your custom speaking practice scenario has been generated successfully.",
        'url': '/admin',
        'send_email': lambda: email_sender.send_email(
            "Teacher Tati <tatiai@resend.dev>",
            email,
            "AI Content Generated",
            f"""
            <div style="font-family: sans-serif; max-width: 600px; color: #333;">
                <h2 style="color: #6366f1;">AI Content Generated</h2>
                <p>Hi <strong>{name}</strong>,</p>
                <p>Your custom speaking practice scenario has been generated successfully and is ready for you.</p>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">Teacher Tati Team</p>
            </div>
            """
        )
    })
    
    # 10. Weekly Report (with PDF Generation & email attachment)
    async def send_weekly_report():
        print("   Generating PDF report...")
        try:
            pdf_path = await progress_report_service.generate_student_report(username, lang='en-US')
            if pdf_path and os.path.exists(pdf_path):
                print(f"   PDF generated successfully at: {pdf_path}")
                success = email_sender.send_report_email(email, name, pdf_path, lang='en-US')
                return success
            else:
                print("   Error: PDF path not found or empty.")
                return False
        except Exception as e:
            print(f"   Error generating weekly report PDF: {e}")
            return False

    notifications.append({
        'name': 'Weekly Report (with PDF)',
        'category': 'weekly_report',
        'title': "📊 Your Weekly Progress Report is ready",
        'body': "Congratulations on your progress this week! Open to view details.",
        'url': '/activities',
        'send_email_async': send_weekly_report
    })
    
    print("\nStarting execution of all notification types...")
    for idx, notif in enumerate(notifications, 1):
        print(f"\n[{idx}/{len(notifications)}] Processing: {notif['name']}")
        
        # A. Save in DB (Webapp)
        db_res = insert_db_notification(notif['category'], notif['title'], notif['body'])
        print(f"   - [Webapp DB]: {'SUCCESS' if db_res else 'FAILED'}")
        
        # B. Send Push Notification (Android Device)
        try:
            push_res = send_push_to_user(username, notif['title'], notif['body'], notif['url'])
            print(f"   - [Android Push]: SUCCESS (Sent: {push_res.get('sent', 0)}, Failed: {push_res.get('failed', 0)})")
        except Exception as e:
            print(f"   - [Android Push]: FAILED (Error: {e})")
            
        # C. Send Email
        try:
            if 'send_email_async' in notif:
                email_res = await notif['send_email_async']()
            else:
                email_res = notif['send_email']()
            print(f"   - [Email]: {'SUCCESS' if email_res else 'FAILED'}")
        except Exception as e:
            print(f"   - [Email]: FAILED (Error: {e})")
            
    print("\nAll notifications dispatched.")

if __name__ == "__main__":
    asyncio.run(main())
