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


# ── Cache commodités (TTL 30 min) ───────────────────────────────────────────
_commodities_cache: dict = {"data": None, "fetched_at": None}
COMMODITIES_CACHE_TTL = 1800  # 30 minutes

# ── Cache indices boursiers (TTL 15 min) ─────────────────────────────────────
_indices_cache: dict = {"data": None, "fetched_at": None}
INDICES_CACHE_TTL = 900  # 15 minutes

# Métadonnées commodités africaines stratégiques
COMMODITIES_META = [
    {"code": "PCOILBRENTSPOT", "name": "Pétrole Brent",   "unit": "USD/baril", "icon": "🛢️",  "relevance": "Exportateurs: NGA, AGO, DZA, LBY, GAB"},
    {"code": "PCOILWTICO",     "name": "Pétrole WTI",     "unit": "USD/baril", "icon": "⛽",   "relevance": "Référence marché spot"},
    {"code": "PGOLD",          "name": "Or",               "unit": "USD/t oz",  "icon": "🥇",  "relevance": "Exportateurs: ZAF, GHA, MLI, TZA, BFA"},
    {"code": "PCOCO",          "name": "Cacao",            "unit": "USD/tonne", "icon": "🍫",  "relevance": "CIV (40% world), GHA — recettes export majeures"},
    {"code": "PCOFFOTM",       "name": "Café",             "unit": "USD/kg",    "icon": "☕",  "relevance": "ETH, UGA, TZA, CMR — revenus agricoles"},
    {"code": "PNGASHHH",       "name": "Gaz naturel",      "unit": "USD/MBTU",  "icon": "🔥",  "relevance": "DZA, NGA, MOZ, SEN (Sangomar) — production croissante"},
    {"code": "PWHEAMT",        "name": "Blé",              "unit": "USD/tonne", "icon": "🌾",  "relevance": "Importateurs nets — impact inflation alimentaire"},
    {"code": "PCOPP",          "name": "Cuivre",           "unit": "USD/tonne", "icon": "🔶",  "relevance": "ZMB, COD — recettes d'exportation"},
    {"code": "PCOTTIND",       "name": "Coton",            "unit": "USD/kg",    "icon": "🧵",  "relevance": "MLI, BFA, BEN, TCD — revenus paysans"},
    {"code": "PIORECR",        "name": "Minerai de fer",   "unit": "USD/tonne", "icon": "⚙️",  "relevance": "MRT, ZAF, GUI — exportations minières"},
]

# Fallback prix commodités (31 mai 2025 approx.)
COMMODITIES_FALLBACK = {
    "PCOILBRENTSPOT": {"value": 74.2,  "change_1m": -3.2, "change_ytd": -8.5},
    "PCOILWTICO":     {"value": 70.5,  "change_1m": -3.5, "change_ytd": -9.1},
    "PGOLD":          {"value": 3320.0,"change_1m": 2.1,  "change_ytd": 25.4},
    "PCOCO":          {"value": 7450.0,"change_1m": -5.2, "change_ytd": 42.3},
    "PCOFFOTM":       {"value": 4.15,  "change_1m": 8.3,  "change_ytd": 65.2},
    "PNGASHHH":       {"value": 3.45,  "change_1m": 12.1, "change_ytd": 18.7},
    "PWHEAMT":        {"value": 198.0, "change_1m": -1.8, "change_ytd": -12.3},
    "PCOPP":          {"value": 9320.0,"change_1m": 1.4,  "change_ytd": 7.8},
    "PCOTTIND":       {"value": 0.68,  "change_1m": -2.3, "change_ytd": -5.1},
    "PIORECR":        {"value": 105.0, "change_1m": 3.2,  "change_ytd": -8.4},
}

# Indices boursiers africains — tickers Yahoo Finance (disponibles)
INDICES_TICKERS = {
    "JSE Top 40":   {"ticker": "^J200.JO", "flag": "🇿🇦", "country": "ZAF", "exchange": "Johannesburg Stock Exchange", "currency": "ZAR"},
    "EGX 30":       {"ticker": "^CASE.CA", "flag": "🇪🇬", "country": "EGY", "exchange": "Egyptian Exchange",           "currency": "EGP"},
    "MASI":         {"ticker": "^MASI.CS", "flag": "🇲🇦", "country": "MAR", "exchange": "Bourse de Casablanca",        "currency": "MAD"},
}


