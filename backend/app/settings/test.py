from .base import *
from django.test.runner import DiscoverRunner

DEBUG = False
INSTALLED_APPS = [app for app in INSTALLED_APPS if app != 'debug_toolbar']
MIDDLEWARE = [mw for mw in MIDDLEWARE if 'debug_toolbar' not in mw]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'test-cache',
    }
}
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

class DisableMigrations(dict):
    def __contains__(self, item):
        return True
    def __getitem__(self, item):
        return None
    def setdefault(self, key, default=None):
        return None

MIGRATION_MODULES = DisableMigrations()

class UnmanagedModelTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        config = super().setup_databases(**kwargs)
        from django.db import connection
        from apps.authentication.models import User
        from apps.chat.models import Conversation, Message
        from apps.notifications.models import Notification
        from apps.activities.models import (
            PremiumContent,
            Flashcard,
            Module,
            ActivitySubmission,
            UserFlashcardProgress,
            Trophy,
            UserTrophy,
        )

        with connection.schema_editor() as schema_editor:
            for model in [
                User,
                Conversation,
                Message,
                Notification,
                PremiumContent,
                Flashcard,
                Module,
                ActivitySubmission,
                UserFlashcardProgress,
                Trophy,
                UserTrophy,
            ]:
                try:
                    schema_editor.create_model(model)
                except Exception:
                    pass
        return config

TEST_RUNNER = 'app.settings.test.UnmanagedModelTestRunner'
