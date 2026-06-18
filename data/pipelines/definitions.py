"""
MANSA Terminal — Dagster Definitions
Orchestrateur central de tous les pipelines de données
"""
import logging
import os

from dagster import (
    Definitions,
    ScheduleDefinition,
    define_asset_job,
    AssetSelection,
    sensor,
    RunRequest,
    SensorEvaluationContext,
    run_failure_sensor,
    RunFailureSensorContext,
)

logger = logging.getLogger(__name__)

from imf_pipeline import imf_weo_all_indicators, imf_weo_to_database
from worldbank_pipeline import worldbank_wdi_indicators, worldbank_wdi_to_database
from rag_pipeline import knowledge_base_seed
from imf_ifs_pipeline import imf_ifs_monthly_data, imf_ifs_to_database
from central_banks_pipeline import central_banks_data, central_banks_to_database

# ============================================================
# Jobs — Groupes d'assets à exécuter ensemble
# ============================================================

# daily_job et weekly_job référençaient des groupes d'assets inexistants (fx_daily,
# commodities, google_trends, conflict_data) → erreur au démarrage Dagster.
# Corrigés : daily et weekly pointent vers les assets disponibles (IMF + WB)
# jusqu'à ce que les pipelines Phase 2 soient implémentés.

daily_job = define_asset_job(
    name="daily_data_refresh",
    description="Mise à jour quotidienne : IMF WEO + World Bank WDI + IFS mensuel + Banques centrales",
    selection=AssetSelection.assets(
        "imf_weo_all_indicators",
        "imf_weo_to_database",
        "worldbank_wdi_indicators",
        "worldbank_wdi_to_database",
        "imf_ifs_monthly_data",
        "imf_ifs_to_database",
        "central_banks_data",
        "central_banks_to_database",
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


@run_failure_sensor(monitor_all_code_locations=True)
def pipeline_failure_alert(context: RunFailureSensorContext):
    """
    Alerte sur les échecs de pipeline.
    Notifie via Sentry et/ou email en production.
    Configurer : SENTRY_DSN + SMTP dans .env
    """
    run_id   = context.dagster_run.run_id
    job_name = context.dagster_run.job_name
    error    = context.failure_event.message if context.failure_event else "Erreur inconnue"

    logger.error(
        "MANSA Pipeline FAILURE | job=%s run=%s | %s",
        job_name, run_id, error
    )

    # Sentry capture
    sentry_dsn = os.getenv("SENTRY_DSN", "")
    if sentry_dsn:
        try:
            import sentry_sdk
            sentry_sdk.init(dsn=sentry_dsn)
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("pipeline", job_name)
                scope.set_tag("run_id", run_id)
                scope.set_context("dagster", {"job": job_name, "run_id": run_id})
                sentry_sdk.capture_message(
                    f"Pipeline échoué : {job_name} — {error[:200]}",
                    level="error",
                )
        except Exception as sentry_err:
            logger.warning("Sentry notification failed: %s", sentry_err)


# ============================================================
# Definitions — Point d'entrée Dagster
# ============================================================

defs = Definitions(
    assets=[
        # Tier 1 — IMF WEO + World Bank WDI (annuel)
        imf_weo_all_indicators,
        imf_weo_to_database,
        worldbank_wdi_indicators,
        worldbank_wdi_to_database,
        # Tier 2 — IMF IFS (mensuel haute fréquence)
        imf_ifs_monthly_data,
        imf_ifs_to_database,
        # Tier 3 — Sources africaines primaires (banques centrales)
        central_banks_data,
        central_banks_to_database,
        # RAG Knowledge Base
        knowledge_base_seed,
        # Phase 3 : nasa_nightlights, imf_portwatch, google_trends, meai
    ],
    schedules=[
        daily_schedule,
        weekly_schedule,
        monthly_schedule,
    ],
    sensors=[data_freshness_sensor, pipeline_failure_alert],
)
