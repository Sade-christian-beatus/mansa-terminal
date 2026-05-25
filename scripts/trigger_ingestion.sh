#!/usr/bin/env bash
# ============================================================
# MANSA Terminal — Déclenche le pipeline d'ingestion manuellement
# Nécessite : gh CLI installé + authentifié (gh auth login)
#
# Usage :
#   bash scripts/trigger_ingestion.sh            # les deux sources
#   bash scripts/trigger_ingestion.sh imf        # IMF WEO uniquement
#   bash scripts/trigger_ingestion.sh worldbank  # World Bank uniquement
#   bash scripts/trigger_ingestion.sh both true  # dry-run
# ============================================================

set -euo pipefail

SOURCE="${1:-both}"
DRY_RUN="${2:-false}"
REPO="${GITHUB_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')}"

if [ -z "$REPO" ]; then
  echo "ERROR: Impossible de détecter le repo. Exporter GITHUB_REPO=owner/repo"
  exit 1
fi

echo "Déclenchement du pipeline d'ingestion MANSA Data..."
echo "  Repo    : ${REPO}"
echo "  Source  : ${SOURCE}"
echo "  Dry-run : ${DRY_RUN}"
echo ""

gh workflow run data-ingest.yml \
  --repo "$REPO" \
  --field source="$SOURCE" \
  --field dry_run="$DRY_RUN"

echo "Workflow déclenché. Suivre la progression :"
echo "  https://github.com/${REPO}/actions/workflows/data-ingest.yml"
