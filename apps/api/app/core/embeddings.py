"""
MANSA Terminal — Utilitaire d'embeddings pour le RAG sémantique.

Fournit `embed_text()` qui génère un vecteur 1536-dim via Voyage AI
(l'API d'embedding d'Anthropic). Retourne None si la clé n'est pas
configurée ou si l'appel échoue — le code appelant doit gérer le fallback
vers la recherche par country_id.

Configuration :
    VOYAGE_API_KEY=  (dans .env)  — optionnel pour la Phase 2 RAG
    VOYAGE_MODEL=voyage-3 (défaut)
"""
import json
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
_VOYAGE_MODEL = getattr(settings, "VOYAGE_MODEL", "voyage-3")
_VOYAGE_DIM = 1536


async def embed_text(text: str) -> Optional[list[float]]:
    """
    Génère un embedding pour `text` via Voyage AI.
    Retourne None si VOYAGE_API_KEY n'est pas définie ou si l'appel échoue.
    """
    api_key = getattr(settings, "VOYAGE_API_KEY", None)
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _VOYAGE_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                content=json.dumps({"model": _VOYAGE_MODEL, "input": [text[:8_000]]}),
            )
            resp.raise_for_status()
            data = resp.json()
            return data["data"][0]["embedding"]
    except Exception as exc:
        logger.warning("Voyage AI embedding échoué : %s", exc)
        return None
