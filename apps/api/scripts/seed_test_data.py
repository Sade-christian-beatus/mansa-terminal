"""
MANSA Terminal — Seed manuel pour tests rapides
Insère des données macro fictives pour 5 pays clés
sans avoir à attendre les pipelines Dagster.

Usage : python scripts/seed_test_data.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.core.config import settings


# Données macro réalistes 2020-2024 pour 5 pays clés
TEST_DATA = {
    "NGA": {  # Nigeria
        "NGDP_RPCH":   {"2020": -1.8, "2021": 3.6, "2022": 3.3, "2023": 2.9, "2024": 3.1},
        "PCPIPCH":     {"2020": 13.2, "2021": 17.0, "2022": 18.8, "2023": 24.7, "2024": 25.0},
        "GGXCNL_NGDP": {"2020": -5.3, "2021": -5.5, "2022": -5.4, "2023": -4.7, "2024": -4.5},
        "GGXWDG_NGDP": {"2020": 35.1, "2021": 36.6, "2022": 39.6, "2023": 46.4, "2024": 49.0},
    },
    "ZAF": {  # South Africa
        "NGDP_RPCH":   {"2020": -6.0, "2021": 4.7, "2022": 1.9, "2023": 0.6, "2024": 1.0},
        "PCPIPCH":     {"2020": 3.3, "2021": 4.6, "2022": 6.9, "2023": 6.0, "2024": 4.9},
        "GGXCNL_NGDP": {"2020": -9.6, "2021": -5.5, "2022": -4.4, "2023": -5.0, "2024": -5.3},
        "GGXWDG_NGDP": {"2020": 69.4, "2021": 69.0, "2022": 71.1, "2023": 74.7, "2024": 75.5},
    },
    "KEN": {  # Kenya
        "NGDP_RPCH":   {"2020": -0.3, "2021": 7.6, "2022": 4.9, "2023": 5.6, "2024": 5.0},
        "PCPIPCH":     {"2020": 5.3, "2021": 6.1, "2022": 7.6, "2023": 7.7, "2024": 5.5},
        "GGXCNL_NGDP": {"2020": -8.1, "2021": -7.2, "2022": -6.2, "2023": -5.6, "2024": -4.5},
        "GGXWDG_NGDP": {"2020": 67.8, "2021": 68.0, "2022": 67.7, "2023": 73.4, "2024": 70.2},
    },
    "GHA": {  # Ghana
        "NGDP_RPCH":   {"2020": 0.5, "2021": 5.1, "2022": 3.8, "2023": 2.9, "2024": 3.1},
        "PCPIPCH":     {"2020": 9.9, "2021": 9.9, "2022": 31.5, "2023": 38.1, "2024": 22.0},
        "GGXCNL_NGDP": {"2020": -15.0, "2021": -12.1, "2022": -11.8, "2023": -4.1, "2024": -4.6},
        "GGXWDG_NGDP": {"2020": 72.3, "2021": 79.6, "2022": 88.8, "2023": 84.9, "2024": 80.0},
    },
    "SEN": {  # Senegal
        "NGDP_RPCH":   {"2020": 1.3, "2021": 6.5, "2022": 4.2, "2023": 4.6, "2024": 8.3},
        "PCPIPCH":     {"2020": 2.5, "2021": 2.2, "2022": 9.7, "2023": 5.9, "2024": 3.1},
        "GGXCNL_NGDP": {"2020": -6.4, "2021": -6.3, "2022": -6.6, "2023": -4.9, "2024": -3.9},
        "GGXWDG_NGDP": {"2020": 69.2, "2021": 73.2, "2022": 76.0, "2023": 81.0, "2024": 79.5},
    },
}

INDICATOR_META = {
    "NGDP_RPCH":   ("GDP Real Growth", "%"),
    "PCPIPCH":     ("CPI Inflation", "%"),
    "GGXCNL_NGDP": ("Fiscal Balance % GDP", "% GDP"),
    "GGXWDG_NGDP": ("Government Debt % GDP", "% GDP"),
}


async def seed():
    print("🌱 Seeding test macro data...")
    engine = create_async_engine(settings.DATABASE_URL)

    inserted = 0
    async with AsyncSession(engine) as session:
        for country_id, indicators in TEST_DATA.items():
            for code, periods in indicators.items():
                name, unit = INDICATOR_META[code]
                for period, value in periods.items():
                    await session.execute(text("""
                        INSERT INTO macro_indicators
                          (id, country_id, indicator_code, indicator_name,
                           value, unit, period, period_type, source, timestamp)
                        VALUES
                          (gen_random_uuid(), :cid, :code, :name, :val,
                           :unit, :period, 'annual', 'IMF_TEST', NOW())
                        ON CONFLICT (country_id, indicator_code, period, source)
                        DO UPDATE SET value = EXCLUDED.value
                    """), {
                        "cid": country_id, "code": code, "name": name,
                        "val": value, "unit": unit, "period": period,
                    })
                    inserted += 1
        await session.commit()

    await engine.dispose()
    print(f"✅ {inserted} points de données insérés pour {len(TEST_DATA)} pays")


if __name__ == "__main__":
    asyncio.run(seed())
