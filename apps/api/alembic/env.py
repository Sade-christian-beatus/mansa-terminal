"""
MANSA Terminal — Alembic env.py
Migrations synchrones avec SQLAlchemy + psycopg2
"""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# Permet à Alembic de trouver le package app/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import Base

# IMPORTANT : importer les modèles pour que Alembic les détecte
from app.models import *  # noqa: F401,F403


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# URL DB utilisée par Alembic
config.set_main_option(
    "sqlalchemy.url",
    settings.database_url_sync_value,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url_sync_value

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        # Force IPv4 — Railway ne supporte pas IPv6 vers Supabase port 5432.
        # Utiliser le Supabase Session Pooler (port 6543) dans DATABASE_URL_SYNC
        # est la correction définitive ; ce connect_args est une garde-fou supplémentaire.
        connect_args={"options": "-c tcp_keepalives_idle=10 -c tcp_keepalives_interval=5"},
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()