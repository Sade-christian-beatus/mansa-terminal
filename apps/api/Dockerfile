# ============================================================
# MANSA Terminal — API Dockerfile
# Multi-stage build : dev léger, prod optimisé
# ============================================================

FROM python:3.12-slim as base

WORKDIR /app

# Dépendances système
RUN apt-get update && apt-get install -y \
    curl libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Dev stage ----
FROM base as development
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ---- Production stage ----
FROM base as production

# Créer utilisateur non-root avant la copie
RUN adduser --disabled-password --gecos "" --shell /bin/false mansa

COPY --chown=mansa:mansa . .

RUN chmod +x start.sh

USER mansa

CMD ["sh", "start.sh"]

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
