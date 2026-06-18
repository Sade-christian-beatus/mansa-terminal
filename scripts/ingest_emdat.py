#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion EM-DAT (CRED/UCLouvain)
Lit le fichier Excel EM-DAT téléchargé manuellement depuis emdat.be
et charge les indicateurs agrégés par pays/année/type de catastrophe.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_emdat.py \
        --file /path/to/emdat_custom_request_*.xlsx [--dry-run]

Requis : pandas openpyxl psycopg2-binary
Source : EM-DAT, CRED / UCLouvain, Brussels — https://www.emdat.be
"""
import argparse
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("ingest_emdat")

# Pays africains couverts (ISO3)
AFRICAN_ISO3 = {
    "NGA", "ZAF", "KEN", "GHA", "EGY", "MAR", "TUN", "SEN", "CIV", "CMR",
    "TZA", "UGA", "ETH", "RWA", "COD", "MOZ", "ZMB", "AGO", "BWA", "MUS",
    "BEN", "BFA", "GNB", "MLI", "NER", "TGO", "CAF", "TCD", "COG", "GNQ",
    "GAB", "MDG", "MWI", "ZWE", "NAM", "GIN", "DZA", "LBY", "SDN", "SOM",
    "ERI", "DJI", "SSD", "SLE", "LBR", "GMB", "CPV", "MRT", "LSO", "SWZ",
    "COM", "STP", "BDI",
}

# Catastrophes naturelles d'intérêt macroéconomique
NATURAL_TYPES = {
    "Flood", "Drought", "Storm", "Earthquake", "Wildfire",
    "Epidemic", "Mass movement (wet)", "Mass movement (dry)",
    "Extreme temperature", "Volcanic activity", "Infestation",
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
        (gen_random_uuid(), 'EMDAT', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


def parse_emdat(filepath: str) -> list[dict]:
    """Parse le fichier EM-DAT et retourne les indicateurs agrégés."""
    log.info("Lecture du fichier EM-DAT : %s", filepath)
    df = pd.read_excel(filepath, sheet_name="EM-DAT Data")

    # Filtrer : pays africains + catastrophes naturelles + 2000-présent
    df = df[
        df["ISO"].isin(AFRICAN_ISO3) &
        (df["Disaster Group"] == "Natural") &
        (df["Start Year"] >= 2000)
    ].copy()

    log.info("  %d événements naturels retenus (Afrique, 2000+)", len(df))

    # Normaliser le type de catastrophe pour le code indicateur
    def type_code(t: str) -> str:
        return t.upper().replace(" ", "_").replace("(", "").replace(")", "")

    rows: list[dict] = []
    source_url = "https://www.emdat.be"

    # ── 1. Nombre d'événements par pays/année/type ────────────────────────
    events = (
        df.groupby(["ISO", "Start Year", "Disaster Type"])
        .size()
        .reset_index(name="count")
    )
    for _, r in events.iterrows():
        tc = type_code(r["Disaster Type"])
        rows.append({
            "country_id": r["ISO"],
            "indicator_code": f"EMDAT_EVENTS_{tc}",
            "indicator_name": f"Number of {r['Disaster Type']} Events (EM-DAT)",
            "value": float(r["count"]),
            "unit": "events",
            "period": str(int(r["Start Year"])),
            "period_type": "annual",
            "source": "EMDAT_CRED",
            "source_url": source_url,
        })

    # ── 2. Décès totaux par pays/année/type ───────────────────────────────
    deaths = (
        df.dropna(subset=["Total Deaths"])
        .groupby(["ISO", "Start Year", "Disaster Type"])["Total Deaths"]
        .sum()
        .reset_index()
    )
    for _, r in deaths.iterrows():
        tc = type_code(r["Disaster Type"])
        rows.append({
            "country_id": r["ISO"],
            "indicator_code": f"EMDAT_DEATHS_{tc}",
            "indicator_name": f"Total Deaths from {r['Disaster Type']} (EM-DAT)",
            "value": float(r["Total Deaths"]),
            "unit": "persons",
            "period": str(int(r["Start Year"])),
            "period_type": "annual",
            "source": "EMDAT_CRED",
            "source_url": source_url,
        })

    # ── 3. Personnes affectées par pays/année/type ────────────────────────
    affected = (
        df.dropna(subset=["Total Affected"])
        .groupby(["ISO", "Start Year", "Disaster Type"])["Total Affected"]
        .sum()
        .reset_index()
    )
    for _, r in affected.iterrows():
        tc = type_code(r["Disaster Type"])
        rows.append({
            "country_id": r["ISO"],
            "indicator_code": f"EMDAT_AFFECTED_{tc}",
            "indicator_name": f"Total Affected by {r['Disaster Type']} (EM-DAT)",
            "value": float(r["Total Affected"]),
            "unit": "persons",
            "period": str(int(r["Start Year"])),
            "period_type": "annual",
            "source": "EMDAT_CRED",
            "source_url": source_url,
        })

    # ── 4. Dommages économiques totaux ($000) par pays/année/type ─────────
    damage_col = "Total Damage ('000 US$)"
    if damage_col in df.columns:
        damage = (
            df.dropna(subset=[damage_col])
            .groupby(["ISO", "Start Year", "Disaster Type"])[damage_col]
            .sum()
            .reset_index()
        )
        for _, r in damage.iterrows():
            tc = type_code(r["Disaster Type"])
            rows.append({
                "country_id": r["ISO"],
                "indicator_code": f"EMDAT_DAMAGE_{tc}",
                "indicator_name": f"Total Damage from {r['Disaster Type']} USD 000 (EM-DAT)",
                "value": float(r[damage_col]),
                "unit": "USD_000",
                "period": str(int(r["Start Year"])),
                "period_type": "annual",
                "source": "EMDAT_CRED",
                "source_url": source_url,
            })

    # ── 5. Agrégats toutes catastrophes confondues par pays/année ─────────
    all_agg = df.groupby(["ISO", "Start Year"]).agg(
        total_events=("DisNo.", "count"),
        total_deaths=("Total Deaths", "sum"),
        total_affected=("Total Affected", "sum"),
    ).reset_index()

    for _, r in all_agg.iterrows():
        base = {
            "period": str(int(r["Start Year"])),
            "period_type": "annual",
            "source": "EMDAT_CRED",
            "source_url": source_url,
        }
        rows.append({**base, "country_id": r["ISO"],
                     "indicator_code": "EMDAT_ALL_EVENTS",
                     "indicator_name": "Total Natural Disaster Events (EM-DAT)",
                     "value": float(r["total_events"]), "unit": "events"})
        if pd.notna(r["total_deaths"]) and r["total_deaths"] > 0:
            rows.append({**base, "country_id": r["ISO"],
                         "indicator_code": "EMDAT_ALL_DEATHS",
                         "indicator_name": "Total Deaths from Natural Disasters (EM-DAT)",
                         "value": float(r["total_deaths"]), "unit": "persons"})
        if pd.notna(r["total_affected"]) and r["total_affected"] > 0:
            rows.append({**base, "country_id": r["ISO"],
                         "indicator_code": "EMDAT_ALL_AFFECTED",
                         "indicator_name": "Total Affected by Natural Disasters (EM-DAT)",
                         "value": float(r["total_affected"]), "unit": "persons"})

    log.info("  ✅ %d records générés depuis EM-DAT", len(rows))
    return rows


def ingest(filepath: str, dry_run: bool) -> None:
    started_at = datetime.now(timezone.utc)
    t0 = time.time()

    rows = parse_emdat(filepath)

    if dry_run:
        log.info("🔍 DRY-RUN — %d records seraient insérés (skip DB)", len(rows))
        # Afficher un échantillon
        for r in rows[:5]:
            log.info("  Sample: %s | %s | %s | %.1f %s",
                     r["country_id"], r["period"], r["indicator_code"],
                     r["value"], r["unit"])
        return

    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        log.error("DATABASE_URL_SYNC non définie")
        sys.exit(1)

    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    inserted = 0
    error_msg = None

    try:
        cur.executemany(UPSERT_SQL, rows)
        conn.commit()
        inserted = len(rows)
        log.info("✅ %d records insérés en %.1fs", inserted, time.time() - t0)
    except Exception as exc:
        conn.rollback()
        error_msg = str(exc)
        log.error("Erreur DB: %s", exc)
    finally:
        try:
            cur.execute(LOG_SQL, {
                "status": "success" if not error_msg else "error",
                "fetched": len(rows),
                "inserted": inserted,
                "error": error_msg,
                "started": started_at,
            })
            conn.commit()
        except Exception:
            pass
        cur.close()
        conn.close()

    if error_msg:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Ingestion EM-DAT (Excel local)")
    parser.add_argument(
        "--file", required=True,
        help="Chemin vers le fichier Excel EM-DAT téléchargé (public_emdat_custom_request_*.xlsx)"
    )
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, no DB write")
    args = parser.parse_args()

    if not Path(args.file).exists():
        log.error("Fichier introuvable : %s", args.file)
        sys.exit(1)

    ingest(args.file, args.dry_run)
