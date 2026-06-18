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
    # ── Macro / PIB ──────────────────────────────────────────────────────────
    "NY.GDP.MKTP.CD":    ("GDP Nominal USD", "USD"),
    "NY.GDP.MKTP.KD.ZG": ("GDP Real Growth Rate WB", "%"),
    "NY.GDP.PCAP.CD":    ("GDP per Capita USD", "USD"),
    "NY.GDP.PCAP.PP.CD": ("GDP per Capita PPP", "USD"),
    "SP.POP.TOTL":       ("Population Total", "persons"),
    "SP.URB.TOTL.IN.ZS": ("Urban Population %", "%"),
    "SP.POP.GROW":       ("Population Growth Rate", "%"),
    "FP.CPI.TOTL.ZG":    ("CPI Inflation WB", "%"),
    "NY.GNP.PCAP.CD":    ("GNI per Capita Atlas", "USD"),

    # ── Fiscal & dette ───────────────────────────────────────────────────────
    "GC.DOD.TOTL.GD.ZS": ("Central Gov Debt % GDP", "%"),
    "GC.REV.XGRT.GD.ZS": ("Gov Revenue excl Grants % GDP", "%"),
    "GC.XPN.TOTL.GD.ZS": ("Gov Expenditure % GDP", "%"),
    "DT.DOD.DECT.GD.ZS": ("External Debt Stocks % GNI", "%"),
    "DT.TDS.DECT.EX.ZS": ("Debt Service % Exports", "%"),

    # ── Secteur extérieur ────────────────────────────────────────────────────
    "NE.TRD.GNFS.ZS":    ("Trade % GDP", "%"),
    "NE.EXP.GNFS.ZS":    ("Exports % GDP", "%"),
    "NE.IMP.GNFS.ZS":    ("Imports % GDP", "%"),
    "BX.KLT.DINV.CD.WD": ("FDI Inflows USD", "USD"),
    "BX.TRF.PWKR.DT.GD.ZS": ("Personal Remittances % GDP", "%"),

    # ── Secteur financier ────────────────────────────────────────────────────
    "FD.AST.PRVT.GD.ZS": ("Domestic Credit to Private Sector % GDP", "%"),
    "FX.OWN.TOTL.ZS":    ("Account Ownership at Financial Institution %", "%"),
    "FX.OWN.TOTL.MA.ZS": ("Account Ownership Male %", "%"),
    "FX.OWN.TOTL.FE.ZS": ("Account Ownership Female %", "%"),

    # ── Marché du travail ────────────────────────────────────────────────────
    "SL.UEM.TOTL.ZS":    ("Unemployment Total WB", "%"),
    "SL.UEM.1524.ZS":    ("Youth Unemployment Rate %", "%"),
    "SL.TLF.CACT.ZS":    ("Labour Force Participation Rate %", "%"),
    "SL.TLF.CACT.FE.ZS": ("Labour Force Participation Female %", "%"),

    # ── Energie & environnement ──────────────────────────────────────────────
    "EG.ELC.ACCS.ZS":    ("Access to Electricity %", "%"),
    "EG.FEC.RNEW.ZS":    ("Renewable Energy % Mix", "%"),
    "EG.ELC.RNEW.ZS":    ("Renewable Electricity Output %", "%"),
    "EN.ATM.CO2E.PC":    ("CO2 Emissions per Capita", "tons"),
    "AG.LND.FRST.ZS":    ("Forest Area % Land", "%"),

    # ── Santé ────────────────────────────────────────────────────────────────
    "SP.DYN.LE00.IN":    ("Life Expectancy at Birth", "years"),
    "SP.DYN.LE00.FE.IN": ("Life Expectancy Female", "years"),
    "SP.DYN.LE00.MA.IN": ("Life Expectancy Male", "years"),
    "SH.DYN.MORT":       ("Under-5 Mortality Rate", "per 1000"),
    "SP.DYN.IMRT.IN":    ("Infant Mortality Rate", "per 1000"),
    "SH.STA.MMRT":       ("Maternal Mortality Ratio", "per 100k"),
    "SH.XPD.CHEX.GD.ZS": ("Current Health Expenditure % GDP", "%"),
    "SH.XPD.CHEX.PC.CD": ("Health Expenditure per Capita", "USD"),
    "SH.HIV.INCD.ZS":    ("HIV Incidence per 1000 Adults", "per 1000"),
    "SH.MLR.INCD.P3":    ("Malaria Incidence per 1000", "per 1000"),

    # ── Éducation ────────────────────────────────────────────────────────────
    "SE.ADT.LITR.ZS":    ("Adult Literacy Rate", "%"),
    "SE.PRM.ENRR":       ("Primary Enrollment Gross %", "%"),
    "SE.SEC.ENRR":       ("Secondary Enrollment Gross %", "%"),
    "SE.TER.ENRR":       ("Tertiary Enrollment Gross %", "%"),
    "SE.PRM.CMPT.ZS":    ("Primary Completion Rate %", "%"),

    # ── Capital humain ───────────────────────────────────────────────────────
    "HD.HCI.OVRL":       ("Human Capital Index", "index"),

    # ── Gouvernance (WGI) ────────────────────────────────────────────────────
    "CC.EST":            ("WGI Control of Corruption Estimate", "score"),
    "GE.EST":            ("WGI Government Effectiveness Estimate", "score"),
    "PV.EST":            ("WGI Political Stability Estimate", "score"),
    "RL.EST":            ("WGI Rule of Law Estimate", "score"),
    "RQ.EST":            ("WGI Regulatory Quality Estimate", "score"),
    "VA.EST":            ("WGI Voice and Accountability Estimate", "score"),

    # ── Technologie & connectivité ───────────────────────────────────────────
    "IT.NET.USER.ZS":    ("Internet Users % Population", "%"),
    "IT.CEL.SETS.P2":    ("Mobile Subscriptions per 100", "per 100"),

    # ── Logistique & commerce ────────────────────────────────────────────────
    "LP.LPI.OVRL.XQ":    ("Logistics Performance Index Overall", "score"),
    "IC.REG.DURS":       ("Business Registration Days", "days"),

    # ── Pauvreté & inégalités ────────────────────────────────────────────────
    "SI.POV.DDAY":       ("Poverty Rate $2.15/day", "%"),
    "SI.POV.NAHC":       ("Poverty Rate National Headcount %", "%"),
    "SI.POV.GINI":       ("GINI Coefficient", "index"),
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
        all_records.extend(rec for rec in records if rec.get("value") is not None)

        if page >= meta.get("pages", 1):
            break
        page += 1
        await asyncio.sleep(0.3)

    return all_records


