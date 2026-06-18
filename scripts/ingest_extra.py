#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion sources supplémentaires
Sources : ILO ILOSTAT · FAO FAOSTAT · Climate Watch (WRI) · WHO GHO · WB PIP
          OECD DAC CRS · IMF PortWatch · IPC/CH (food security) · Google Trends

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_extra.py [--dry-run] [--source SOURCE]

Sources disponibles : ilo, fao, climate_watch, who_gho, wb_pip, oecd_dac,
                      imf_portwatch, ipc_food, google_trends
Par défaut : toutes les sources gratuites sans clé API requise

Requis : httpx tenacity psycopg2-binary pytrends
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
# WHO GHO — Santé mondiale (API publique, sans clé)
# https://www.who.int/data/gho/info/gho-odata-api
# ────────────────────────────────────────────────────────────────────────────
WHO_BASE = "https://ghoapi.azureedge.net/api"

# Indicateurs WHO GHO disponibles pour l'Afrique (code indicateur → (nom, unité))
WHO_INDICATORS = {
    "WHOSIS_000002":              ("HIV Prevalence % Adults 15-49", "%"),
    "MALARIA_EST_MORTALITY_RATE": ("Malaria Mortality Rate per 100k", "per 100k"),
    "MDG_0000000026":             ("TB Incidence per 100k", "per 100k"),
    "NCD_BMI_30A":                ("Obesity Prevalence Adults %", "%"),
    "SA_0000001688":              ("Alcohol Consumption Litres/Capita", "litres"),
}

