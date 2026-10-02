from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('activities', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE TABLE IF NOT EXISTS cefr_schedules (
                id uuid PRIMARY KEY,
                active boolean DEFAULT true,
                weekdays jsonb DEFAULT '[]',
                execution_time time,
                weekly_frequency integer DEFAULT 1,
                materials_per_execution integer DEFAULT 5,
                selected_types text[],
                reference_ids jsonb DEFAULT '[]',
                topic_plan jsonb DEFAULT '[]',
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now()
            );
            ALTER TABLE cefr_schedules ADD COLUMN IF NOT EXISTS topic_plan jsonb DEFAULT '[]';
            """,
            reverse_sql="ALTER TABLE cefr_schedules DROP COLUMN IF EXISTS topic_plan;",
        ),
    ]