async def _fetch_live_commodities() -> dict[str, float]:
    """
    Récupère les prix spot des commodités africaines stratégiques
    via l'API publique de la Banque Mondiale (Pink Sheet).
    Cache 30 minutes.
    """
    import time
    now = time.time()
    if _commodities_cache["data"] and _commodities_cache["fetched_at"] and now - _commodities_cache["fetched_at"] < COMMODITIES_CACHE_TTL:
        return _commodities_cache["data"]

    # WB Commodity Prices API : mrv=2 pour avoir la valeur la plus récente
    codes = [m["code"] for m in COMMODITIES_META]
    results: dict[str, float] = {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        for code in codes:
            try:
                resp = await client.get(
                    f"https://api.worldbank.org/v2/en/indicator/{code}?format=json&mrv=2&frequency=M"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    # WB API : [metadata, [datapoints]]
                    if len(data) == 2 and data[1]:
                        for point in data[1]:
                            if point.get("value") is not None:
                                results[code] = float(point["value"])
                                break
            except Exception as exc:
                logger.debug("WB commodity %s fetch failed: %s", code, exc)

    if results:
        _commodities_cache["data"] = results
        _commodities_cache["fetched_at"] = now
        logger.info("Commodities fetched live from World Bank: %d/%d", len(results), len(codes))

    return results


async def _fetch_live_indices() -> dict[str, dict]:
    """
    Récupère les indices boursiers africains via l'API non officielle Yahoo Finance.
    Disponible sans clé API. Cache 15 minutes.
    """
    import time
    now = time.time()
    if _indices_cache["data"] and _indices_cache["fetched_at"] and now - _indices_cache["fetched_at"] < INDICES_CACHE_TTL:
        return _indices_cache["data"]

    results: dict[str, dict] = {}
    headers = {"User-Agent": "Mozilla/5.0 (compatible; MANSA-Terminal/1.0)"}

    async with httpx.AsyncClient(timeout=8.0, headers=headers) as client:
        for name, meta in INDICES_TICKERS.items():
            try:
                ticker = meta["ticker"]
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"
                )
                if resp.status_code == 200:
                    body = resp.json()
                    result = body.get("chart", {}).get("result", [])
                    if result:
                        q = result[0].get("indicators", {}).get("quote", [{}])[0]
                        closes = q.get("close", [])
                        closes = [c for c in closes if c is not None]
                        if len(closes) >= 2:
                            current = closes[-1]
                            prev    = closes[-2]
                            results[name] = {
                                "value":     round(current, 2),
                                "change_1d": round((current - prev) / prev * 100, 2),
                                "is_live":   True,
                            }
                        elif len(closes) == 1:
                            results[name] = {"value": round(closes[0], 2), "change_1d": 0.0, "is_live": True}
            except Exception as exc:
                logger.debug("Yahoo Finance index %s fetch failed: %s", name, exc)

    if results:
        _indices_cache["data"] = results
        _indices_cache["fetched_at"] = now
        logger.info("Indices fetched live from Yahoo Finance: %d/%d", len(results), len(INDICES_TICKERS))

    return results


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


@router.get("/commodities")
async def get_commodities(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """
    Prix spot des commodités africaines stratégiques.
    Live via API publique Banque Mondiale (Pink Sheet) — fallback statique.
    """
    live = await _fetch_live_commodities()
    is_live = bool(live)

    output = []
    for meta in COMMODITIES_META:
        code     = meta["code"]
        fallback = COMMODITIES_FALLBACK[code]
        value    = live.get(code, fallback["value"])
        output.append({
            "code":       code,
            "name":       meta["name"],
            "unit":       meta["unit"],
            "icon":       meta["icon"],
            "value":      round(value, 4),
            "change_1m":  fallback["change_1m"],
            "change_ytd": fallback["change_ytd"],
            "relevance":  meta["relevance"],
            "source":     "World Bank Pink Sheet" if code in live else "MANSA Fallback",
            "is_live":    code in live,
        })

    return {
        "commodities": output,
        "is_live":     is_live,
        "source":      "World Bank Commodity Price Data" if is_live else "Données de référence MANSA",
        "note":        "Données mensuelles — Pink Sheet Banque Mondiale",
    }


@router.get("/indices")
async def get_market_indices(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """
    Indices boursiers africains.
    Live pour JSE, EGX30, MASI via Yahoo Finance — fallback statique pour les autres.
    """
    live_indices = await _fetch_live_indices()

    merged = []
    for item in INDICES_DATA:
        name = item["name"]
        live = live_indices.get(name)
        merged.append({
            **item,
            "value":     live["value"]     if live else item["value"],
            "change_1d": live["change_1d"] if live else item["change_1d"],
            "is_live":   live["is_live"]   if live else False,
            "source":    "Yahoo Finance"   if live else "MANSA Fallback",
        })

    return {
        "indices": merged,
        "is_live": bool(live_indices),
        "note":    "JSE/EGX/MASI : données live Yahoo Finance · BRVM/NSE/GSE : indicatifs",
    }


@router.get("/currencies")
async def list_currencies(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """Métadonnées des monnaies africaines couvertes."""
    return CURRENCIES_META
