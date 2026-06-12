"""
MANSA Terminal — Database Models
SQLAlchemy ORM for PostgreSQL + TimescaleDB
"""
import uuid

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


# ============================================================
# USERS & AUTH
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    organization = Column(String(255))
    role = Column(String(20), nullable=False, default="analyst")
    is_active = Column(Boolean, nullable=False, default=True)
    is_verified = Column(Boolean, nullable=False, default=False)
    # Révocation stateless des refresh tokens : incrémenté à chaque logout /
    # changement de mot de passe. Tout refresh token portant un "ver" différent
    # est immédiatement rejeté sans avoir besoin d'une blocklist Redis.
    token_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    subscription = relationship("Subscription", back_populates="user", uselist=False)
    ai_queries = relationship("AIQuery", back_populates="user")

    def __repr__(self):
        return f"<User {self.email}>"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="trialing")
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    current_period_end = Column(DateTime(timezone=True))
    trial_ends_at = Column(DateTime(timezone=True))
    seats = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="subscription")

    @property
    def is_active_subscription(self) -> bool:
        return self.status in ("trialing", "active")


# ============================================================
# COUNTRIES
# ============================================================

class Country(Base):
    __tablename__ = "countries"

    id = Column(String(3), primary_key=True)    # ISO 3166-1 alpha-3: NGA, KEN…
    iso2 = Column(String(2), unique=True)        # ISO 3166-1 alpha-2: NG, KE…
    name_en = Column(String(100), nullable=False)
    name_fr = Column(String(100))
    region = Column(String(50))                  # West Africa, East Africa…
    sub_region = Column(String(50))              # WAEMU, CEMAC, EAC…
    capital = Column(String(100))
    currency_code = Column(String(3))
    currency_name = Column(String(100))
    is_waemu = Column(Boolean, nullable=False, default=False)
    is_cemac = Column(Boolean, nullable=False, default=False)
    coverage_tier = Column(Integer, nullable=False, default=3)  # 1=Full 2=Moderate 3=Basic
    flag_emoji = Column(String(10))
    is_active = Column(Boolean, nullable=False, default=True)

    def __repr__(self):
        return f"<Country {self.id} {self.name_en}>"


class MacroIndicator(Base):
    __tablename__ = "macro_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_id = Column(String(3), ForeignKey("countries.id"), nullable=False)
    indicator_code = Column(String(50), nullable=False)
    indicator_name = Column(String(200))
    value = Column(Float)
    unit = Column(String(50))
    period = Column(String(20))
    period_type = Column(String(20))
    source = Column(String(50))
    source_url = Column(String(500))
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    raw_data = Column(JSONB)

    country = relationship("Country")

    __table_args__ = (
        Index("idx_macro_country_indicator", "country_id", "indicator_code"),
        Index("idx_macro_timestamp", "timestamp"),
        UniqueConstraint(
            "country_id",
            "indicator_code",
            "period",
            "source",
            name="uq_macro_indicator",
        ),
    )

    def __repr__(self):
        return f"<MacroIndicator {self.country_id} {self.indicator_code} {self.period}>"


# ============================================================
# FX RATES
# ============================================================

class FXRate(Base):
    """Daily exchange rates — tracks official and parallel market spread."""
    __tablename__ = "fx_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    country_id = Column(String(3), ForeignKey("countries.id"), nullable=False)
    base_currency = Column(String(3), nullable=False, default="USD")
    quote_currency = Column(String(3), nullable=False)
    rate_official = Column(Float)
    rate_parallel = Column(Float)
    spread_pct = Column(Float)
    source = Column(String(50))
    date = Column(Date, nullable=False)

    __table_args__ = (
        Index("idx_fx_country_date", "country_id", "date"),
    )


# ============================================================
# AI ANALYST
# ============================================================

class AIQuery(Base):
    """Audit log for every AI Analyst request."""
    __tablename__ = "ai_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    question = Column(Text, nullable=False)
    response = Column(Text)
    model = Column(String(100), nullable=False, default="claude-sonnet-4-6")
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    countries_mentioned = Column(JSONB, default=list)
    context_docs_used = Column(JSONB, default=list)
    duration_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_queries")


class KnowledgeDocument(Base):
    """
    RAG knowledge base — Documents macro-économiques africains.

    Colonne embedding : vecteur VECTOR(1536) ajouté via migration 0003_pgvector.
    Phase 1 : recherche par country_id (pas de vecteur requis).
    Phase 2 : recherche sémantique par similarité cosine avec pgvector.
              Activer en décommentant la colonne embedding ci-dessous et en
              exécutant alembic upgrade head.

    Modèles d'embedding compatibles (dim=1536) :
      - OpenAI text-embedding-3-small (recommandé, économique)
      - Voyage-3 (Anthropic, haute qualité)
    """
    __tablename__ = "knowledge_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    doc_type = Column(String(100))           # IMF_ARTICLE_IV | WB_MEMO | BCEAO_REPORT | MANSA_SUMMARY
    country_id = Column(String(3), ForeignKey("countries.id"), nullable=True)
    content = Column(Text, nullable=False)
    year = Column(Integer)
    source_url = Column(String(500))
    # Embedding pgvector — NULL si pas encore vectorisé (migration 0003 requise)
    # La colonne est déclarée ici comme Text pour rester compatible si pgvector
    # n'est pas installé. La migration 0003 change son type en vector(1536).
    # Pour la recherche sémantique, utiliser sqlalchemy-pgvector ou raw SQL.
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("idx_knowledge_country", "country_id"),
        Index("idx_knowledge_type", "doc_type"),
        Index("idx_knowledge_year", "year"),
    )


# ============================================================
# API KEYS (Public API)
# ============================================================

class APIKey(Base):
    """Clés d'API pour accès programmatique à la plateforme MANSA."""
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)           # Label donné par l'user (ex: "Mon script R")
    key_hash = Column(String(64), unique=True, nullable=False)  # SHA-256 de la clé brute
    key_prefix = Column(String(12), nullable=False)     # Premiers chars pour affichage (mansa_xxxx)
    scopes = Column(JSONB, default=list)                # ["read:macro", "read:countries", ...]
    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))        # NULL = pas d'expiration
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")

    __table_args__ = (
        Index("idx_apikey_user", "user_id"),
        Index("idx_apikey_hash", "key_hash"),
    )


# ============================================================
# PIPELINE MONITORING
# ============================================================

class DataIngestionLog(Base):
    """Records every pipeline run — used by Dagster sensors for freshness checks."""
    __tablename__ = "data_ingestion_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False)      # IMF | WORLD_BANK | BCEAO
    country_id = Column(String(3), nullable=True)
    indicator_code = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False)
    records_fetched = Column(Integer, nullable=False, default=0)
    records_inserted = Column(Integer, nullable=False, default=0)
    error_message = Column(Text)
    duration_ms = Column(Integer)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
