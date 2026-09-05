from .base import *
from django.test.runner import DiscoverRunner

DEBUG = False
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

class UnmanagedModelTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        config = super().setup_databases(**kwargs)
        from django.db import connection
        from apps.authentication.models import User
        from apps.chat.models import Conversation, Message

        with connection.schema_editor() as schema_editor:
            for model in [User, Conversation, Message]:
                try:
                    schema_editor.create_model(model)
                except Exception:
                    pass
        return config

TEST_RUNNER = 'app.settings.test.UnmanagedModelTestRunner'
