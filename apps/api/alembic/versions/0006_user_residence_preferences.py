"""user_residence_preferences — country_of_residence, preferred_currency, preferred_language

Revision ID: 0006_user_residence_preferences
Revises: 0005_ensure_forecast_ready
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa

revision = "0006_user_residence_preferences"
down_revision = "0005_ensure_forecast_ready"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("country_of_residence", sa.String(3), nullable=True))
    op.add_column("users", sa.Column("preferred_currency",   sa.String(3), nullable=True))
    op.add_column("users", sa.Column("preferred_language",   sa.String(5), nullable=True, server_default="fr"))


def downgrade() -> None:
    op.drop_column("users", "preferred_language")
    op.drop_column("users", "preferred_currency")
    op.drop_column("users", "country_of_residence")
