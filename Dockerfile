# Dockerfile de Producao na raiz do monorepo (Python 3.12 - VPS Docker Swarm / GHCR)
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=app.settings.production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Dependencias nativas para PostgreSQL, FFmpeg (audio), LibreOffice/Poppler (Hub WebP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libpq-dev \
    curl \
    ffmpeg \
    libreoffice \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Instala dependencias Python aproveitando cache de camadas do Docker
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium \
    && chmod -R 755 /ms-playwright \
    && rm -rf /var/lib/apt/lists/*

# Copia o codigo do backend
COPY backend/ ./

# Garante quebras de linha LF (Unix) e permissao de execucao nos entrypoints
RUN sed -i 's/\r$//' /app/entrypoint.sh /app/worker-entrypoint.sh \
    && chmod +x /app/entrypoint.sh /app/worker-entrypoint.sh \
    && mkdir -p /app/media /app/staticfiles

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "app.asgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--timeout", "120", "--graceful-timeout", "30", "--keep-alive", "5", "--forwarded-allow-ips", "*", "--access-logfile", "-", "--error-logfile", "-"]
