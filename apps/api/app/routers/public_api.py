"""
MANSA Terminal — Public API v1
Endpoints accessibles via clé d'API (Bearer mansa_xxx) pour usage programmatique.
Destiné aux économistes, data scientists, instituts de recherche.

Authentification : Authorization: Bearer mansa_<token>
Scopes disponibles : read:macro, read:countries, read:fx, read:climate
"""
import hashlib
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_active_user
from app.core.limiter import limiter
from app.models.models import APIKey, Country, FXRate, MacroIndicator, Subscription, User

router = APIRouter()

# Timestamp de démarrage pour le calcul d'uptime
_SERVER_START_TIME = time.time()
API_VERSION = "1.0.0"


def _add_sla_headers(response: Response, *, limit: int, window_seconds: int = 60) -> None:
    """Injecte les headers SLA standard dans chaque réponse de l'API publique."""
    reset_ts = int(time.time()) + window_seconds
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Reset"] = str(reset_ts)
    response.headers["X-RateLimit-Window"] = f"{window_seconds}s"
    response.headers["X-API-Version"] = API_VERSION


# ── Constantes ──────────────────────────────────────────────────────────────
KEY_PREFIX = "mansa_"
MAX_KEYS_PER_USER = 5
ALL_SCOPES = ["read:macro", "read:countries", "read:fx", "read:climate"]


# ── Schémas ─────────────────────────────────────────────────────────────────
class CreateKeyRequest(BaseModel):
    name: str
    scopes: list[str] = ALL_SCOPES
    expires_days: Optional[int] = None  # None = pas d'expiration


class APIKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: list[str]
    last_used_at: Optional[str]
    expires_at: Optional[str]
    is_active: bool
    created_at: str


class APIKeyCreatedResponse(APIKeyResponse):
    full_key: str  # Affiché une seule fois à la création


# ── Helper : hash d'une clé brute ────────────────────────────────────────────
def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ── Dépendance : authentification par clé d'API ─────────────────────────────
async def get_api_key_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> tuple[User, APIKey]:
    """
    Vérifie un Bearer token de type mansa_xxx.
    Retourne (User, APIKey) ou lève 401.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Clé d'API manquante (Authorization: Bearer mansa_xxx)")
    raw_key = auth[7:]
    if not raw_key.startswith(KEY_PREFIX):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Format de clé invalide")

    key_hash = _hash_key(raw_key)
    result = await db.execute(
        select(APIKey).where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True,
        )
    )
    api_key = result.scalar_one_or_none()

    if not api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Clé d'API invalide ou révoquée")

    if api_key.expires_at and api_key.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Clé d'API expirée")

    # Récupérer l'utilisateur
    user_result = await db.execute(select(User).where(User.id == api_key.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Compte utilisateur inactif")

    # Vérifier l'abonnement actif
    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == user.id,
            Subscription.status.in_(["trialing", "active"]),
        )
    )
    if not sub_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail="Abonnement requis pour utiliser l'API")

    # Mettre à jour last_used_at (sans bloquer la requête si ça rate)
    try:
        await db.execute(
            update(APIKey)
            .where(APIKey.id == api_key.id)
            .values(last_used_at=datetime.now(timezone.utc))
        )
        await db.commit()
    except Exception:
        pass

    return user, api_key


def _require_scope(api_key: APIKey, scope: str) -> None:
    if scope not in (api_key.scopes or []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Scope requis : {scope}. Clés actuelles : {api_key.scopes}",
        )


# ═══════════════════════════════════════════════════════════════
#  GESTION DES CLÉS (auth par session JWT Supabase)
# ═══════════════════════════════════════════════════════════════

@router.get("/keys", response_model=list[APIKeyResponse], tags=["API Keys"])
async def list_api_keys(
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Liste les clés d'API de l'utilisateur connecté."""
    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == current_user.id, APIKey.is_active == True)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        APIKeyResponse(
            id=str(k.id),
            name=k.name,
            key_prefix=k.key_prefix,
            scopes=k.scopes or [],
            last_used_at=k.last_used_at.isoformat() if k.last_used_at else None,
            expires_at=k.expires_at.isoformat() if k.expires_at else None,
            is_active=k.is_active,
            created_at=k.created_at.isoformat(),
        )
        for k in keys
    ]


