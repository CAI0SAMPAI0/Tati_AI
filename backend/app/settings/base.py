import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Carrega variáveis de ambiente do .env na raiz do projeto
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
ENV_PATH = ROOT_DIR / '.env'
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'django-insecure-tati-ai-super-secret-key-2026')
DEBUG = os.getenv('DEBUG', 'False').lower() in ('true', '1', 't')

ALLOWED_HOSTS = ['*']

# ── INSTALLED APPS ───────────────────────────────────────────────────
INSTALLED_APPS = [
    # Daphne deve vir antes de django.contrib.staticfiles para ASGI WebSockets
    'daphne',
    
    # Django Core
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',

    # Third-party Apps
    'corsheaders',
    'channels',
    'django_celery_results',
    'django_celery_beat',

    # Local Apps
    'apps.authentication',
    'apps.users',
    'apps.activities',
    'apps.chat',
    'apps.payments',
    'apps.notifications',
    'apps.dashboard',
]

AUTH_USER_MODEL = 'authentication.User'

# ── MIDDLEWARE ────────────────────────────────────────────────────────
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'app.middleware.PerformanceMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'
ASGI_APPLICATION = 'app.asgi.application'

# ── BANCO DE DADOS ────────────────────────────────────────────────────
# Utiliza DATABASE_URL (Supabase PostgreSQL / Railway) ou fallback local SQLite
DATABASE_URL = (
    os.getenv('DATABASE_URL')
    or os.getenv('SUPABASE_DB_URL')
    or os.getenv('WHATSAPP_SESSIONS_POSTGRESQL_URL')
    or os.getenv('POSTGRES_URL')
)
if DATABASE_URL:
    db_config = dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=0,
        conn_health_checks=True,
    )
    if 'pooler.supabase.com' in str(db_config.get('HOST', '')) and not db_config.get('PORT'):
        db_config['PORT'] = 5432

    db_config.setdefault('OPTIONS', {})['connect_timeout'] = 10
    DATABASES = {'default': db_config}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ── CACHE (UPSTASH REDIS / DJANGO CACHE BACKEND) ─────────────────────
UPSTASH_REDIS_URL = os.getenv('UPSTASH_REDIS_URL')
REDIS_URL = os.getenv('REDIS_URL', UPSTASH_REDIS_URL)

if REDIS_URL and REDIS_URL.startswith(('redis://', 'rediss://')) and os.getenv('USE_REDIS_CACHE', 'false').lower() in ('true', '1'):
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'IGNORE_EXCEPTIONS': True,
            },
            'KEY_PREFIX': 'tati_ai',
            'TIMEOUT': 3600,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'tati-ai-local-cache',
            'TIMEOUT': 3600,
        }
    }

# ── CELERY & BACKGROUND TASKS ─────────────────────────────────────────
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', REDIS_URL or 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = 'django-db'
CELERY_CACHE_BACKEND = 'django-cache'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'America/Sao_Paulo'
CELERY_ENABLE_UTC = True

# ── DJANGO CHANNELS (WEBSOCKETS LAYER) ────────────────────────────────
# Em containers autônomos (HF Spaces), InMemoryChannelLayer garante latência zero e 0 falhas de conexão de rede
if os.getenv('USE_REDIS_CHANNELS', 'false').lower() in ('true', '1') and REDIS_URL and REDIS_URL.startswith(('redis://', 'rediss://')):
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                'hosts': [REDIS_URL],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        },
    }

# ── CORS HEADERS ──────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:8000',
    'http://localhost:8000',
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'capacitor://localhost',
    'http://localhost',
    'https://tati-ai.vercel.app',
    'https://tati-ai-git-main-caio-andrades-projects.vercel.app',
    'https://tati-hub.vercel.app',
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['*']

# ── INTERNACIONALIZAÇÃO & TEMPO ───────────────────────────────────────
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── SEGURANÇA E ADMINS (RBAC) ─────────────────────────────────────────
SUPERADMIN_EMAILS = [
    e.strip().lower()
    for e in os.getenv('SUPERADMIN_EMAILS', 'dev@tati.ai,programador,caiosampaiov@gmail.com').split(',')
    if e.strip()
]
PROGRAMMER_USERNAMES = [
    u.strip()
    for u in os.getenv('PROGRAMMER_USERNAMES', 'programador,admin,caio').split(',')
    if u.strip()
]
