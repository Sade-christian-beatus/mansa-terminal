"""
MANSA Terminal — Router Macro Data
Données macro-fiscales des 54 pays africains
"""
import csv
import io
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.core.limiter import limiter

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, Country, MacroIndicator, DataIngestionLog

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


@router.get("/export")
async def export_macro_data(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    sources: Optional[str] = Query(None, description="Sources CSV, ex: IMF,WB"),
    year_from: int = Query(2015, ge=1990, le=2030),
    year_to: int = Query(2025, ge=1990, le=2030),
):
    """
    Export des données macro pour le dashboard.
    Retourne toutes les valeurs dans la plage d'années demandée.
    """
    q = select(
        MacroIndicator.country_id,
        MacroIndicator.indicator_code,
        MacroIndicator.value,
        MacroIndicator.period,
        MacroIndicator.unit,
        MacroIndicator.source,
        Country.name_en,
        Country.flag_emoji,
    ).join(Country, MacroIndicator.country_id == Country.id).where(
        and_(
            MacroIndicator.period >= str(year_from),
            MacroIndicator.period <= str(year_to),
            MacroIndicator.period_type == "annual",
        )
    )
    if sources:
        src_list = [s.strip().upper() for s in sources.split(",") if s.strip()]
        if src_list:
            q = q.where(MacroIndicator.source.in_(src_list))

    result = await db.execute(q.order_by(MacroIndicator.country_id, MacroIndicator.indicator_code, MacroIndicator.period).limit(5_000))
    rows = result.fetchall()
    return [
        {
            "country": r.country_id,
            "country_name": r.name_en,
            "flag": r.flag_emoji,
            "indicator_code": r.indicator_code,
            "indicator_name": KEY_INDICATORS.get(r.indicator_code, r.indicator_code),
            "value": r.value,
            "period": r.period,
            "unit": r.unit,
            "source": r.source,
        }
        for r in rows
    ]


@router.get("/freshness")
async def get_data_freshness(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
):
    """
    Retourne la fraîcheur des données pour chaque source (IMF, World Bank, etc.).
    Utilisé par le frontend pour afficher l'horodatage de mise à jour.
    """
    result = await db.execute(
        select(
            DataIngestionLog.source,
            func.max(DataIngestionLog.completed_at).label("last_updated"),
            func.sum(DataIngestionLog.records_inserted).label("total_records"),
            func.count(DataIngestionLog.id).label("run_count"),
        )
        .where(DataIngestionLog.status == "success")
        .group_by(DataIngestionLog.source)
        .order_by(func.max(DataIngestionLog.completed_at).desc())
    )
    rows = result.fetchall()

    # Fallback si aucun log d'ingestion
    if not rows:
        return {
            "sources": [],
            "last_updated": None,
            "is_live": False,
            "note": "Aucune ingestion enregistrée — lancez le pipeline Dagster",
        }

    sources = [
        {
            "source": r.source,
            "last_updated": r.last_updated.isoformat() if r.last_updated else None,
            "total_records": int(r.total_records or 0),
            "run_count": int(r.run_count or 0),
        }
        for r in rows
    ]

    most_recent = max(
        (s["last_updated"] for s in sources if s["last_updated"]),
        default=None,
    )

    return {
        "sources": sources,
        "last_updated": most_recent,
        "is_live": most_recent is not None,
    }


