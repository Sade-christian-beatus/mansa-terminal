#!/usr/bin/env python3
"""
MANSA Terminal — Script d'ingestion autonome (sans Dagster)
===========================================================

Peuple les tables `countries` et `macro_indicators` avec des données réelles.

Source par défaut : **Banque Mondiale WDI** (api.worldbank.org) — gratuite,
ouverte et fiable. Les indicateurs macro cœur (croissance, inflation, dette,
compte courant, PIB, population, chômage…) sont mappés vers les codes du
catalogue MANSA afin d'alimenter directement les colonnes du dashboard.

Le FMI WEO est disponible en option (--with-imf) mais son API est souvent
bloquée (HTTP 403 / Cloudflare) hors réseau résidentiel.

Dépendances : psycopg2 (déjà dans apps/api/requirements.txt) + stdlib.
    pip install psycopg2-binary

Usage (cmd.exe) :
    set "DATABASE_URL=postgresql://user:pass@host:5432/postgres"
    python data\\pipelines\\ingest.py

Options :
    --with-imf   Tente aussi le FMI WEO (peut échouer en 403 selon le réseau)
    --imf-only   N'ingère que le FMI WEO
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

# Évite les UnicodeEncodeError sur les consoles Windows (cp1252) face aux emojis.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:  # noqa: BLE001
    pass

IMF_BASE = "https://www.imf.org/external/datamapper/api/v1"
WB_BASE = "https://api.worldbank.org/v2"

# En-têtes navigateur — nécessaire : les WAF (World Bank, IMF) renvoient 403
# sur les User-Agent non navigateur.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Pays africains : ISO3 → (ISO2, nom_en, nom_fr, région) ──────────────────
COUNTRIES: dict[str, tuple[str, str, str, str]] = {
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
    "EGY": ("eg", "Egypt", "Égypte", "North Africa"),
    "MAR": ("ma", "Morocco", "Maroc", "North Africa"),
    "TUN": ("tn", "Tunisia", "Tunisie", "North Africa"),
    "DZA": ("dz", "Algeria", "Algérie", "North Africa"),
    "LBY": ("ly", "Libya", "Libye", "North Africa"),
    "SDN": ("sd", "Sudan", "Soudan", "North Africa"),
    "CMR": ("cm", "Cameroon", "Cameroun", "Central Africa"),
    "TCD": ("td", "Chad", "Tchad", "Central Africa"),
    "CAF": ("cf", "Central African Republic", "Centrafrique", "Central Africa"),
    "COG": ("cg", "Congo", "Congo (Brazzaville)", "Central Africa"),
    "COD": ("cd", "DR Congo", "Congo (RDC)", "Central Africa"),
    "GAB": ("ga", "Gabon", "Gabon", "Central Africa"),
    "GNQ": ("gq", "Equatorial Guinea", "Guinée équatoriale", "Central Africa"),
    "STP": ("st", "Sao Tome and Principe", "Sao Tomé-et-Príncipe", "Central Africa"),
    "AGO": ("ao", "Angola", "Angola", "Central Africa"),
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

# ── Banque Mondiale — indicateurs cœur mappés vers le catalogue MANSA ───────
# (wb_code, store_code, nom, unité, facteur d'échelle)
WB_CORE = [
    ("NY.GDP.MKTP.KD.ZG", "NGDP_RPCH",   "Croissance du PIB réel", "%",     1.0),
    ("FP.CPI.TOTL.ZG",    "PCPIPCH",     "Inflation (IPC)",        "%",     1.0),
    ("NY.GDP.PCAP.CD",    "NGDPDPC",     "PIB par habitant",       "USD",   1.0),
    ("NY.GDP.MKTP.CD",    "NGDPD",       "PIB nominal",            "Mds $", 1e-9),
    ("NY.GDP.MKTP.PP.CD", "PPPGDP",      "PIB en PPA",             "Mds $", 1e-9),
    ("SP.POP.TOTL",       "LP",          "Population",             "M hab.",1e-6),
    ("GC.DOD.TOTL.GD.ZS", "GGXWDG_NGDP", "Dette publique",         "% PIB", 1.0),
    ("DT.DOD.DECT.GN.ZS", "EXTD_TOTAL_GDP", "Dette extérieure",    "% PIB", 1.0),
    ("GC.NLD.TOTL.GD.ZS", "GGXCNL_NGDP", "Solde budgétaire",       "% PIB", 1.0),
    ("GC.REV.XGRT.GD.ZS", "GGR_NGDP",    "Recettes publiques",     "% PIB", 1.0),
    ("GC.XPN.TOTL.GD.ZS", "GGX_NGDP",    "Dépenses publiques",     "% PIB", 1.0),
    ("BN.CAB.XOKA.GD.ZS", "BCA_NGDPD",   "Compte courant",         "% PIB", 1.0),
    ("BX.KLT.DINV.WD.GD.ZS", "BX_KLT_DINV_WD_GD_ZS", "IDE entrants", "% PIB", 1.0),
    ("BX.TRF.PWKR.DT.GD.ZS", "REM_GDP",  "Transferts diaspora",    "% PIB", 1.0),
    ("BX.GSR.GNFS.CD",    "BX_GSR_GNFS_CD", "Exportations B&S",    "Mds $", 1e-9),
    ("BM.GSR.GNFS.CD",    "BM_GSR_GNFS_CD", "Importations B&S",    "Mds $", 1e-9),
    ("SL.UEM.TOTL.ZS",    "LUR",         "Chômage",                "%",     1.0),
]

# ── Banque Mondiale — indicateurs social/climat (code en underscore) ────────
WB_SOCIAL = [
    ("SP.DYN.LE00.IN", "SP_DYN_LE00_IN", "Espérance de vie",        "ans", 1.0),
    ("SE.ADT.LITR.ZS", "SE_ADT_LITR_ZS", "Alphabétisation",         "%",   1.0),
    ("EG.ELC.ACCS.ZS", "EG_ELC_ACCS_ZS", "Accès électricité",       "%",   1.0),
    ("EG.FEC.RNEW.ZS", "EG_FEC_RNEW_ZS", "Énergie renouvelable",    "%",   1.0),
    ("IT.NET.USER.ZS", "IT_NET_USER_ZS", "Internautes",             "%",   1.0),
    ("SH.DYN.MORT",    "SH_DYN_MORT",    "Mortalité < 5 ans",       "‰",   1.0),
    ("SI.POV.DDAY",    "SI_POV_DDAY",    "Pauvreté < 2,15$/j",      "%",   1.0),
    ("EN.ATM.CO2E.PC", "EN_ATM_CO2E_PC", "Émissions CO2/hab",       "t",   1.0),
]

# ── FMI WEO (optionnel, --with-imf) ─────────────────────────────────────────
IMF_INDICATORS = {
    "NGDPD":       ("PIB nominal (Mds USD)", "Mds $"),
    "NGDPDPC":     ("PIB par habitant (USD)", "USD"),
    "NGDP_RPCH":   ("Croissance du PIB réel (%)", "%"),
    "LP":          ("Population (M)", "M hab."),
    "PCPIPCH":     ("Inflation IPC (%)", "%"),
    "GGXCNL_NGDP": ("Solde budgétaire (% PIB)", "% PIB"),
    "GGXWDG_NGDP": ("Dette publique (% PIB)", "% PIB"),
    "BCA_NGDPD":   ("Compte courant (% PIB)", "% PIB"),
    "LUR":         ("Chômage (%)", "%"),
}


# ── HTTP (stdlib, en-têtes navigateur, retry) ───────────────────────────────
def http_get_json(url: str, retries: int = 3) -> object:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=BROWSER_HEADERS)
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"GET échoué après {retries} essais : {url} — {last_err}")


def batched(seq: list[str], n: int) -> Iterable[list[str]]:
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


# ── Banque Mondiale ─────────────────────────────────────────────────────────
def fetch_wb(defs: list[tuple], source_label: str) -> list[tuple]:
    """defs = [(wb_code, store_code, nom, unité, échelle)]. Retourne des tuples UPSERT.

    On interroge `country/all` (un seul appel) puis on filtre les 54 pays
    africains : l'URL multi-pays trop longue déclenche un 403 côté WAF.
    """
    rows: list[tuple] = []
    for wb_code, store_code, name, unit, scale in defs:
        qs = urllib.parse.urlencode({"format": "json", "per_page": 20000, "mrv": 15})
        url = f"{WB_BASE}/country/all/indicator/{wb_code}?{qs}"
        try:
            data = http_get_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"  [warn] WB {store_code} : {e}")
            continue
        n = 0
        if isinstance(data, list) and len(data) >= 2 and data[1]:
            for rec in data[1]:
                value = rec.get("value")
                iso3 = rec.get("countryiso3code", "")
                year = rec.get("date", "")
                if value is None or iso3 not in COUNTRIES or not year:
                    continue
                rows.append((iso3, store_code, name, float(value) * scale, unit, str(year), "annual", source_label))
                n += 1
        print(f"  [ok] WB {store_code:<16} {n} points")
        time.sleep(0.2)
    return rows


# ── FMI WEO (optionnel) ─────────────────────────────────────────────────────
def fetch_imf(years: tuple[int, int]) -> list[tuple]:
    periods = ",".join(str(y) for y in range(years[0], years[1] + 1))
    rows: list[tuple] = []

    # Sonde rapide — si l'API IMF est bloquée (403), abandonner proprement
    # au lieu de cracher des dizaines d'avertissements.
    try:
        http_get_json(f"{IMF_BASE}/NGDP_RPCH/NGA?periods={years[1]}", retries=1)
    except Exception as e:  # noqa: BLE001
        print(f"  [skip] FMI WEO injoignable depuis ce réseau ({type(e).__name__}). "
              "L'API IMF bloque souvent hors résidentiel — données World Bank conservées.")
        return rows

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


# ── Base de données ─────────────────────────────────────────────────────────
def normalize_sync_url(url: str) -> str:
    url = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    parts = urllib.parse.urlsplit(url)
    params = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    params = [(k, v) for k, v in params if k.lower() not in ("pgbouncer",)]
    if not any(k.lower() == "sslmode" for k, _ in params):
        params.append(("sslmode", "require"))
    new_query = urllib.parse.urlencode(params)
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def seed_countries(cur) -> None:
    execute_values(cur, """
        INSERT INTO countries (id, iso2, name_en, name_fr, region, is_active)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            iso2 = EXCLUDED.iso2, name_en = EXCLUDED.name_en,
            name_fr = EXCLUDED.name_fr, region = EXCLUDED.region
    """, [(iso3, iso2, en, fr, region, True)
          for iso3, (iso2, en, fr, region) in COUNTRIES.items()])


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
    parser = argparse.ArgumentParser(description="Ingestion MANSA (Banque Mondiale + FMI WEO optionnel)")
    parser.add_argument("--with-imf", action="store_true", help="Tente aussi le FMI WEO (souvent bloqué hors résidentiel)")
    parser.add_argument("--imf-only", action="store_true")
    parser.add_argument("--years", nargs=2, type=int, default=[2015, 2025], metavar=("FROM", "TO"))
    args = parser.parse_args()

    raw_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL")
    if not raw_url:
        sys.exit("❌ DATABASE_URL (ou DATABASE_URL_SYNC) non défini dans l'environnement.")
    db_url = normalize_sync_url(raw_url)

    print("🌍 MANSA — Ingestion des données macro réelles")
    print(f"   Pays : {len(COUNTRIES)} · Source : {'FMI WEO' if args.imf_only else 'Banque Mondiale WDI' + (' + FMI WEO' if args.with_imf else '')}")

    wb_rows: list[tuple] = []
    imf_rows: list[tuple] = []

    if not args.imf_only:
        print("\n📊 Banque Mondiale — indicateurs cœur…")
        wb_rows += fetch_wb(WB_CORE, "WorldBank")
        print("📊 Banque Mondiale — social & climat…")
        wb_rows += fetch_wb(WB_SOCIAL, "WorldBank")

    if args.with_imf or args.imf_only:
        print("\n📈 FMI WEO (peut échouer en 403)…")
        imf_rows += fetch_imf(tuple(args.years))

    print("\n💾 Écriture en base…")
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            seed_countries(cur)
            n_wb = upsert_indicators(cur, wb_rows)
            n_imf = upsert_indicators(cur, imf_rows)
            if n_wb:
                log_ingestion(cur, "WorldBank", n_wb)
            if n_imf:
                log_ingestion(cur, "IMF_WEO", n_imf)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    total = n_wb + n_imf
    print(f"\n✅ Terminé — {total} points insérés/mis à jour "
          f"(Banque Mondiale : {n_wb}, FMI : {n_imf}).")
    if total == 0:
        print("⚠ Aucun point inséré — vérifiez votre connexion réseau (proxy/pare-feu).")
    else:
        print("   Le dashboard doit maintenant passer en « Live ». Rechargez avec Ctrl+Shift+R.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
