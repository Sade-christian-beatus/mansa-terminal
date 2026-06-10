"""
MANSA Terminal — Dagster Definitions
Orchestrateur central de tous les pipelines de données
"""
from dagster import (
    Definitions,
    ScheduleDefinition,
    define_asset_job,
    AssetSelection,
    sensor,
    RunRequest,
    SensorEvaluationContext,
)

from imf_pipeline import imf_weo_all_indicators, imf_weo_to_database
from worldbank_pipeline import worldbank_wdi_indicators, worldbank_wdi_to_database
from rag_pipeline import knowledge_base_seed

# ============================================================
# Jobs — Groupes d'assets à exécuter ensemble
# ============================================================

# daily_job et weekly_job référençaient des groupes d'assets inexistants (fx_daily,
# commodities, google_trends, conflict_data) → erreur au démarrage Dagster.
# Corrigés : daily et weekly pointent vers les assets disponibles (IMF + WB)
# jusqu'à ce que les pipelines Phase 2 soient implémentés.

daily_job = define_asset_job(
    name="daily_data_refresh",
    description="Mise à jour quotidienne : IMF WEO + World Bank WDI (fallback Phase 1)",
    selection=AssetSelection.assets(
        "imf_weo_all_indicators",
        "imf_weo_to_database",
        "worldbank_wdi_indicators",
        "worldbank_wdi_to_database",
    ),
)

weekly_job = define_asset_job(
    name="weekly_data_refresh",
    description="Mise à jour hebdomadaire : IMF WEO + World Bank WDI",
    selection=AssetSelection.assets(
        "imf_weo_all_indicators",
        "imf_weo_to_database",
        "worldbank_wdi_indicators",
        "worldbank_wdi_to_database",
    ),
)

monthly_job = define_asset_job(
    name="monthly_data_refresh",
    description="Mise à jour mensuelle : IMF WEO, World Bank WDI",
    selection=AssetSelection.assets(
        "imf_weo_all_indicators",
        "imf_weo_to_database",
        "worldbank_wdi_indicators",
        "worldbank_wdi_to_database",
    ),
)

full_refresh_job = define_asset_job(
    name="full_historical_refresh",
    description="Rechargement complet de l'historique (à lancer manuellement)",
    selection=AssetSelection.all(),
)

# ============================================================
# Schedules — Fréquences d'exécution
# ============================================================

# Tous les jours à 5h UTC (avant l'ouverture des marchés africains)
daily_schedule = ScheduleDefinition(
    job=daily_job,
    cron_schedule="0 5 * * *",
    name="daily_refresh_schedule",
)

# Tous les lundis à 6h UTC
weekly_schedule = ScheduleDefinition(
    job=weekly_job,
    cron_schedule="0 6 * * 1",
    name="weekly_refresh_schedule",
)

# Le 1er de chaque mois à 7h UTC
monthly_schedule = ScheduleDefinition(
    job=monthly_job,
    cron_schedule="0 7 1 * *",
    name="monthly_refresh_schedule",
)

# ============================================================
# Sensors — Alertes sur fraîcheur des données
# ============================================================

@sensor(
    job=monthly_job,
    minimum_interval_seconds=3600,  # Vérifier toutes les heures
)
def data_freshness_sensor(context: SensorEvaluationContext):
    """
    Déclenche un refresh si les données d'un pays clé
    ont plus de 48h de retard.
    """
    # En production : checker la table data_ingestion_logs
    # Pour le MVP : run mensuel simple
    return []


# ============================================================
# Definitions — Point d'entrée Dagster
# ============================================================

defs = Definitions(
    assets=[
        # Tier 1 — Gratuit, disponible Day 1
        imf_weo_all_indicators,
        imf_weo_to_database,
        worldbank_wdi_indicators,
        worldbank_wdi_to_database,
        # RAG Knowledge Base — seed initial + future indexation PDF
        knowledge_base_seed,
        # Phase 2 : budget_scrapers, bceao_data, beac_data
        # Phase 3 : nasa_nightlights, imf_portwatch, google_trends, meai
    ],
    schedules=[
        daily_schedule,
        weekly_schedule,
        monthly_schedule,
    ],
    sensors=[data_freshness_sensor],
)
