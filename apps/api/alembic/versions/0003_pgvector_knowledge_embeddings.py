"""pgvector — colonne embedding sur knowledge_documents

Revision ID: 0003
Revises: 0002
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
revision = "0003"
down_revision = "0002_add_token_version"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Activer l'extension pgvector (idempotent — ne plante pas si déjà présente)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Ajouter la colonne embedding (nullable — les docs sans embedding gardent NULL)
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

    # 4. Index pour filtrage country_id + similarité (composite)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_knowledge_country_created
        ON knowledge_documents (country_id, created_at DESC);
    """)


def downgrade() -> None:
    # Supprimer l'index composite
    op.execute("DROP INDEX IF EXISTS idx_knowledge_country_created;")

    # Supprimer la colonne embedding
    op.execute("""
        ALTER TABLE knowledge_documents
        DROP COLUMN IF EXISTS embedding;
    """)

    # Ne pas DROP EXTENSION vector — d'autres tables peuvent l'utiliser
