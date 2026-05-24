#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion IMF WEO
Remplace le Dagster asset `imf_weo_to_database` pour GitHub Actions.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_imf.py [--dry-run]

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
log = logging.getLogger("ingest_imf")

# ── Config ────────────────────────────────────────────────────────────────
IMF_BASE = "https://www.imf.org/external/datamapper/api/v1"
PERIODS = ",".join(str(y) for y in range(2015, 2026))

AFRICAN_COUNTRIES = [
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI",
]
AFRICAN_COUNTRIES_SET = set(AFRICAN_COUNTRIES)

IMF_INDICATORS = {
    "NGDP_RPCH":   ("GDP Real Growth Rate", "%"),
    "NGDPDPC":     ("GDP per Capita USD", "USD"),
    "NGDPD":       ("GDP Nominal Billions USD", "USD_BN"),
    "PPPGDP":      ("GDP PPP Billions USD", "USD_BN"),
    "PCPIPCH":     ("CPI Inflation Rate", "%"),
    "PCPIEPCH":    ("End-Period Inflation", "%"),
    "GGXCNL_NGDP": ("Fiscal Balance % GDP", "% GDP"),
    "GGXONLB_NGDP":("Primary Balance % GDP", "% GDP"),
    "GGXWDG_NGDP": ("Government Debt % GDP", "% GDP"),
    "GGR_NGDP":    ("Government Revenue % GDP", "% GDP"),
    "GGX_NGDP":    ("Government Expenditure % GDP", "% GDP"),
    "BCA_NGDPD":   ("Current Account % GDP", "% GDP"),
    "ASSDRESES":   ("FX Reserves Months Imports", "months"),
    "LUR":         ("Unemployment Rate", "%"),
    "LP":          ("Population Millions", "millions"),
}

UPSERT_SQL = """
    INSERT INTO macro_indicators
        (id, country_id, indicator_code, indicator_name,
         value, unit, period, period_type, source, source_url, timestamp)
    VALUES
        (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
         %(value)s, %(unit)s, %(period)s, 'annual', 'IMF',
         'https://imf.org/external/datamapper', NOW())
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
        (gen_random_uuid(), 'IMF_WEO', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


# ── HTTP avec retry ───────────────────────────────────────────────────────
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_indicator_batch(
    client: httpx.AsyncClient,
    indicator: str,
    batch: list[str],
) -> dict:
    url = f"{IMF_BASE}/{indicator}/{'/'.join(batch)}"
    r = await client.get(url, params={"periods": PERIODS}, timeout=30.0)
    r.raise_for_status()
    return r.json().get("values", {}).get(indicator, {})


async def fetch_indicator(client: httpx.AsyncClient, indicator: str) -> dict:
    """Agrège les batches de 20 pays pour un indicateur."""
    all_data: dict = {}
    batches = [AFRICAN_COUNTRIES[i:i + 20] for i in range(0, len(AFRICAN_COUNTRIES), 20)]
    for batch in batches:
        try:
            data = await fetch_indicator_batch(client, indicator, batch)
            all_data.update(data)
            await asyncio.sleep(0.5)
        except Exception as exc:
            log.warning("IMF %s batch %s…: %s", indicator, batch[:2], exc)
    return all_data


# ── Pipeline principal ────────────────────────────────────────────────────
async def run(dry_run: bool = False) -> None:
    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        log.error("DATABASE_URL_SYNC non définie — arrêt")
        sys.exit(1)

    started_at = datetime.now(timezone.utc)
    total_inserted = 0
    errors: list[str] = []

    log.info("🌍 Démarrage ingestion IMF WEO — %d indicateurs", len(IMF_INDICATORS))
    t0 = time.time()

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=60.0,
    ) as http:
        all_results: dict[str, dict] = {}

        for code, (name, unit) in IMF_INDICATORS.items():
            log.info("  → %s: %s", code, name)
            try:
                data = await fetch_indicator(http, code)
                all_results[code] = {"name": name, "unit": unit, "data": data}
                log.info("  ✅ %s: %d pays", code, len(data))
            except Exception as exc:
                errors.append(f"{code}: {exc}")
                log.warning("  ❌ %s: %s", code, exc)

    if dry_run:
        records = sum(
            sum(len(v) for v in ind["data"].values())
            for ind in all_results.values()
        )
        log.info("🔍 DRY-RUN — %d records seraient insérés (aucune écriture DB)", records)
        return

    # ── Écriture en base (psycopg2 sync) ─────────────────────────────────
    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        for code, ind in all_results.items():
            name = ind["name"]
            unit = ind["unit"]
            batch_rows = []

            for country_id, yearly in ind["data"].items():
                if country_id not in AFRICAN_COUNTRIES_SET:
                    continue
                for year, value in yearly.items():
                    if value is None:
                        continue
                    batch_rows.append({
                        "country_id": country_id,
                        "indicator_code": code,
                        "indicator_name": name,
                        "value": float(value),
                        "unit": unit,
                        "period": str(year),
                    })

            if batch_rows:
                cur.executemany(UPSERT_SQL, batch_rows)
                total_inserted += len(batch_rows)

        conn.commit()
        log.info("✅ %d records insérés/mis à jour", total_inserted)

        # Audit log
        cur.execute(LOG_SQL, {
            "status": "success" if not errors else "partial",
            "fetched": total_inserted,
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
    parser = argparse.ArgumentParser(description="MANSA — Ingestion IMF WEO")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch data only, no DB write")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))
