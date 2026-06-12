"""api_keys — clés d'API pour accès programmatique

Revision ID: 0004_api_keys
Revises: 0003_add_pgvector
Create Date: 2025-06-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0004_api_keys"
down_revision = "0003_add_pgvector"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "api_keys" not in inspector.get_table_names():
        op.create_table(
            "api_keys",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(100), nullable=False),
            sa.Column("key_hash", sa.String(64), unique=True, nullable=False),
            sa.Column("key_prefix", sa.String(12), nullable=False),
            sa.Column("scopes", JSONB, nullable=False, server_default="[]"),
            sa.Column("last_used_at", sa.DateTime(timezone=True)),
            sa.Column("expires_at", sa.DateTime(timezone=True)),
            sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        )
    op.create_index("idx_apikey_user", "api_keys", ["user_id"], if_not_exists=True)
    op.create_index("idx_apikey_hash", "api_keys", ["key_hash"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("idx_apikey_hash", table_name="api_keys")
    op.drop_index("idx_apikey_user", table_name="api_keys")
    op.drop_table("api_keys")
