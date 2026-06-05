"""
MANSA Terminal — Révocation stateless des refresh tokens
Ajoute token_version sur la table users.
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_add_token_version"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
