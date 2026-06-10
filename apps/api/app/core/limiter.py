"""
MANSA Terminal — Rate Limiter
Configuration par route : protection API production.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],   # Limite globale par défaut
    storage_uri="memory://",         # Redis en production: REDIS_URL
)

# ── Limites spécifiques par type de route ────────────────────────────────────
# Usage : @limiter.limit(LIMIT_AI) sur le router
LIMIT_AUTH       = "10/minute"    # Login/register — brute-force protection
LIMIT_AI         = "20/hour"      # Appels Claude — coût tokens élevé
LIMIT_MACRO      = "120/minute"   # Données macro — lecture intensive
LIMIT_MARKETS    = "60/minute"    # FX + indices — cache déjà actif
LIMIT_NEWS       = "30/minute"    # RSS feed — cache 30 min actif
LIMIT_ALERTS     = "60/minute"    # Alertes — lecture rapide
LIMIT_EXPORT     = "20/hour"      # Export — opération lourde
LIMIT_CONFLICTS  = "60/minute"    # ACLED — données statiques
