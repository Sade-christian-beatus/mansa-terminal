"""
MANSA Terminal — Pipeline IMF IFS (International Financial Statistics)
Données mensuelles haute fréquence via l'API SDMX du FMI.

Contrairement au WEO (annuel), l'IFS fournit des données mensuelles :
  - CPI mensuel (meilleur proxy d'inflation en temps réel)
  - Taux directeurs des banques centrales
  - Masse monétaire M2 (mensuel)
  - Balance commerciale (mensuel)
  - Taux de change officiels (mensuel)
  - Réserves de change (mensuel)

Source : data.imf.org/api/SDMX/2.1 (gratuit, pas de clé requise)
Documentation : https://datahelp.imf.org/knowledgebase/articles/630877
"""
import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from dagster import (
    asset, AssetExecutionContext, Output, MetadataValue,
    RetryPolicy, Backoff,
)
from tenacity import retry, stop_after_attempt, wait_exponential

# ============================================================
# Configuration
# ============================================================
IFS_BASE = "https://data.imf.org/api/SDMX/2.1"

# Pays africains pour IFS (ISO 2 lettres — format requis par IFS)
# IFS utilise les codes ISO 2 du FMI (légèrement différents des ISO 3166-1 alpha-2)
IFS_COUNTRY_CODES = {
    "NGA": "NG", "ZAF": "ZA", "KEN": "KE", "GHA": "GH", "EGY": "EG",
    "MAR": "MA", "TUN": "TN", "SEN": "SN", "CIV": "CI", "CMR": "CM",
    "TZA": "TZ", "UGA": "UG", "ETH": "ET", "RWA": "RW", "COD": "CD",
    "MOZ": "MZ", "ZMB": "ZM", "AGO": "AO", "BWA": "BW", "MUS": "MU",
    "BEN": "BJ", "BFA": "BF", "MLI": "ML", "NER": "NE", "TGO": "TG",
    "CAF": "CF", "TCD": "TD", "COG": "CG", "GAB": "GA", "MDG": "MG",
    "MWI": "MW", "ZWE": "ZW", "NAM": "NA", "GIN": "GN", "DZA": "DZ",
    "SDN": "SD", "DJI": "DJ", "SLE": "SL", "LBR": "LR", "GMB": "GM",
    "MRT": "MR", "LSO": "LS", "SWZ": "SZ", "BDI": "BI", "RWA": "RW",
}

# Indicateurs IFS — codes SDMX
# Format de requête: {fréquence}.{pays}.{indicateur}
IFS_INDICATORS = {
    # Inflation
    "PCPI_IX":    ("CPI Index (2010=100)", "index", "PCPIPCH"),
    "PCPI_PC_CP_A_PT": ("CPI Inflation Annual %", "%", "PCPIPCH"),
    # Monétaire
    "FMS_XDC":    ("Broad Money M2 (local currency)", "LCU", "FM_LIPY"),
    "FPOLM_PA":   ("Policy Rate %", "%", "INT_POLICY"),
    "FILR_PA":    ("Lending Rate %", "%", "INT_LENDING"),
    # Externe
    "BCA_BP6_USD": ("Current Account USD", "USD_MN", "BCA_USD"),
    "EREER_IX":   ("Real Effective Exchange Rate", "index", "REER"),
    "ENDA_XDC_USD_RATE": ("Official Exchange Rate (LCU/USD)", "LCU/USD", "FX_OFFICIAL"),
    # Réserves
    "RAFA_USD":   ("Foreign Exchange Reserves USD", "USD_MN", "FX_RESERVES"),
}

# Pays prioritaires Tier 1 (coverage garantie dans IFS)
TIER1_COUNTRIES = [
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN",
    "SEN", "CIV", "CMR", "TZA", "UGA", "ETH", "DZA",
]


