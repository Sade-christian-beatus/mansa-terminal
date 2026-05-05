"""
MANSA Terminal — Pipeline IMF Data
Ingestion des données FMI : WEO, IFS, BOP pour les 54 pays africains
Source : imf.org/external/datamapper/api/v1 (gratuit, pas de clé requise)
"""
import asyncio
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
IMF_BASE = "https://www.imf.org/external/datamapper/api/v1"

# Tous les pays africains (ISO 3166-1 alpha-3)
AFRICAN_COUNTRIES = [
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI", "GNQ",
]

# Indicateurs prioritaires MVP (WEO codes)
IMF_INDICATORS_TIER1 = {
    # Croissance et PIB
    "NGDP_RPCH":    ("GDP Real Growth", "%"),
    "NGDPDPC":      ("GDP per Capita USD", "USD"),
    "NGDPD":        ("GDP Nominal Billions USD", "USD_BN"),
    # Inflation
    "PCPIPCH":      ("CPI Inflation", "%"),
    "PCPIEPCH":     ("End-Period Inflation", "%"),
    # Finances publiques
    "GGXCNL_NGDP":  ("Fiscal Balance % GDP", "% GDP"),
    "GGXWDG_NGDP":  ("Government Debt % GDP", "% GDP"),
    "GGRO_NGDP":    ("Government Revenue % GDP", "% GDP"),
    "GGX_NGDP":     ("Government Expenditure % GDP", "% GDP"),
    # Compte courant et dette externe
    "BCA_NGDPD":    ("Current Account % GDP", "% GDP"),
    "EDIBGS_NGDPD": ("External Debt % GDP", "% GDP"),
    # Réserves et taux de change
    "ASSDRESES":    ("FX Reserves Months Imports", "months"),
    # Chômage
    "LUR":          ("Unemployment Rate", "%"),
}


# ============================================================
# Client HTTP avec retry
# ============================================================
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
)
async def fetch_imf_indicator(
    client: httpx.AsyncClient,
    indicator: str,
    countries: list[str],
) -> dict:
    """Récupère un indicateur IMF pour une liste de pays"""
    # IMF API format: /INDICATOR/COUNTRY1/COUNTRY2/...
    countries_str = "/".join(countries[:20])  # Max 20 pays par requête
    url = f"{IMF_BASE}/{indicator}/{countries_str}"

    response = await client.get(
        url,
        params={"periods": "2015,2016,2017,2018,2019,2020,2021,2022,2023,2024"},
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


async def fetch_all_countries_for_indicator(
    client: httpx.AsyncClient,
    indicator: str,
) -> dict:
    """Récupère un indicateur pour TOUS les pays africains par batches de 20"""
    all_data = {}
    batches = [AFRICAN_COUNTRIES[i:i+20]
               for i in range(0, len(AFRICAN_COUNTRIES), 20)]

    for batch in batches:
        try:
            data = await fetch_imf_indicator(client, indicator, batch)
            values = data.get("values", {}).get(indicator, {})
            all_data.update(values)
            await asyncio.sleep(0.5)  # Respecter le rate limit IMF
        except Exception as e:
            print(f"⚠ Erreur IMF {indicator} batch {batch[:3]}...: {e}")

    return all_data


# ============================================================
# Assets Dagster
# ============================================================
@asset(
    group_name="imf_tier1",
    description="Données WEO du FMI — tous indicateurs pour 54 pays africains",
    retry_policy=RetryPolicy(max_retries=3, delay=60, backoff=Backoff.EXPONENTIAL),
)
async def imf_weo_all_indicators(context: AssetExecutionContext) -> Output[dict]:
    """
    Asset principal — ingère tous les indicateurs WEO Tier 1 du FMI.
    Retourne un dictionnaire {indicator: {country: {year: value}}}
    """
    context.log.info(f"🌍 Démarrage ingestion IMF WEO — {len(IMF_INDICATORS_TIER1)} indicateurs")
    start = time.time()
    results = {}
    errors = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/1.0 (kodzovi@mansa.ai)"},
        timeout=60.0,
    ) as client:
        for indicator_code, (name, unit) in IMF_INDICATORS_TIER1.items():
            context.log.info(f"  → {indicator_code}: {name}")
            try:
                data = await fetch_all_countries_for_indicator(client, indicator_code)
                results[indicator_code] = {
                    "name": name,
                    "unit": unit,
                    "data": data,  # {country_iso: {year: value}}
                }
                context.log.info(f"  ✅ {indicator_code}: {len(data)} pays")
            except Exception as e:
                errors.append(f"{indicator_code}: {str(e)}")
                context.log.warning(f"  ❌ {indicator_code}: {e}")

    duration = time.time() - start
    total_records = sum(
        sum(len(v) for v in ind["data"].values())
        for ind in results.values()
    )

    context.log.info(f"✅ IMF WEO terminé en {duration:.1f}s — {total_records} points")

    return Output(
        value=results,
        metadata={
            "indicators_fetched": MetadataValue.int(len(results)),
            "total_records": MetadataValue.int(total_records),
            "errors": MetadataValue.int(len(errors)),
            "duration_seconds": MetadataValue.float(duration),
            "timestamp": MetadataValue.text(datetime.now(timezone.utc).isoformat()),
        },
    )


