"""
MANSA Terminal — Router Climate & ESG (Phase 2)
Indicateurs climat, énergie, environnement pour les 54 pays africains
"""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, MacroIndicator, Country

router = APIRouter()

CLIMATE_INDICATORS = {
    "CO2_PC":       "Émissions CO₂ par habitant (tonnes)",
    "ELEC_ACC":     "Accès à l'électricité (% population)",
    "REN_PCT":      "Part des renouvelables dans le mix (%)",
    "ELEC_RURAL":   "Accès électricité rural (%)",
    "CO2_GDP":      "Intensité carbone du PIB (kg CO₂ / USD)",
    "ELEC_LOSS":    "Pertes réseau électrique (%)",
    "CLIM_FIN_USD": "Finance climatique reçue (M USD)",
}

# Données de référence (fallback si DB vide) — World Bank WDI 2022
CLIMATE_FALLBACK = [
    {"country_id":"NGA","flag":"🇳🇬","name":"Nigeria",       "co2_pc":0.59,"elec_acc":59.1,"ren_pct":18.2,"clim_fin":312.4},
    {"country_id":"ZAF","flag":"🇿🇦","name":"South Africa",  "co2_pc":6.95,"elec_acc":91.2,"ren_pct":10.8,"clim_fin":892.1},
    {"country_id":"EGY","flag":"🇪🇬","name":"Egypt",         "co2_pc":2.41,"elec_acc":99.8,"ren_pct":11.3,"clim_fin":428.7},
    {"country_id":"KEN","flag":"🇰🇪","name":"Kenya",         "co2_pc":0.37,"elec_acc":75.0,"ren_pct":90.2,"clim_fin":521.3},
    {"country_id":"ETH","flag":"🇪🇹","name":"Ethiopia",      "co2_pc":0.14,"elec_acc":44.3,"ren_pct":91.8,"clim_fin":643.2},
    {"country_id":"GHA","flag":"🇬🇭","name":"Ghana",         "co2_pc":0.57,"elec_acc":84.9,"ren_pct":42.1,"clim_fin":187.6},
    {"country_id":"SEN","flag":"🇸🇳","name":"Sénégal",       "co2_pc":0.68,"elec_acc":67.4,"ren_pct":30.6,"clim_fin":295.4},
    {"country_id":"MAR","flag":"🇲🇦","name":"Maroc",         "co2_pc":1.82,"elec_acc":99.5,"ren_pct":37.3,"clim_fin":1243.8},
    {"country_id":"TZA","flag":"🇹🇿","name":"Tanzania",      "co2_pc":0.22,"elec_acc":38.0,"ren_pct":55.4,"clim_fin":312.1},
    {"country_id":"CMR","flag":"🇨🇲","name":"Cameroun",      "co2_pc":0.38,"elec_acc":66.2,"ren_pct":73.1,"clim_fin":198.7},
    {"country_id":"AGO","flag":"🇦🇴","name":"Angola",        "co2_pc":0.74,"elec_acc":47.0,"ren_pct":57.2,"clim_fin":89.4},
    {"country_id":"CIV","flag":"🇨🇮","name":"Côte d'Ivoire", "co2_pc":0.52,"elec_acc":70.3,"ren_pct":42.9,"clim_fin":224.5},
    {"country_id":"MLI","flag":"🇲🇱","name":"Mali",          "co2_pc":0.17,"elec_acc":53.1,"ren_pct":62.5,"clim_fin":134.2},
    {"country_id":"MOZ","flag":"🇲🇿","name":"Mozambique",    "co2_pc":0.22,"elec_acc":31.2,"ren_pct":78.3,"clim_fin":178.9},
    {"country_id":"ZMB","flag":"🇿🇲","name":"Zambie",        "co2_pc":0.39,"elec_acc":43.9,"ren_pct":84.1,"clim_fin":241.3},
    {"country_id":"RWA","flag":"🇷🇼","name":"Rwanda",        "co2_pc":0.11,"elec_acc":43.0,"ren_pct":48.7,"clim_fin":312.6},
    {"country_id":"UGA","flag":"🇺🇬","name":"Ouganda",       "co2_pc":0.13,"elec_acc":41.5,"ren_pct":84.3,"clim_fin":267.4},
    {"country_id":"BFA","flag":"🇧🇫","name":"Burkina Faso",  "co2_pc":0.21,"elec_acc":19.0,"ren_pct":48.2,"clim_fin":98.7},
    {"country_id":"NER","flag":"🇳🇪","name":"Niger",         "co2_pc":0.10,"elec_acc":15.3,"ren_pct":35.4,"clim_fin":87.3},
    {"country_id":"TGO","flag":"🇹🇬","name":"Togo",          "co2_pc":0.31,"elec_acc":56.0,"ren_pct":42.8,"clim_fin":74.2},
]


