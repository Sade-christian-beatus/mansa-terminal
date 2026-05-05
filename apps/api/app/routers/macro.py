"""
MANSA Terminal — Router Macro Data
Données macro-fiscales des 54 pays africains
"""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, Country, MacroIndicator

router = APIRouter()

# --- Schémas de réponse ---
class IndicatorPoint(BaseModel):
    period: str
    value: float | None
    unit: str | None
    source: str

class CountryMacroResponse(BaseModel):
    country_id: str
    country_name: str
    indicators: dict[str, list[IndicatorPoint]]

class CountrySummary(BaseModel):
    id: str
    iso2: str
    name_en: str
    name_fr: str | None
    region: str | None
    currency_code: str | None
    coverage_tier: int
    flag_emoji: str | None

# Indicateurs clés du dashboard MVP
KEY_INDICATORS = {
    "NGDP_RPCH":    "GDP Real Growth (%)",
    "PCPIPCH":      "Inflation CPI (%)",
    "GGXCNL_NGDP":  "Fiscal Balance (% GDP)",
    "GGXWDG_NGDP":  "Government Debt (% GDP)",
    "BCA_NGDPD":    "Current Account (% GDP)",
    "NGDPDPC":      "GDP per Capita (USD)",
    "LUR":          "Unemployment Rate (%)",
}


@router.get("/countries", response_model=list[CountrySummary])
async def list_countries(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    region: Optional[str] = Query(None, description="Filtrer par région"),
    tier: Optional[int] = Query(None, ge=1, le=3),
):
    """Liste des 54 pays africains avec métadonnées"""
    query = select(Country).where(Country.is_active == True)
    if region:
        query = query.where(Country.region == region)
    if tier:
        query = query.where(Country.coverage_tier == tier)
    query = query.order_by(Country.coverage_tier, Country.name_en)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{country_id}", response_model=CountryMacroResponse)
async def get_country_macro(
    country_id: str,
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    indicators: Optional[str] = Query(
        None,
        description="Codes indicateurs séparés par virgule. Ex: NGDP_RPCH,PCPIPCH"
    ),
    from_year: int = Query(2015, ge=1990, le=2030),
    to_year: int = Query(2025, ge=1990, le=2030),
):
    """
    Données macro complètes pour un pays.
    Retourne les séries temporelles des indicateurs demandés.
    """
    # Valider le pays
    country_result = await db.execute(
        select(Country).where(Country.id == country_id.upper())
    )
    country = country_result.scalar_one_or_none()
    if not country:
        raise HTTPException(status_code=404,
                            detail=f"Pays '{country_id}' introuvable")

    # Déterminer les indicateurs à retourner
    requested = (
        [i.strip().upper() for i in indicators.split(",")]
        if indicators
        else list(KEY_INDICATORS.keys())
    )

    # Requête des données
    query = select(MacroIndicator).where(
        and_(
            MacroIndicator.country_id == country_id.upper(),
            MacroIndicator.indicator_code.in_(requested),
        )
    ).order_by(MacroIndicator.period)

    result = await db.execute(query)
    data_points = result.scalars().all()

    # Grouper par indicateur
    indicators_grouped: dict[str, list[IndicatorPoint]] = {}
    for point in data_points:
        code = point.indicator_code
        if code not in indicators_grouped:
            indicators_grouped[code] = []
        if point.value is not None:
            indicators_grouped[code].append(IndicatorPoint(
                period=point.period,
                value=point.value,
                unit=point.unit,
                source=point.source or "IMF",
            ))

    return CountryMacroResponse(
        country_id=country.id,
        country_name=country.name_en,
        indicators=indicators_grouped,
    )


@router.get("/heatmap/africa")
async def get_africa_heatmap(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    indicator: str = Query("NGDP_RPCH", description="Code indicateur IMF"),
    year: int = Query(2024, ge=2000, le=2030),
):
    """
    Vue heatmap continentale — une valeur par pays pour l'année donnée.
    Utilisé pour la carte Africa du dashboard principal.
    """
    result = await db.execute(
        select(
            MacroIndicator.country_id,
            MacroIndicator.value,
            MacroIndicator.period,
            Country.name_en,
            Country.flag_emoji,
        )
        .join(Country, MacroIndicator.country_id == Country.id)
        .where(
            and_(
                MacroIndicator.indicator_code == indicator,
                MacroIndicator.period == str(year),
                MacroIndicator.period_type == "annual",
            )
        )
    )
    rows = result.fetchall()

    return {
        "indicator": indicator,
        "indicator_name": KEY_INDICATORS.get(indicator, indicator),
        "year": year,
        "data": [
            {
                "country_id": r.country_id,
                "country_name": r.name_en,
                "flag": r.flag_emoji,
                "value": r.value,
            }
            for r in rows
        ]
    }
