#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion EIA International Energy Data
API : https://api.eia.gov/v2/international/data/
Documentation : https://www.eia.gov/opendata/

Usage :
    EIA_API_KEY=yourkey DATABASE_URL_SYNC=postgresql://... python scripts/ingest_eia.py [--dry-run]

Clé gratuite : https://www.eia.gov/opendata/register.php (inscription immédiate)

Requis : httpx tenacity psycopg2-binary
"""
import argparse
import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timezone

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("ingest_eia")

EIA_BASE = "https://api.eia.gov/v2/international/data/"

# Codes pays EIA pour l'Afrique (format EIA interne)
# Source : https://www.eia.gov/opendata/browser/international
EIA_AFRICA_COUNTRIES = {
    "DZA": "ALGR",  # Algeria
    "AGO": "ANGO",  # Angola
    "CMR": "CAMR",  # Cameroon
    "COG": "CONG",  # Congo
    "COD": "DRCO",  # DR Congo
    "EGY": "EGYP",  # Egypt
    "GNQ": "EQGU",  # Equatorial Guinea
    "GAB": "GABO",  # Gabon
    "GHA": "GHAN",  # Ghana
    "CIV": "IVCO",  # Ivory Coast
    "KEN": "KENY",  # Kenya
    "LBY": "LIBY",  # Libya
    "MDG": "MADA",  # Madagascar
    "MAR": "MORO",  # Morocco
    "MOZ": "MOZA",  # Mozambique
    "NAM": "NAMI",  # Namibia
    "NER": "NIGE",  # Niger
    "NGA": "NIGR",  # Nigeria
    "SEN": "SENE",  # Senegal
    "ZAF": "SAFR",  # South Africa
    "SSD": "SSUD",  # South Sudan
    "SDN": "SUDA",  # Sudan
    "TZA": "TANZ",  # Tanzania
    "TUN": "TUNI",  # Tunisia
    "UGA": "UGAN",  # Uganda
    "ZMB": "ZAMB",  # Zambia
    "ZWE": "ZIMB",  # Zimbabwe
}

# Indicateurs EIA à récupérer
# Chaque tuple : (productId, activityId, unit, nom_indicateur, indicator_code)
EIA_INDICATORS = [
    # Pétrole brut
    ("57",  "1",  "Mb/d",    "Crude Oil Production Mb/d (EIA)",          "EIA_CRUDE_PROD"),
    ("57",  "2",  "Mb/d",    "Crude Oil Consumption Mb/d (EIA)",          "EIA_CRUDE_CONS"),
    # Gaz naturel
    ("26",  "1",  "Bcf",     "Dry Natural Gas Production Bcf (EIA)",      "EIA_GAS_PROD"),
    # Charbon
    ("7",   "1",  "Mt",      "Coal Production Mt (EIA)",                  "EIA_COAL_PROD"),
    # Électricité
    ("38",  "24", "BkWh",    "Electricity Generation Total BkWh (EIA)",   "EIA_ELEC_GEN"),
    ("39",  "24", "BkWh",    "Electricity Generation Renewables (EIA)",   "EIA_ELEC_REN"),
    # Consommation énergie totale
    ("44",  "2",  "QBtu",    "Total Primary Energy Consumption QBtu (EIA)", "EIA_TPEC"),
]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_eia(
    client: httpx.AsyncClient,
    api_key: str,
    eia_country: str,
    product_id: str,
    activity_id: str,
) -> list[dict]:
    """Récupère une série EIA pour un pays et un indicateur donnés."""
    params = {
        "api_key": api_key,
        "frequency": "annual",
        "data[0]": "value",
        "facets[countryRegionId][]": eia_country,
        "facets[productId][]": product_id,
        "facets[activityId][]": activity_id,
        "start": "2000",
        "sort[0][column]": "period",
        "sort[0][direction]": "asc",
        "offset": "0",
        "length": "100",
    }
    try:
        r = await client.get(EIA_BASE, params=params, timeout=20.0)
        if r.status_code == 403:
            log.warning("EIA 403 — vérifier la clé API")
            return []
        if r.status_code != 200:
            return []
        data = r.json()
        response = data.get("response", {})
        records = []
        for item in response.get("data", []):
            period = str(item.get("period", ""))
            value = item.get("value")
            if value is not None and period:
                try:
                    records.append({"period": period[:4], "value": float(value)})
                except (ValueError, TypeError):
                    pass
        return records
    except Exception as exc:
        log.debug("EIA fetch %s/%s/%s: %s", eia_country, product_id, activity_id, exc)
        return []


async def ingest_eia(dry_run: bool) -> tuple[int, list[str]]:
    api_key = os.environ.get("EIA_API_KEY", "")
    if not api_key:
        log.error("EIA_API_KEY non définie. Inscription gratuite: https://www.eia.gov/opendata/register.php")
        return 0, ["EIA_API_KEY missing"]

    errors: list[str] = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        for iso3, eia_code in EIA_AFRICA_COUNTRIES.items():
            for product_id, activity_id, unit, name, code in EIA_INDICATORS:
                records = await fetch_eia(http, api_key, eia_code, product_id, activity_id)
                for rec in records:
                    rows.append({
                        "country_id": iso3,
                        "indicator_code": code,
                        "indicator_name": name,
                        "value": rec["value"],
                        "unit": unit,
                        "period": rec["period"],
                        "period_type": "annual",
                        "source": "EIA_International",
                        "source_url": "https://api.eia.gov/v2/international/data/",
                    })
                await asyncio.sleep(0.15)

            log.info("  ✅ EIA %s (%s): %d records",
                     iso3, eia_code,
                     sum(1 for r in rows if r["country_id"] == iso3))

    log.info("  📦 EIA total: %d records collectés pour %d pays",
             len(rows), len(EIA_AFRICA_COUNTRIES))

    if dry_run:
        log.info("🔍 DRY-RUN EIA — %d records seraient insérés", len(rows))
        return len(rows), errors

    if rows:
        import psycopg2
        conn = psycopg2.connect(os.environ["DATABASE_URL_SYNC"])
        conn.autocommit = False
        cur = conn.cursor()
        try:
            cur.executemany("""
                INSERT INTO macro_indicators
                    (id, country_id, indicator_code, indicator_name,
                     value, unit, period, period_type, source, source_url, timestamp)
                VALUES
                    (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
                     %(value)s, %(unit)s, %(period)s, %(period_type)s, %(source)s,
                     %(source_url)s, NOW())
                ON CONFLICT (country_id, indicator_code, period, source)
                DO UPDATE SET value = EXCLUDED.value, timestamp = NOW()
            """, rows)
            conn.commit()
        except Exception as exc:
            conn.rollback()
            errors.append(f"EIA DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Ingestion EIA International Energy")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    async def main():
        db_url = os.environ.get("DATABASE_URL_SYNC")
        if not db_url and not args.dry_run:
            log.error("DATABASE_URL_SYNC non définie")
            sys.exit(1)

        log.info("🛢️  EIA International Energy Ingestion")
        t0 = time.time()
        inserted, errors = await ingest_eia(args.dry_run)
        log.info("🏁 Terminé en %.1fs — %d records, %d erreurs",
                 time.time() - t0, inserted, len(errors))
        if errors:
            log.warning("Erreurs : %s", errors[:5])
        sys.exit(0 if not errors else 1)

    asyncio.run(main())
