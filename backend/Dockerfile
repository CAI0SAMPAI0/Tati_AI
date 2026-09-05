# Dockerfile de Produção para o Backend Django (ASGI / Gunicorn + Uvicorn Workers)
FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=app.settings.production \
    WORKERS=2

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

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Coleta arquivos estáticos
RUN python manage.py collectstatic --noinput || true

EXPOSE 7860 8080

# Healthcheck para Hugging Face Spaces / Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f -L http://localhost:${PORT:-7860}/health || curl -f -L http://localhost:8080/health || exit 1

# Executa Gunicorn com Uvicorn workers suportando Hugging Face Spaces (7860) e Railway/Docker Compose ($PORT ou 8080)
CMD ["sh", "-c", "BIND_ARGS=\"-b 0.0.0.0:7860\"; if [ -n \"$PORT\" ] && [ \"$PORT\" != \"7860\" ]; then BIND_ARGS=\"-b 0.0.0.0:${PORT} -b 0.0.0.0:7860\"; elif [ -z \"$PORT\" ]; then BIND_ARGS=\"-b 0.0.0.0:7860 -b 0.0.0.0:8080\"; fi; exec gunicorn app.asgi:application -w ${WORKERS:-2} -k uvicorn.workers.UvicornWorker $BIND_ARGS --forwarded-allow-ips '*' --timeout 120 --graceful-timeout 30 --access-logfile -"]
