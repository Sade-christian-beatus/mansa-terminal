"""
MANSA Terminal — Cache Redis
Client async singleton pour le cache des réponses AI et autres ressources fréquentes.
"""
import hashlib
import json
import logging
from typing import Any

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis | None:
    """Retourne le client Redis singleton. Retourne None si Redis est indisponible."""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await _redis_client.ping()
        except Exception as exc:
            logger.warning("Redis indisponible — cache désactivé : %s", exc)
            _redis_client = None
    return _redis_client


async def cache_get(key: str) -> Any | None:
    """Récupère une valeur du cache. Retourne None si absent ou erreur."""
    client = await get_redis()
    if not client:
        return None
    try:
        raw = await client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Stocke une valeur en cache avec TTL en secondes."""
    client = await get_redis()
    if not client:
        return
    try:
        await client.setex(key, ttl, json.dumps(value, ensure_ascii=False))
    except Exception:
        pass


def make_ai_cache_key(question: str, plan: str) -> str:
    """Clé de cache pour une réponse AI : hash(question+plan)."""
    payload = f"ai_v1:{plan}:{question.strip().lower()}"
    return "mansa:ai:" + hashlib.sha256(payload.encode()).hexdigest()