@router.get("/regions/{zone}")
async def get_region_aggregates(
    zone: str,
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    year: int = Query(2024, ge=2000, le=2030),
):
    """
    Agrégats macro pour une zone régionale : UEMOA, CEMAC ou SSA.
    Calcule moyennes et vérifie les critères de convergence.
    """
    ZONE_COUNTRIES = {
        "UEMOA": ["SEN", "CIV", "MLI", "BFA", "NER", "TGO", "BEN", "GNB"],
        "CEMAC": ["CMR", "TCD", "CAF", "COG", "GAB", "GNQ"],
        "SSA":   None,  # tous les pays africains actifs
    }
    zone_upper = zone.upper()
    if zone_upper not in ZONE_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Zone '{zone}' inconnue. Valeurs valides: UEMOA, CEMAC, SSA")

    country_ids = ZONE_COUNTRIES[zone_upper]

    # Données par pays pour l'année demandée
    base_q = select(
        MacroIndicator.country_id,
        MacroIndicator.indicator_code,
        MacroIndicator.value,
        Country.name_fr,
        Country.flag_emoji,
    ).join(Country, MacroIndicator.country_id == Country.id).where(
        and_(
            MacroIndicator.period == str(year),
            MacroIndicator.indicator_code.in_(list(KEY_INDICATORS.keys())),
        )
    )
    if country_ids:
        base_q = base_q.where(MacroIndicator.country_id.in_(country_ids))

    result = await db.execute(base_q.order_by(MacroIndicator.country_id))
    rows = result.fetchall()

    # Organiser par pays
    by_country: dict[str, dict] = {}
    for r in rows:
        if r.country_id not in by_country:
            by_country[r.country_id] = {
                "country_id": r.country_id,
                "name": r.name_fr or r.country_id,
                "flag": r.flag_emoji or "",
                "indicators": {},
            }
        by_country[r.country_id]["indicators"][r.indicator_code] = r.value

    # Critères de convergence
    CONVERGENCE = {
        "UEMOA": {
            "GGXCNL_NGDP": {"op": "gte", "threshold": -3.0, "label": "Déficit ≤ 3% PIB"},
            "PCPIPCH":      {"op": "lte", "threshold":  3.0, "label": "Inflation ≤ 3%"},
            "GGXWDG_NGDP":  {"op": "lte", "threshold": 70.0, "label": "Dette ≤ 70% PIB"},
            "GGR_NGDP":     {"op": "gte", "threshold": 20.0, "label": "Recettes ≥ 20% PIB"},
        },
        "CEMAC": {
            "GGXCNL_NGDP": {"op": "gte", "threshold": -3.0, "label": "Déficit ≤ 3% PIB"},
            "PCPIPCH":     {"op": "lte", "threshold":  3.0, "label": "Inflation ≤ 3%"},
        },
        "SSA": {},
    }

    criteria = CONVERGENCE.get(zone_upper, {})
    countries_data = list(by_country.values())

    # Ajouter le statut de convergence pour chaque pays
    for country in countries_data:
        compliance: dict[str, str] = {}
        for code, rule in criteria.items():
            val = country["indicators"].get(code)
            if val is None:
                compliance[code] = "no_data"
            elif rule["op"] == "gte":
                compliance[code] = "ok" if val >= rule["threshold"] else "breach"
            else:
                compliance[code] = "ok" if val <= rule["threshold"] else "breach"
        country["convergence"] = compliance

    # Calculer les totaux attendus par zone pour le warning de complétude
    expected_counts = {"UEMOA": 8, "CEMAC": 6, "SSA": 54}
    n_expected = expected_counts.get(zone_upper, len(countries_data))
    n_with_data = len(countries_data)
    data_completeness_pct = round((n_with_data / n_expected) * 100) if n_expected else 100

    # Avertissement si des pays manquent de données
    completeness_warning = None
    if n_with_data < n_expected:
        missing_count = n_expected - n_with_data
        completeness_warning = (
            f"{missing_count} pays sur {n_expected} n'ont pas de données pour {year}. "
            f"Les moyennes sont calculées sur {n_with_data} pays ({data_completeness_pct}% de couverture)."
        )

    return {
        "zone": zone_upper,
        "year": year,
        "countries": countries_data,
        "convergence_criteria": criteria,
        "n_countries": n_with_data,
        "n_expected": n_expected,
        "data_completeness_pct": data_completeness_pct,
        "completeness_warning": completeness_warning,
    }


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


# ── ALL_INDICATORS — catalogue complet exposé dans le bulk export ───────────
ALL_INDICATORS = {
    **KEY_INDICATORS,
    "NGDPD":          "GDP Nominal (Billions USD)",
    "PPPGDP":         "GDP PPP (Billions USD)",
    "LP":             "Population (Millions)",
    "GGXONLB_NGDP":   "Primary Balance (% GDP)",
    "GGR_NGDP":       "Government Revenue (% GDP)",
    "GGX_NGDP":       "Government Expenditure (% GDP)",
    "BX_KLT_DINV_WD_GD_ZS": "FDI Inflows (% GDP)",
    "EXTD_TOTAL_GDP": "External Debt (% GDP)",
    "REM_GDP":        "Remittances (% GDP)",
    "BX_GSR_GNFS_CD": "Exports of Goods & Services (USD)",
    "BM_GSR_GNFS_CD": "Imports of Goods & Services (USD)",
    "FM_LIPY":        "Money Supply M2 (% GDP)",
    "SP_DYN_LE00_IN": "Life Expectancy (years)",
    "SE_ADT_LITR_ZS": "Adult Literacy Rate (%)",
    "EG_ELC_ACCS_ZS": "Electricity Access (%)",
    "EG_FEC_RNEW_ZS": "Renewable Energy Share (%)",
    "EN_ATM_CO2E_PC":  "CO2 Emissions per Capita (t)",
    "IT_NET_USER_ZS":  "Internet Users (%)",
    "SH_DYN_MORT":    "Under-5 Mortality (per 1,000)",
    "SI_POV_DDAY":    "Poverty Headcount < $2.15/day (%)",
}


