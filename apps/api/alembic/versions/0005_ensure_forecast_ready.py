"""ensure_forecast_ready — validation de la chaîne après réparation 0004

Revision ID: 0005_ensure_forecast_ready
Revises: 0004_api_keys
Create Date: 2026-06-12
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_ensure_forecast_ready"
down_revision = "0004_api_keys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op: ensures the migration chain is intact after the 0004 repair.
    # Adds a composite index on macro_indicators for forecast queries if missing.
    # Uses 'timestamp' column (not 'date') as defined in 0001_initial.py
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_macroindicator_country_code_date
        ON macro_indicators (country_id, indicator_code, timestamp DESC);
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_macroindicator_country_code_date;")
