#!/bin/sh
# MANSA Terminal — Script de démarrage Render
# 1. Migrations Alembic  2. Démarrage API (1 worker — Render Free 512MB)

set -e

echo "🔄 Applying database migrations..."
alembic upgrade head
echo "✅ Migrations done"

echo "🚀 Starting MANSA API..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --timeout-keep-alive 75
