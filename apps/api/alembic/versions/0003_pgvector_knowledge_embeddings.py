"""pgvector — colonne embedding sur knowledge_documents

Revision ID: 0003_add_pgvector
Revises: 0002_add_token_version
Create Date: 2025-06-10

Ajoute pgvector à PostgreSQL et une colonne embedding VECTOR(1536) sur la table
knowledge_documents. La dimension 1536 correspond à text-embedding-3-small (OpenAI)
et Voyage-3 (Anthropic). À ajuster si vous utilisez un autre modèle d'embedding.

Pré-requis :
    docker exec -it <postgres_container> psql -U postgres -d mansa_db \
        -c "CREATE EXTENSION IF NOT EXISTS vector;"
    ou
    mcp__supabase__apply_migration avec le SQL ci-dessous.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_add_pgvector"
down_revision = "0002_add_token_version"
branch_labels = None
depends_on = None


def _pgvector_available() -> bool:
    """
    Vérifie si l'extension pgvector est disponible sur ce serveur PostgreSQL.
    Retourne False en CI (postgres:16 standard) et True en prod (pgvector installé).
    """
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'")
    )
    return (result.scalar() or 0) > 0


def upgrade() -> None:
    # 1. Index composite country_id + date (toujours disponible, sans pgvector)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_knowledge_country_created
        ON knowledge_documents (country_id, created_at DESC);
    """)

    # 2. pgvector — extension + colonne embedding (optionnel : skippé si non disponible)
    #    En CI (postgres:16 standard) : skippé.
    #    En production (pgvector installé) : activé.
    if not _pgvector_available():
        return  # pgvector non disponible — colonne embedding ignorée

    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.execute("""
        ALTER TABLE knowledge_documents
        ADD COLUMN IF NOT EXISTS embedding vector(1536);
    """)

    # 3. Index IVFFlat pour la recherche par similarité cosine (~10x plus rapide)
    #    Activer seulement APRÈS avoir inséré au moins 100 documents.
    #    Décommentez quand la table est peuplée :
    # op.execute("""
    #     CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_ivf
    #     ON knowledge_documents USING ivfflat (embedding vector_cosine_ops)
    #     WITH (lists = 10);
    # """)


def downgrade() -> None:
    # Supprimer l'index composite
    op.execute("DROP INDEX IF EXISTS idx_knowledge_country_created;")

    # Supprimer la colonne embedding (seulement si pgvector était activé)
    if not _pgvector_available():
        return

    op.execute("""
        ALTER TABLE knowledge_documents
        DROP COLUMN IF EXISTS embedding;
    """)

    # Ne pas DROP EXTENSION vector — d'autres tables peuvent l'utiliser
