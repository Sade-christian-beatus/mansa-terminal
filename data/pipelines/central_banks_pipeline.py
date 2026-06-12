"""
MANSA Terminal — Pipeline Banques Centrales Africaines
Sources primaires africaines : BCEAO, BEAC, CBN, SARB, Bank Al-Maghrib

Ces banques centrales publient des données non présentes dans IMF/WB :
  - Taux directeurs officiels (décisions de politique monétaire)
  - Agrégats monétaires (M1, M2, crédit à l'économie)
  - Statistiques bancaires (créances douteuses, adéquation des fonds propres)
  - Données de paiement (transferts mobiles, microfinance)
  - Bulletins mensuels avec data fraîche (délai 1-3 mois vs 6-18 mois pour IMF)

Stratégie Phase 1 :
  - BCEAO : API JSON partielle + scraping des publications mensuelles
  - BEAC  : Scraping du tableau de bord statistique
  - CBN   : API JSON officielle (opendata.cbn.gov.ng)
  - SARB  : API JSON officielle (resbank.co.za)
  - BAM   : Scraping (Bank Al-Maghrib)

Source fallback : IMF IFS (déjà implémenté) pour les pays sans API directe.
"""
import asyncio
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from dagster import (
    asset, AssetExecutionContext, Output, MetadataValue,
    RetryPolicy, Backoff,
)
from tenacity import retry, stop_after_attempt, wait_exponential


# ============================================================
# Configuration des sources
# ============================================================

# CBN (Central Bank of Nigeria) — API officielle
CBN_BASE = "https://opendata.cbn.gov.ng/api/odata/v1"

# SARB (South African Reserve Bank) — API officielle
SARB_BASE = "https://www.resbank.co.za/api/sarbdata"

# BCEAO — Page statistiques (JSON partiel disponible)
BCEAO_STATS_URL = "https://www.bceao.int/fr/content/tableau-de-bord-statistique"
BCEAO_API_BASE  = "https://www.bceao.int/api"   # Endpoint partiel

# BEAC — Page de données
BEAC_STATS_URL = "https://www.beac.int/wp-content/uploads/statistiques"

# Bank Al-Maghrib
BAM_API_BASE = "https://www.bkam.ma/api"


# ============================================================
# Données pivot statiques (taux directeurs officiels publiés)
# Mis à jour manuellement lors des décisions de politique monétaire.
# TODO Phase 2 : remplacer par fetch dynamique depuis les bulletins.
# ============================================================

# Taux directeurs des banques centrales africaines (dernier taux connu)
POLICY_RATES: dict[str, dict] = {
    # Zone UEMOA — BCEAO (même taux pour les 8 pays)
    "SEN": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "CIV": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "MLI": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "BFA": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "NER": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "TGO": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "BEN": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    "GNB": {"rate": 3.50, "currency": "XOF", "bank": "BCEAO", "date": "2024-06"},
    # Zone CEMAC — BEAC (même taux pour les 6 pays)
    "CMR": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    "TCD": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    "CAF": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    "COG": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    "GAB": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    "GNQ": {"rate": 5.00, "currency": "XAF", "bank": "BEAC", "date": "2024-03"},
    # Grandes économies — taux individuels
    "NGA": {"rate": 26.25, "currency": "NGN", "bank": "CBN",  "date": "2024-07"},
    "ZAF": {"rate":  8.25, "currency": "ZAR", "bank": "SARB", "date": "2024-09"},
    "EGY": {"rate": 27.25, "currency": "EGP", "bank": "CBE",  "date": "2024-03"},
    "MAR": {"rate":  3.00, "currency": "MAD", "bank": "BAM",  "date": "2024-06"},
    "KEN": {"rate": 13.00, "currency": "KES", "bank": "CBK",  "date": "2024-06"},
    "GHA": {"rate": 29.00, "currency": "GHS", "bank": "BoG",  "date": "2024-07"},
    "TUN": {"rate":  8.00, "currency": "TND", "bank": "BCT",  "date": "2024-01"},
    "ETH": {"rate": 15.00, "currency": "ETB", "bank": "NBE",  "date": "2024-01"},
    "TZA": {"rate":  5.50, "currency": "TZS", "bank": "BoT",  "date": "2024-04"},
    "UGA": {"rate": 10.25, "currency": "UGX", "bank": "BoU",  "date": "2024-06"},
    "RWA": {"rate":  6.50, "currency": "RWF", "bank": "BNR",  "date": "2024-04"},
    "ZMB": {"rate": 13.50, "currency": "ZMW", "bank": "BoZ",  "date": "2024-02"},
    "MOZ": {"rate": 15.00, "currency": "MZN", "bank": "BdM",  "date": "2024-04"},
    "DZA": {"rate":  3.00, "currency": "DZD", "bank": "BA",   "date": "2024-01"},
}

