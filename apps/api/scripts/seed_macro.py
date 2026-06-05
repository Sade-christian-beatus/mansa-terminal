"""
MANSA Terminal — Seed macro_indicators depuis IMF WEO API
Usage : python scripts/seed_macro.py
"""
import os, httpx
from sqlalchemy import create_engine, text

DB = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")
engine = create_engine(DB)

INDICATORS = ["NGDP_RPCH", "PCPIPCH", "GGXCNL_NGDP", "GGXWDG_NGDP", "BCA_NGDPD", "NGDPDPC"]
BASE = "https://www.imf.org/external/datamapper/api/v1"

with engine.connect() as conn:
    countries = {r[0] for r in conn.execute(text("SELECT id FROM countries"))}
    print(f"Pays en base : {len(countries)}")

    for ind in INDICATORS:
        print(f"→ {ind} ...", end=" ", flush=True)
        try:
            data = httpx.get(f"{BASE}/{ind}", timeout=30).json().get("values", {}).get(ind, {})
            rows = [
                {"c": cid, "i": ind, "p": yr, "v": float(val), "s": "IMF_WEO"}
                for cid, years in data.items() if cid in countries
                for yr, val in years.items() if val is not None and int(yr) >= 2015
            ]
            if rows:
                conn.execute(text("""
                    INSERT INTO macro_indicators
                      (id, country_id, indicator_code, period, value, source, period_type)
                    VALUES (gen_random_uuid(), :c, :i, :p, :v, :s, 'annual')
                    ON CONFLICT (country_id, indicator_code, period, source) DO NOTHING
                """), rows)
                conn.commit()
            print(f"{len(rows)} lignes ✓")
        except Exception as e:
            print(f"erreur : {e}")

print("Seed terminé ✅")
