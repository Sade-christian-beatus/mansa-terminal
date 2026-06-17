#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion autonome (sans Dagster)
===========================================================

Peuple la table `macro_indicators` (et `countries`) avec les données réelles
FMI WEO + Banque Mondiale WDI pour les 54 pays africains. Une fois exécuté, le
dashboard passe en « Live » et le filtre d'année (2015–2025) devient actif.

Dépendances : psycopg2 (déjà dans apps/api/requirements.txt) + stdlib.
    pip install psycopg2-binary

Usage :
    # Le script lit DATABASE_URL (ou DATABASE_URL_SYNC) depuis l'environnement.
    export DATABASE_URL="postgresql://user:pass@host:5432/postgres"   # bash
    python data/pipelines/ingest.py

    # Windows PowerShell :
    $env:DATABASE_URL = "postgresql://user:pass@host:5432/postgres"
    python data/pipelines/ingest.py

Options :
    --imf-only   N'ingère que les données FMI WEO
    --wb-only    N'ingère que les données Banque Mondiale
    --years 2010 2025   Plage d'années FMI (défaut : 2015 2025)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Iterable

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    sys.exit("psycopg2 manquant. Installez-le :  pip install psycopg2-binary")

IMF_BASE = "https://www.imf.org/external/datamapper/api/v1"
WB_BASE = "https://api.worldbank.org/v2"
USER_AGENT = "MANSA-Terminal/1.0 (ingest-script)"

# ── Pays africains : ISO3 → (ISO2, nom_en, nom_fr, région) ──────────────────
# Les régions correspondent aux clés géo du frontend (filtre régional).
COUNTRIES: dict[str, tuple[str, str, str, str]] = {
    # Afrique de l'Ouest
    "NGA": ("ng", "Nigeria", "Nigeria", "West Africa"),
    "GHA": ("gh", "Ghana", "Ghana", "West Africa"),
    "CIV": ("ci", "Côte d'Ivoire", "Côte d'Ivoire", "West Africa"),
    "SEN": ("sn", "Senegal", "Sénégal", "West Africa"),
    "MLI": ("ml", "Mali", "Mali", "West Africa"),
    "BFA": ("bf", "Burkina Faso", "Burkina Faso", "West Africa"),
    "NER": ("ne", "Niger", "Niger", "West Africa"),
    "BEN": ("bj", "Benin", "Bénin", "West Africa"),
    "TGO": ("tg", "Togo", "Togo", "West Africa"),
    "GIN": ("gn", "Guinea", "Guinée", "West Africa"),
    "SLE": ("sl", "Sierra Leone", "Sierra Leone", "West Africa"),
    "LBR": ("lr", "Liberia", "Libéria", "West Africa"),
    "GMB": ("gm", "Gambia", "Gambie", "West Africa"),
    "GNB": ("gw", "Guinea-Bissau", "Guinée-Bissau", "West Africa"),
    "CPV": ("cv", "Cape Verde", "Cap-Vert", "West Africa"),
    "MRT": ("mr", "Mauritania", "Mauritanie", "West Africa"),
    # Afrique de l'Est
    "KEN": ("ke", "Kenya", "Kenya", "East Africa"),
    "TZA": ("tz", "Tanzania", "Tanzanie", "East Africa"),
    "UGA": ("ug", "Uganda", "Ouganda", "East Africa"),
    "ETH": ("et", "Ethiopia", "Éthiopie", "East Africa"),
    "RWA": ("rw", "Rwanda", "Rwanda", "East Africa"),
    "BDI": ("bi", "Burundi", "Burundi", "East Africa"),
    "SSD": ("ss", "South Sudan", "Soudan du Sud", "East Africa"),
    "SOM": ("so", "Somalia", "Somalie", "East Africa"),
    "DJI": ("dj", "Djibouti", "Djibouti", "East Africa"),
    "ERI": ("er", "Eritrea", "Érythrée", "East Africa"),
    # Afrique du Nord
    "EGY": ("eg", "Egypt", "Égypte", "North Africa"),
    "MAR": ("ma", "Morocco", "Maroc", "North Africa"),
    "TUN": ("tn", "Tunisia", "Tunisie", "North Africa"),
    "DZA": ("dz", "Algeria", "Algérie", "North Africa"),
    "LBY": ("ly", "Libya", "Libye", "North Africa"),
    "SDN": ("sd", "Sudan", "Soudan", "North Africa"),
    # Afrique Centrale
    "CMR": ("cm", "Cameroon", "Cameroun", "Central Africa"),
    "TCD": ("td", "Chad", "Tchad", "Central Africa"),
    "CAF": ("cf", "Central African Republic", "Centrafrique", "Central Africa"),
    "COG": ("cg", "Congo", "Congo (Brazzaville)", "Central Africa"),
    "COD": ("cd", "DR Congo", "Congo (RDC)", "Central Africa"),
    "GAB": ("ga", "Gabon", "Gabon", "Central Africa"),
    "GNQ": ("gq", "Equatorial Guinea", "Guinée équatoriale", "Central Africa"),
    "STP": ("st", "Sao Tome and Principe", "Sao Tomé-et-Príncipe", "Central Africa"),
    "AGO": ("ao", "Angola", "Angola", "Central Africa"),
    # Afrique Australe
    "ZAF": ("za", "South Africa", "Afrique du Sud", "Southern Africa"),
    "BWA": ("bw", "Botswana", "Botswana", "Southern Africa"),
    "NAM": ("na", "Namibia", "Namibie", "Southern Africa"),
    "LSO": ("ls", "Lesotho", "Lesotho", "Southern Africa"),
    "SWZ": ("sz", "Eswatini", "Eswatini", "Southern Africa"),
    "ZMB": ("zm", "Zambia", "Zambie", "Southern Africa"),
    "ZWE": ("zw", "Zimbabwe", "Zimbabwe", "Southern Africa"),
    "MWI": ("mw", "Malawi", "Malawi", "Southern Africa"),
    "MOZ": ("mz", "Mozambique", "Mozambique", "Southern Africa"),
    "MDG": ("mg", "Madagascar", "Madagascar", "Southern Africa"),
    "MUS": ("mu", "Mauritius", "Maurice", "Southern Africa"),
    "COM": ("km", "Comoros", "Comores", "Southern Africa"),
    "SYC": ("sc", "Seychelles", "Seychelles", "Southern Africa"),
}
ISO3_LIST = list(COUNTRIES.keys())
ISO2_TO_ISO3 = {v[0].upper(): k for k, v in COUNTRIES.items()}