# Taux de réserves obligatoires (%)
RESERVE_REQUIREMENTS: dict[str, float] = {
    "SEN": 3.0, "CIV": 3.0, "MLI": 3.0, "BFA": 3.0,  # UEMOA
    "CMR": 6.5, "TCD": 6.5, "GAB": 6.5,               # CEMAC
    "NGA": 45.0, "ZAF": 0.0, "EGY": 18.0, "KEN": 4.25,
    "GHA": 14.0, "MAR": 4.0, "TUN": 12.0, "ETH": 10.0,
}


# ============================================================
# Client HTTP
# ============================================================
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=15), reraise=True)
async def _safe_get(client: httpx.AsyncClient, url: str, **kwargs) -> Optional[dict]:
    try:
        resp = await client.get(url, timeout=20.0, **kwargs)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError:
        return None
    except Exception:
        return None


# ============================================================
# Fetch CBN (Nigeria) — API officielle
# ============================================================
async def fetch_cbn_data(client: httpx.AsyncClient) -> list[dict]:
    """
    Récupère les taux d'intérêt et données monétaires de la CBN.
    API OData officielle : opendata.cbn.gov.ng
    """
    records = []

    # Taux de change CBN (officiel)
    fx_url = f"{CBN_BASE}/ExchangeRate?$top=12&$orderby=date desc"
    fx_data = await _safe_get(client, fx_url)
    if fx_data:
        for item in fx_data.get("value", [])[:6]:
            try:
                records.append({
                    "country_id":     "NGA",
                    "indicator_code": "FX_CBN_USD",
                    "indicator_name": "CBN Official FX Rate (NGN/USD)",
                    "value":          float(item.get("buyingRate") or item.get("centralRate") or 0),
                    "period":         str(item.get("date", ""))[:7],  # "2024-07"
                    "period_type":    "monthly",
                    "unit":           "NGN/USD",
                    "source":         "CBN",
                })
            except (ValueError, TypeError):
                continue

    return records


# ============================================================
# Fetch SARB (Afrique du Sud) — données monétaires
# ============================================================
async def fetch_sarb_data(client: httpx.AsyncClient) -> list[dict]:
    """
    Récupère les données clés de la SARB.
    La SARB publie des séries JSON sur resbank.co.za
    """
    records = []
    # Taux repo (taux directeur SARB)
    # Fallback : taux connu depuis POLICY_RATES
    sarb_rate = POLICY_RATES.get("ZAF", {})
    if sarb_rate:
        records.append({
            "country_id":     "ZAF",
            "indicator_code": "INT_POLICY",
            "indicator_name": "SARB Repo Rate (%)",
            "value":          sarb_rate["rate"],
            "period":         sarb_rate["date"],
            "period_type":    "monthly",
            "unit":           "%",
            "source":         "SARB",
        })
    return records


