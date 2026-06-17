#!/usr/bin/env python3
"""
MANSA Terminal — Ingestion conflits (UCDP sans clé · ACLED OAuth)
================================================================

À lancer DEPUIS TA MACHINE (connexion résidentielle) : UCDP et ACLED bloquent
souvent les datacenters (Railway). Agrège les événements de conflit par pays
et par année, puis écrit dans `macro_indicators` (codes CONFLICT_EVENTS /
CONFLICT_FATALITIES, source UCDP ou ACLED). La page Conflits lit ensuite ces
valeurs réelles.

Usage (cmd.exe) :
    set "DATABASE_URL=postgresql://user:pass@host:6543/postgres"
    python data\\pipelines\\ingest_conflicts.py                 # UCDP (sans clé)

    # ACLED (nécessite un compte avec accès API activé) :
    set "ACLED_EMAIL=ton.email@gmail.com"
    set "ACLED_PASSWORD=ton_mot_de_passe"
    python data\\pipelines\\ingest_conflicts.py --source acled

Sans DATABASE_URL, le script affiche seulement un aperçu (pas d'écriture).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass

BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Noms de pays (UCDP / ACLED) → ISO3 ──────────────────────────────────────
NAME_TO_ISO3 = {
    "Algeria": "DZA", "Angola": "AGO", "Benin": "BEN", "Botswana": "BWA",
    "Burkina Faso": "BFA", "Burundi": "BDI", "Cameroon": "CMR", "Cape Verde": "CPV",
    "Central African Republic": "CAF", "Chad": "TCD", "Comoros": "COM", "Congo": "COG",
    "DR Congo (Zaire)": "COD", "DR Congo": "COD", "Democratic Republic of Congo": "COD",
    "Djibouti": "DJI", "Egypt": "EGY", "Equatorial Guinea": "GNQ", "Eritrea": "ERI",
    "Eswatini (Swaziland)": "SWZ", "eSwatini": "SWZ", "Ethiopia": "ETH", "Gabon": "GAB",
    "Gambia": "GMB", "Ghana": "GHA", "Guinea": "GIN", "Guinea-Bissau": "GNB",
    "Ivory Coast": "CIV", "Kenya": "KEN", "Lesotho": "LSO", "Liberia": "LBR",
    "Libya": "LBY", "Madagascar (Malagasy)": "MDG", "Madagascar": "MDG", "Malawi": "MWI",
    "Mali": "MLI", "Mauritania": "MRT", "Mauritius": "MUS", "Morocco": "MAR",
    "Mozambique": "MOZ", "Namibia": "NAM", "Niger": "NER", "Nigeria": "NGA",
    "Rwanda": "RWA", "Senegal": "SEN", "Sierra Leone": "SLE", "Somalia": "SOM",
    "South Africa": "ZAF", "South Sudan": "SSD", "Sudan": "SDN", "Tanzania": "TZA",
    "Togo": "TGO", "Tunisia": "TUN", "Uganda": "UGA", "Zambia": "ZMB", "Zimbabwe": "ZWE",
}

UCDP_VERSIONS = ["24.1", "23.1", "22.1"]
ACLED_OAUTH = "https://acleddata.com/oauth/token"
ACLED_READ = "https://acleddata.com/api/acled/read"


def http_json(url: str, headers: dict | None = None):
    req = urllib.request.Request(url, headers=headers or BROWSER)
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


# ── UCDP (sans clé) ─────────────────────────────────────────────────────────
def fetch_ucdp() -> dict[tuple[str, str], dict]:
    """Retourne {(iso3, year): {events, fatalities}} pour l'Afrique."""
    agg: dict[tuple[str, str], dict] = defaultdict(lambda: {"events": 0, "fatalities": 0})
    version = None
    for v in UCDP_VERSIONS:
        try:
            http_json(f"https://ucdpapi.pcr.uu.se/api/gedevents/{v}?pagesize=1")
            version = v
            break
        except Exception:  # noqa: BLE001
            continue
    if not version:
        sys.exit("❌ UCDP injoignable (probable blocage réseau). Lance depuis ta connexion résidentielle.")

    print(f"📥 UCDP GED v{version} — téléchargement (Afrique)…")
    page, total = 0, 0
    while page < 60:  # garde-fou : 60 pages × 1000 = 60k événements max
        url = f"https://ucdpapi.pcr.uu.se/api/gedevents/{version}?pagesize=1000&page={page}"
        try:
            data = http_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"  ⚠ page {page} : {e}")
            break
        results = data.get("Result", []) or []
        if not results:
            break
        for ev in results:
            if ev.get("region") != "Africa":
                continue
            iso3 = NAME_TO_ISO3.get(ev.get("country", ""))
            year = str(ev.get("year", "")) or ""
            if not iso3 or not year:
                continue
            agg[(iso3, year)]["events"] += 1
            try:
                agg[(iso3, year)]["fatalities"] += int(ev.get("best", 0) or 0)
            except (TypeError, ValueError):
                pass
            total += 1
        page += 1
        if page >= int(data.get("TotalPages", page + 1)):
            break
    print(f"   {total} événements africains agrégés sur {len({k[0] for k in agg})} pays.")
    return agg


