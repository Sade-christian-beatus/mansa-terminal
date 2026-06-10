"""
MANSA Terminal — Router Markets (Phase 2)
Taux de change temps réel via Frankfurter (ECB), indices boursiers africains
"""
import logging
from datetime import date, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, FXRate, Country

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Cache FX en mémoire (TTL 15 min) ────────────────────────────────────────
_fx_cache: dict = {"data": None, "fetched_at": None}
FX_CACHE_TTL = 900  # 15 minutes

# ── Données statiques de référence (fallback si DB vide) ─────────────────────

CURRENCIES_META = [
    {"code": "XOF", "name": "Franc CFA UEMOA", "countries": ["SEN","CIV","MLI","BFA","NER","TGO","BEN","GNB"], "peg": "EUR"},
    {"code": "XAF", "name": "Franc CFA CEMAC", "countries": ["CMR","TCD","CAF","COG","GAB","GNQ"], "peg": "EUR"},
    {"code": "NGN", "name": "Naira nigérian",   "countries": ["NGA"], "peg": None},
    {"code": "ZAR", "name": "Rand sud-africain","countries": ["ZAF"], "peg": None},
    {"code": "KES", "name": "Shilling kényan",  "countries": ["KEN"], "peg": None},
    {"code": "EGP", "name": "Livre égyptienne", "countries": ["EGY"], "peg": None},
    {"code": "MAD", "name": "Dirham marocain",  "countries": ["MAR"], "peg": None},
    {"code": "GHS", "name": "Cédi ghanéen",     "countries": ["GHA"], "peg": None},
    {"code": "ETB", "name": "Birr éthiopien",   "countries": ["ETH"], "peg": None},
    {"code": "TZS", "name": "Shilling tanzanien","countries": ["TZA"], "peg": None},
]

# Taux USD indicatifs au 2025-05 (officiels)
FX_FALLBACK = {
    "XOF": {"rate_official": 620.5,  "rate_parallel": 622.0,  "change_7d": -0.3,  "change_30d": 0.1},
    "XAF": {"rate_official": 620.5,  "rate_parallel": 622.0,  "change_7d": -0.3,  "change_30d": 0.1},
    "NGN": {"rate_official": 1580.0, "rate_parallel": 1640.0, "change_7d": 2.1,   "change_30d": -4.5},
    "ZAR": {"rate_official": 18.4,   "rate_parallel": 18.6,   "change_7d": -0.8,  "change_30d": 1.2},
    "KES": {"rate_official": 129.5,  "rate_parallel": 131.0,  "change_7d": 0.4,   "change_30d": -2.1},
    "EGP": {"rate_official": 50.8,   "rate_parallel": 51.5,   "change_7d": 0.2,   "change_30d": 0.8},
    "MAD": {"rate_official": 9.95,   "rate_parallel": 10.05,  "change_7d": -0.1,  "change_30d": 0.3},
    "GHS": {"rate_official": 15.6,   "rate_parallel": 16.1,   "change_7d": 1.8,   "change_30d": 3.2},
    "ETB": {"rate_official": 57.2,   "rate_parallel": 62.5,   "change_7d": 0.5,   "change_30d": 1.9},
    "TZS": {"rate_official": 2640.0, "rate_parallel": 2660.0, "change_7d": -0.2,  "change_30d": 0.4},
}

INDICES_DATA = [
    {
        "name": "BRVM Composite",
        "exchange": "Bourse Régionale Valeurs Mobilières",
        "country": "UEMOA",
        "flag": "🌍",
        "value": 231.48,
        "change_1d": 0.34,
        "change_ytd": 5.2,
        "volume_usd_m": 1.8,
        "currency": "XOF",
        "top_stocks": ["SONATEL", "BOA-CI", "ORANGE-CI"],
    },
    {
        "name": "JSE Top 40",
        "exchange": "Johannesburg Stock Exchange",
        "country": "ZAF",
        "flag": "🇿🇦",
        "value": 72840.0,
        "change_1d": -0.52,
        "change_ytd": 3.8,
        "volume_usd_m": 612.4,
        "currency": "ZAR",
        "top_stocks": ["NASPERS", "ANGLO AMERICAN", "FIRSTRAND"],
    },
    {
        "name": "NSE All Share",
        "exchange": "Nigerian Exchange Group",
        "country": "NGA",
        "flag": "🇳🇬",
        "value": 107250.0,
        "change_1d": 1.23,
        "change_ytd": 31.4,
        "volume_usd_m": 28.6,
        "currency": "NGN",
        "top_stocks": ["DANGOTE CEMENT", "MTN NIGERIA", "GTCO"],
    },
    {
        "name": "EGX 30",
        "exchange": "Egyptian Exchange",
        "country": "EGY",
        "flag": "🇪🇬",
        "value": 28140.0,
        "change_1d": -0.18,
        "change_ytd": 12.7,
        "volume_usd_m": 84.2,
        "currency": "EGP",
        "top_stocks": ["COMMERCIAL INT. BANK", "EASTERN CO.", "EFG HERMES"],
    },
    {
        "name": "MASI",
        "exchange": "Bourse de Casablanca",
        "country": "MAR",
        "flag": "🇲🇦",
        "value": 13452.0,
        "change_1d": 0.41,
        "change_ytd": 8.1,
        "volume_usd_m": 42.5,
        "currency": "MAD",
        "top_stocks": ["ATTIJARIWAFA", "MAROC TELECOM", "BCP"],
    },
    {
        "name": "GSE Composite",
        "exchange": "Ghana Stock Exchange",
        "country": "GHA",
        "flag": "🇬🇭",
        "value": 3687.0,
        "change_1d": 0.08,
        "change_ytd": -2.3,
        "volume_usd_m": 0.4,
        "currency": "GHS",
        "top_stocks": ["MTN GHANA", "GCGL", "TOTAL PETROLEUM"],
    },
]