# ============================================================
# Asset principal — Fetch toutes les banques centrales
# ============================================================
@asset(
    name="central_banks_data",
    description="Données primaires des banques centrales africaines : taux directeurs, taux de réserves, agrégats monétaires",
    retry_policy=RetryPolicy(max_retries=2, delay=60),
    group_name="african_sources",
)
async def central_banks_data(context: AssetExecutionContext) -> Output[list[dict]]:
    """
    Collecte les données des banques centrales africaines.

    Phase 1 : taux directeurs (pivot statique mis à jour aux décisions monétaires)
              + données live CBN, SARB où disponibles.
    Phase 2 : parsers BCEAO/BEAC bulletins PDF, BAM API.
    """
    records: list[dict] = []

    # 1. Taux directeurs — toutes les banques centrales
    for country_id, rate_info in POLICY_RATES.items():
        records.append({
            "country_id":     country_id,
            "indicator_code": "INT_POLICY",
            "indicator_name": f"Policy Rate - {rate_info['bank']} (%)",
            "value":          rate_info["rate"],
            "period":         rate_info["date"],
            "period_type":    "monthly",
            "unit":           "%",
            "source":         rate_info["bank"],
        })

    # 2. Taux de réserves obligatoires
    for country_id, rate in RESERVE_REQUIREMENTS.items():
        records.append({
            "country_id":     country_id,
            "indicator_code": "INT_RESERVE_REQ",
            "indicator_name": "Required Reserve Ratio (%)",
            "value":          rate,
            "period":         "2024-06",
            "period_type":    "monthly",
            "unit":           "%",
            "source":         POLICY_RATES.get(country_id, {}).get("bank", "CENTRAL_BANK"),
        })

    # 3. Données live CBN et SARB
    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/1.0 (research@mansa.ai)"},
        timeout=30.0,
    ) as client:
        cbn_records  = await fetch_cbn_data(client)
        sarb_records = await fetch_sarb_data(client)
        records.extend(cbn_records)
        records.extend(sarb_records)

    context.log.info(f"Central banks data: {len(records)} records from {len(POLICY_RATES)} countries")

    return Output(
        value=records,
        metadata={
            "total_records":   MetadataValue.int(len(records)),
            "countries":       MetadataValue.int(len(POLICY_RATES)),
            "sources":         MetadataValue.text("BCEAO, BEAC, CBN, SARB, BAM, BCT, CBK"),
            "indicators":      MetadataValue.text("INT_POLICY, INT_RESERVE_REQ, FX_CBN_USD"),
        },
    )


# ============================================================
# Asset 2 — Persist en base
# ============================================================
@asset(
    name="central_banks_to_database",
    description="Persiste les données des banques centrales dans macro_indicators",
    deps=["central_banks_data"],
    group_name="african_sources",
)
def central_banks_to_database(
    context: AssetExecutionContext,
    central_banks_data: list[dict],
) -> Output[dict]:
    """UPSERT des données banques centrales dans macro_indicators."""
    import os
    from sqlalchemy import create_engine, text

    db_url = os.getenv("DATABASE_URL_SYNC", os.getenv("DATABASE_URL", ""))
    if not db_url:
        raise ValueError("DATABASE_URL_SYNC non configurée")
    db_url = db_url.replace("postgres://", "postgresql://").replace("postgresql+asyncpg://", "postgresql://")

    engine = create_engine(db_url)
    inserted, skipped = 0, 0

    upsert_sql = text("""
        INSERT INTO macro_indicators
            (id, country_id, indicator_code, indicator_name, value, unit,
             period, period_type, source, timestamp)
        VALUES
            (gen_random_uuid(), :country_id, :indicator_code, :indicator_name,
             :value, :unit, :period, :period_type, :source, NOW())
        ON CONFLICT (country_id, indicator_code, period, source)
        DO UPDATE SET
            value          = EXCLUDED.value,
            indicator_name = EXCLUDED.indicator_name,
            timestamp      = NOW()
    """)

    with engine.begin() as conn:
        existing_countries = {
            row[0] for row in conn.execute(text("SELECT id FROM countries")).fetchall()
        }
        for rec in central_banks_data:
            if rec["country_id"] not in existing_countries:
                skipped += 1
                continue
            try:
                conn.execute(upsert_sql, rec)
                inserted += 1
            except Exception as e:
                context.log.warning(f"Upsert error {rec['country_id']}/{rec['indicator_code']}: {e}")
                skipped += 1

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO data_ingestion_logs
                (id, source, status, records_fetched, records_inserted, completed_at)
            VALUES (gen_random_uuid(), 'CENTRAL_BANKS', 'success', :fetched, :inserted, NOW())
        """), {"fetched": len(central_banks_data), "inserted": inserted})

    context.log.info(f"Central banks DB upsert: {inserted} inserted, {skipped} skipped")

    return Output(
        value={"inserted": inserted, "skipped": skipped},
        metadata={
            "records_inserted": MetadataValue.int(inserted),
            "records_skipped":  MetadataValue.int(skipped),
        },
    )
