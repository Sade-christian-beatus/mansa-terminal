#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion UN Comtrade (Flux commerciaux bilatéraux)
API : https://comtradeapi.un.org/data/v1/get/{typeCode}/{freqCode}/{clCode}

Usage :
    COMTRADE_SUBSCRIPTION_KEY=yourkey DATABASE_URL_SYNC=postgresql://... \
        python scripts/ingest_comtrade.py [--dry-run] [--year 2023]

Clé gratuite (500 req/j) : https://comtradeapi.un.org/  → Register → Free Plan
Sans clé : limité à 100 req/heure, timeout fréquent sur gros volumes

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
log = logging.getLogger("ingest_comtrade")

COMTRADE_BASE = "https://comtradeapi.un.org/data/v1/get"

# Codes M49 (UN Comtrade reporter codes) → ISO3
# Source : https://comtradeapi.un.org/files/v1/app/reference/Reporters.json
AFRICA_M49: dict[str, str] = {
    "12": "DZA",   # Algeria
    "24": "AGO",   # Angola
    "204": "BEN",  # Benin
    "72": "BWA",   # Botswana
    "854": "BFA",  # Burkina Faso
    "108": "BDI",  # Burundi
    "132": "CPV",  # Cabo Verde
    "120": "CMR",  # Cameroon
    "140": "CAF",  # Central African Republic
    "174": "COM",  # Comoros
    "178": "COG",  # Congo
    "384": "CIV",  # Côte d'Ivoire
    "180": "COD",  # DR Congo
    "262": "DJI",  # Djibouti
    "818": "EGY",  # Egypt
    "232": "ERI",  # Eritrea
    "231": "ETH",  # Ethiopia
    "266": "GAB",  # Gabon
    "270": "GMB",  # Gambia
    "288": "GHA",  # Ghana
    "324": "GIN",  # Guinea
    "624": "GNB",  # Guinea-Bissau
    "404": "KEN",  # Kenya
    "426": "LSO",  # Lesotho
    "430": "LBR",  # Liberia
    "434": "LBY",  # Libya
    "450": "MDG",  # Madagascar
    "454": "MWI",  # Malawi
    "466": "MLI",  # Mali
    "478": "MRT",  # Mauritania
    "480": "MUS",  # Mauritius
    "504": "MAR",  # Morocco
    "508": "MOZ",  # Mozambique
    "516": "NAM",  # Namibia
    "562": "NER",  # Niger
    "566": "NGA",  # Nigeria
    "646": "RWA",  # Rwanda
    "678": "STP",  # São Tomé and Príncipe
    "686": "SEN",  # Senegal
    "694": "SLE",  # Sierra Leone
    "706": "SOM",  # Somalia
    "710": "ZAF",  # South Africa
    "729": "SDN",  # Sudan
    "748": "SWZ",  # Eswatini
    "834": "TZA",  # Tanzania
    "768": "TGO",  # Togo
    "788": "TUN",  # Tunisia
    "800": "UGA",  # Uganda
    "894": "ZMB",  # Zambia
    "716": "ZWE",  # Zimbabwe
}

# Partenaires commerciaux clés (M49) — Monde + grands partenaires Afrique
PARTNERS = {
    "0": "World",
    "156": "China",
    "842": "USA",
    "699": "India",
    "276": "Germany",
    "250": "France",
    "826": "UK",
    "792": "Turkey",
}

# Codes HS simplifiés — totaux et quelques sections clés
CMD_CODES = {
    "TOTAL": "All Commodities (Total Trade)",
    "AG2": "Food & Agriculture (HS 01-24)",
    "AG6": "Energy (HS 27)",
    "AG4": "Machinery & Equipment (HS 84-85)",
}

UPSERT_SQL = """
    INSERT INTO macro_indicators
        (id, country_id, indicator_code, indicator_name,
         value, unit, period, period_type, source, source_url, timestamp)
    VALUES
        (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
         %(value)s, %(unit)s, %(period)s, %(period_type)s, %(source)s,
         %(source_url)s, NOW())
    ON CONFLICT (country_id, indicator_code, period, source)
    DO UPDATE SET value = EXCLUDED.value, timestamp = NOW()
"""

