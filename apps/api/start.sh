#!/bin/sh
# MANSA Terminal — Script de démarrage Render
# La migration Alembic est gérée par releaseCommand dans render.yaml
# (s'exécute avant le restart du service — pas ici pour eviter le doublon).

set -e

echo "Starting MANSA API (1 worker - Render Free)..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --timeout-keep-alive 75
