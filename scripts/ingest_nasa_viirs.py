#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion NASA VIIRS Nightlights (proxy PIB / activité économique)
API : https://wvs.earthdata.nasa.gov/api/v1/ (Worldview Snapshots)
Layer : VIIRS_SNPP_DNB_At_Sensor_Radiance_500m

Méthode : fetch d'image PNG par bounding-box pays → moyenne des pixels
          = indice de lumière nocturne (corrélé au niveau d'activité économique)

Usage :
    python scripts/ingest_nasa_viirs.py [--dry-run] [--year 2023]
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_nasa_viirs.py --year 2023

Note : aucune clé API requise pour WVS. Pour les données HDF5 brutes (VNP46A3),
       définir NASA_EARTHDATA_TOKEN (gratuit : https://urs.earthdata.nasa.gov)

Requis : httpx Pillow numpy psycopg2-binary
"""
import argparse
import asyncio
import io
import logging
import os
import sys
import time
from datetime import datetime, timezone

import httpx
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("ingest_nasa_viirs")

WVS_BASE = "https://wvs.earthdata.nasa.gov/api/v1/snapshot"
VIIRS_LAYER = "VIIRS_SNPP_DNB_At_Sensor_Radiance_500m"

# Bounding boxes africains (lon_min, lat_min, lon_max, lat_max)
# Centré sur les zones urbaines/économiquement actives par pays
AFRICA_BBOXES: dict[str, tuple[float, float, float, float]] = {
    "NGA": (3.0, 4.0, 15.0, 14.0),    # Nigeria
    "ZAF": (16.0, -35.0, 33.0, -22.0), # South Africa
    "KEN": (33.9, -5.0, 42.0, 5.0),    # Kenya
    "GHA": (-3.3, 4.5, 1.2, 11.2),     # Ghana
    "EGY": (24.7, 22.0, 37.0, 31.7),   # Egypt
    "MAR": (-13.2, 27.7, -1.0, 36.0),  # Morocco
    "TUN": (7.5, 30.2, 11.6, 37.3),    # Tunisia
    "SEN": (-17.5, 12.3, -11.4, 15.0), # Senegal
    "CIV": (-8.6, 4.3, -2.5, 10.7),    # Ivory Coast
    "CMR": (8.5, 1.7, 16.2, 13.1),     # Cameroon
    "TZA": (29.3, -11.7, 40.4, -1.0),  # Tanzania
    "UGA": (29.5, -1.5, 35.1, 4.2),    # Uganda
    "ETH": (33.0, 3.4, 48.0, 15.0),    # Ethiopia
    "RWA": (28.9, -2.8, 30.9, -1.1),   # Rwanda
    "COD": (12.2, -13.5, 31.3, 5.3),   # DR Congo
    "MOZ": (32.0, -26.9, 40.8, -10.5), # Mozambique
    "ZMB": (22.0, -18.1, 33.7, -8.2),  # Zambia
    "AGO": (11.7, -18.0, 24.1, -4.4),  # Angola
    "BWA": (19.9, -26.9, 29.4, -17.8), # Botswana
    "MUS": (57.3, -20.5, 57.8, -19.9), # Mauritius
    "MDG": (43.2, -25.6, 50.5, -11.9), # Madagascar
    "DZA": (-8.7, 19.0, 12.0, 37.1),   # Algeria
    "LBY": (9.4, 19.5, 25.2, 33.2),    # Libya
    "SDN": (21.8, 8.7, 38.6, 22.2),    # Sudan
    "SOM": (40.9, -1.7, 51.4, 12.0),   # Somalia
    "MLI": (-4.2, 10.1, 4.3, 25.0),    # Mali
    "BFA": (-5.5, 9.4, 2.4, 15.1),     # Burkina Faso
    "NER": (0.2, 11.7, 15.9, 23.5),    # Niger
    "TGO": (0.0, 6.1, 1.8, 11.1),      # Togo
    "BEN": (0.8, 6.2, 3.8, 12.4),      # Benin
    "ZWE": (25.2, -22.4, 33.1, -15.6), # Zimbabwe
    "NAM": (11.7, -29.0, 25.3, -16.9), # Namibia
    "GIN": (-15.1, 7.2, -7.6, 12.7),   # Guinea
    "SLE": (-13.3, 6.9, -10.3, 10.0),  # Sierra Leone
    "LBR": (-11.5, 4.3, -7.4, 8.5),    # Liberia
    "SSD": (23.4, 3.5, 35.9, 12.2),    # South Sudan
    "CAF": (14.4, 2.2, 27.5, 11.0),    # Central African Republic
    "TCD": (13.5, 7.4, 24.0, 23.5),    # Chad
    "GAB": (8.7, -3.9, 14.5, 2.3),     # Gabon
    "GNQ": (8.4, 0.9, 11.4, 3.8),      # Equatorial Guinea
    "MWI": (32.7, -17.1, 35.9, -9.4),  # Malawi
    "COG": (11.1, -5.1, 18.7, 3.7),    # Congo
    "LSO": (27.0, -30.7, 29.5, -28.6), # Lesotho
    "SWZ": (30.8, -27.3, 32.1, -25.7), # Eswatini
    "DJI": (41.8, 11.0, 43.4, 12.7),   # Djibouti
    "ERI": (36.4, 12.4, 43.2, 18.0),   # Eritrea
    "BDI": (28.9, -4.5, 30.8, -2.3),   # Burundi
    "GMB": (-16.8, 13.1, -13.8, 13.8), # Gambia
    "CPV": (-25.4, 14.8, -22.7, 17.2), # Cabo Verde
    "COM": (43.2, -12.4, 44.5, -11.4), # Comoros
    "STP": (6.4, 0.0, 7.5, 1.7),       # São Tomé and Príncipe
    "MRT": (-17.1, 14.7, -4.9, 27.3),  # Mauritania
    "GNB": (-16.7, 10.9, -13.6, 12.7), # Guinea-Bissau
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
        (gen_random_uuid(), 'NASA_VIIRS', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


async def fetch_nightlight_index(
    client: httpx.AsyncClient,
    iso3: str,
    bbox: tuple[float, float, float, float],
    date: str,
) -> float | None:
    """
    Récupère l'image VIIRS nightlights pour un pays et retourne l'indice moyen.
    date format : YYYY-MM-DD (utiliser mi-mois pour composite mensuel)
    Retourne : moyenne des pixels non-noirs (0-255) normalisée sur 100
    """
    try:
        lon_min, lat_min, lon_max, lat_max = bbox
        params = {
            "REQUEST": "GetSnapshot",
            "LAYERS": VIIRS_LAYER,
            "CRS": "EPSG:4326",
            "TIME": date,
            "BBOX": f"{lon_min},{lat_min},{lon_max},{lat_max}",
            "WIDTH": "512",
            "HEIGHT": "512",
            "FORMAT": "image/png",
        }
        r = await client.get(WVS_BASE, params=params, timeout=30.0)
        if r.status_code != 200:
            return None

        # Charger l'image PNG avec Pillow
        from PIL import Image
        img = Image.open(io.BytesIO(r.content)).convert("L")  # grayscale
        arr = np.array(img, dtype=np.float32)

        # Moyenne des pixels lumineux (exclure le noir pur = océan/nodata)
        lit_pixels = arr[arr > 5]
        if len(lit_pixels) == 0:
            return 0.0
        # Normaliser sur 100 (pixel max théorique = 255)
        mean_radiance = float(np.mean(lit_pixels))
        index = round((mean_radiance / 255.0) * 100, 4)
        return index

    except ImportError:
        log.error("Pillow non installé — pip install Pillow numpy")
        return None
    except Exception as exc:
        log.debug("VIIRS %s %s: %s", iso3, date, exc)
        return None


async def ingest_nasa_viirs(dry_run: bool, year: int) -> tuple[int, list[str]]:
    """Récupère l'indice de lumière nocturne pour chaque pays africain."""
    errors: list[str] = []
    rows: list[dict] = []

    # Fetch un snapshot par trimestre (jan, apr, jul, oct) pour l'année demandée
    months = ["01", "04", "07", "10"]
    # Pour une moyenne annuelle, on combine les 4 snapshots
    country_values: dict[str, list[float]] = {iso3: [] for iso3 in AFRICA_BBOXES}

    async with httpx.AsyncClient(
        headers={"User-Agent": "MANSA-Terminal/2.0 (data@mansa.ai)"},
        timeout=40.0,
    ) as http:
        log.info("  NASA VIIRS → Nightlights %d (%d pays × 4 mois)", year, len(AFRICA_BBOXES))
        total_requests = 0
        for month in months:
            date = f"{year}-{month}-15"
            log.info("  Mois de référence : %s", date)
            for iso3, bbox in AFRICA_BBOXES.items():
                val = await fetch_nightlight_index(http, iso3, bbox, date)
                if val is not None:
                    country_values[iso3].append(val)
                    total_requests += 1
                await asyncio.sleep(0.5)  # WVS rate limit

    # Calculer la moyenne annuelle et créer les records
    for iso3, values in country_values.items():
        if not values:
            continue
        mean_val = round(sum(values) / len(values), 4)
        rows.append({
            "country_id": iso3,
            "indicator_code": "NASA_VIIRS_NLI",
            "indicator_name": "VIIRS Nighttime Light Index (NASA WVS) — proxy economic activity",
            "value": mean_val,
            "unit": "index (0-100)",
            "period": str(year),
            "period_type": "annual",
            "source": "NASA_VIIRS",
            "source_url": WVS_BASE,
        })

    log.info("  ✅ NASA VIIRS: %d pays avec données pour %d", len(rows), year)

    if dry_run:
        log.info("🔍 DRY-RUN NASA VIIRS — %d records seraient insérés", len(rows))
        for r in rows[:5]:
            log.info("  %s: NLI = %.2f", r["country_id"], r["value"])
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
            errors.append(f"NASA VIIRS DB: {exc}")
        finally:
            cur.close()
            conn.close()

    return len(rows), errors


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — NASA VIIRS Nightlights Ingestion")
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
        log.info("🛰️  NASA VIIRS Nightlights — années : %s", years_to_process)

        for yr in years_to_process:
            n, errs = await ingest_nasa_viirs(args.dry_run, yr)
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
