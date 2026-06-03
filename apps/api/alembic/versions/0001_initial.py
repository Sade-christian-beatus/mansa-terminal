"""
MANSA Terminal — Migration initiale
Crée toutes les tables + hypertable TimescaleDB pour macro_indicators
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- Extension pgvector (timescaledb supprimé : non dispo sur Supabase free) ----
    # Exécuter en AUTOCOMMIT pour qu'un échec n'avorte pas la transaction principale
    conn = op.get_bind()
    conn.execution_options(isolation_level="AUTOCOMMIT").execute(
        sa.text("CREATE EXTENSION IF NOT EXISTS vector;")
    )

    # ---- Table: users ----
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("organization", sa.String(255)),
        sa.Column("role", sa.String(20), default="analyst"),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("is_verified", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ---- Table: subscriptions ----
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), default="trialing"),
        sa.Column("stripe_customer_id", sa.String(255)),
        sa.Column("stripe_subscription_id", sa.String(255)),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)),
        sa.Column("seats", sa.Integer, default=1),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    # ---- Table: countries ----
    op.create_table(
        "countries",
        sa.Column("id", sa.String(3), primary_key=True),
        sa.Column("iso2", sa.String(2), unique=True),
        sa.Column("name_en", sa.String(100), nullable=False),
        sa.Column("name_fr", sa.String(100)),
        sa.Column("region", sa.String(50)),
        sa.Column("sub_region", sa.String(50)),
        sa.Column("capital", sa.String(100)),
        sa.Column("currency_code", sa.String(3)),
        sa.Column("currency_name", sa.String(100)),
        sa.Column("is_waemu", sa.Boolean, default=False),
        sa.Column("is_cemac", sa.Boolean, default=False),
        sa.Column("coverage_tier", sa.Integer, default=3),
        sa.Column("flag_emoji", sa.String(10)),
        sa.Column("is_active", sa.Boolean, default=True),
    )

    # ---- Table: macro_indicators (sera convertie en hypertable) ----
    op.create_table(
        "macro_indicators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_id", sa.String(3),
                  sa.ForeignKey("countries.id"), nullable=False),
        sa.Column("indicator_code", sa.String(50), nullable=False),
        sa.Column("indicator_name", sa.String(200)),
        sa.Column("value", sa.Float),
        sa.Column("unit", sa.String(50)),
        sa.Column("period", sa.String(20)),
        sa.Column("period_type", sa.String(20)),
        sa.Column("source", sa.String(50)),
        sa.Column("source_url", sa.String(500)),
        sa.Column("timestamp", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("raw_data", postgresql.JSONB),
    )
    op.create_index("idx_macro_country_indicator", "macro_indicators",
                    ["country_id", "indicator_code"])
    op.create_index("idx_macro_timestamp", "macro_indicators", ["timestamp"])
    op.create_index("idx_macro_period", "macro_indicators",
                    ["country_id", "indicator_code", "period"])
    op.create_unique_constraint(
        "uq_macro_indicator", "macro_indicators",
        ["country_id", "indicator_code", "period", "source"]
    )
    # NOTE: macro_indicators reste une table PostgreSQL standard.
    # Le volume (~54 pays × 15 indicateurs × 30 ans ≈ 25K lignes) ne justifie
    # pas une hypertable TimescaleDB. L'extension est disponible pour fx_rates
    # et d'autres tables haute fréquence en Phase 2.

    # ---- Table: fx_rates ----
    op.create_table(
        "fx_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("country_id", sa.String(3),
                  sa.ForeignKey("countries.id"), nullable=False),
        sa.Column("base_currency", sa.String(3), default="USD"),
        sa.Column("quote_currency", sa.String(3), nullable=False),
        sa.Column("rate_official", sa.Float),
        sa.Column("rate_parallel", sa.Float),
        sa.Column("spread_pct", sa.Float),
        sa.Column("source", sa.String(50)),
        sa.Column("date", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_fx_country_date", "fx_rates", ["country_id", "date"])

    # ---- Table: ai_queries ----
    op.create_table(
        "ai_queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("response", sa.Text),
        sa.Column("model", sa.String(100)),
        sa.Column("input_tokens", sa.Integer, default=0),
        sa.Column("output_tokens", sa.Integer, default=0),
        sa.Column("countries_mentioned", postgresql.JSONB),
        sa.Column("context_docs_used", postgresql.JSONB),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    # ---- Table: knowledge_documents + colonne vecteur ----
    op.create_table(
        "knowledge_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("doc_type", sa.String(100)),
        sa.Column("country_id", sa.String(3),
                  sa.ForeignKey("countries.id"), nullable=True),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("year", sa.Integer),
        sa.Column("source_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )
    # Ajouter la colonne vecteur pgvector (1536 dims = OpenAI, 1024 = Claude)
    op.execute("""
        ALTER TABLE knowledge_documents
        ADD COLUMN embedding vector(1024);
    """)
    # Index HNSW pour recherche vecteur rapide
    op.execute("""
        CREATE INDEX idx_knowledge_embedding
        ON knowledge_documents
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)
    op.create_index("idx_knowledge_country", "knowledge_documents",
                    ["country_id"])
    op.create_index("idx_knowledge_type", "knowledge_documents", ["doc_type"])

    # ---- Table: data_ingestion_logs ----
    op.create_table(
        "data_ingestion_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("country_id", sa.String(3), nullable=True),
        sa.Column("indicator_code", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("records_fetched", sa.Integer, default=0),
        sa.Column("records_inserted", sa.Integer, default=0),
        sa.Column("error_message", sa.Text),
        sa.Column("duration_ms", sa.Integer),
        sa.Column("started_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )

    # ---- Seed: 54 pays africains ----
    _seed_african_countries()


def _seed_african_countries():
    """Insère les 54 pays africains avec leurs métadonnées"""
    countries_table = sa.table(
        "countries",
        sa.column("id"), sa.column("iso2"), sa.column("name_en"),
        sa.column("name_fr"), sa.column("region"), sa.column("sub_region"),
        sa.column("currency_code"), sa.column("is_waemu"),
        sa.column("is_cemac"), sa.column("coverage_tier"),
        sa.column("flag_emoji"), sa.column("is_active"),
    )

    COUNTRIES = [
        # Tier 1 — Full depth (Mois 1-3)
        ("NGA", "NG", "Nigeria", "Nigéria", "West Africa", None, "NGN", False, False, 1, "🇳🇬"),
        ("ZAF", "ZA", "South Africa", "Afrique du Sud", "Southern Africa", None, "ZAR", False, False, 1, "🇿🇦"),
        ("KEN", "KE", "Kenya", "Kenya", "East Africa", "EAC", "KES", False, False, 1, "🇰🇪"),
        ("GHA", "GH", "Ghana", "Ghana", "West Africa", None, "GHS", False, False, 1, "🇬🇭"),
        ("EGY", "EG", "Egypt", "Égypte", "North Africa", None, "EGP", False, False, 1, "🇪🇬"),
        ("MAR", "MA", "Morocco", "Maroc", "North Africa", None, "MAD", False, False, 1, "🇲🇦"),
        ("TUN", "TN", "Tunisia", "Tunisie", "North Africa", None, "TND", False, False, 1, "🇹🇳"),
        ("SEN", "SN", "Senegal", "Sénégal", "West Africa", "WAEMU", "XOF", True, False, 1, "🇸🇳"),
        ("CIV", "CI", "Côte d'Ivoire", "Côte d'Ivoire", "West Africa", "WAEMU", "XOF", True, False, 1, "🇨🇮"),
        ("CMR", "CM", "Cameroon", "Cameroun", "Central Africa", "CEMAC", "XAF", False, True, 1, "🇨🇲"),
        ("TZA", "TZ", "Tanzania", "Tanzanie", "East Africa", "EAC", "TZS", False, False, 1, "🇹🇿"),
        ("UGA", "UG", "Uganda", "Ouganda", "East Africa", "EAC", "UGX", False, False, 1, "🇺🇬"),
        ("ETH", "ET", "Ethiopia", "Éthiopie", "East Africa", None, "ETB", False, False, 1, "🇪🇹"),
        ("RWA", "RW", "Rwanda", "Rwanda", "East Africa", "EAC", "RWF", False, False, 1, "🇷🇼"),
        ("COD", "CD", "DR Congo", "RD Congo", "Central Africa", None, "CDF", False, False, 1, "🇨🇩"),
        ("MOZ", "MZ", "Mozambique", "Mozambique", "Southern Africa", None, "MZN", False, False, 1, "🇲🇿"),
        ("ZMB", "ZM", "Zambia", "Zambie", "Southern Africa", None, "ZMW", False, False, 1, "🇿🇲"),
        ("AGO", "AO", "Angola", "Angola", "Southern Africa", None, "AOA", False, False, 1, "🇦🇴"),
        ("BWA", "BW", "Botswana", "Botswana", "Southern Africa", None, "BWP", False, False, 1, "🇧🇼"),
        ("MUS", "MU", "Mauritius", "Maurice", "East Africa", None, "MUR", False, False, 1, "🇲🇺"),
        # Tier 2 — Moderate depth (Mois 3-6)
        ("BEN", "BJ", "Benin", "Bénin", "West Africa", "WAEMU", "XOF", True, False, 2, "🇧🇯"),
        ("BFA", "BF", "Burkina Faso", "Burkina Faso", "West Africa", "WAEMU", "XOF", True, False, 2, "🇧🇫"),
        ("GNB", "GW", "Guinea-Bissau", "Guinée-Bissau", "West Africa", "WAEMU", "XOF", True, False, 2, "🇬🇼"),
        ("MLI", "ML", "Mali", "Mali", "West Africa", "WAEMU", "XOF", True, False, 2, "🇲🇱"),
        ("NER", "NE", "Niger", "Niger", "West Africa", "WAEMU", "XOF", True, False, 2, "🇳🇪"),
        ("TGO", "TG", "Togo", "Togo", "West Africa", "WAEMU", "XOF", True, False, 2, "🇹🇬"),
        ("CAF", "CF", "Central African Republic", "Centrafrique", "Central Africa", "CEMAC", "XAF", False, True, 2, "🇨🇫"),
        ("TCD", "TD", "Chad", "Tchad", "Central Africa", "CEMAC", "XAF", False, True, 2, "🇹🇩"),
        ("COG", "CG", "Republic of Congo", "Congo-Brazzaville", "Central Africa", "CEMAC", "XAF", False, True, 2, "🇨🇬"),
        ("GNQ", "GQ", "Equatorial Guinea", "Guinée équatoriale", "Central Africa", "CEMAC", "XAF", False, True, 2, "🇬🇶"),
        ("GAB", "GA", "Gabon", "Gabon", "Central Africa", "CEMAC", "XAF", False, True, 2, "🇬🇦"),
        ("MDG", "MG", "Madagascar", "Madagascar", "Southern Africa", None, "MGA", False, False, 2, "🇲🇬"),
        ("MWI", "MW", "Malawi", "Malawi", "Southern Africa", None, "MWK", False, False, 2, "🇲🇼"),
        ("ZWE", "ZW", "Zimbabwe", "Zimbabwe", "Southern Africa", None, "ZWL", False, False, 2, "🇿🇼"),
        ("NAM", "NA", "Namibia", "Namibie", "Southern Africa", None, "NAD", False, False, 2, "🇳🇦"),
        ("GIN", "GN", "Guinea", "Guinée", "West Africa", None, "GNF", False, False, 2, "🇬🇳"),
        # Tier 3 — Basic (Mois 6-12)
        ("DZA", "DZ", "Algeria", "Algérie", "North Africa", None, "DZD", False, False, 3, "🇩🇿"),
        ("LBY", "LY", "Libya", "Libye", "North Africa", None, "LYD", False, False, 3, "🇱🇾"),
        ("SDN", "SD", "Sudan", "Soudan", "East Africa", None, "SDG", False, False, 3, "🇸🇩"),
        ("SOM", "SO", "Somalia", "Somalie", "East Africa", None, "SOS", False, False, 3, "🇸🇴"),
        ("ERI", "ER", "Eritrea", "Érythrée", "East Africa", None, "ERN", False, False, 3, "🇪🇷"),
        ("DJI", "DJ", "Djibouti", "Djibouti", "East Africa", None, "DJF", False, False, 3, "🇩🇯"),
        ("SSD", "SS", "South Sudan", "Soudan du Sud", "East Africa", None, "SSP", False, False, 3, "🇸🇸"),
        ("SLE", "SL", "Sierra Leone", "Sierra Leone", "West Africa", None, "SLL", False, False, 3, "🇸🇱"),
        ("LBR", "LR", "Liberia", "Libéria", "West Africa", None, "LRD", False, False, 3, "🇱🇷"),
        ("GMB", "GM", "Gambia", "Gambie", "West Africa", None, "GMD", False, False, 3, "🇬🇲"),
        ("CPV", "CV", "Cabo Verde", "Cap-Vert", "West Africa", None, "CVE", False, False, 3, "🇨🇻"),
        ("MRT", "MR", "Mauritania", "Mauritanie", "West Africa", None, "MRU", False, False, 3, "🇲🇷"),
        ("LSO", "LS", "Lesotho", "Lesotho", "Southern Africa", None, "LSL", False, False, 3, "🇱🇸"),
        ("SWZ", "SZ", "Eswatini", "Eswatini", "Southern Africa", None, "SZL", False, False, 3, "🇸🇿"),
        ("COM", "KM", "Comoros", "Comores", "East Africa", None, "KMF", False, False, 3, "🇰🇲"),
        ("STP", "ST", "São Tomé and Príncipe", "São Tomé-et-Príncipe", "Central Africa", None, "STN", False, False, 3, "🇸🇹"),
        ("BDI", "BI", "Burundi", "Burundi", "East Africa", "EAC", "BIF", False, False, 3, "🇧🇮"),
    ]

    op.bulk_insert(countries_table, [
        {
            "id": c[0], "iso2": c[1], "name_en": c[2], "name_fr": c[3],
            "region": c[4], "sub_region": c[5], "currency_code": c[6],
            "is_waemu": c[7], "is_cemac": c[8], "coverage_tier": c[9],
            "flag_emoji": c[10], "is_active": True,
        }
        for c in COUNTRIES
    ])


def downgrade() -> None:
    op.drop_table("data_ingestion_logs")
    op.drop_table("knowledge_documents")
    op.drop_table("ai_queries")
    op.drop_table("fx_rates")
    op.drop_table("macro_indicators")
    op.drop_table("countries")
    op.drop_table("subscriptions")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector;")
