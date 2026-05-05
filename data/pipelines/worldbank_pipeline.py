"""
MANSA Terminal — Pipeline World Bank
Ingestion des données WDI (World Development Indicators)
Source : api.worldbank.org/v2 (gratuit, pas de clé requise)
"""
import asyncio
import time
from datetime import datetime, timezone

import httpx
from dagster import asset, AssetExecutionContext, Output, MetadataValue, RetryPolicy, Backoff

WB_BASE = "https://api.worldbank.org/v2"

# ISO3 valides pour filtrer les agrégats régionaux retournés par l'API WB
AFRICAN_ISO3 = {
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI",
}

AFRICAN_ISO2 = [
    "NG", "ZA", "KE", "GH", "EG", "MA", "TN", "SN", "CI", "CM",
    "TZ", "UG", "ET", "RW", "CD", "MZ", "ZM", "AO", "BW", "MU",
    "BJ", "BF", "GW", "ML", "NE", "TG", "CF", "TD", "CG", "GQ",
    "GA", "MG", "MW", "ZW", "NA", "GN", "DZ", "LY", "SD", "SO",
    "ER", "DJ", "SS", "SL", "LR", "GM", "CV", "MR", "LS", "SZ",
    "KM", "ST", "BI",
]

# Indicateurs WB complémentaires IMF
WB_INDICATORS = {
    "NY.GDP.MKTP.CD":     ("GDP Nominal USD", "USD"),
    "SP.POP.TOTL":        ("Population Total", "persons"),
    "SH.DYN.MORT":        ("Under-5 Mortality Rate", "per 1000"),
    "SE.ADT.LITR.ZS":     ("Adult Literacy Rate", "%"),
    "EG.ELC.ACCS.ZS":     ("Access to Electricity", "%"),
    "IT.NET.USER.ZS":     ("Internet Users", "% population"),
    "NE.TRD.GNFS.ZS":     ("Trade % GDP", "%"),
    "BX.KLT.DINV.CD.WD":  ("FDI Inflows USD", "USD"),
    "GC.DOD.TOTL.GD.ZS":  ("Central Gov Debt % GDP", "%"),
    "FP.CPI.TOTL.ZG":     ("CPI Inflation WB", "%"),
    "NY.GNP.PCAP.CD":     ("GNI per Capita Atlas", "USD"),
    "SL.UEM.TOTL.ZS":     ("Unemployment Total WB", "%"),
    "AG.LND.ARBL.ZS":     ("Arable Land % total", "%"),
    "EG.FEC.RNEW.ZS":     ("Renewable Energy %", "%"),
}


async def fetch_wb_indicator_all_africa(
    client: httpx.AsyncClient,
    indicator: str,
) -> list[dict]:
    """Récupère un indicateur WB pour tous les pays africains"""
    countries_str = ";".join(AFRICAN_ISO2)
    url = f"{WB_BASE}/country/{countries_str}/indicator/{indicator}"

    all_records = []
    page = 1

    while True:
        response = await client.get(url, params={
            "format": "json",
            "per_page": 1000,
            "mrv": 10,  # Most Recent Values = 10 dernières années
            "page": page,
        }, timeout=30.0)
        response.raise_for_status()

        data = response.json()
        if not data or len(data) < 2:
            break

        meta, records = data[0], data[1]
        if records:
            all_records.extend(records)

        # Pagination
        if page >= meta.get("pages", 1):
            break
        page += 1
        await asyncio.sleep(0.3)

    return all_records


