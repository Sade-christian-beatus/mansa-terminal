#!/bin/sh
# MANSA Terminal — Script de démarrage Railway
# 1. Migrations Alembic  2. Démarrage API

set -e

echo "🔄 Applying database migrations..."
alembic upgrade head
echo "✅ Migrations done"

echo "🚀 Starting MANSA API..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 2 \
  --proxy-headers \
  --forwarded-allow-ips="*"
