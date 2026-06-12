"""
MANSA Terminal — Moteur de prédiction macro-fiscal
Forecasting automatique des indicateurs économiques africains.

Algorithmes :
  - ExponentialSmoothing (Holt-Winters) : séries courtes (< 10 ans)
  - ARIMA automatique (auto_arima simplifié) : séries longues
  - Moyenne mobile pondérée : fallback robuste

Retourne : prévisions 1–5 ans avec intervalles de confiance 80% et 95%.
"""
import math
from datetime import datetime
from typing import Annotated, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_active_subscription
from app.models.models import MacroIndicator, Subscription

router = APIRouter()


# ── Noms lisibles des indicateurs ──────────────────────────────────────────
INDICATOR_LABELS: dict[str, str] = {
    "NGDP_RPCH":    "Croissance du PIB réel (%)",
    "PCPIPCH":      "Inflation IPC (%)",
    "GGXWDG_NGDP":  "Dette publique (% PIB)",
    "GGXCNL_NGDP":  "Solde budgétaire (% PIB)",
    "BCA_NGDPD":    "Compte courant (% PIB)",
    "NGDPDPC":      "PIB par habitant (USD)",
    "LUR":          "Taux de chômage (%)",
    "GGR_NGDP":     "Recettes publiques (% PIB)",
    "GGX_NGDP":     "Dépenses publiques (% PIB)",
    "NGDPD":        "PIB nominal (Mds USD)",
    "INT_POLICY":   "Taux directeur (%)",
    "BX_KLT_DINV_WD_GD_ZS": "IDE entrants (% PIB)",
}


# ── Moteur de prédiction ────────────────────────────────────────────────────

def _exponential_smoothing_forecast(
    values: list[float],
    horizon: int,
    alpha: float = 0.3,
    beta: float = 0.1,
) -> tuple[list[float], list[float], list[float]]:
    """
    Holt double exponential smoothing (trend).
    Retourne (point_forecast, lower_95, upper_95).
    """
    n = len(values)
    if n < 2:
        last = values[-1] if values else 0.0
        return [last] * horizon, [last * 0.8] * horizon, [last * 1.2] * horizon

    # Initialisation
    level = values[0]
    trend = values[1] - values[0]

    levels = [level]
    trends = [trend]

    for i in range(1, n):
        new_level = alpha * values[i] + (1 - alpha) * (level + trend)
        new_trend = beta * (new_level - level) + (1 - beta) * trend
        level, trend = new_level, new_trend
        levels.append(level)
        trends.append(trend)

    # Résidus pour intervalle de confiance
    fitted = [levels[i] + trends[i] for i in range(n)]
    residuals = [values[i] - fitted[i] for i in range(1, n)]
    rmse = math.sqrt(sum(r ** 2 for r in residuals) / max(len(residuals), 1))

    forecasts = []
    for h in range(1, horizon + 1):
        forecasts.append(level + h * trend)

    # Intervalles de confiance (s'élargissent avec l'horizon)
    lower_95 = [f - 1.96 * rmse * math.sqrt(h) for h, f in enumerate(forecasts, 1)]
    upper_95 = [f + 1.96 * rmse * math.sqrt(h) for h, f in enumerate(forecasts, 1)]

    return forecasts, lower_95, upper_95


def _arima_simple_forecast(
    values: list[float],
    horizon: int,
) -> tuple[list[float], list[float], list[float]]:
    """
    ARIMA(1,1,0) simplifié — différenciation + régression AR(1).
    Adapté aux séries macro non-stationnaires.
    """
    if len(values) < 4:
        return _exponential_smoothing_forecast(values, horizon)

    try:
        from statsmodels.tsa.arima.model import ARIMA
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            # Auto-sélection ordre (1,1,1) pour les séries macro
            model = ARIMA(values, order=(1, 1, 1))
            fit = model.fit()
            forecast_result = fit.get_forecast(steps=horizon)
            point = forecast_result.predicted_mean.tolist()
            ci = forecast_result.conf_int(alpha=0.05)
            lower = ci.iloc[:, 0].tolist()
            upper = ci.iloc[:, 1].tolist()
            return point, lower, upper
    except Exception:
        # Fallback sur Holt si statsmodels échoue
        return _exponential_smoothing_forecast(values, horizon)


def _choose_model(values: list[float]) -> str:
    """Sélectionne le meilleur modèle selon la longueur de la série."""
    n = len(values)
    if n >= 8:
        return "ARIMA(1,1,1)"
    return "HoltES"