@asset(
    group_name="worldbank_tier1",
    description="Indicateurs World Bank WDI pour 54 pays africains",
)
async def worldbank_wdi_indicators(context: AssetExecutionContext) -> Output[dict]:
    """Ingère les indicateurs World Bank Development Indicators"""
    context.log.info(f"🌍 Démarrage ingestion World Bank — {len(WB_INDICATORS)} indicateurs")
    start = time.time()
    results = {}

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/1.0"},
        timeout=60.0,
    ) as client:
        for wb_code, (name, unit) in WB_INDICATORS.items():
            try:
                records = await fetch_wb_indicator_all_africa(client, wb_code)
                # Transformer en format {iso2: {year: value}}
                country_data = {}
                for r in records:
                    if r.get("value") is None:
                        continue
                    country = r.get("countryiso3code") or r.get("country", {}).get("id")
                    year = r.get("date")
                    if country and year:
                        if country not in country_data:
                            country_data[country] = {}
                        country_data[country][year] = r["value"]

                results[wb_code] = {
                    "name": name, "unit": unit,
                    "data": country_data,
                    "records": len(records),
                }
                context.log.info(f"  ✅ {wb_code}: {len(records)} records")
                await asyncio.sleep(1.0)  # Rate limit WB

            except Exception as e:
                context.log.warning(f"  ❌ {wb_code}: {e}")

    total = sum(ind["records"] for ind in results.values())
    duration = time.time() - start

    return Output(
        value=results,
        metadata={
            "indicators_fetched": MetadataValue.int(len(results)),
            "total_records": MetadataValue.int(total),
            "duration_seconds": MetadataValue.float(duration),
        },
    )


@asset(
    group_name="worldbank_tier1",
    description="Sauvegarde des données World Bank WDI en base PostgreSQL",
    deps=[worldbank_wdi_indicators],
    retry_policy=RetryPolicy(max_retries=2, delay=30, backoff=Backoff.EXPONENTIAL),
)
async def worldbank_wdi_to_database(
    context: AssetExecutionContext,
    worldbank_wdi_indicators: dict,
) -> Output[dict]:
    """
    Charge les données World Bank dans TimescaleDB.
    Utilise UPSERT pour éviter les doublons (même pattern qu'IMF).
    """
    import os
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import text

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        context.log.warning("DATABASE_URL non défini — skip persistance")
        return Output({"status": "skipped", "reason": "no database"}, metadata={})

    engine = create_async_engine(database_url)
    inserted = 0
    skipped = 0

    async with AsyncSession(engine) as session:
        for wb_code, indicator_info in worldbank_wdi_indicators.items():
            name = indicator_info["name"]
            unit = indicator_info["unit"]
            country_data = indicator_info["data"]  # {iso3: {year: value}}

            for country_id, yearly_values in country_data.items():
                # Filtrer les agrégats régionaux (WB renvoie parfois "SSA", "AFR", etc.)
                if country_id not in AFRICAN_ISO3:
                    skipped += 1
                    continue

                for year, value in yearly_values.items():
                    if value is None:
                        continue

                    await session.execute(text("""
                        INSERT INTO macro_indicators
                            (id, country_id, indicator_code, indicator_name,
                             value, unit, period, period_type, source,
                             source_url, timestamp)
                        VALUES
                            (gen_random_uuid(), :country_id, :indicator_code,
                             :indicator_name, :value, :unit, :period,
                             'annual', 'WorldBank',
                             'https://api.worldbank.org/v2',
                             NOW())
                        ON CONFLICT (country_id, indicator_code, period, source)
                        DO UPDATE SET
                            value = EXCLUDED.value,
                            indicator_name = EXCLUDED.indicator_name,
                            timestamp = NOW()
                    """), {
                        "country_id": country_id,
                        "indicator_code": wb_code,
                        "indicator_name": name,
                        "value": float(value),
                        "unit": unit,
                        "period": str(year),
                    })
                    inserted += 1

            await session.commit()

        await session.execute(text("""
            INSERT INTO data_ingestion_logs
                (id, source, status, records_fetched, records_inserted,
                 started_at, completed_at)
            VALUES
                (gen_random_uuid(), 'WorldBank_WDI', 'success', :fetched,
                 :inserted, NOW(), NOW())
        """), {"fetched": inserted + skipped, "inserted": inserted})
        await session.commit()

    await engine.dispose()
    context.log.info(f"✅ WorldBank WDI : {inserted} records insérés, {skipped} agrégats ignorés")

    return Output(
        value={"inserted": inserted, "skipped": skipped},
        metadata={
            "records_inserted": MetadataValue.int(inserted),
            "records_skipped": MetadataValue.int(skipped),
        },
    )