# Correspondance ISO3 → WHO country code (WHO utilise ISO-3 standard)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def fetch_who_indicator(client: httpx.AsyncClient, indicator: str, iso3: str) -> list[dict]:
    try:
        r = await client.get(
            f"{WHO_BASE}/{indicator}",
            params={"$filter": f"SpatialDim eq '{iso3}'", "$select": "TimeDim,NumericValue,SpatialDim"},
            timeout=20.0,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        records = []
        for item in data.get("value", []):
            value = item.get("NumericValue")
            period = str(item.get("TimeDim", ""))
            if value is not None and period:
                records.append({"country": iso3, "period": period, "value": float(value)})
        return records
    except Exception:
        return []


async def ingest_who_gho(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        for code, (name, unit) in WHO_INDICATORS.items():
            log.info("  WHO GHO → %s: %s", code, name)
            for iso3 in AFRICAN_ISO3:
                records = await fetch_who_indicator(http, code, iso3)
                for rec in records:
                    rows.append({
                        "country_id": rec["country"],
                        "indicator_code": f"WHO_{code}",
                        "indicator_name": name,
                        "value": rec["value"],
                        "unit": unit,
                        "period": rec["period"],
                        "period_type": "annual",
                        "source": "WHO_GHO",
                        "source_url": "https://ghoapi.azureedge.net/api",
                    })
                await asyncio.sleep(0.15)
            log.info("  ✅ WHO %s: %d records", code, sum(1 for r in rows if r["indicator_code"] == f"WHO_{code}"))

    if dry_run:
        log.info("🔍 DRY-RUN WHO GHO — %d records seraient insérés", len(rows))
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
            errors.append(f"WHO DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# World Bank PIP — Pauvreté & inégalités (API publique)
# https://pip.worldbank.org/api
# ────────────────────────────────────────────────────────────────────────────
WB_PIP_BASE = "https://api.worldbank.org/pip/v1/pip"

# Correspondance ISO3 → ISO2 pour PIP
ISO3_TO_ISO2 = {
    "NGA": "NG", "ZAF": "ZA", "KEN": "KE", "GHA": "GH", "EGY": "EG",
    "MAR": "MA", "TUN": "TN", "SEN": "SN", "CIV": "CI", "CMR": "CM",
    "TZA": "TZ", "UGA": "UG", "ETH": "ET", "RWA": "RW", "COD": "CD",
    "MOZ": "MZ", "ZMB": "ZM", "AGO": "AO", "BWA": "BW", "MUS": "MU",
    "BEN": "BJ", "BFA": "BF", "GNB": "GW", "MLI": "ML", "NER": "NE",
    "TGO": "TG", "CAF": "CF", "TCD": "TD", "COG": "CG", "GNQ": "GQ",
    "GAB": "GA", "MDG": "MG", "MWI": "MW", "ZWE": "ZW", "NAM": "NA",
    "GIN": "GN", "DZA": "DZ", "LBY": "LY", "SDN": "SD", "SOM": "SO",
    "ERI": "ER", "DJI": "DJ", "SSD": "SS", "SLE": "SL", "LBR": "LR",
    "GMB": "GM", "CPV": "CV", "MRT": "MR", "LSO": "LS", "SWZ": "SZ",
    "COM": "KM", "STP": "ST", "BDI": "BI",
}

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def fetch_pip(client: httpx.AsyncClient, iso2: str) -> list[dict]:
    try:
        r = await client.get(
            WB_PIP_BASE,
            params={
                "country": iso2,
                "year": "all",
                "povline": 2.15,
                "fill_gaps": False,
                "welfare_type": "all",
                "reporting_level": "national",
                "format": "json",
            },
            timeout=20.0,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        records = []
        for item in data:
            year = str(item.get("reporting_year", ""))
            headcount = item.get("headcount")
            gini = item.get("gini")
            if headcount is not None:
                records.append({"period": year, "indicator": "WB_PIP_HEADCOUNT_215", "name": "Poverty Headcount $2.15/day (PIP)", "value": headcount * 100, "unit": "%"})
            if gini is not None:
                records.append({"period": year, "indicator": "WB_PIP_GINI", "name": "GINI Coefficient (PIP)", "value": gini, "unit": "index"})
        return records
    except Exception:
        return []


async def ingest_wb_pip(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        log.info("  WB PIP → Pauvreté & GINI (54 pays)")
        for iso3 in AFRICAN_ISO3:
            iso2 = ISO3_TO_ISO2.get(iso3)
            if not iso2:
                continue
            records = await fetch_pip(http, iso2)
            for rec in records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": rec["indicator"],
                    "indicator_name": rec["name"],
                    "value": rec["value"],
                    "unit": rec["unit"],
                    "period": rec["period"],
                    "period_type": "annual",
                    "source": "WorldBank_PIP",
                    "source_url": "https://pip.worldbank.org",
                })
            await asyncio.sleep(0.2)
        log.info("  ✅ WB PIP: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN WB PIP — %d records seraient insérés", len(rows))
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
            errors.append(f"WB PIP DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# OECD DAC CRS — Aide publique au développement (API SDMX gratuite)
# https://stats.oecd.org/SDMX-JSON/data/DAC1
# ────────────────────────────────────────────────────────────────────────────
OECD_BASE = "https://stats.oecd.org/SDMX-JSON/data"

# Codes pays OECD DAC pour les pays africains (recipient codes)
OECD_AFRICA_RECIPIENTS = {
    "615": "NGA", "627": "ZAF", "614": "KEN", "611": "GHA", "651": "EGY",
    "612": "MAR", "616": "TUN", "636": "SEN", "613": "CIV", "622": "CMR",
    "738": "TZA", "741": "UGA", "632": "ETH", "646": "RWA", "621": "COD",
    "637": "MOZ", "754": "ZMB", "610": "AGO", "619": "BWA", "733": "MUS",
    "616": "BEN", "617": "BFA", "652": "GNB", "618": "MLI", "639": "NER",
    "640": "TGO", "620": "CAF", "623": "TCD", "626": "COG", "628": "GNQ",
    "629": "GAB", "634": "MDG", "635": "MWI", "742": "ZWE", "638": "NAM",
    "630": "GIN", "612": "DZA", "618": "LBY", "650": "SDN", "649": "SOM",
}

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=30))
async def fetch_oecd_oda(client: httpx.AsyncClient, recipient_code: str) -> list[dict]:
    """Récupère l'ODA nette reçue par un pays bénéficiaire (DAC1)."""
    try:
        url = f"{OECD_BASE}/DAC1/all+{recipient_code}.206.1140.D.2010:2023"
        r = await client.get(url, params={"contentType": "json"}, timeout=30.0)
        if r.status_code != 200:
            return []
        data = r.json()
        obs = (data.get("dataSets", [{}])[0].get("series", {})
               .get("0:0:0:0:0", {}).get("observations", {}))
        time_periods = [
            t.get("id", "")
            for t in (data.get("structure", {}).get("dimensions", {})
                      .get("observation", [{}])[0].get("values", []))
        ]
        records = []
        for idx_str, vals in obs.items():
            idx = int(idx_str)
            value = vals[0] if vals else None
            if value is not None and idx < len(time_periods):
                records.append({"period": time_periods[idx], "value": float(value)})
        return records
    except Exception:
        return []


async def ingest_oecd_dac(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=40.0,
    ) as http:
        log.info("  OECD DAC → ODA nette par pays africain")
        seen = set()
        for rec_code, iso3 in OECD_AFRICA_RECIPIENTS.items():
            if iso3 in seen:
                continue
            seen.add(iso3)
            records = await fetch_oecd_oda(http, rec_code)
            for rec in records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": "OECD_ODA_NET_USD",
                    "indicator_name": "Net ODA Received USD millions (OECD DAC)",
                    "value": rec["value"],
                    "unit": "USD_MM",
                    "period": rec["period"],
                    "period_type": "annual",
                    "source": "OECD_DAC",
                    "source_url": "https://stats.oecd.org/SDMX-JSON/data/DAC1",
                })
            await asyncio.sleep(0.3)
        log.info("  ✅ OECD DAC: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN OECD DAC — %d records seraient insérés", len(rows))
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
            errors.append(f"OECD DAC DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# IMF PortWatch — Trafic maritime & commerce portuaire (API gratuite)
# https://portwatch.imf.org
# ────────────────────────────────────────────────────────────────────────────
PORTWATCH_BASE = "https://portwatch.imf.org/api/v1"

# Ports africains majeurs (UNLOCODE → ISO3)
AFRICAN_PORTS = {
    "NGAPP": "NGA",  # Apapa (Lagos)
    "ZADUR": "ZAF",  # Durban
    "ZACPT": "ZAF",  # Cape Town
    "EGPSD": "EGY",  # Port Said
    "EGALY": "EGY",  # Alexandria
    "MAPTM": "MAR",  # Tanger Med
    "KEMIA": "KEN",  # Mombasa
    "TZDARES": "TZA", # Dar es Salaam
    "GHACC": "GHA",  # Tema (Accra)
    "SNDKR": "SEN",  # Dakar
    "CIABD": "CIV",  # Abidjan
    "TZDAR": "TZA",  # Zanzibar
    "MZMPUTO": "MOZ", # Maputo
    "AOLAD": "AGO",  # Luanda
    "DZDZA": "DZA",  # Algiers
}

@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=20))
async def fetch_portwatch(client: httpx.AsyncClient, port_code: str) -> list[dict]:
    try:
        r = await client.get(
            f"{PORTWATCH_BASE}/portcalls",
            params={"portcode": port_code, "frequency": "monthly", "format": "json"},
            timeout=20.0,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        records = []
        for item in data if isinstance(data, list) else data.get("data", []):
            date = item.get("date") or item.get("period", "")
            calls = item.get("portcalls") or item.get("vessel_calls")
            if date and calls is not None:
                records.append({"period": str(date)[:7], "value": float(calls)})
        return records
    except Exception:
        return []


async def ingest_imf_portwatch(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        log.info("  IMF PortWatch → Appels de navires (15 ports africains)")
        for port_code, iso3 in AFRICAN_PORTS.items():
            records = await fetch_portwatch(http, port_code)
            for rec in records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": f"PORTWATCH_CALLS_{port_code}",
                    "indicator_name": f"Port Vessel Calls — {port_code} (IMF PortWatch)",
                    "value": rec["value"],
                    "unit": "vessel calls",
                    "period": rec["period"],
                    "period_type": "monthly",
                    "source": "IMF_PortWatch",
                    "source_url": "https://portwatch.imf.org",
                })
            await asyncio.sleep(0.3)
        log.info("  ✅ IMF PortWatch: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN PortWatch — %d records seraient insérés", len(rows))
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
            errors.append(f"PortWatch DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# IPC/CH — Sécurité alimentaire (Cadre Intégré de Classification)
# https://www.ipcinfo.org/ipcinfo-website/ipc-dashboard-and-resources/ipc-api
# ────────────────────────────────────────────────────────────────────────────
IPC_BASE = "https://api.ipcinfo.org"

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def fetch_ipc(client: httpx.AsyncClient, iso3: str) -> list[dict]:
    try:
        r = await client.get(
            f"{IPC_BASE}/country",
            params={"country": iso3, "format": "json"},
            timeout=20.0,
        )
        if r.status_code != 200:
            return []
        data = r.json()
        records = []
        for entry in data if isinstance(data, list) else [data]:
            period = str(entry.get("year", entry.get("reference_year", "")))
            phase3plus = entry.get("phase3plus_pop") or entry.get("p3plus")
            if period and phase3plus is not None:
                records.append({
                    "period": period,
                    "indicator": "IPC_PHASE3PLUS_POP",
                    "name": "IPC Phase 3+ Population (Acute Food Insecurity)",
                    "value": float(phase3plus),
                    "unit": "persons",
                })
        return records
    except Exception:
        return []


async def ingest_ipc_food(dry_run: bool) -> tuple[int, list[str]]:
    errors = []
    rows: list[dict] = []

    # Pays africains ayant des évaluations IPC régulières
    IPC_COUNTRIES = [
        "ETH", "SOM", "SSD", "SDN", "NGA", "NER", "MLI", "BFA", "CMR",
        "CAF", "COD", "ZMB", "ZWE", "MOZ", "MDG", "KEN", "UGA", "TZA",
        "SEN", "MRT", "DJI", "ERI", "BDI", "RWA", "SLE", "LBR", "GIN",
        "GMB", "TGO", "BEN", "GNB",
    ]

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        log.info("  IPC/CH → Insécurité alimentaire aiguë")
        for iso3 in IPC_COUNTRIES:
            records = await fetch_ipc(http, iso3)
            for rec in records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": rec["indicator"],
                    "indicator_name": rec["name"],
                    "value": rec["value"],
                    "unit": rec["unit"],
                    "period": rec["period"],
                    "period_type": "annual",
                    "source": "IPC_CH",
                    "source_url": "https://www.ipcinfo.org",
                })
            await asyncio.sleep(0.2)
        log.info("  ✅ IPC/CH: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN IPC — %d records seraient insérés", len(rows))
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
            errors.append(f"IPC DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# Google Trends — Proxy d'activité économique (pytrends, sans clé)
# ────────────────────────────────────────────────────────────────────────────
GOOGLE_TRENDS_KEYWORDS = {
    "unemployment": "Google Trends: Unemployment Search Index",
    "inflation":    "Google Trends: Inflation Search Index",
    "forex":        "Google Trends: Forex Search Index",
    "recession":    "Google Trends: Recession Search Index",
}

# Correspondance ISO3 → code pays Google Trends (ISO-2)
TRENDS_GEO = {
    "NGA": "NG", "ZAF": "ZA", "KEN": "KE", "GHA": "GH", "EGY": "EG",
    "MAR": "MA", "TUN": "TN", "SEN": "SN", "CIV": "CI", "CMR": "CM",
    "TZA": "TZ", "UGA": "UG", "ETH": "ET", "RWA": "RW",
}

async def ingest_google_trends(dry_run: bool) -> tuple[int, list[str]]:
    """Récupère les tendances de recherche pour des mots-clés économiques."""
    errors = []
    rows: list[dict] = []

    try:
        from pytrends.request import TrendReq
    except ImportError:
        log.warning("pytrends non installé — skip Google Trends (pip install pytrends)")
        return 0, ["pytrends not installed"]

    import asyncio
    loop = asyncio.get_event_loop()

    def _fetch_trends_sync(keyword: str, geo: str) -> list[dict]:
        try:
            pt = TrendReq(hl="en-US", tz=0, timeout=(10, 25), retries=2, backoff_factor=0.5)
            pt.build_payload([keyword], cat=0, timeframe="today 5-y", geo=geo)
            df = pt.interest_over_time()
            if df.empty or keyword not in df.columns:
                return []
            records = []
            for date, row in df.iterrows():
                val = row[keyword]
                if val > 0:
                    records.append({"period": str(date)[:7], "value": float(val)})
            return records
        except Exception as exc:
            log.debug("Google Trends %s/%s: %s", keyword, geo, exc)
            return []

    log.info("  Google Trends → %d mots-clés × %d pays", len(GOOGLE_TRENDS_KEYWORDS), len(TRENDS_GEO))
    for keyword, name in GOOGLE_TRENDS_KEYWORDS.items():
        for iso3, geo in TRENDS_GEO.items():
            records = await loop.run_in_executor(None, _fetch_trends_sync, keyword, geo)
            for rec in records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": f"GTRENDS_{keyword.upper()}",
                    "indicator_name": name,
                    "value": rec["value"],
                    "unit": "index (0-100)",
                    "period": rec["period"],
                    "period_type": "monthly",
                    "source": "Google_Trends",
                    "source_url": "https://trends.google.com",
                })
            await asyncio.sleep(1.5)  # Rate limit Google Trends

    log.info("  ✅ Google Trends: %d records collectés", len(rows))

    if dry_run:
        log.info("🔍 DRY-RUN Google Trends — %d records seraient insérés", len(rows))
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
            errors.append(f"Google Trends DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


# ────────────────────────────────────────────────────────────────────────────
# Pipeline principal
# ────────────────────────────────────────────────────────────────────────────
SOURCES = {
    "ilo":            ("ILO ILOSTAT",         ingest_ilo),
    "fao":            ("FAO FAOSTAT",          ingest_fao),
    "climate_watch":  ("Climate Watch WRI",    ingest_climate_watch),
    "who_gho":        ("WHO GHO",              ingest_who_gho),
    "wb_pip":         ("World Bank PIP",       ingest_wb_pip),
    "oecd_dac":       ("OECD DAC CRS",         ingest_oecd_dac),
    "imf_portwatch":  ("IMF PortWatch",        ingest_imf_portwatch),
    "ipc_food":       ("IPC/CH Food Security", ingest_ipc_food),
    "google_trends":  ("Google Trends",        ingest_google_trends),
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
                        help=f"Sources à ingérer (défaut: toutes). Disponibles: {', '.join(SOURCES.keys())}")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run, sources=args.source))
