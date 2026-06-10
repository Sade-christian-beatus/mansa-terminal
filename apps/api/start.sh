#!/bin/sh
# MANSA Terminal — Script de démarrage Render
# 1. Migrations Alembic  2. Démarrage API (1 worker — Render Free 512MB)

echo "=== MANSA Terminal startup ==="
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo 'NO — set it in Railway Variables')"
echo "DATABASE_URL_SYNC set: $([ -n "$DATABASE_URL_SYNC" ] && echo yes || echo 'not set — using DATABASE_URL fallback')"
echo "APP_ENV: ${APP_ENV:-development}"
echo "PORT: ${PORT:-8000}"

# Vérifier que DATABASE_URL_SYNC pointe sur le Supabase Session Pooler (port 6543)
# et non la connexion directe (port 5432, IPv6 → Network unreachable sur Railway)
_DB_SYNC="${DATABASE_URL_SYNC:-$DATABASE_URL}"
if echo "$_DB_SYNC" | grep -q ":5432/"; then
    echo "WARNING: DATABASE_URL_SYNC uses port 5432 (direct connection)."
    echo "  Railway needs the Supabase Session Pooler on port 6543 (IPv4)."
    echo "  Supabase Dashboard → Settings → Database → Connection pooling → Session mode"
    echo "  Expected format: postgresql://postgres.xxx:[PWD]@aws-0-region.pooler.supabase.com:6543/postgres"
fi

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