@router.get("/indicators")
async def get_climate_indicators(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    year: int = Query(2022, ge=2000, le=2030),
):
    """
    Indicateurs climat & ESG pour tous les pays africains.
    Retourne données DB si disponibles, sinon données de référence WB 2022.
    """
    result = await db.execute(
        select(MacroIndicator, Country.name_en, Country.flag_emoji)
        .join(Country, MacroIndicator.country_id == Country.id)
        .where(
            and_(
                MacroIndicator.indicator_code.in_(list(CLIMATE_INDICATORS.keys())),
                MacroIndicator.period == str(year),
            )
        )
    )
    rows = result.all()

    if rows:
        grouped: dict[str, dict] = {}
        for ind, name_en, flag in rows:
            if ind.country_id not in grouped:
                grouped[ind.country_id] = {
                    "country_id": ind.country_id,
                    "name": name_en,
                    "flag": flag or "🌍",
                    "indicators": {},
                }
            grouped[ind.country_id]["indicators"][ind.indicator_code] = ind.value
        return {"year": year, "source": "MANSA DB / World Bank WDI", "data": list(grouped.values())}

    # Fallback données de référence
    return {
        "year": 2022,
        "source": "World Bank WDI (référence)",
        "note": "Charger les pipelines Dagster pour les données live",
        "data": [
            {
                "country_id": d["country_id"],
                "name": d["name"],
                "flag": d["flag"],
                "indicators": {
                    "CO2_PC":   d["co2_pc"],
                    "ELEC_ACC": d["elec_acc"],
                    "REN_PCT":  d["ren_pct"],
                    "CLIM_FIN_USD": d["clim_fin"],
                },
            }
            for d in CLIMATE_FALLBACK
        ],
    }


@router.get("/summary")
async def get_climate_summary(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """Résumé continental — moyennes et leaders par indicateur."""
    avg_co2    = round(sum(d["co2_pc"] for d in CLIMATE_FALLBACK) / len(CLIMATE_FALLBACK), 2)
    avg_elec   = round(sum(d["elec_acc"] for d in CLIMATE_FALLBACK) / len(CLIMATE_FALLBACK), 1)
    avg_ren    = round(sum(d["ren_pct"] for d in CLIMATE_FALLBACK) / len(CLIMATE_FALLBACK), 1)
    total_fin  = round(sum(d["clim_fin"] for d in CLIMATE_FALLBACK), 0)

    leader_ren  = max(CLIMATE_FALLBACK, key=lambda d: d["ren_pct"])
    leader_elec = max(CLIMATE_FALLBACK, key=lambda d: d["elec_acc"])
    leader_co2  = min(CLIMATE_FALLBACK, key=lambda d: d["co2_pc"])

    return {
        "continent_averages": {
            "co2_per_capita":     avg_co2,
            "electricity_access": avg_elec,
            "renewables_share":   avg_ren,
            "total_climate_finance_m_usd": total_fin,
        },
        "leaders": {
            "cleanest_energy":    {"country": leader_ren["name"],  "value": leader_ren["ren_pct"],  "flag": leader_ren["flag"]},
            "best_elec_access":   {"country": leader_elec["name"], "value": leader_elec["elec_acc"],"flag": leader_elec["flag"]},
            "lowest_co2_pc":      {"country": leader_co2["name"],  "value": leader_co2["co2_pc"],   "flag": leader_co2["flag"]},
        },
    }
