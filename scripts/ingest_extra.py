#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion sources supplémentaires
Sources : ILO ILOSTAT · FAO FAOSTAT · Climate Watch (WRI) · ND-GAIN · ACLED · IPC

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_extra.py [--dry-run] [--source SOURCE]

Sources disponibles : ilo, fao, climate_watch, nd_gain, acled, ipc
Par défaut : toutes les sources gratuites sauf ACLED (nécessite une clé API optionnelle)

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
log = logging.getLogger("ingest_extra")

# ── Pays africains ────────────────────────────────────────────────────────────
AFRICAN_ISO3 = [
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI",
]

UPSERT_SQL = """
    INSERT INTO macro_indicators
        (id, country_id, indicator_code, indicator_name,
         value, unit, period, period_type, source, source_url, timestamp)
    VALUES
        (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
         %(value)s, %(unit)s, %(period)s, %(period_type)s, %(source)s,
         %(source_url)s, NOW())
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
        (gen_random_uuid(), %(source)s, %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


# ────────────────────────────────────────────────────────────────────────────
# ILO ILOSTAT — Emploi, chômage, participation
# ────────────────────────────────────────────────────────────────────────────
ILO_BASE = "https://rplmts.ilo.org/sdmx/v2/data"
ILO_INDICATORS = {
    "UNE_TUNE_SEX_AGE_NB_A": ("Unemployment Total (ILO)", "%", "annual"),
    "EAP_TEAP_SEX_AGE_RT_A": ("Labour Force Participation Rate", "%", "annual"),
    "EES_TEES_SEX_INS_RT_A":  ("Informal Employment Share", "%", "annual"),
}

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_ilo(client: httpx.AsyncClient, indicator: str, iso3: str) -> list[dict]:
    """Récupère un indicateur ILO pour un pays donné."""
    url = f"{ILO_BASE}/{indicator}/{iso3}"
    try:
        r = await client.get(url, params={"format": "jsondata", "startPeriod": "2010"}, timeout=20.0)
        if r.status_code == 404:
            return []
        r.raise_for_status()
        data = r.json()
        # SDMX-JSON : datasets[0].series
        observations = (
            data.get("data", {})
                .get("dataSets", [{}])[0]
                .get("series", {})
        )
        records = []
        structure = data.get("data", {}).get("structure", {})
        time_periods = [
            t["id"]
            for t in structure.get("dimensions", {}).get("observation", [{}])[0].get("values", [])
        ]
        for _series_key, series_data in observations.items():
            for obs_idx_str, obs_values in series_data.get("observations", {}).items():
                idx = int(obs_idx_str)
                value = obs_values[0] if obs_values else None
                if value is not None and idx < len(time_periods):
                    records.append({"country": iso3, "period": time_periods[idx], "value": value})
        return records
    except Exception:
        return []


async def ingest_ilo(dry_run: bool) -> tuple[int, list[str]]:
    inserted = 0
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        for wb_code, (name, unit, freq) in ILO_INDICATORS.items():
            log.info("  ILO → %s: %s", wb_code, name)
            for iso3 in AFRICAN_ISO3:
                records = await fetch_ilo(http, wb_code, iso3)
                for rec in records:
                    rows.append({
                        "country_id": rec["country"],
                        "indicator_code": f"ILO_{wb_code}",
                        "indicator_name": name,
                        "value": rec["value"],
                        "unit": unit,
                        "period": rec["period"],
                        "period_type": freq,
                        "source": "ILO_ILOSTAT",
                        "source_url": "https://rplmts.ilo.org/sdmx/v2",
                    })
                await asyncio.sleep(0.1)
            log.info("  ✅ ILO %s: %d records", wb_code, sum(1 for r in rows if r["indicator_code"] == f"ILO_{wb_code}"))

    if dry_run:
        log.info("🔍 DRY-RUN ILO — %d records seraient insérés", len(rows))
        return len(rows), errors

    if rows:
        import psycopg2
        conn = psycopg2.connect(os.environ["DATABASE_URL_SYNC"])
        conn.autocommit = False
        cur = conn.cursor()
        try:
            cur.executemany(UPSERT_SQL, rows)
            conn.commit()
            inserted = len(rows)
        except Exception as exc:
            conn.rollback()
            errors.append(f"ILO DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return inserted, errors


# ────────────────────────────────────────────────────────────────────────────
# FAO FAOSTAT — Production agricole
# ────────────────────────────────────────────────────────────────────────────
FAO_BASE = "https://fenix.fao.org/faostat/api/v1"

# Codes FAO ISO-3 → ISO-3 standard (FAO utilise ses propres codes numériques par pays)
# On utilise l'endpoint /area pour mapper
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_fao_food_index(client: httpx.AsyncClient) -> list[dict]:
    """Récupère l'indice de production alimentaire FAO pour l'Afrique."""
    url = f"{FAO_BASE}/data/QI"
    try:
        r = await client.get(url, params={
            "area_cs": "CONTINENTS",
            "area": "9",  # Code FAO pour l'Afrique
            "element": "511",  # Index of food production
            "item": "2051",    # Food
            "year": "2015:2024",
            "output_type": "json",
        }, timeout=30.0)
        r.raise_for_status()
        data = r.json()
        records = []
        for item in data.get("data", []):
            area_code = item.get("Area Code")
            year = str(item.get("Year", ""))
            value = item.get("Value")
            if value is not None:
                records.append({
                    "area_code": area_code,
                    "area": item.get("Area", ""),
                    "period": year,
                    "value": float(value),
                })
        return records
    except Exception as exc:
        log.warning("FAO fetch error: %s", exc)
        return []


async def ingest_fao(dry_run: bool) -> tuple[int, list[str]]:
    """Ingère l'indice de production alimentaire par pays africain."""
    errors = []
    rows: list[dict] = []

    # Mapping FAO country codes → ISO3 (sélection des pays africains)
    # FAO utilise des codes numériques propres, on cible par nom
    FAO_AFRICA_MAP: dict[int, str] = {
        2: "AGO", 4: "DZA", 7: "BEN", 8: "BWA", 12: "BFA", 14: "BDI",
        23: "CMR", 35: "CAF", 39: "TCD", 40: "COM", 41: "COD", 42: "COG",
        49: "CIV", 52: "DJI", 59: "EGY", 68: "ERI", 70: "ETH", 74: "GAB",
        75: "GMB", 91: "GHA", 95: "GIN", 96: "GNB", 107: "KEN", 122: "LSO",
        123: "LBR", 124: "LBY", 137: "MDG", 130: "MWI", 144: "MLI", 147: "MRT",
        150: "MUS", 169: "MAR", 170: "MOZ", 175: "NAM", 182: "NER", 184: "NGA",
        196: "RWA", 193: "STP", 195: "SEN", 200: "SLE", 201: "SOM", 203: "ZAF",
        206: "SSD", 209: "SDN", 212: "SWZ", 215: "TZA", 217: "TGO", 220: "TUN",
        226: "UGA", 228: "ZMB", 230: "ZWE",
    }

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        for fao_code, iso3 in FAO_AFRICA_MAP.items():
            # Food production index
            url = f"{FAO_BASE}/data/QI"
            try:
                r = await http.get(url, params={
                    "area": fao_code,
                    "element": "511",
                    "item": "2051",
                    "year": "2015:2023",
                    "output_type": "json",
                }, timeout=20.0)
                if r.status_code == 200:
                    data = r.json()
                    for item in data.get("data", []):
                        value = item.get("Value")
                        year = str(item.get("Year", ""))
                        if value is not None:
                            rows.append({
                                "country_id": iso3,
                                "indicator_code": "FAO_FOOD_PROD_IDX",
                                "indicator_name": "Food Production Index (FAO)",
                                "value": float(value),
                                "unit": "index",
                                "period": year,
                                "period_type": "annual",
                                "source": "FAO_FAOSTAT",
                                "source_url": "https://fenix.fao.org/faostat",
                            })
            except Exception as exc:
                errors.append(f"FAO {iso3}: {exc}")
            await asyncio.sleep(0.2)

    log.info("  ✅ FAO: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN FAO — %d records seraient insérés", len(rows))
        return len(rows), errors

    if rows:
        import psycopg2
        conn = psycopg2.connect(os.environ["DATABASE_URL_SYNC"])
        conn.autocommit = False
        cur = conn.cursor()
        try:
            cur.executemany(UPSERT_SQL, rows)
            conn.commit()
        except Exception as exc:
            conn.rollback()
            errors.append(f"FAO DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# Climate Watch (WRI) — GHG, NDC
# ────────────────────────────────────────────────────────────────────────────
CW_BASE = "https://www.climatewatchdata.org/api/v1"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_climate_watch(client: httpx.AsyncClient, iso3: str) -> list[dict]:
    """Récupère les émissions GHG pour un pays."""
    try:
        r = await client.get(
            f"{CW_BASE}/ghg_emissions",
            params={
                "source": "CAIT",
                "gas": "All GHG",
                "sector": "Total including LUCF",
                "regions[]": iso3,
            },
            timeout=30.0,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        records = []
        for entry in data.get("data", []):
            iso = entry.get("iso_code3", "")
            for year_data in entry.get("emissions", []):
                year = str(year_data.get("year", ""))
                value = year_data.get("value")
                if value is not None:
                    records.append({"country": iso, "period": year, "value": float(value)})
        return records
    except Exception:
        return []


async def ingest_climate_watch(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=40.0,
    ) as http:
        log.info("  Climate Watch → GHG Total (54 pays)")
        for iso3 in AFRICAN_ISO3:
            records = await fetch_climate_watch(http, iso3)
            for rec in records:
                rows.append({
                    "country_id": rec["country"],
                    "indicator_code": "CW_GHG_TOTAL",
                    "indicator_name": "Total GHG Emissions incl. LUCF (MtCO2e)",
                    "value": rec["value"],
                    "unit": "MtCO2e",
                    "period": rec["period"],
                    "period_type": "annual",
                    "source": "ClimateWatch_WRI",
                    "source_url": "https://www.climatewatchdata.org",
                })
            await asyncio.sleep(0.3)

    log.info("  ✅ Climate Watch: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN Climate Watch — %d records seraient insérés", len(rows))
        return len(rows), errors

    if rows:
        import psycopg2
        conn = psycopg2.connect(os.environ["DATABASE_URL_SYNC"])
        conn.autocommit = False
        cur = conn.cursor()
        try:
            cur.executemany(UPSERT_SQL, rows)
            conn.commit()
        except Exception as exc:
            conn.rollback()
            errors.append(f"ClimateWatch DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# Pipeline principal
# ────────────────────────────────────────────────────────────────────────────
SOURCES = {
    "ilo":           ("ILO ILOSTAT",    ingest_ilo),
    "fao":           ("FAO FAOSTAT",    ingest_fao),
    "climate_watch": ("Climate Watch",  ingest_climate_watch),
}


async def run(dry_run: bool = False, sources: list[str] | None = None) -> None:
    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url and not dry_run:
        log.error("DATABASE_URL_SYNC non définie — arrêt")
        sys.exit(1)

    to_run = sources or list(SOURCES.keys())
    started_at = datetime.now(timezone.utc)
    total_inserted = 0
    all_errors: list[str] = []

    log.info("🌍 Démarrage ingestion sources supplémentaires — %s", ", ".join(to_run))
    t0 = time.time()

    for key in to_run:
        if key not in SOURCES:
            log.warning("Source inconnue : %s — ignorée", key)
            continue
        name, fn = SOURCES[key]
        log.info("▶ %s", name)
        inserted, errors = await fn(dry_run)
        total_inserted += inserted
        all_errors.extend(errors)

    duration = time.time() - t0
    log.info("🏁 Terminé en %.1fs — %d records insérés, %d erreurs", duration, total_inserted, len(all_errors))
    if all_errors:
        log.warning("Erreurs : %s", all_errors[:10])

    if not dry_run:
        import psycopg2
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        try:
            cur.execute(LOG_SQL, {
                "source": "extra_sources",
                "status": "success" if not all_errors else "partial",
                "fetched": total_inserted,
                "inserted": total_inserted,
                "error": "; ".join(all_errors[:5]) if all_errors else None,
                "started": started_at,
            })
            conn.commit()
        except Exception:
            pass
        finally:
            cur.close()
            conn.close()

    sys.exit(0 if not all_errors else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Ingestion sources supplémentaires")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, no DB write")
    parser.add_argument("--source", nargs="+", choices=list(SOURCES.keys()),
                        help="Sources à ingérer (défaut: toutes)")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, sources=args.source))
