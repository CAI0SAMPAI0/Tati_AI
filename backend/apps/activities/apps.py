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

        import threading
        threading.Thread(target=_sanitize_legacy_levels, daemon=True).start()