async def _fetch_live_fx_rates() -> dict[str, float]:
    """
    Récupère les taux de change USD depuis l'API Frankfurter (ECB).
    Retourne {code: usd_rate} ou {} si indisponible.
    XOF/XAF sont des parités fixes EUR — calculées depuis EUR/USD.
    """
    import time
    now = time.time()
    if _fx_cache["data"] and _fx_cache["fetched_at"] and now - _fx_cache["fetched_at"] < FX_CACHE_TTL:
        return _fx_cache["data"]

    # Devises à taux flottant + EUR pour dériver XOF/XAF
    symbols = "EUR,NGN,ZAR,KES,EGP,MAD,GHS,ETB,TZS"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                f"https://api.frankfurter.app/latest?from=USD&to={symbols}"
            )
            resp.raise_for_status()
            data = resp.json()
            rates: dict[str, float] = data.get("rates", {})

        # XOF et XAF = parité fixe EUR/655.957
        # 1 EUR = 655.957 XOF → 1 USD = rates["EUR"] * 655.957 XOF (inverse)
        if "EUR" in rates:
            usd_eur = rates["EUR"]          # EUR per 1 USD
            xof_per_usd = 655.957 / (1 / usd_eur)  # = 655.957 * usd_eur? no
            # 1 USD = X EUR, 1 EUR = 655.957 XOF → 1 USD = X * 655.957 XOF
            xof_rate = usd_eur * 655.957
            rates["XOF"] = round(xof_rate, 2)
            rates["XAF"] = round(xof_rate, 2)

        _fx_cache["data"] = rates
        _fx_cache["fetched_at"] = now
        logger.info("FX rates fetched live from Frankfurter: %d currencies", len(rates))
        return rates

    except Exception as exc:
        logger.warning("Frankfurter API indisponible: %s", exc)
        return {}


@router.get("/fx")
async def get_fx_rates(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
):
    """
    Taux de change USD pour les 10 principales monnaies africaines.
    Données live via Frankfurter (ECB) — fallback statique si indisponible.
    XOF/XAF : parité fixe EUR/655.957.
    """
    today = date.today()

    # 1. Tenter les taux live (Frankfurter / ECB)
    live_rates = await _fetch_live_fx_rates()
    is_live = bool(live_rates)

    # 2. Consulter aussi la DB pour les taux parallèles historiques
    db_result = await db.execute(
        select(FXRate)
        .where(FXRate.date >= today - timedelta(days=7))
        .order_by(FXRate.date.desc())
    )
    db_rates = db_result.scalars().all()
    db_by_currency: dict[str, FXRate] = {}
    for r in db_rates:
        if r.quote_currency not in db_by_currency:
            db_by_currency[r.quote_currency] = r

    output = []
    for meta in CURRENCIES_META:
        code = meta["code"]
        fallback = FX_FALLBACK[code]
        db_row = db_by_currency.get(code)

        # Taux officiel : live > DB > fallback
        if code in live_rates:
            rate_official = round(live_rates[code], 4)
        elif db_row:
            rate_official = db_row.rate_official
        else:
            rate_official = fallback["rate_official"]

        # Taux parallèle : DB > fallback (ratio appliqué au taux live)
        fallback_spread = (fallback["rate_parallel"] - fallback["rate_official"]) / fallback["rate_official"]
        if db_row and db_row.rate_parallel:
            rate_parallel = db_row.rate_parallel
        else:
            rate_parallel = round(rate_official * (1 + fallback_spread), 4)

        output.append({
            "currency_code": code,
            "currency_name": meta["name"],
            "countries": meta["countries"],
            "peg": meta["peg"],
            "rate_official": rate_official,
            "rate_parallel": rate_parallel,
            "spread_pct": round((rate_parallel - rate_official) / rate_official * 100, 2),
            "change_7d": fallback["change_7d"],
            "change_30d": fallback["change_30d"],
            "as_of": today.isoformat(),
            "source": "ECB via Frankfurter" if code in live_rates else "MANSA Fallback",
            "is_live": code in live_rates,
        })

    return {
        "base": "USD",
        "as_of": today.isoformat(),
        "is_live": is_live,
        "source": "Frankfurter API (ECB)" if is_live else "Données de référence MANSA",
        "rates": output,
    }


@router.get("/indices")
async def get_market_indices(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """Indices boursiers africains (BRVM, JSE, NSE, EGX, MASI, GSE)."""
    return {"indices": INDICES_DATA, "note": "Données indicatives — flux temps réel Phase 3"}


@router.get("/currencies")
async def list_currencies(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """Métadonnées des monnaies africaines couvertes."""
    return CURRENCIES_META