# ── ACLED (OAuth email+password) ────────────────────────────────────────────
def fetch_acled() -> dict[tuple[str, str], dict]:
    email = os.getenv("ACLED_EMAIL")
    password = os.getenv("ACLED_PASSWORD")
    if not email or not password:
        sys.exit("❌ Définis ACLED_EMAIL et ACLED_PASSWORD.")
    body = urllib.parse.urlencode({
        "username": email, "password": password, "grant_type": "password",
        "client_id": "acled", "scope": "authenticated",
    }).encode()
    req = urllib.request.Request(ACLED_OAUTH, data=body, headers={**BROWSER, "Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            token = json.loads(r.read().decode("utf-8")).get("access_token")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"❌ Auth ACLED échouée : {e}")
    if not token:
        sys.exit("❌ Jeton ACLED absent.")
    print("✅ Jeton ACLED obtenu.")

    agg: dict[tuple[str, str], dict] = defaultdict(lambda: {"events": 0, "fatalities": 0})
    qs = urllib.parse.urlencode({"_format": "json", "limit": 50000})
    try:
        payload = http_json(f"{ACLED_READ}?{qs}", headers={**BROWSER, "Authorization": f"Bearer {token}"})
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        sys.exit(f"❌ Lecture ACLED refusée (HTTP {e.code}) : {e.read().decode('utf-8','replace')[:200]}\n"
                 "   ➜ Active l'accès API/licence sur acleddata.com/myacled.")
    rows = payload.get("data", payload) if isinstance(payload, dict) else payload
    for ev in rows or []:
        iso3 = NAME_TO_ISO3.get(ev.get("country", ""))
        year = str(ev.get("year", "")) or ""
        if not iso3 or not year:
            continue
        agg[(iso3, year)]["events"] += 1
        try:
            agg[(iso3, year)]["fatalities"] += int(float(ev.get("fatalities", 0) or 0))
        except (TypeError, ValueError):
            pass
    print(f"   {len(rows or [])} événements ACLED, {len({k[0] for k in agg})} pays africains.")
    return agg


# ── Base de données ─────────────────────────────────────────────────────────
def normalize_sync_url(url: str) -> str:
    url = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    parts = urllib.parse.urlsplit(url)
    params = [(k, v) for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=True) if k.lower() != "pgbouncer"]
    if not any(k.lower() == "sslmode" for k, _ in params):
        params.append(("sslmode", "require"))
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(params), parts.fragment))


def write_db(agg: dict[tuple[str, str], dict], source: str) -> int:
    try:
        import psycopg2
        from psycopg2.extras import execute_values
    except ImportError:
        sys.exit("psycopg2 manquant : pip install psycopg2-binary")
    rows = []
    for (iso3, year), v in agg.items():
        rows.append((iso3, "CONFLICT_EVENTS", "Événements de conflit", float(v["events"]), "count", year, "annual", source))
        rows.append((iso3, "CONFLICT_FATALITIES", "Décès liés aux conflits", float(v["fatalities"]), "deaths", year, "annual", source))
    if not rows:
        return 0
    conn = psycopg2.connect(normalize_sync_url(os.environ["DATABASE_URL"]))
    try:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO macro_indicators
                    (id, country_id, indicator_code, indicator_name, value, unit, period, period_type, source, timestamp)
                VALUES %s
                ON CONFLICT (country_id, indicator_code, period, source) DO UPDATE SET
                    value = EXCLUDED.value, timestamp = NOW()
            """, rows, template="(gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, NOW())")
            cur.execute("""INSERT INTO data_ingestion_logs (id, source, status, records_fetched, records_inserted, started_at, completed_at)
                           VALUES (gen_random_uuid(), %s, 'success', %s, %s, NOW(), NOW())""", (source, len(rows), len(rows)))
        conn.commit()
    finally:
        conn.close()
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingestion conflits MANSA (UCDP / ACLED)")
    parser.add_argument("--source", choices=["ucdp", "acled"], default="ucdp")
    args = parser.parse_args()

    print(f"🌍 MANSA — Ingestion conflits · source : {args.source.upper()}")
    agg = fetch_ucdp() if args.source == "ucdp" else fetch_acled()

    # Aperçu : top pays sur l'année la plus récente
    years = sorted({y for _, y in agg}, reverse=True)
    if years:
        latest = years[0]
        top = sorted(((iso, agg[(iso, latest)]) for iso, y in agg if y == latest),
                     key=lambda kv: kv[1]["fatalities"], reverse=True)
        print(f"\n📊 Top conflits {latest} :")
        print(f"   {'Pays':<6}{'Événements':>12}{'Décès':>10}")
        for iso, v in top[:15]:
            print(f"   {iso:<6}{v['events']:>12}{v['fatalities']:>10}")

    if os.getenv("DATABASE_URL"):
        n = write_db(agg, args.source.upper())
        print(f"\n✅ {n} valeurs écrites en base (CONFLICT_EVENTS / CONFLICT_FATALITIES, source {args.source.upper()}).")
        print("   Recharge la page Conflits (Ctrl+Shift+R) pour voir les données live.")
    else:
        print("\nℹ DATABASE_URL non défini — aperçu seulement (pas d'écriture). "
              "Définis-le pour peupler la base.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