LOG_SQL = """
    INSERT INTO data_ingestion_logs
        (id, source, status, records_fetched, records_inserted,
         error_message, started_at, completed_at)
    VALUES
        (gen_random_uuid(), 'UN_Comtrade', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=3, max=60))
async def fetch_comtrade(
    client: httpx.AsyncClient,
    subscription_key: str | None,
    reporter_m49: str,
    period: str,
    cmd_code: str = "TOTAL",
    flow_code: str = "X,M",
    partner_code: str = "0",
) -> list[dict]:
    """
    Récupère les flux commerciaux depuis UN Comtrade API v1.
    typeCode=C (commodity), freqCode=A (annual), clCode=HS
    """
    url = f"{COMTRADE_BASE}/C/A/HS"
    headers = {}
    if subscription_key:
        headers["Ocp-Apim-Subscription-Key"] = subscription_key

    params = {
        "reporterCode": reporter_m49,
        "period": period,
        "partnerCode": partner_code,
        "cmdCode": cmd_code,
        "flowCode": flow_code,
        "includeDesc": "true",
        "breakdownMode": "classic",
    }

    try:
        r = await client.get(url, headers=headers, params=params, timeout=25.0)
        if r.status_code == 429:
            log.warning("Comtrade rate limit — attente 60s")
            await asyncio.sleep(60)
            return []
        if r.status_code in (401, 403):
            log.warning("Comtrade auth error %d — vérifier COMTRADE_SUBSCRIPTION_KEY", r.status_code)
            return []
        if r.status_code != 200:
            return []

        data = r.json()
        records = []
        for item in data.get("data", []):
            flow = item.get("flowCode", "")  # X=export, M=import
            value = item.get("primaryValue") or item.get("cifValue") or item.get("fobValue")
            if value is None:
                continue
            records.append({
                "flow": flow,
                "value": float(value),
                "reporter_m49": reporter_m49,
                "cmd": item.get("cmdCode", cmd_code),
                "partner": item.get("partnerCode", partner_code),
            })
        return records
    except Exception as exc:
        log.debug("Comtrade %s/%s: %s", reporter_m49, period, exc)
        return []


async def ingest_comtrade(dry_run: bool, year: int) -> tuple[int, list[str]]:
    sub_key = os.environ.get("COMTRADE_SUBSCRIPTION_KEY", "")
    if not sub_key:
        log.warning(
            "COMTRADE_SUBSCRIPTION_KEY non définie — mode sans clé (limité à ~10 pays). "
            "Inscription gratuite : https://comtradeapi.un.org/"
        )

    errors: list[str] = []
    rows: list[dict] = []
    period = str(year)

    # Sans clé, limiter aux 15 plus grandes économies africaines
    # Avec clé, traiter tous les pays
    if sub_key:
        countries_to_fetch = list(AFRICA_M49.items())
    else:
        priority_m49 = {"566", "710", "818", "504", "288", "404", "231", "12",
                        "434", "686", "800", "120", "508", "834", "716"}
        countries_to_fetch = [(m49, iso3) for m49, iso3 in AFRICA_M49.items() if m49 in priority_m49]

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=30.0,
    ) as http:
        log.info("  UN Comtrade → %d pays, année %s", len(countries_to_fetch), period)

        for m49, iso3 in countries_to_fetch:
            # Exports totaux vers le monde
            export_records = await fetch_comtrade(http, sub_key or None, m49, period, "TOTAL", "X", "0")
            for rec in export_records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": "COMTRADE_EXPORTS_TOTAL_USD",
                    "indicator_name": "Total Exports USD (UN Comtrade)",
                    "value": rec["value"],
                    "unit": "USD",
                    "period": period,
                    "period_type": "annual",
                    "source": "UN_Comtrade",
                    "source_url": COMTRADE_BASE,
                })

            # Imports totaux depuis le monde
            import_records = await fetch_comtrade(http, sub_key or None, m49, period, "TOTAL", "M", "0")
            for rec in import_records:
                rows.append({
                    "country_id": iso3,
                    "indicator_code": "COMTRADE_IMPORTS_TOTAL_USD",
                    "indicator_name": "Total Imports USD (UN Comtrade)",
                    "value": rec["value"],
                    "unit": "USD",
                    "period": period,
                    "period_type": "annual",
                    "source": "UN_Comtrade",
                    "source_url": COMTRADE_BASE,
                })

            # Trade balance (calculée côté DB)
            if export_records and import_records:
                exports = sum(r["value"] for r in export_records)
                imports = sum(r["value"] for r in import_records)
                rows.append({
                    "country_id": iso3,
                    "indicator_code": "COMTRADE_TRADE_BALANCE_USD",
                    "indicator_name": "Trade Balance USD (Exports-Imports, UN Comtrade)",
                    "value": exports - imports,
                    "unit": "USD",
                    "period": period,
                    "period_type": "annual",
                    "source": "UN_Comtrade",
                    "source_url": COMTRADE_BASE,
                })

            log.info("  ✅ Comtrade %s (%s): %d records", iso3, m49,
                     sum(1 for r in rows if r["country_id"] == iso3))
            # Respecter les rate limits
            await asyncio.sleep(1.2 if sub_key else 3.0)

    log.info("  📦 UN Comtrade total: %d records, %d pays", len(rows), len(countries_to_fetch))

    if dry_run:
        log.info("🔍 DRY-RUN Comtrade — %d records seraient insérés", len(rows))
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
            errors.append(f"Comtrade DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — UN Comtrade Trade Flows Ingestion")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--year", type=int, default=datetime.now().year - 1,
        help="Année à ingérer (défaut: année précédente)"
    )
    parser.add_argument(
        "--years", nargs="+", type=int,
        help="Plusieurs années (ex: --years 2020 2021 2022 2023)"
    )
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url and not args.dry_run:
        log.error("DATABASE_URL_SYNC non définie")
        sys.exit(1)

    years_to_process = args.years if args.years else [args.year]

    async def main():
        total = 0
        started_at = datetime.now(timezone.utc)
        t0 = time.time()
        log.info("🔄 UN Comtrade — années : %s", years_to_process)

        for yr in years_to_process:
            n, errs = await ingest_comtrade(args.dry_run, yr)
            total += n
            if errs:
                log.warning("Erreurs %d: %s", yr, errs[:3])

        log.info("🏁 Terminé en %.1fs — %d records totaux", time.time() - t0, total)

        if not args.dry_run and db_url:
            import psycopg2
            conn = psycopg2.connect(db_url)
            cur = conn.cursor()
            try:
                cur.execute(LOG_SQL, {
                    "status": "success",
                    "fetched": total,
                    "inserted": total,
                    "error": None,
                    "started": started_at,
                })
                conn.commit()
            except Exception:
                pass
            finally:
                cur.close()
                conn.close()

    asyncio.run(main())
