# Dockerfile de Produção para o Backend Django (ASGI / Gunicorn + Uvicorn Workers)
FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=app.settings.production \
    WORKERS=1

# Instalar dependências de sistema para compilação e conversão de documentos
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
    ffmpeg \
    libreoffice \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Suporte resiliente para build na raiz do monorepo (Railway) ou no subdiretorio /backend (Docker Compose / Hugging Face)
COPY . /tmp/build/

RUN if [ -f "/tmp/build/backend/requirements.txt" ]; then \
      cp /tmp/build/backend/requirements.txt ./requirements.txt; \
      cp -r /tmp/build/backend/. ./; \
    else \
      cp /tmp/build/requirements.txt ./requirements.txt; \
      cp -r /tmp/build/. ./; \
    fi \
    && rm -rf /tmp/build \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Coleta arquivos estaticos
RUN python manage.py collectstatic --noinput || true

EXPOSE 7860 8080 8000

# Healthcheck para Hugging Face Spaces / Railway / Docker Compose
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f -L http://localhost:${PORT:-8000}/health || curl -f -L http://localhost:8080/health || curl -f -L http://localhost:7860/health || exit 1

# Executa Gunicorn com Uvicorn workers suportando porta 8000 por padrão, e $PORT no Hugging Face (7860) / Railway
CMD ["sh", "-c", "BIND_PORT=\"${PORT:-8000}\"; exec gunicorn app.asgi:application -w ${WORKERS:-1} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${BIND_PORT} --forwarded-allow-ips '*' --timeout 120 --graceful-timeout 30 --access-logfile -"]
