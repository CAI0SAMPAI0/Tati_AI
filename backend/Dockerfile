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

COPY requirements.txt* backend/requirements.txt* ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Se o build context foi a raiz (/), move o conteudo de backend/ para /app
RUN if [ -d "backend/app" ]; then \
      cp -r backend/. . && rm -rf backend; \
    fi

# Coleta arquivos estáticos
RUN python manage.py collectstatic --noinput || true

EXPOSE 8080

# Healthcheck para Railway / HF Spaces
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f -L http://localhost:${PORT:-8080}/health || exit 1

# Executa Gunicorn com Uvicorn workers na porta configurada pelo Railway ($PORT ou 8080)
CMD ["sh", "-c", "gunicorn app.asgi:application -w ${WORKERS:-2} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8080} --forwarded-allow-ips '*' --timeout 120 --graceful-timeout 30 --access-logfile -"]
