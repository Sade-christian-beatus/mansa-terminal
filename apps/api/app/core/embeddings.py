"""
MANSA Terminal — Service d'embeddings (RAG sémantique)

Fournit les vecteurs OpenAI text-embedding-3-small (1536 dim) pour la recherche
sémantique sur la knowledge base. Dégradation gracieuse : si OPENAI_API_KEY est
absente ou que l'appel échoue, les fonctions renvoient None et l'appelant retombe
sur la recherche par country_id (voir ai_analyst.get_relevant_context).
"""
import logging

from app.core.config import settings

log = logging.getLogger("embeddings")

_client = None
_client_failed = False


def embeddings_enabled() -> bool:
    """True si une clé OpenAI est configurée (le RAG sémantique est alors actif)."""
    return bool(settings.OPENAI_API_KEY)


def _get_client():
    """Instancie (paresseusement) le client OpenAI ; None si indisponible."""
    global _client, _client_failed
    if _client is not None:
        return _client
    if _client_failed or not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import AsyncOpenAI
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return _client
    except Exception as e:  # pragma: no cover — dépend de l'install
        log.warning("Client OpenAI indisponible (embeddings désactivés) : %s", e)
        _client_failed = True
        return None


async def embed_text(text: str) -> list[float] | None:
    """Retourne l'embedding du texte, ou None si les embeddings sont indisponibles."""
    client = _get_client()
    if client is None or not text.strip():
        return None
    try:
        resp = await client.embeddings.create(
            model=settings.EMBEDDING_MODEL,
            input=text[:8000],  # ~8k chars ≈ marge sous la limite de tokens
        )
        return resp.data[0].embedding
    except Exception as e:
        log.warning("Échec de génération d'embedding : %s", e)
        return None


def to_pgvector_literal(vec: list[float]) -> str:
    """Sérialise un vecteur Python en littéral pgvector : '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"