@asset(
    group_name="imf_tier1",
    description="Sauvegarde des données IMF en base PostgreSQL",
    deps=[imf_weo_all_indicators],
)
async def imf_weo_to_database(
    context: AssetExecutionContext,
    imf_weo_all_indicators: dict,
) -> Output[dict]:
    """
    Charge les données IMF dans TimescaleDB.
    Utilise UPSERT pour éviter les doublons.
    """
    import os
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import text

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        context.log.warning("DATABASE_URL non défini — skip persistance")
        return Output({"status": "skipped", "reason": "no database"})

    engine = create_async_engine(database_url)
    inserted = 0
    updated = 0

    async with AsyncSession(engine) as session:
        for indicator_code, indicator_info in imf_weo_all_indicators.items():
            name = indicator_info["name"]
            unit = indicator_info["unit"]
            country_data = indicator_info["data"]

            for country_id, yearly_values in country_data.items():
                if country_id not in AFRICAN_COUNTRIES:
                    continue  # Filtrer pays non africains

                for year, value in yearly_values.items():
                    if value is None:
                        continue

                    # UPSERT — INSERT ou UPDATE si déjà existant
                    await session.execute(text("""
                        INSERT INTO macro_indicators
                            (id, country_id, indicator_code, indicator_name,
                             value, unit, period, period_type, source,
                             source_url, timestamp)
                        VALUES
                            (gen_random_uuid(), :country_id, :indicator_code,
                             :indicator_name, :value, :unit, :period,
                             'annual', 'IMF',
                             'https://imf.org/external/datamapper',
                             NOW())
                        ON CONFLICT (country_id, indicator_code, period, source)
                        DO UPDATE SET
                            value = EXCLUDED.value,
                            indicator_name = EXCLUDED.indicator_name,
                            timestamp = NOW()
                    """), {
                        "country_id": country_id,
                        "indicator_code": indicator_code,
                        "indicator_name": name,
                        "value": float(value),
                        "unit": unit,
                        "period": str(year),
                    })
                    inserted += 1

            await session.commit()

        # Log de l'ingestion
        await session.execute(text("""
            INSERT INTO data_ingestion_logs
                (id, source, status, records_fetched, records_inserted,
                 started_at, completed_at)
            VALUES
                (gen_random_uuid(), 'IMF_WEO', 'success', :fetched,
                 :inserted, NOW(), NOW())
        """), {"fetched": inserted, "inserted": inserted})
        await session.commit()

    await engine.dispose()
    context.log.info(f"✅ Base de données mise à jour : {inserted} records")

    return Output(
        value={"inserted": inserted, "updated": updated},
        metadata={
            "records_inserted": MetadataValue.int(inserted),
            "records_updated": MetadataValue.int(updated),
        },
    )
