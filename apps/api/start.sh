#!/bin/sh
# MANSA Terminal — Script de démarrage Railway/Render
# 1. Réparation chaîne Alembic  2. Migrations  3. Démarrage API

echo "=== MANSA Terminal startup ==="
echo "DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo 'NO — set it in Railway Variables')"
echo "APP_ENV: ${APP_ENV:-development}"
echo "PORT: ${PORT:-8000}"

# ── Réparation préventive de la chaîne Alembic ───────────────────────────────
# Handles two known failure modes:
#   1. DB still holds old revision ID "0003_pgvector_knowledge_embeddings"
#      (renamed to "0003_add_pgvector" in commit bad4e9f)
#   2. DB is at "0004_api_keys" but that revision wasn't in the deployed image
#      (fixed by adding 0004_api_keys.py back to the chain)
echo "Running Alembic chain repair..."
python - <<'PYEOF'
import os, sys

db_url = os.environ.get("DATABASE_URL_SYNC") or ""
if not db_url:
    # Derive sync URL from async DATABASE_URL
    db_url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")

if not db_url:
    print("WARNING: no DATABASE_URL — skipping repair")
    sys.exit(0)

try:
    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    # Repair 1: rename old revision ID
    cur.execute(
        "UPDATE alembic_version SET version_num = '0003_add_pgvector' "
        "WHERE version_num = '0003_pgvector_knowledge_embeddings'"
    )
    if cur.rowcount:
        print("Repaired: renamed 0003_pgvector_knowledge_embeddings → 0003_add_pgvector")

    conn.close()
    print("Repair step OK")
except Exception as exc:
    print(f"Repair step warning (non-fatal): {exc}")
PYEOF

# ── Migrations Alembic ────────────────────────────────────────────────────────
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

# ── Démarrage API ─────────────────────────────────────────────────────────────
echo "Starting MANSA API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --timeout-keep-alive 75
