import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings.development')
sys.path.insert(0, os.path.abspath('backend'))
django.setup()

from django.db import connection

with connection.cursor() as cur:
    # 1. Options column in cefr_flashcards
    cur.execute("""
        ALTER TABLE cefr_flashcards 
        ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'::jsonb;
    """)

    # 2. Table student_feedbacks for Teacher Tatiana
    cur.execute("""
        CREATE TABLE IF NOT EXISTS student_feedbacks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_username VARCHAR(150) NOT NULL,
            student_name VARCHAR(255) DEFAULT '',
            cefr_level VARCHAR(20) DEFAULT 'A1',
            area VARCHAR(50) NOT NULL DEFAULT 'general',
            activity_id VARCHAR(255) DEFAULT '',
            activity_title VARCHAR(255) DEFAULT '',
            rating INTEGER DEFAULT 5,
            comment TEXT NOT NULL,
            teacher_reply TEXT DEFAULT '',
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_student_feedbacks_user ON student_feedbacks(student_username);
        CREATE INDEX IF NOT EXISTS idx_student_feedbacks_level ON student_feedbacks(cefr_level);
        CREATE INDEX IF NOT EXISTS idx_student_feedbacks_area ON student_feedbacks(area);
        CREATE INDEX IF NOT EXISTS idx_student_feedbacks_created ON student_feedbacks(created_at DESC);
    """)

    # 3. Table developer_bug_reports for Programmer
    cur.execute("""
        CREATE TABLE IF NOT EXISTS developer_bug_reports (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            student_username VARCHAR(150) NOT NULL,
            student_name VARCHAR(255) DEFAULT '',
            student_email VARCHAR(255) DEFAULT '',
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            image_urls JSONB DEFAULT '[]'::jsonb,
            page_url VARCHAR(500) DEFAULT '',
            user_agent TEXT DEFAULT '',
            status VARCHAR(50) DEFAULT 'open',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_dev_bugs_user ON developer_bug_reports(student_username);
        CREATE INDEX IF NOT EXISTS idx_dev_bugs_created ON developer_bug_reports(created_at DESC);
    """)

    print("Tables student_feedbacks, developer_bug_reports and cefr_flashcards.options verified successfully.")