# ── Indicateurs FMI WEO (codes alignés sur le catalogue frontend) ───────────
IMF_INDICATORS = {
    "NGDPD":       ("PIB nominal (Mds USD)", "Mds $"),
    "NGDPDPC":     ("PIB par habitant (USD)", "USD"),
    "PPPGDP":      ("PIB PPA (Mds USD)", "Mds $"),
    "NGDP_RPCH":   ("Croissance du PIB réel (%)", "%"),
    "LP":          ("Population (M)", "M hab."),
    "PCPIPCH":     ("Inflation IPC (%)", "%"),
    "GGXCNL_NGDP": ("Solde budgétaire (% PIB)", "% PIB"),
    "GGXONLB_NGDP":("Solde primaire (% PIB)", "% PIB"),
    "GGX_NGDP":    ("Dépenses publiques (% PIB)", "% PIB"),
    "GGXWDG_NGDP": ("Dette publique (% PIB)", "% PIB"),
    "BCA_NGDPD":   ("Compte courant (% PIB)", "% PIB"),
    "LUR":         ("Chômage (%)", "%"),
}

# ── Indicateurs Banque Mondiale (code WB pointé → stocké en underscore) ─────
# Les codes underscore correspondent au catalogue frontend (colonnes affichées).
WB_INDICATORS = {
    "SP.DYN.LE00.IN": ("Espérance de vie (ans)", "ans"),
    "SE.ADT.LITR.ZS": ("Alphabétisation (%)", "%"),
    "EG.ELC.ACCS.ZS": ("Accès électricité (%)", "%"),
    "EG.FEC.RNEW.ZS": ("Énergie renouvelable (%)", "%"),
    "IT.NET.USER.ZS": ("Internautes (%)", "%"),
    "SH.DYN.MORT":    ("Mortalité < 5 ans (‰)", "‰"),
    "SI.POV.DDAY":    ("Pauvreté < 2,15$/j (%)", "%"),
    "EN.ATM.CO2E.PC": ("Émissions CO2/hab (t)", "t"),
}


# ── HTTP (stdlib, avec retry simple) ────────────────────────────────────────
def http_get_json(url: str, retries: int = 3) -> object:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GET échoué après {retries} essais : {url} — {last_err}")