# ============================================================
# Client HTTP avec retry
# ============================================================
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
async def _fetch_ifs(client: httpx.AsyncClient, url: str, params: dict) -> dict:
    resp = await client.get(url, params=params, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


async def fetch_ifs_series(
    client: httpx.AsyncClient,
    country_iso2: str,
    indicator_code: str,
    start_period: str = "2015-01",
) -> list[dict]:
    """
    Récupère une série temporelle IFS pour un pays et un indicateur.
    Retourne une liste de {period, value}.
    """
    url = f"{IFS_BASE}/data/IFS/M.{country_iso2}.{indicator_code}/IMF"
    params = {
        "format": "sdmx_json",
        "startPeriod": start_period,
    }
    try:
        data = await _fetch_ifs(client, url, params)
        return _parse_sdmx_series(data)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return []  # Indicateur absent pour ce pays
        raise
    except Exception:
        return []


def _parse_sdmx_series(sdmx_json: dict) -> list[dict]:
    """Parse le format SDMX JSON retourné par l'API IMF."""
    try:
        datasets = sdmx_json.get("dataSets", [])
        if not datasets:
            return []

        structure = sdmx_json.get("structure", {})
        dimensions = structure.get("dimensions", {}).get("observation", [])

        # Récupérer les labels de période
        period_dim = next((d for d in dimensions if d.get("id") == "TIME_PERIOD"), None)
        if not period_dim:
            return []

        period_values = [v["id"] for v in period_dim.get("values", [])]

        # Parser les observations
        series_data = datasets[0].get("series", {})
        results = []
        for series_key, series_vals in series_data.items():
            observations = series_vals.get("observations", {})
            for obs_idx, obs_values in observations.items():
                idx = int(obs_idx)
                if idx < len(period_values) and obs_values and obs_values[0] is not None:
                    results.append({
                        "period": period_values[idx],    # "2024-03" format
                        "value": float(obs_values[0]),
                    })
        return results
    except (KeyError, IndexError, ValueError):
        return []


# ============================================================
# Asset 1 — Fetch toutes les données IFS
# ============================================================
@asset(
    name="imf_ifs_monthly_data",
    description="Données mensuelles IFS (FMI) : inflation, taux, M2, réserves pour les pays africains Tier 1",
    retry_policy=RetryPolicy(max_retries=2, delay=30, backoff=Backoff.EXPONENTIAL),
    group_name="monthly_sources",
)
async def imf_ifs_monthly_data(context: AssetExecutionContext) -> Output[list[dict]]:
    """
    Fetch les données mensuelles IFS pour les 14 pays africains Tier 1.
    Couvre 9 indicateurs × 14 pays depuis 2015.
    """
    records = []
    errors = []

    async with httpx.AsyncClient(
        headers={"Accept": "application/json", "User-Agent": "MANSA-Terminal/1.0"},
        timeout=60.0,
    ) as client:
        for iso3 in TIER1_COUNTRIES:
            iso2 = IFS_COUNTRY_CODES.get(iso3)
            if not iso2:
                continue

            context.log.info(f"Fetching IFS data for {iso3} ({iso2})")

            for ifs_code, (name, unit, internal_code) in IFS_INDICATORS.items():
                await asyncio.sleep(0.3)  # Respecter le rate limit IMF
                series = await fetch_ifs_series(client, iso2, ifs_code)

                for point in series:
                    records.append({
                        "country_id": iso3,
                        "indicator_code": internal_code,
                        "indicator_name": name,
                        "ifs_code": ifs_code,
                        "value": point["value"],
                        "period": point["period"],  # "2024-03" format
                        "period_type": "monthly",
                        "unit": unit,
                        "source": "IMF_IFS",
                    })

            context.log.info(f"  → {iso3}: {len([r for r in records if r['country_id'] == iso3])} points")

    context.log.info(f"IMF IFS fetch complete: {len(records)} records, {len(errors)} errors")

    return Output(
        value=records,
        metadata={
            "total_records": MetadataValue.int(len(records)),
            "countries_fetched": MetadataValue.int(len(TIER1_COUNTRIES)),
            "indicators": MetadataValue.int(len(IFS_INDICATORS)),
            "period_type": MetadataValue.text("monthly"),
            "source": MetadataValue.text("IMF IFS SDMX API"),
        },
    )


# ============================================================
# Asset 2 — Persist en base
# ============================================================
@asset(
    name="imf_ifs_to_database",
    description="Persiste les données IFS mensuelles dans macro_indicators",
    deps=["imf_ifs_monthly_data"],
    group_name="monthly_sources",
)
def imf_ifs_to_database(
    context: AssetExecutionContext,
    imf_ifs_monthly_data: list[dict],
) -> Output[dict]:
    """
    UPSERT les données IFS dans la table macro_indicators.
    Les données mensuelles coexistent avec les données annuelles WEO
    grâce à la clé composite (country_id, indicator_code, period, source).
    """
    import os
    from sqlalchemy import create_engine, text

    db_url = os.getenv("DATABASE_URL_SYNC", os.getenv("DATABASE_URL", ""))
    if not db_url:
        raise ValueError("DATABASE_URL_SYNC non configurée")
    # Normaliser le schéma de connexion
    db_url = db_url.replace("postgres://", "postgresql://").replace("postgresql+asyncpg://", "postgresql://")

    engine = create_engine(db_url)
    inserted = 0
    skipped = 0

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
            unit           = EXCLUDED.unit,
            timestamp      = NOW()
    """)

    with engine.begin() as conn:
        # Vérifier que les pays existent en DB
        existing_countries = {
            row[0] for row in conn.execute(text("SELECT id FROM countries")).fetchall()
        }

        for record in imf_ifs_monthly_data:
            if record["country_id"] not in existing_countries:
                skipped += 1
                continue
            try:
                conn.execute(upsert_sql, {
                    "country_id":     record["country_id"],
                    "indicator_code": record["indicator_code"],
                    "indicator_name": record["indicator_name"],
                    "value":          record["value"],
                    "unit":           record["unit"],
                    "period":         record["period"],
                    "period_type":    "monthly",
                    "source":         "IMF_IFS",
                })
                inserted += 1
            except Exception as e:
                context.log.warning(f"Upsert failed for {record['country_id']}/{record['indicator_code']}: {e}")
                skipped += 1

    # Log dans data_ingestion_logs
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO data_ingestion_logs
                (id, source, status, records_fetched, records_inserted, completed_at)
            VALUES
                (gen_random_uuid(), 'IMF_IFS', 'success', :fetched, :inserted, NOW())
        """), {"fetched": len(imf_ifs_monthly_data), "inserted": inserted})

    context.log.info(f"IFS DB upsert: {inserted} inserted, {skipped} skipped")

    return Output(
        value={"inserted": inserted, "skipped": skipped},
        metadata={
            "records_inserted": MetadataValue.int(inserted),
            "records_skipped":  MetadataValue.int(skipped),
        },
    )