async def fetch_wb_indicator_single(
    client: httpx.AsyncClient, indicator: str, iso2: str
) -> list[dict]:
    """Fallback : récupère un indicateur WB pour un seul pays."""
    try:
        r = await client.get(
            f"{WB_BASE}/country/{iso2}/indicator/{indicator}",
            params={"format": "json", "per_page": 100, "mrv": 12},
            timeout=20.0,
        )
        if r.status_code == 403:
            return []
        r.raise_for_status()
        data = r.json()
        if not data or len(data) < 2 or not data[1]:
            return []
        return [rec for rec in data[1] if rec.get("value") is not None]
    except Exception:
        return []


async def fetch_wb_indicator(client: httpx.AsyncClient, indicator: str) -> list[dict]:
    """Récupère un indicateur WB pour tous les pays africains.
    Stratégie : batch de 10 pays. Si 403, repli pays par pays (fallback)."""
    all_records: list[dict] = []
    for i, batch in enumerate(COUNTRY_BATCHES):
        try:
            batch_records = await fetch_wb_indicator_batch(client, indicator, batch)
            all_records.extend(batch_records)
        except Exception as exc:
            # 403 ou autre erreur → fallback pays par pays pour ce batch
            log.warning("  Batch %d échoué (%s) → fallback individuel", i + 1, exc)
            for iso2 in batch:
                single = await fetch_wb_indicator_single(client, indicator, iso2)
                all_records.extend(single)
                await asyncio.sleep(0.2)
        if i < len(COUNTRY_BATCHES) - 1:
            await asyncio.sleep(0.5)
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
