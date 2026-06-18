#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion des données nationales du Burkina Faso (INSD).

Lit les CSV produits par `scripts/extract_burkina_insd.py` (extraction profonde
des annuaires statistiques nationaux) + le CSV « chiffres clés » vérifié à la
main, et les upsert dans `macro_indicators` avec `source = "INSD"`. Ces séries
sont ensuite exposées par `/api/macro/BFA/national-sources` (section « Sources
nationales » de la page pays).

Pourquoi un CSV intermédiaire commité ?
  - L'extraction PDF (lourde, dépend de pdfplumber + des PDF locaux) est séparée
    de l'ingestion (légère). La CI ingère depuis le CSV commité, sans les PDF.
  - Le CSV est relisible/revé par un humain avant écriture en base.

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_burkina_insd.py [--dry-run]
        [--csv data/burkina_insd/insd_burkina.csv data/burkina_insd/insd_burkina_keyfigures.csv]

Requis : psycopg2-binary
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass

DEFAULT_CSVS = [
    "data/burkina_insd/insd_burkina_keyfigures.csv",
    "data/burkina_insd/insd_burkina.csv",
]

UPSERT_SQL = """
    INSERT INTO macro_indicators
        (id, country_id, indicator_code, indicator_name, value, unit,
         period, period_type, source, source_url, raw_data, timestamp)
    VALUES
        (gen_random_uuid(), %(country_id)s, %(indicator_code)s, %(indicator_name)s,
         %(value)s, %(unit)s, %(period)s, %(period_type)s, %(source)s,
         %(source_url)s, %(raw_data)s, NOW())
    ON CONFLICT (country_id, indicator_code, period, source)
    DO UPDATE SET
        value = EXCLUDED.value,
        indicator_name = EXCLUDED.indicator_name,
        unit = EXCLUDED.unit,
        raw_data = EXCLUDED.raw_data,
        timestamp = NOW()
"""

LOG_SQL = """
    INSERT INTO data_ingestion_logs
        (id, source, status, records_fetched, records_inserted,
         error_message, started_at, completed_at)
    VALUES
        (gen_random_uuid(), 'INSD_Burkina', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


def load_rows(paths: list[str]) -> list[dict]:
    rows: list[dict] = []
    for path in paths:
        if not os.path.exists(path):
            print(f"⚠ CSV introuvable, ignoré : {path}")
            continue
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                try:
                    value = float(r["value"])
                except (TypeError, ValueError):
                    continue
                rows.append({
                    "country_id": r.get("country_id", "BFA"),
                    "indicator_code": r["indicator_code"][:50],
                    "indicator_name": (r.get("indicator_name") or "")[:200],
                    "value": value,
                    "unit": (r.get("unit") or None) or None,
                    "period": r["period"],
                    "period_type": r.get("period_type") or "annual",
                    "source": r.get("source") or "INSD",
                    "source_url": r.get("source_url") or "https://www.insd.bf",
                    "raw_data": json.dumps({
                        "table_ref": r.get("table_ref"),
                        "book_year": r.get("book_year"),
                    }),
                })
        print(f"  · {path} → cumul {len(rows)} lignes")
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingestion données nationales INSD Burkina")
    ap.add_argument("--csv", nargs="+", default=DEFAULT_CSVS)
    ap.add_argument("--dry-run", action="store_true", help="Aucune écriture en base")
    args = ap.parse_args()

    rows = load_rows(args.csv)
    print(f"📦 {len(rows)} points INSD à ingérer "
          f"({len({r['indicator_code'] for r in rows})} indicateurs distincts)")

    if args.dry_run:
        for r in rows[:6]:
            print(f"   ex. {r['indicator_code']} | {r['indicator_name'][:40]} "
                  f"| {r['period']} = {r['value']} {r['unit'] or ''}")
        print("🔍 DRY-RUN — aucune écriture DB")
        return 0

    db_url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL")
    if not db_url:
        sys.exit("❌ DATABASE_URL_SYNC non défini dans l'environnement.")

    import psycopg2
    started = datetime.now(timezone.utc)
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    inserted = 0
    try:
        with conn.cursor() as cur:
            cur.executemany(UPSERT_SQL, rows)
            inserted = len(rows)
            cur.execute(LOG_SQL, {
                "status": "success", "fetched": len(rows),
                "inserted": inserted, "error": None, "started": started,
            })
        conn.commit()
        print(f"✅ {inserted} points INSD insérés/mis à jour")
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print(f"❌ Erreur DB : {exc}")
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
