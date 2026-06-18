#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion Open Data for Africa (Knoema) — sources nationales.

Pilote : Système Statistique National du Burkina Faso (INSD), via le portail
`burkinafaso.opendataforafrica.org` (moteur Knoema). Les séries récupérées sont
écrites dans `macro_indicators` avec `source = "INSD"` afin d'être exposées par
l'endpoint `/api/macro/{country_id}/national-sources` (section « Sources
nationales » de la page pays).

Flux Knoema :
  1. Liste des datasets du portail        → /api/1.0/meta/dataset
  2. Métadonnées + dimensions d'un dataset → /api/1.0/meta/dataset/{id}
  3. Membres d'une dimension               → /api/1.0/meta/dataset/{id}/dimension/{dimId}
  4. Données (pivot)                        → POST /api/1.0/data/details
        body: {"Dataset": id, "Header":[{"DimensionId":"Time","Members":[],
               "Range":{"From":"2000","To":"2026"}}], "Stub":[{dim members}],
               "Filter":[], "Frequencies":["A","Q","M"]}

Usage :
    DATABASE_URL_SYNC=postgresql://... python scripts/ingest_odfa.py [--dry-run]
        [--country BFA] [--host burkinafaso.opendataforafrica.org]
        [--limit 25] [--datasets uobkfve,exaninf]

Requis : curl (système) · tenacity · psycopg2-binary

NB : le portail Knoema/ODFA est protégé par Cloudflare qui bloque l'empreinte
TLS des clients Python (httpx/requests → 403). On délègue donc les appels HTTP
à `curl` (présent sur les runners GitHub Actions et en local), dont l'empreinte
TLS est acceptée.
"""
import argparse
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

from tenacity import retry, stop_after_attempt, wait_exponential

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("ingest_odfa")

# Le portail Knoema/ODFA bloque les User-Agent non-navigateur (403) → UA navigateur.
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

# Portail ODFA → (host, ISO3 pays, abréviation institut national = tag source)
PORTALS = {
    "BFA": {"host": "burkinafaso.opendataforafrica.org", "source": "INSD"},
}

FREQ_TO_PERIOD_TYPE = {"A": "annual", "Q": "quarterly", "M": "monthly", "W": "weekly", "D": "daily"}

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
        unit = EXCLUDED.unit,
        timestamp = NOW()
"""

LOG_SQL = """
    INSERT INTO data_ingestion_logs
        (id, source, status, records_fetched, records_inserted,
         error_message, started_at, completed_at)
    VALUES
        (gen_random_uuid(), 'ODFA_National', %(status)s,
         %(fetched)s, %(inserted)s, %(error)s, %(started)s, NOW())
"""


# ── HTTP via curl (contourne le blocage TLS Cloudflare) ───────────────────
def _curl(args: list[str]) -> str:
    proc = subprocess.run(
        ["curl", "-s", "--fail", "-A", UA, "-H", "Accept: application/json", *args],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90,
    )
    if proc.returncode != 0:
        err = (proc.stderr or "").strip()[:120]
        raise RuntimeError(f"curl rc={proc.returncode}: {err}")
    return proc.stdout


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
def _get(url: str) -> object:
    return json.loads(_curl(["-m", "30", url]))


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
def _post(url: str, body: dict) -> object:
    out = _curl(["-m", "45", "-X", "POST", url,
                 "-H", "Content-Type: application/json", "-d", json.dumps(body)])
    return json.loads(out)


def list_datasets(base: str, limit: int) -> list[str]:
    """IDs des datasets du portail (limités à `limit`)."""
    data = _get(f"{base}/api/1.0/meta/dataset?pageSize={max(limit, 1)}")
    items = data if isinstance(data, list) else data.get("datasets", [])
    ids = [d.get("id") for d in items if d.get("id")]
    return ids[:limit]


def dataset_meta(base: str, ds_id: str) -> dict:
    return _get(f"{base}/api/1.0/meta/dataset/{ds_id}")


def dimension_members(base: str, ds_id: str, dim_id: str) -> list[int]:
    data = _get(f"{base}/api/1.0/meta/dataset/{ds_id}/dimension/{dim_id}")
    items = data.get("items") or data.get("members") or []
    return [m["key"] for m in items if m.get("key") is not None]


def short_code(ds_id: str, id_parts: list[str], member_keys: list) -> str:
    """Code indicateur déterministe ≤ 50 car. : ODFA_<ds>_<idparts|hash>."""
    suffix = "_".join(p for p in id_parts if p) or "_".join(str(k) for k in member_keys)
    code = f"ODFA_{ds_id}_{suffix}"
    if len(code) <= 50:
        return code
    h = hashlib.md5(suffix.encode("utf-8")).hexdigest()[:10]
    return f"ODFA_{ds_id}_{h}"[:50]


def parse_period(date_obj: dict) -> tuple[str | None, str]:
    """{'value':'01/01/2013','frequency':'A'} → ('2013'|'2013-Q1'|'2013-01', period_type)."""
    if not isinstance(date_obj, dict):
        return None, "annual"
    raw = date_obj.get("value") or ""
    freq = (date_obj.get("frequency") or "A").upper()
    ptype = FREQ_TO_PERIOD_TYPE.get(freq, "annual")
    # raw au format dd/mm/yyyy
    try:
        d = datetime.strptime(raw, "%d/%m/%Y")
    except (ValueError, TypeError):
        return None, ptype
    if freq == "A":
        return str(d.year), ptype
    if freq == "Q":
        return f"{d.year}-Q{(d.month - 1) // 3 + 1}", ptype
    if freq == "M":
        return f"{d.year}-{d.month:02d}", ptype
    return d.strftime("%Y-%m-%d"), ptype


