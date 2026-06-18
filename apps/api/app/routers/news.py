"""
MANSA Terminal — Router News
Flux RSS agrégé depuis IMF Blog, World Bank Africa, AllAfrica
Cache Redis 30 minutes — fallback articles statiques si toutes les sources tombent
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Sources RSS publiques ────────────────────────────────────────────────────
RSS_SOURCES = [
    {
        "name": "IMF Blog",
        "url": "https://www.imf.org/en/News/Rss",
        "category": "macro",
        "region": "Global",
    },
    {
        "name": "World Bank Africa",
        "url": "https://blogs.worldbank.org/africacan/rss.xml",
        "category": "développement",
        "region": "Afrique",
    },
    {
        "name": "AllAfrica",
        "url": "https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf",
        "category": "actualité",
        "region": "Afrique",
    },
]

# ── Articles de repli (si toutes les sources RSS sont indisponibles) ─────────
FALLBACK_ARTICLES = [
    {
        "id": "f1",
        "title": "FMI révise à la hausse ses prévisions de croissance pour l'Afrique subsaharienne",
        "summary": "Le FMI anticipe une croissance de 4,2% en 2025 pour l'Afrique subsaharienne, portée par la reprise des économies d'Afrique de l'Est.",
        "source": "FMI WEO",
        "category": "macro",
        "region": "Afrique subsaharienne",
        "published_at": "2025-04-15T09:00:00Z",
        "url": "#",
        "is_featured": True,
        "is_demo": True,
    },
    {
        "id": "f2",
        "title": "AfCFTA : le commerce intra-africain progresse de 18% en 2024",
        "summary": "La Zone de libre-échange continentale africaine produit ses premiers effets mesurables sur les flux commerciaux entre pays membres.",
        "source": "Banque Mondiale",
        "category": "commerce",
        "region": "Afrique",
        "published_at": "2025-04-12T14:00:00Z",
        "url": "#",
        "is_featured": True,
        "is_demo": True,
    },
    {
        "id": "f3",
        "title": "Sénégal : le déficit budgétaire réduit à 7,5% du PIB en 2024",
        "summary": "Les nouvelles autorités sénégalaises publient leurs premières données fiscales officielles après l'audit du FMI.",
        "source": "Ministère des Finances",
        "category": "fiscal",
        "region": "Afrique de l'Ouest",
        "published_at": "2025-04-10T10:30:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
    {
        "id": "f4",
        "title": "Kenya : la Bourse de Nairobi enregistre sa meilleure semaine depuis 2 ans",
        "summary": "L'indice NSE All Share gagne 3,2% sur la semaine, porté par les valeurs bancaires et télécoms.",
        "source": "NSE / Bloomberg",
        "category": "marchés",
        "region": "Afrique de l'Est",
        "published_at": "2025-04-09T16:00:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
    {
        "id": "f5",
        "title": "Nigeria : la Banque centrale relève son taux directeur à 27,5%",
        "summary": "La CBN poursuit son cycle de hausse de taux pour ancrer les anticipations d'inflation et soutenir le naira.",
        "source": "CBN",
        "category": "monétaire",
        "region": "Afrique de l'Ouest",
        "published_at": "2025-04-08T11:00:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
    {
        "id": "f6",
        "title": "Énergie renouvelable : l'Afrique attire 15 Mds USD d'investissements en 2024",
        "summary": "Les projets solaires et éoliens dominent les flux d'IDE verts vers le continent africain.",
        "source": "IRENA",
        "category": "énergie",
        "region": "Afrique",
        "published_at": "2025-04-07T08:00:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
    {
        "id": "f7",
        "title": "Sécheresse au Sahel : 4 pays en situation d'urgence alimentaire",
        "summary": "L'IPC classe le Mali, le Niger, le Burkina Faso et le Tchad en phase 3-4 de la classification de sécurité alimentaire.",
        "source": "IPC / FAO",
        "category": "climat",
        "region": "Sahel",
        "published_at": "2025-04-06T09:30:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
    {
        "id": "f8",
        "title": "M-Pesa franchit le cap des 60 millions d'utilisateurs actifs",
        "summary": "Le service de mobile money de Safaricom continue son expansion en Afrique de l'Est, avec de nouveaux services de crédit numérique.",
        "source": "Safaricom",
        "category": "fintech",
        "region": "Afrique de l'Est",
        "published_at": "2025-04-05T13:00:00Z",
        "url": "#",
        "is_featured": False,
        "is_demo": True,
    },
]

# ── Cache en mémoire simple (TTL 30 min) ────────────────────────────────────
_news_cache: dict = {"articles": None, "fetched_at": None}
CACHE_TTL_SECONDS = 1800


def _parse_rss_item(item: dict, source_meta: dict) -> Optional[dict]:
    """Transforme un item feedparser en article MANSA normalisé."""
    try:
        import feedparser  # type: ignore
        title = item.get("title", "").strip()
        link = item.get("link", "#")
        summary = item.get("summary", item.get("description", "")).strip()
        # Nettoyer les balises HTML basiques
        import re
        summary = re.sub(r"<[^>]+>", " ", summary)
        summary = re.sub(r"\s+", " ", summary).strip()[:400]

        published = None
        if item.get("published_parsed"):
            try:
                import time
                published = datetime(
                    *item["published_parsed"][:6], tzinfo=timezone.utc
                ).isoformat()
            except Exception:
                pass

        if not title or not link:
            return None

        return {
            "id": f"rss-{abs(hash(link))}",
            "title": title[:200],
            "summary": summary or title,
            "source": source_meta["name"],
            "category": source_meta["category"],
            "region": source_meta["region"],
            "published_at": published or datetime.now(timezone.utc).isoformat(),
            "url": link,
            "is_featured": False,
            "is_demo": False,
        }
    except Exception:
        return None


async def _fetch_rss_source(source: dict, client: httpx.AsyncClient) -> list[dict]:
    """Récupère et parse un flux RSS en async."""
    try:
        import feedparser  # type: ignore
        resp = await client.get(source["url"], timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        articles = []
        for entry in feed.entries[:10]:
            art = _parse_rss_item(entry, source)
            if art:
                articles.append(art)
        return articles
    except Exception as exc:
        logger.warning("Flux RSS indisponible %s: %s", source["url"], exc)
        return []


async def _fetch_all_news(limit: int) -> tuple[list[dict], bool]:
    """
    Retourne (articles, is_live).
    Essaie d'abord le cache, puis les flux RSS, puis le fallback statique.
    """
    now = datetime.now(timezone.utc).timestamp()

    # Cache valide ?
    if (
        _news_cache["articles"] is not None
        and _news_cache["fetched_at"] is not None
        and now - _news_cache["fetched_at"] < CACHE_TTL_SECONDS
    ):
        return _news_cache["articles"][:limit], True

    # Tenter de fetcher les flux RSS
    try:
        import feedparser  # noqa — vérifier la disponibilité
        async with httpx.AsyncClient(
            headers={"User-Agent": "MANSA-Terminal/2.0 (+https://mansaterminal.com)"},
            timeout=10.0,
        ) as client:
            tasks = [_fetch_rss_source(src, client) for src in RSS_SOURCES]
            results = await asyncio.gather(*tasks, return_exceptions=True)

        articles: list[dict] = []
        for res in results:
            if isinstance(res, list):
                articles.extend(res)

        if articles:
            # Trier par date décroissante
            articles.sort(key=lambda a: a.get("published_at", ""), reverse=True)
            # Marquer les 2 premiers comme featured
            for i, art in enumerate(articles[:2]):
                art["is_featured"] = True

            _news_cache["articles"] = articles
            _news_cache["fetched_at"] = now
            return articles[:limit], True

    except ImportError:
        logger.warning("feedparser non installé — utilisation du fallback statique")
    except Exception as exc:
        logger.warning("Erreur fetch RSS: %s", exc)

    # Fallback statique
    return FALLBACK_ARTICLES[:limit], False


@router.get("/feed")
async def get_news_feed(
    current_user: Annotated[User, Depends(require_active_subscription)],
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None),
):
    """
    Flux d'actualités agrégé (IMF, Banque Mondiale, AllAfrica).
    Mise en cache 30 minutes — fallback articles statiques si indisponible.
    """
    articles, is_live = await _fetch_all_news(limit * 2)

    if category:
        articles = [a for a in articles if a.get("category", "").lower() == category.lower()]

    return {
        "articles": articles[:limit],
        "total": len(articles),
        "is_live": is_live,
        "source": "RSS aggregation" if is_live else "Données de démonstration",
        "cache_ttl_minutes": CACHE_TTL_SECONDS // 60,
    }