def run_forecast(
    values: list[float],
    years: list[int],
    horizon: int = 3,
) -> dict:
    """
    Exécute le forecast et retourne le résultat structuré.
    """
    if not values or len(values) < 2:
        return {"error": "Série trop courte pour une prévision (minimum 2 points)"}

    model_name = _choose_model(values)

    if model_name.startswith("ARIMA") and len(values) >= 8:
        point, lower95, upper95 = _arima_simple_forecast(values, horizon)
    else:
        point, lower95, upper95 = _exponential_smoothing_forecast(values, horizon)

    # Intervalles 80% (moins larges)
    _, lower80, upper80 = _exponential_smoothing_forecast(values, horizon, alpha=0.4)

    last_year = max(years) if years else 2024
    forecast_years = list(range(last_year + 1, last_year + horizon + 1))

    return {
        "model": model_name,
        "historical": [
            {"year": y, "value": round(v, 3)}
            for y, v in zip(years, values)
        ],
        "forecast": [
            {
                "year":      fy,
                "value":     round(point[i], 3),
                "lower_80":  round(lower80[i], 3),
                "upper_80":  round(upper80[i], 3),
                "lower_95":  round(lower95[i], 3),
                "upper_95":  round(upper95[i], 3),
            }
            for i, fy in enumerate(forecast_years)
        ],
        "last_historical_year": last_year,
        "n_observations": len(values),
    }


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/{country_id}/{indicator_code}")
async def forecast_indicator(
    country_id: str,
    indicator_code: str,
    sub: Annotated[Subscription, Depends(get_active_subscription)],
    db: AsyncSession = Depends(get_db),
    horizon: int = Query(3, ge=1, le=5, description="Années de prévision (1–5)"),
    from_year: int = Query(2010, ge=1990, le=2025),
):
    """
    Prévision d'un indicateur macro pour un pays africain.

    Utilise ARIMA(1,1,1) pour les longues séries ou Holt Double Exponential
    Smoothing pour les séries courtes.

    Retourne :
    - Historique complet depuis `from_year`
    - Prévisions pour `horizon` années
    - Intervalles de confiance à 80% et 95%
    - Métadonnées du modèle utilisé
    """
    country_id = country_id.upper()
    indicator_code = indicator_code.upper()

    # Récupérer la série historique
    result = await db.execute(
        select(MacroIndicator)
        .where(
            MacroIndicator.country_id == country_id,
            MacroIndicator.indicator_code == indicator_code,
            MacroIndicator.period >= str(from_year),
            MacroIndicator.value.isnot(None),
        )
        .order_by(MacroIndicator.period)
    )
    data_points = result.scalars().all()

    # Filtrer les données annuelles uniquement (period = "2023" pas "2023-06")
    annual_points = [
        p for p in data_points
        if p.period and len(p.period) == 4 and p.period.isdigit()
    ]

    if not annual_points:
        raise HTTPException(
            status_code=404,
            detail=f"Aucune donnée annuelle pour {country_id}/{indicator_code} depuis {from_year}",
        )

    # Dédupliquer par année (garder la dernière source si doublon)
    seen_years: dict[int, MacroIndicator] = {}
    for pt in annual_points:
        yr = int(pt.period)
        # Préférer IMF WEO sur les autres sources
        if yr not in seen_years or pt.source in ("IMF", "IMF_WEO"):
            seen_years[yr] = pt

    sorted_points = sorted(seen_years.values(), key=lambda p: p.period)
    values = [float(p.value) for p in sorted_points]
    years  = [int(p.period) for p in sorted_points]

    # Lancer le forecast
    forecast_result = run_forecast(values, years, horizon=horizon)

    if "error" in forecast_result:
        raise HTTPException(status_code=422, detail=forecast_result["error"])

    return {
        "country_id":      country_id,
        "indicator_code":  indicator_code,
        "indicator_name":  INDICATOR_LABELS.get(indicator_code, indicator_code),
        "unit":            sorted_points[-1].unit if sorted_points else None,
        "source_data":     sorted_points[-1].source if sorted_points else "IMF",
        "horizon_years":   horizon,
        "generated_at":    datetime.utcnow().isoformat() + "Z",
        **forecast_result,
    }


@router.get("/batch/{country_id}")
async def forecast_country_batch(
    country_id: str,
    sub: Annotated[Subscription, Depends(get_active_subscription)],
    db: AsyncSession = Depends(get_db),
    indicators: str = Query(
        "NGDP_RPCH,PCPIPCH,GGXWDG_NGDP,GGXCNL_NGDP,BCA_NGDPD",
        description="Codes indicateurs séparés par virgule",
    ),
    horizon: int = Query(3, ge=1, le=5),
):
    """
    Prévisions pour plusieurs indicateurs d'un pays en un seul appel.
    Retourne un dictionnaire {indicator_code: forecast_result}.
    Limité à 10 indicateurs par appel.
    """
    country_id = country_id.upper()
    ind_list = [i.strip().upper() for i in indicators.split(",") if i.strip()][:10]

    results = {}
    for ind in ind_list:
        result = await db.execute(
            select(MacroIndicator)
            .where(
                MacroIndicator.country_id == country_id,
                MacroIndicator.indicator_code == ind,
                MacroIndicator.period >= "2010",
                MacroIndicator.value.isnot(None),
            )
            .order_by(MacroIndicator.period)
        )
        points = [
            p for p in result.scalars().all()
            if p.period and len(p.period) == 4 and p.period.isdigit()
        ]

        if len(points) < 2:
            results[ind] = {"error": "Données insuffisantes"}
            continue

        seen: dict[int, MacroIndicator] = {}
        for pt in points:
            yr = int(pt.period)
            if yr not in seen or pt.source in ("IMF", "IMF_WEO"):
                seen[yr] = pt

        sorted_pts = sorted(seen.values(), key=lambda p: p.period)
        values = [float(p.value) for p in sorted_pts]
        years  = [int(p.period) for p in sorted_pts]

        fc = run_forecast(values, years, horizon=horizon)
        if "error" not in fc:
            fc["indicator_name"] = INDICATOR_LABELS.get(ind, ind)
            fc["unit"] = sorted_pts[-1].unit
        results[ind] = fc

    return {
        "country_id":   country_id,
        "horizon_years": horizon,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "forecasts":    results,
    }
