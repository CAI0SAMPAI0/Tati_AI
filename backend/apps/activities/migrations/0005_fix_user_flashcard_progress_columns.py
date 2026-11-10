from django.db import migrations


def fix_user_flashcard_progress_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS user_flashcard_progress (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(150) NOT NULL,
                flashcard_id VARCHAR(255) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'correct',
                next_review_date TIMESTAMPTZ NULL,
                reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CONSTRAINT user_flashcard_progress_user_id_flashcard_id_key UNIQUE (user_id, flashcard_id)
            );
            """
        )
        cursor.execute(
            """
            ALTER TABLE user_flashcard_progress
                DROP CONSTRAINT IF EXISTS user_flashcard_progress_flashcard_id_fkey,
                DROP CONSTRAINT IF EXISTS user_flashcard_progress_user_id_fkey;
            """
        )
        cursor.execute(
            """
            ALTER TABLE user_flashcard_progress
                ALTER COLUMN user_id TYPE VARCHAR(150) USING user_id::text,
                ALTER COLUMN flashcard_id TYPE VARCHAR(255) USING flashcard_id::text;
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0004_scrapedactivitycontent_pronunciationhistory"),
    ]

    operations = [
        migrations.RunPython(
            fix_user_flashcard_progress_schema,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
