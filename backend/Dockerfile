# Dockerfile de Produção para o Backend Django (ASGI / Daphne)
FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=app.settings.production

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

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Coleta arquivos estáticos
RUN python manage.py collectstatic --noinput || true

EXPOSE 7860

# Healthcheck para Hugging Face Spaces / Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-7860}/health || exit 1

# Executa o Gunicorn com workers Uvicorn ASGI (3 workers paralelos para balancear carga e WebSockets)
CMD ["sh", "-c", "gunicorn app.asgi:application -w ${WEB_CONCURRENCY:-3} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-7860} --timeout 120 --access-logfile -"]
