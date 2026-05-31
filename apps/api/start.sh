#!/bin/sh
# MANSA Terminal — Script de démarrage Render
# 1. Migrations Alembic  2. Démarrage API (1 worker — Render Free 512MB)

echo "=== MANSA Terminal startup ==="
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo 'NO — set it in Railway Variables')"
echo "APP_ENV: ${APP_ENV:-development}"
echo "PORT: ${PORT:-8000}"

echo "Applying database migrations..."
if alembic upgrade head; then
    echo "Migrations OK"
else
    if [ "${APP_ENV:-development}" = "production" ]; then
        echo "ERROR: Migrations failed in production — aborting"
        exit 1
    else
        echo "WARNING: Migrations failed — starting API anyway (dev mode)"
    fi
fi

echo "Starting MANSA API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --timeout-keep-alive 75
