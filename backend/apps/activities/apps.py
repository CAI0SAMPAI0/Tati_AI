from django.apps import AppConfig


class ActivitiesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.activities"
    verbose_name = "Atividades e Conteúdos Pedagógicos"

    def ready(self):
        import sys
        if any(cmd in sys.argv for cmd in ["makemigrations", "migrate", "test"]):
            return

        def _sanitize_legacy_levels():
            import time
            time.sleep(2)
            try:
                from apps.activities.models import Game, NewsItem
                for g in Game.objects.all():
                    clean = [l for l in (g.levels or []) if l and str(l).strip().lower() != "all"]
                    if clean and len(clean) != len(g.levels or []):
                        g.levels = clean
                        g.save(update_fields=["levels"])
                for n in NewsItem.objects.all():
                    clean = [l for l in (n.levels or []) if l and str(l).strip().lower() != "all"]
                    if clean and len(clean) != len(n.levels or []):
                        n.levels = clean
                        n.save(update_fields=["levels"])
            except Exception:
                pass

        def _ensure_user_trophies_schema():
            import time
            time.sleep(1)
            try:
                from django.db import connection
                with connection.cursor() as cursor:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns 
                                WHERE table_name = 'user_trophies' AND column_name = 'unlocked_at'
                            ) THEN
                                IF EXISTS (
                                    SELECT 1 FROM information_schema.columns 
                                    WHERE table_name = 'user_trophies' AND column_name = 'earned_at'
                                ) THEN
                                    ALTER TABLE user_trophies ADD COLUMN unlocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                                    UPDATE user_trophies SET unlocked_at = earned_at WHERE unlocked_at IS NULL;
                                ELSE
                                    ALTER TABLE user_trophies ADD COLUMN unlocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
                                END IF;
                            END IF;

                            IF EXISTS (
                                SELECT 1 FROM information_schema.columns 
                                WHERE table_name = 'user_trophies' AND column_name = 'trophy_id' AND data_type = 'uuid'
                            ) THEN
                                ALTER TABLE user_trophies ALTER COLUMN trophy_id TYPE VARCHAR(100) USING trophy_id::text;
                            END IF;
                        END $$;
                    """)
            except Exception:
                pass

        import threading
        threading.Thread(target=_sanitize_legacy_levels, daemon=True).start()
        threading.Thread(target=_ensure_user_trophies_schema, daemon=True).start()


