"""
MANSA Terminal — Router Markets (Phase 2)
Taux de change, indices boursiers africains, données FX
"""
from datetime import date, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, FXRate, Country

router = APIRouter()

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


@router.get("/fx")
async def get_fx_rates(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
):
    """Taux de change USD pour les 10 principales monnaies africaines."""
    today = date.today()
    result = await db.execute(
        select(FXRate)
        .where(FXRate.date >= today - timedelta(days=7))
        .order_by(FXRate.date.desc())
    )
    db_rates = result.scalars().all()

    db_by_currency: dict[str, FXRate] = {}
    for r in db_rates:
        if r.quote_currency not in db_by_currency:
            db_by_currency[r.quote_currency] = r

    output = []
    for meta in CURRENCIES_META:
        code = meta["code"]
        fallback = FX_FALLBACK[code]
        db_row = db_by_currency.get(code)

        output.append({
            "currency_code": code,
            "currency_name": meta["name"],
            "countries": meta["countries"],
            "peg": meta["peg"],
            "rate_official": db_row.rate_official if db_row else fallback["rate_official"],
            "rate_parallel": db_row.rate_parallel if db_row else fallback["rate_parallel"],
            "spread_pct": (
                round((db_row.rate_parallel - db_row.rate_official) / db_row.rate_official * 100, 2)
                if db_row and db_row.rate_parallel and db_row.rate_official
                else round(
                    (fallback["rate_parallel"] - fallback["rate_official"])
                    / fallback["rate_official"] * 100, 2
                )
            ),
            "change_7d": fallback["change_7d"],
            "change_30d": fallback["change_30d"],
            "as_of": db_row.date.isoformat() if db_row else today.isoformat(),
            "source": "MANSA / Banques centrales",
        })

    return {"base": "USD", "as_of": today.isoformat(), "rates": output}


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
