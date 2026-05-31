#!/bin/sh
# MANSA Terminal — Script de démarrage Railway
# 1. Migrations Alembic (non-fatales)  2. Démarrage API

set -e

echo "=== MANSA Terminal startup ==="
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO — check Railway env vars)"
echo "PORT: ${PORT:-8000}"

echo "Applying database migrations..."
if alembic upgrade head; then
    echo "Migrations OK"
else
    echo "WARNING: Migrations failed — starting API anyway (check DB connection)"
fi

echo "Starting MANSA API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 2 \
  --proxy-headers \
  --forwarded-allow-ips="*"