def extract_series(base: str, ds_id: str, meta: dict) -> list[dict]:
    """Retourne une liste de points {indicator_code, indicator_name, value, period, period_type}."""
    dims = meta.get("dimensions") or []
    if not dims:
        return []

    stub = []
    for dim in dims:
        dim_id = dim.get("id")
        keys = dimension_members(base, ds_id, dim_id)
        if not keys:
            return []
        stub.append({"DimensionId": dim_id, "Members": keys})

    body = {
        "Dataset": ds_id,
        "Header": [{"DimensionId": "Time", "Members": [], "Range": {"From": "1990", "To": "2026"}}],
        "Stub": stub,
        "Filter": [],
        "Frequencies": ["A", "Q", "M"],
    }
    resp = _post(f"{base}/api/1.0/data/details", body)
    columns = resp.get("columns") or []
    flat = resp.get("data") or []
    if not columns or not flat:
        return []

    ncol = len(columns)
    points: list[dict] = []
    for start in range(0, len(flat), ncol):
        row = flat[start:start + ncol]
        if len(row) < ncol:
            break
        labels, id_parts = [], []
        date_obj, value = None, None
        for col, cell in zip(columns, row):
            status = col.get("status")
            if status == "Date":
                date_obj = cell
            elif status == "Measure":
                value = cell
            elif status == "Dimension":
                if col.get("fieldId") == "id":
                    id_parts.append(str(cell))
                else:
                    labels.append(str(cell))
        if value is None:
            continue
        try:
            fval = float(value)
        except (ValueError, TypeError):
            continue
        period, ptype = parse_period(date_obj)
        if not period:
            continue
        points.append({
            "indicator_code": short_code(ds_id, id_parts, [m for s in stub for m in s["Members"]]),
            "indicator_name": " · ".join(dict.fromkeys(labels))[:200] or ds_id,
            "value": fval,
            "period": period,
            "period_type": ptype,
        })
    return points


# ── Pipeline principal ────────────────────────────────────────────────────
def run(country: str, host: str | None, limit: int, datasets: list[str] | None, dry_run: bool) -> None:
    country = country.upper()
    portal = PORTALS.get(country, {})
    host = host or portal.get("host")
    source = portal.get("source", "ODFA")
    if not host:
        log.error("Aucun portail ODFA connu pour %s (préciser --host)", country)
        sys.exit(1)
    base = f"https://{host}"
    source_url = f"{base}"

    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url and not dry_run:
        log.error("DATABASE_URL_SYNC non définie — arrêt")
        sys.exit(1)

    started_at = datetime.now(timezone.utc)
    t0 = time.time()
    all_points: list[dict] = []
    errors: list[str] = []

    log.info("🇧🇫 Ingestion ODFA — %s (%s) via %s", country, source, host)
    ds_ids = datasets or list_datasets(base, limit)
    log.info("  %d datasets à traiter", len(ds_ids))
    for i, ds_id in enumerate(ds_ids, 1):
        try:
            meta = dataset_meta(base, ds_id)
            pts = extract_series(base, ds_id, meta)
            for p in pts:
                p["country_id"] = country
                p["unit"] = None
                p["source"] = source
                p["source_url"] = source_url
            all_points.extend(pts)
            log.info("  [%d/%d] %s → %d points", i, len(ds_ids), ds_id, len(pts))
            time.sleep(0.3)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{ds_id}: {exc}")
            log.warning("  [%d/%d] %s ❌ %s", i, len(ds_ids), ds_id, exc)

    log.info("📦 %d points extraits (%d datasets, %d erreurs)", len(all_points), len(ds_ids), len(errors))

    if dry_run:
        for p in all_points[:8]:
            log.info("   ex. %s | %s | %s = %s", p["indicator_code"], p["indicator_name"], p["period"], p["value"])
        log.info("🔍 DRY-RUN — aucune écriture DB")
        return

    import psycopg2
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    inserted = 0
    try:
        if all_points:
            cur.executemany(UPSERT_SQL, all_points)
            inserted = len(all_points)
        conn.commit()
        log.info("✅ %d points insérés/mis à jour", inserted)
        cur.execute(LOG_SQL, {
            "status": "success" if not errors else "partial",
            "fetched": len(all_points), "inserted": inserted,
            "error": "; ".join(errors[:5]) if errors else None, "started": started_at,
        })
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        log.error("Erreur DB: %s", exc)
        try:
            cur.execute(LOG_SQL, {"status": "error", "fetched": 0, "inserted": 0,
                                  "error": str(exc)[:500], "started": started_at})
            conn.commit()
        except Exception:
            pass
        raise
    finally:
        cur.close()
        conn.close()

    log.info("🏁 Terminé en %.1fs", time.time() - t0)
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MANSA — Ingestion Open Data for Africa (sources nationales)")
    parser.add_argument("--country", default="BFA", help="ISO3 du pays (défaut BFA)")
    parser.add_argument("--host", default=None, help="Hôte du portail ODFA (sinon déduit du pays)")
    parser.add_argument("--limit", type=int, default=25, help="Nb max de datasets en mode découverte")
    parser.add_argument("--datasets", default=None, help="Liste d'IDs de datasets séparés par virgule")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, no DB write")
    args = parser.parse_args()
    ds = [s.strip() for s in args.datasets.split(",")] if args.datasets else None
    run(args.country, args.host, args.limit, ds, args.dry_run)