def batched(seq: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ── Récupération FMI WEO ────────────────────────────────────────────────────
def fetch_imf(years: tuple[int, int]) -> list[tuple]:
    """Retourne une liste de tuples prêts pour l'UPSERT macro_indicators."""
    periods = ",".join(str(y) for y in range(years[0], years[1] + 1))
    rows: list[tuple] = []
    for code, (name, unit) in IMF_INDICATORS.items():
        merged: dict[str, dict] = {}
        for batch in batched(ISO3_LIST, 20):
            url = f"{IMF_BASE}/{code}/{'/'.join(batch)}?periods={periods}"
            try:
                data = http_get_json(url)
                vals = data.get("values", {}).get(code, {}) if isinstance(data, dict) else {}
                merged.update(vals)
            except Exception as e:  # noqa: BLE001
                print(f"  ⚠ IMF {code} batch {batch[:2]}… : {e}")
            time.sleep(0.4)
        n = 0
        for country_id, yearly in merged.items():
            if country_id not in COUNTRIES or not isinstance(yearly, dict):
                continue
            for year, value in yearly.items():
                if value is None:
                    continue
                rows.append((country_id, code, name, float(value), unit, str(year), "annual", "IMF"))
                n += 1
        print(f"  ✓ IMF {code:<14} {n} points")
    return rows


# ── Récupération Banque Mondiale ────────────────────────────────────────────
def fetch_wb() -> list[tuple]:
    rows: list[tuple] = []
    iso2_str = ";".join(v[0] for v in COUNTRIES.values())
    for wb_code, (name, unit) in WB_INDICATORS.items():
        store_code = wb_code.replace(".", "_")  # aligne sur le catalogue frontend
        page, n = 1, 0
        while True:
            qs = urllib.parse.urlencode({"format": "json", "per_page": 1000, "mrv": 12, "page": page})
            url = f"{WB_BASE}/country/{iso2_str}/indicator/{wb_code}?{qs}"
            try:
                data = http_get_json(url)
            except Exception as e:  # noqa: BLE001
                print(f"  ⚠ WB {wb_code} page {page} : {e}")
                break
            if not isinstance(data, list) or len(data) < 2 or not data[1]:
                break
            for rec in data[1]:
                value = rec.get("value")
                iso3 = rec.get("countryiso3code", "")
                year = rec.get("date", "")
                if value is None or iso3 not in COUNTRIES or not year:
                    continue
                rows.append((iso3, store_code, name, float(value), unit, str(year), "annual", "WorldBank"))
                n += 1
            meta = data[0]
            if page >= int(meta.get("pages", 1)):
                break
            page += 1
            time.sleep(0.3)
        print(f"  ✓ WB  {store_code:<16} {n} points")
    return rows


# ── Base de données ─────────────────────────────────────────────────────────
def normalize_sync_url(url: str) -> str:
    url = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    if "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def seed_countries(cur) -> None:
    values = [(iso3, iso2, en, fr, region) for iso3, (iso2, en, fr, region) in COUNTRIES.items()]
    execute_values(cur, """
        INSERT INTO countries (id, iso2, name_en, name_fr, region, is_active)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            iso2 = EXCLUDED.iso2, name_en = EXCLUDED.name_en,
            name_fr = EXCLUDED.name_fr, region = EXCLUDED.region
    """, [(iso3, iso2, en, fr, region, True) for iso3, iso2, en, fr, region in values])


def upsert_indicators(cur, rows: list[tuple]) -> int:
    if not rows:
        return 0
    execute_values(cur, """
        INSERT INTO macro_indicators
            (id, country_id, indicator_code, indicator_name, value, unit,
             period, period_type, source, timestamp)
        VALUES %s
        ON CONFLICT (country_id, indicator_code, period, source) DO UPDATE SET
            value = EXCLUDED.value, indicator_name = EXCLUDED.indicator_name,
            unit = EXCLUDED.unit, timestamp = NOW()
    """, rows, template="(gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, NOW())")
    return len(rows)


def log_ingestion(cur, source: str, count: int) -> None:
    cur.execute("""
        INSERT INTO data_ingestion_logs
            (id, source, status, records_fetched, records_inserted, started_at, completed_at)
        VALUES (gen_random_uuid(), %s, 'success', %s, %s, NOW(), NOW())
    """, (source, count, count))


# ── Main ────────────────────────────────────────────────────────────────────
def main() -> int:
    parser = argparse.ArgumentParser(description="Ingestion MANSA (FMI WEO + Banque Mondiale)")
    parser.add_argument("--imf-only", action="store_true")
    parser.add_argument("--wb-only", action="store_true")
    parser.add_argument("--years", nargs=2, type=int, default=[2015, 2025], metavar=("FROM", "TO"))
    args = parser.parse_args()

    raw_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL")
    if not raw_url:
        sys.exit("❌ DATABASE_URL (ou DATABASE_URL_SYNC) non défini dans l'environnement.")
    db_url = normalize_sync_url(raw_url)

    do_imf = not args.wb_only
    do_wb = not args.imf_only

    print("🌍 MANSA — Ingestion des données macro réelles")
    print(f"   Pays : {len(COUNTRIES)} · Années FMI : {args.years[0]}–{args.years[1]}")

    imf_rows = fetch_imf(tuple(args.years)) if do_imf else []
    wb_rows = fetch_wb() if do_wb else []

    print("\n💾 Écriture en base…")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            seed_countries(cur)
            n_imf = upsert_indicators(cur, imf_rows)
            n_wb = upsert_indicators(cur, wb_rows)
            if n_imf:
                log_ingestion(cur, "IMF_WEO", n_imf)
            if n_wb:
                log_ingestion(cur, "WorldBank", n_wb)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"\n✅ Terminé — {n_imf + n_wb} points insérés/mis à jour "
          f"(FMI : {n_imf}, Banque Mondiale : {n_wb}).")
    print("   Le dashboard doit maintenant passer en « Live ». Rechargez avec Ctrl+Shift+R.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