@router.get("/bulk-export")
@limiter.limit("10/hour")
async def bulk_export(
    request: Request,
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    countries: Optional[str] = Query(None, description="Codes ISO3 séparés par virgule. Vide = tous les 54 pays"),
    indicators: Optional[str] = Query(None, description="Codes indicateurs séparés par virgule. Vide = tous les indicateurs clés"),
    from_year: int = Query(2015, ge=1990, le=2030),
    to_year: int = Query(2025, ge=1990, le=2030),
    format: str = Query("csv", enum=["csv", "json"]),
    region: Optional[str] = Query(None, description="Filtrer par région. Ex: West Africa"),
):
    """
    Téléchargement massif des données macro.
    Permet d'exporter jusqu'à 50 000 lignes en CSV ou JSON.
    Limité à 10 exports par heure.
    """
    # Construire le filtre pays
    country_filter: Optional[list[str]] = None
    if countries:
        country_filter = [c.strip().upper() for c in countries.split(",") if c.strip()][:54]

    # Si filtre région — récupérer les pays de la région
    if region and not country_filter:
        region_result = await db.execute(
            select(Country.id).where(Country.region == region, Country.is_active == True)
        )
        country_filter = [r[0] for r in region_result.fetchall()]

    # Construire le filtre indicateurs
    indicator_filter: Optional[list[str]] = None
    if indicators:
        indicator_filter = [i.strip().upper() for i in indicators.split(",") if i.strip()][:50]
    else:
        indicator_filter = list(ALL_INDICATORS.keys())

    # Requête principale
    q = (
        select(
            MacroIndicator.country_id,
            MacroIndicator.indicator_code,
            MacroIndicator.indicator_name,
            MacroIndicator.value,
            MacroIndicator.unit,
            MacroIndicator.period,
            MacroIndicator.source,
            Country.name_en,
            Country.name_fr,
            Country.region,
        )
        .join(Country, MacroIndicator.country_id == Country.id)
        .where(
            MacroIndicator.period >= str(from_year),
            MacroIndicator.period <= str(to_year),
        )
        .order_by(Country.name_en, MacroIndicator.indicator_code, MacroIndicator.period)
        .limit(50_000)
    )
    if country_filter:
        q = q.where(MacroIndicator.country_id.in_(country_filter))
    if indicator_filter:
        q = q.where(MacroIndicator.indicator_code.in_(indicator_filter))

    result = await db.execute(q)
    rows = result.fetchall()

    # ── Format CSV ───────────────────────────────────────────────────────────
    if format == "csv":
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=[
            "country_id", "country_name_en", "country_name_fr", "region",
            "indicator_code", "indicator_name", "period", "value", "unit", "source",
        ])
        writer.writeheader()
        for r in rows:
            writer.writerow({
                "country_id": r.country_id,
                "country_name_en": r.name_en,
                "country_name_fr": r.name_fr or r.name_en,
                "region": r.region or "",
                "indicator_code": r.indicator_code,
                "indicator_name": r.indicator_name or ALL_INDICATORS.get(r.indicator_code, r.indicator_code),
                "period": r.period,
                "value": r.value,
                "unit": r.unit or "",
                "source": r.source or "",
            })
        buf.seek(0)
        filename = f"mansa_data_{from_year}_{to_year}.csv"
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # ── Format JSON ──────────────────────────────────────────────────────────
    return {
        "meta": {
            "countries": country_filter or "all",
            "indicators": indicator_filter,
            "from_year": from_year,
            "to_year": to_year,
            "total_rows": len(rows),
            "source": "MANSA Terminal — IMF WEO + World Bank WDI",
            "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        },
        "data": [
            {
                "country_id": r.country_id,
                "country_name_en": r.name_en,
                "country_name_fr": r.name_fr or r.name_en,
                "region": r.region,
                "indicator_code": r.indicator_code,
                "indicator_name": r.indicator_name or ALL_INDICATORS.get(r.indicator_code, r.indicator_code),
                "period": r.period,
                "value": r.value,
                "unit": r.unit,
                "source": r.source,
            }
            for r in rows
        ],
    }


@router.get("/catalog")
async def get_indicators_catalog(
    current_user: Annotated[User, Depends(require_active_subscription)],
):
    """Catalogue de tous les indicateurs disponibles avec code, nom et source."""
    return {
        "indicators": [
            {"code": code, "name": name, "source": "IMF WEO / World Bank WDI"}
            for code, name in ALL_INDICATORS.items()
        ],
        "total": len(ALL_INDICATORS),
    }
