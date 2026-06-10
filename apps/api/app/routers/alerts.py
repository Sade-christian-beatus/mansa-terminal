"""
MANSA Terminal — Router Alertes Macro
Détecte automatiquement les situations critiques dans les données MacroIndicator :
inflation, déficit, dette, croissance, réserves.
"""
from datetime import datetime, timezone
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.dependencies import require_active_subscription
from app.models.models import User, MacroIndicator, Country

router = APIRouter()

# ── Seuils d'alerte ──────────────────────────────────────────────────────────
ALERT_RULES = [
    {
        "indicator": "PCPIPCH",
        "label": "Inflation",
        "unit": "%",
        "rules": [
            {"op": "gte", "threshold": 30.0, "severity": "critical",
             "message": "Inflation hyperinflationniste (≥ 30%)"},
            {"op": "gte", "threshold": 15.0, "severity": "high",
             "message": "Inflation très élevée (≥ 15%)"},
            {"op": "gte", "threshold":  8.0, "severity": "medium",
             "message": "Inflation au-dessus du seuil UEMOA/CEMAC (≥ 8%)"},
        ],
    },
    {
        "indicator": "GGXCNL_NGDP",
        "label": "Solde budgétaire",
        "unit": "% PIB",
        "rules": [
            {"op": "lte", "threshold": -10.0, "severity": "critical",
             "message": "Déficit budgétaire critique (≤ -10% PIB)"},
            {"op": "lte", "threshold":  -7.0, "severity": "high",
             "message": "Déficit budgétaire très élevé (≤ -7% PIB)"},
            {"op": "lte", "threshold":  -5.0, "severity": "medium",
             "message": "Déficit budgétaire élevé (≤ -5% PIB)"},
        ],
    },
    {
        "indicator": "GGXWDG_NGDP",
        "label": "Dette publique",
        "unit": "% PIB",
        "rules": [
            {"op": "gte", "threshold": 100.0, "severity": "critical",
             "message": "Dette publique insoutenable (≥ 100% PIB)"},
            {"op": "gte", "threshold":  80.0, "severity": "high",
             "message": "Dette publique très élevée (≥ 80% PIB)"},
            {"op": "gte", "threshold":  70.0, "severity": "medium",
             "message": "Dette au-dessus du seuil UEMOA (≥ 70% PIB)"},
        ],
    },
    {
        "indicator": "NGDP_RPCH",
        "label": "Croissance PIB",
        "unit": "%",
        "rules": [
            {"op": "lte", "threshold": -3.0, "severity": "critical",
             "message": "Récession profonde (≤ -3%)"},
            {"op": "lte", "threshold":  0.0, "severity": "high",
             "message": "Croissance négative (récession)"},
            {"op": "lte", "threshold":  1.0, "severity": "medium",
             "message": "Croissance quasi-nulle (≤ 1%)"},
        ],
    },
    {
        "indicator": "BCA_NGDPD",
        "label": "Compte courant",
        "unit": "% PIB",
        "rules": [
            {"op": "lte", "threshold": -15.0, "severity": "high",
             "message": "Déficit courant très élevé (≤ -15% PIB)"},
            {"op": "lte", "threshold":  -8.0, "severity": "medium",
             "message": "Déficit courant élevé (≤ -8% PIB)"},
        ],
    },
]

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _evaluate_alert(indicator_code: str, value: float, country_id: str,
                    country_name: str, flag: str, period: str) -> list[dict]:
    """Évalue une valeur contre les règles d'alerte et retourne les alertes déclenchées."""
    alerts = []
    for rule_set in ALERT_RULES:
        if rule_set["indicator"] != indicator_code:
            continue
        for rule in rule_set["rules"]:
            triggered = (
                (rule["op"] == "gte" and value >= rule["threshold"]) or
                (rule["op"] == "lte" and value <= rule["threshold"])
            )
            if triggered:
                alerts.append({
                    "id": f"{country_id}-{indicator_code}-{period}-{rule['severity']}",
                    "country_id": country_id,
                    "country_name": country_name,
                    "flag": flag,
                    "indicator_code": indicator_code,
                    "indicator_label": rule_set["label"],
                    "value": round(value, 2),
                    "unit": rule_set["unit"],
                    "threshold": rule["threshold"],
                    "severity": rule["severity"],
                    "message": rule["message"],
                    "period": period,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                })
                break  # une seule alerte par indicateur (la plus sévère)
    return alerts


@router.get("/macro")
async def get_macro_alerts(
    current_user: Annotated[User, Depends(require_active_subscription)],
    db: AsyncSession = Depends(get_db),
    severity: Optional[str] = Query(
        None,
        description="Filtrer par sévérité CSV: critical,high,medium"
    ),
    year: int = Query(2024, ge=2000, le=2030),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Retourne les alertes macro déclenchées pour l'ensemble des 54 pays africains.
    Évalue : inflation, déficit, dette, croissance, compte courant.
    """
    indicator_codes = [r["indicator"] for r in ALERT_RULES]

    result = await db.execute(
        select(
            MacroIndicator.country_id,
            MacroIndicator.indicator_code,
            MacroIndicator.value,
            MacroIndicator.period,
            Country.name_fr,
            Country.name_en,
            Country.flag_emoji,
        )
        .join(Country, MacroIndicator.country_id == Country.id)
        .where(
            and_(
                MacroIndicator.period == str(year),
                MacroIndicator.indicator_code.in_(indicator_codes),
                MacroIndicator.value.isnot(None),
                Country.is_active == True,
            )
        )
        .order_by(MacroIndicator.country_id, MacroIndicator.indicator_code)
    )
    rows = result.fetchall()

    all_alerts: list[dict] = []
    for r in rows:
        country_name = r.name_fr or r.name_en or r.country_id
        alerts = _evaluate_alert(
            r.indicator_code, r.value, r.country_id,
            country_name, r.flag_emoji or "", r.period
        )
        all_alerts.extend(alerts)

    # Filtrer par sévérité si demandé
    if severity:
        requested = [s.strip().lower() for s in severity.split(",")]
        all_alerts = [a for a in all_alerts if a["severity"] in requested]

    # Trier par sévérité puis par valeur absolue d'écart
    all_alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a["severity"], 99), a["country_id"]))

    # Stats résumées
    summary = {
        "critical": sum(1 for a in all_alerts if a["severity"] == "critical"),
        "high": sum(1 for a in all_alerts if a["severity"] == "high"),
        "medium": sum(1 for a in all_alerts if a["severity"] == "medium"),
        "total": len(all_alerts),
    }

    return {
        "year": year,
        "alerts": all_alerts[:limit],
        "summary": summary,
        "is_live": len(rows) > 0,
        "note": "Données MANSA Database" if rows else "Aucune donnée — pipeline non exécuté",
    }