@router.post("/keys", response_model=APIKeyCreatedResponse, status_code=201, tags=["API Keys"])
@limiter.limit("10/hour")
async def create_api_key(
    request: Request,
    body: CreateKeyRequest,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Crée une nouvelle clé d'API.
    La clé complète est retournée **une seule fois** — sauvegardez-la immédiatement.
    """
    # Vérifier la limite par utilisateur
    count_result = await db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id, APIKey.is_active == True)
    )
    existing = count_result.scalars().all()
    if len(existing) >= MAX_KEYS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_KEYS_PER_USER} clés actives par utilisateur",
        )

    # Valider les scopes
    invalid = [s for s in body.scopes if s not in ALL_SCOPES]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scopes invalides : {invalid}. Valides : {ALL_SCOPES}",
        )

    # Générer la clé
    raw_key = KEY_PREFIX + secrets.token_hex(24)   # mansa_ + 48 hex chars
    key_hash = _hash_key(raw_key)
    key_prefix = raw_key[:12]                       # "mansa_xxxxxx"

    expires_at = None
    if body.expires_days:
        from datetime import timedelta
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    api_key = APIKey(
        user_id=current_user.id,
        name=body.name[:100],
        key_hash=key_hash,
        key_prefix=key_prefix,
        scopes=body.scopes,
        expires_at=expires_at,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return APIKeyCreatedResponse(
        id=str(api_key.id),
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes or [],
        full_key=raw_key,
        last_used_at=None,
        expires_at=api_key.expires_at.isoformat() if api_key.expires_at else None,
        is_active=True,
        created_at=api_key.created_at.isoformat(),
    )


@router.delete("/keys/{key_id}", status_code=204, tags=["API Keys"])
async def revoke_api_key(
    key_id: str,
    current_user: Annotated[User, Depends(get_current_active_user)],
    db: AsyncSession = Depends(get_db),
):
    """Révoque (désactive) une clé d'API."""
    import uuid as _uuid
    try:
        key_uuid = _uuid.UUID(key_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de clé invalide")

    result = await db.execute(
        select(APIKey).where(APIKey.id == key_uuid, APIKey.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Clé introuvable")

    key.is_active = False
    await db.commit()


# ═══════════════════════════════════════════════════════════════
#  ENDPOINTS DE DONNÉES PUBLICS (auth par clé d'API)
# ═══════════════════════════════════════════════════════════════

@router.get("/v1/status", tags=["Public Data"])
async def public_status(response: Response):
    """
    Statut de l'API MANSA Terminal.

    Retourne la version, l'uptime et les limites de débit pour chaque endpoint.
    Ne nécessite pas d'authentification.
    """
    uptime_seconds = int(time.time() - _SERVER_START_TIME)
    hours, rem = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    response.headers["X-API-Version"] = API_VERSION
    return {
        "status": "ok",
        "version": API_VERSION,
        "uptime": f"{hours}h {minutes}m {seconds}s",
        "uptime_seconds": uptime_seconds,
        "rate_limits": {
            "GET /v1/countries":   "120 req/min",
            "GET /v1/indicators":  "60 req/min",
            "GET /v1/fx":          "60 req/min",
            "GET /v1/status":      "300 req/min (no auth)",
        },
        "docs": "/docs",
        "data_coverage": "54 African countries · IMF WEO · World Bank WDI",
    }


@router.get("/v1/countries", tags=["Public Data"])
@limiter.limit("120/minute")
async def public_countries(
    request: Request,
    response: Response,
    auth: Annotated[tuple, Depends(get_api_key_user)],
    db: AsyncSession = Depends(get_db),
    region: Optional[str] = Query(None),
):
    """
    Liste des 54 pays africains avec métadonnées.

    **Authentification** : `Authorization: Bearer mansa_xxx`

    Exemple Python :
    ```python
    import requests
    r = requests.get("https://api.mansa.ai/v1/countries",
                     headers={"Authorization": "Bearer mansa_xxx"})
    ```
    """
    user, api_key = auth
    _require_scope(api_key, "read:countries")
    _add_sla_headers(response, limit=120)

    q = select(Country).where(Country.is_active == True)
    if region:
        q = q.where(Country.region == region)
    q = q.order_by(Country.coverage_tier, Country.name_en)
    result = await db.execute(q)
    countries = result.scalars().all()
    return [
        {
            "id": c.id, "iso2": c.iso2,
            "name_en": c.name_en, "name_fr": c.name_fr,
            "region": c.region, "sub_region": c.sub_region,
            "currency_code": c.currency_code,
            "coverage_tier": c.coverage_tier,
            "is_waemu": c.is_waemu, "is_cemac": c.is_cemac,
        }
        for c in countries
    ]


@router.get("/v1/indicators", tags=["Public Data"])
@limiter.limit("60/minute")
async def public_indicators(
    request: Request,
    response: Response,
    auth: Annotated[tuple, Depends(get_api_key_user)],
    db: AsyncSession = Depends(get_db),
    countries: str = Query(..., description="Codes ISO3 séparés par virgule. Ex: NGA,KEN,SEN"),
    indicators: Optional[str] = Query(None, description="Codes indicateurs. Ex: NGDP_RPCH,PCPIPCH"),
    from_year: int = Query(2015, ge=1990, le=2030),
    to_year: int = Query(2025, ge=1990, le=2030),
    format: str = Query("json", enum=["json", "csv"]),
):
    """
    Données macro-fiscales pour 1–10 pays africains.

    **Exemples d'indicateurs** :
    - `NGDP_RPCH` — Croissance du PIB réel (%)
    - `PCPIPCH` — Inflation IPC (%)
    - `GGXWDG_NGDP` — Dette publique (% PIB)
    - `GGXCNL_NGDP` — Solde budgétaire (% PIB)
    - `BCA_NGDPD` — Compte courant (% PIB)
    - `NGDPDPC` — PIB par habitant (USD)

    **Exemple R** :
    ```r
    library(httr2)
    req <- request("https://api.mansa.ai/v1/indicators") |>
      req_headers(Authorization = "Bearer mansa_xxx") |>
      req_url_query(countries = "NGA,KEN", from_year = 2015, to_year = 2024)
    resp <- req_perform(req)
    df <- resp_body_json(resp)
    ```
    """
    user, api_key = auth
    _require_scope(api_key, "read:macro")
    _add_sla_headers(response, limit=60)

    country_list = [c.strip().upper() for c in countries.split(",") if c.strip()][:10]
    if not country_list:
        raise HTTPException(status_code=400, detail="Au moins un pays requis")

    indicator_list = None
    if indicators:
        indicator_list = [i.strip().upper() for i in indicators.split(",") if i.strip()][:30]

    q = select(MacroIndicator).where(
        MacroIndicator.country_id.in_(country_list),
        MacroIndicator.period >= str(from_year),
        MacroIndicator.period <= str(to_year),
    )
    if indicator_list:
        q = q.where(MacroIndicator.indicator_code.in_(indicator_list))
    q = q.order_by(MacroIndicator.country_id, MacroIndicator.indicator_code, MacroIndicator.period)
    q = q.limit(5000)

    result = await db.execute(q)
    rows = result.scalars().all()

    data = [
        {
            "country_id": r.country_id,
            "indicator_code": r.indicator_code,
            "indicator_name": r.indicator_name,
            "period": r.period,
            "value": r.value,
            "unit": r.unit,
            "source": r.source,
        }
        for r in rows
    ]

    if format == "csv":
        import io, csv
        from fastapi.responses import StreamingResponse
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["country_id", "indicator_code", "indicator_name", "period", "value", "unit", "source"])
        writer.writeheader()
        writer.writerows(data)
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=mansa_data.csv"},
        )

    return {
        "data": data,
        "meta": {
            "countries": country_list,
            "indicators": indicator_list,
            "from_year": from_year,
            "to_year": to_year,
            "total_rows": len(data),
            "source": "MANSA Terminal — IMF WEO + World Bank WDI",
        },
    }


@router.get("/v1/fx", tags=["Public Data"])
@limiter.limit("60/minute")
async def public_fx(
    request: Request,
    response: Response,
    auth: Annotated[tuple, Depends(get_api_key_user)],
    db: AsyncSession = Depends(get_db),
    countries: Optional[str] = Query(None, description="Codes ISO3 séparés par virgule"),
    from_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    to_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
):
    """Taux de change (USD) — officiels et parallèles quand disponibles."""
    user, api_key = auth
    _require_scope(api_key, "read:fx")
    _add_sla_headers(response, limit=60)

    q = select(FXRate)
    if countries:
        country_list = [c.strip().upper() for c in countries.split(",") if c.strip()][:10]
        q = q.where(FXRate.country_id.in_(country_list))
    if from_date:
        q = q.where(FXRate.date >= from_date)
    if to_date:
        q = q.where(FXRate.date <= to_date)
    q = q.order_by(FXRate.country_id, FXRate.date.desc()).limit(2000)

    result = await db.execute(q)
    rows = result.scalars().all()
    return {
        "data": [
            {
                "country_id": r.country_id,
                "base_currency": r.base_currency,
                "quote_currency": r.quote_currency,
                "rate_official": r.rate_official,
                "rate_parallel": r.rate_parallel,
                "spread_pct": r.spread_pct,
                "date": r.date.isoformat() if r.date else None,
                "source": r.source,
            }
            for r in rows
        ],
        "meta": {"total_rows": len(rows)},
    }
