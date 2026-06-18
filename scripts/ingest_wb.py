#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion World Bank WDI
Remplace le Dagster asset `worldbank_wdi_to_database` pour GitHub Actions.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_wb.py [--dry-run]

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
log = logging.getLogger("ingest_wb")

# ── Config ────────────────────────────────────────────────────────────────
WB_BASE = "https://api.worldbank.org/v2"

AFRICAN_ISO3 = {
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI",
}

# country/all évite les URL multi-pays trop longues (WAF 403 avec `;`-séparés)

WB_INDICATORS = {
    "NY.GDP.MKTP.CD":    ("GDP Nominal USD", "USD"),
    "SP.POP.TOTL":       ("Population Total", "persons"),
    "SH.DYN.MORT":       ("Under-5 Mortality Rate", "per 1000"),
    "SE.ADT.LITR.ZS":    ("Adult Literacy Rate", "%"),
    "EG.ELC.ACCS.ZS":    ("Access to Electricity", "%"),
    "IT.NET.USER.ZS":    ("Internet Users % Population", "%"),
    "NE.TRD.GNFS.ZS":    ("Trade % GDP", "%"),
    "BX.KLT.DINV.CD.WD": ("FDI Inflows USD", "USD"),
    "GC.DOD.TOTL.GD.ZS": ("Central Gov Debt % GDP", "%"),
    "FP.CPI.TOTL.ZG":    ("CPI Inflation WB", "%"),
    "NY.GNP.PCAP.CD":    ("GNI per Capita Atlas", "USD"),
    "SL.UEM.TOTL.ZS":    ("Unemployment Total WB", "%"),
    "EG.FEC.RNEW.ZS":    ("Renewable Energy % Mix", "%"),
    "EN.ATM.CO2E.PC":    ("CO2 Emissions per Capita", "tons"),
    "SI.POV.DDAY":       ("Poverty Rate $2.15/day", "%"),
    "SP.DYN.LE00.IN":    ("Life Expectancy at Birth", "years"),
    "HD.HCI.OVRL":       ("Human Capital Index", "index"),
}

UPSERT_SQL = """
    INSERT INTO macro_indicators
        (id, country_id, indicator_code, indicator_name,
         value, unit, period, period_type, source, source_url, timestamp)
    VALUES
        (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
         %(value)s, %(unit)s, %(period)s, 'annual', 'WorldBank',
         'https://api.worldbank.org/v2', NOW())
    ON CONFLICT (country_id, indicator_code, period, source)
    DO UPDATE SET
        value = EXCLUDED.value,
        indicator_name = EXCLUDED.indicator_name,
        timestamp = NOW()
"""

LOG_SQL = """
    INSERT INTO data_ingestion_logs
        (id, source, status, records_fetched, records_inserted,
         error_message, started_at, completed_at)
    VALUES
        (gen_random_uuid(), 'WorldBank_WDI', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


# ── HTTP avec retry ───────────────────────────────────────────────────────
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_wb_indicator(client: httpx.AsyncClient, indicator: str) -> list[dict]:
    """Récupère un indicateur WB pour tous les pays africains (avec pagination)."""
    url = f"{WB_BASE}/country/all/indicator/{indicator}"
    all_records: list[dict] = []
    page = 1

    while True:
        r = await client.get(url, params={
            "format": "json",
            "per_page": 1000,
            "mrv": 12,   # 12 dernières valeurs par pays
            "page": page,
        }, timeout=30.0)
        r.raise_for_status()

        data = r.json()
        if not data or len(data) < 2 or not data[1]:
            break

        meta, records = data[0], data[1]
        all_records.extend(r for r in records if r.get("value") is not None)

        if page >= meta.get("pages", 1):
            break
        page += 1
        await asyncio.sleep(0.3)

    return all_records


def records_to_dict(records: list[dict]) -> dict[str, dict[str, float]]:
    """Transforme [{countryiso3code, date, value}] → {iso3: {year: value}}."""
    result: dict[str, dict[str, float]] = {}
    for r in records:
        iso3 = r.get("countryiso3code") or ""
        year = r.get("date") or ""
        value = r.get("value")
        if iso3 in AFRICAN_ISO3 and year and value is not None:
            result.setdefault(iso3, {})[year] = float(value)
    return result


# ── Pipeline principal ────────────────────────────────────────────────────
async def run(dry_run: bool = False) -> None:
    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        log.error("DATABASE_URL_SYNC non définie — arrêt")
        sys.exit(1)

    started_at = datetime.now(timezone.utc)
    total_inserted = 0
    skipped = 0
    errors: list[str] = []

    log.info("🌍 Démarrage ingestion World Bank WDI — %d indicateurs", len(WB_INDICATORS))
    t0 = time.time()

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=60.0,
    ) as http:
        all_results: dict[str, dict] = {}

        for wb_code, (name, unit) in WB_INDICATORS.items():
            log.info("  → %s: %s", wb_code, name)
            try:
                records = await fetch_wb_indicator(http, wb_code)
                country_data = records_to_dict(records)
                all_results[wb_code] = {
                    "name": name, "unit": unit,
                    "data": country_data,
                    "raw_count": len(records),
                }
                log.info("  ✅ %s: %d records bruts", wb_code, len(records))
                await asyncio.sleep(1.0)   # Respecter le rate limit WB
            except Exception as exc:
                errors.append(f"{wb_code}: {exc}")
                log.warning("  ❌ %s: %s", wb_code, exc)

    if dry_run:
        total = sum(
            sum(len(v) for v in ind["data"].values())
            for ind in all_results.values()
        )
        log.info("🔍 DRY-RUN — %d records seraient insérés (aucune écriture DB)", total)
        return

    # ── Écriture en base (psycopg2 sync) ─────────────────────────────────
    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        for wb_code, ind in all_results.items():
            batch_rows = []
            for country_id, yearly in ind["data"].items():
                for year, value in yearly.items():
                    batch_rows.append({
                        "country_id": country_id,
                        "indicator_code": wb_code,
                        "indicator_name": ind["name"],
                        "value": value,
                        "unit": ind["unit"],
                        "period": year,
                    })

            if batch_rows:
                cur.executemany(UPSERT_SQL, batch_rows)
                total_inserted += len(batch_rows)

        conn.commit()
        log.info("✅ %d records insérés/mis à jour, %d ignorés", total_inserted, skipped)

        # Audit log
        cur.execute(LOG_SQL, {
            "status": "success" if not errors else "partial",
            "fetched": total_inserted + skipped,
            "inserted": total_inserted,
            "error": "; ".join(errors[:5]) if errors else None,
            "started": started_at,
        })
        conn.commit()

    except Exception as exc:
        conn.rollback()
        log.error("Erreur DB: %s", exc)
        try:
            cur.execute(LOG_SQL, {
                "status": "error", "fetched": 0, "inserted": 0,
                "error": str(exc)[:500], "started": started_at,
            })
            conn.commit()
        except Exception:
            pass
        raise
    finally:
        cur.close()
        conn.close()

    duration = time.time() - t0
    log.info("🏁 Terminé en %.1fs — %d erreurs", duration, len(errors))
    if errors:
        log.warning("Indicateurs en erreur : %s", errors)
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Ingestion World Bank WDI")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch data only, no DB write")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))
