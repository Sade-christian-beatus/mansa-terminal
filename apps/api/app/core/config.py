"""
MANSA Terminal — Configuration centralisée
Toutes les variables d'environnement validées avec Pydantic
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _make_asyncpg_url(url: str) -> str:
    """Convertit postgresql:// → postgresql+asyncpg:// (Railway fournit le format sync)."""
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        # Certains providers utilisent postgres:// (alias non standard)
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    _env_paths = [
        ".env",
        "../../.env",
        "../../../.env",
    ]

    model_config = SettingsConfigDict(
        env_file=_env_paths,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    APP_ENV: str = "development"
    APP_NAME: str = "MANSA Terminal"
    APP_VERSION: str = "1.0.0"
    SECRET_KEY: str = "dev_secret_key_change_later"
    DEBUG: bool = False

    # CORS — accepte une chaîne CSV ou JSON depuis l'env var
    # Ex : CORS_ORIGINS_RAW="https://mansa.vercel.app,https://app.mansa.ai"
    # pydantic-settings v2 JSON-parse List[str] AVANT les field_validators,
    # donc on stocke comme str brut et on expose une propriété.
    CORS_ORIGINS_RAW: str = "http://localhost:3000,https://mansa-terminal.vercel.app"

    # URL publique du frontend — utilisée pour les emails de vérification
    FRONTEND_URL: str = "https://mansa-terminal.vercel.app"

    @property
    def cors_origins(self) -> List[str]:
        v = self.CORS_ORIGINS_RAW.strip()
        if not v:
            return ["http://localhost:3000"]
        if v.startswith("["):
            import json
            return json.loads(v)
        return [u.strip() for u in v.split(",") if u.strip()]

    # Base de données
    # Railway fournit DATABASE_URL au format postgresql:// — on le transforme pour asyncpg
    DATABASE_URL: str = "postgresql://mansa:mansa_dev_password@localhost:5432/mansa_db"
    DATABASE_URL_SYNC: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL_ID: str = "claude-sonnet-4-5"
    ANTHROPIC_MAX_TOKENS: int = 2000

    # Observabilité
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    # Auth JWT (legacy — conservé pour compatibilité tokens existants)
    JWT_SECRET_KEY: str = "dev_jwt_secret_change_later"
    JWT_ALGORITHM: str = "HS256"
    JWT_PRIVATE_KEY: str = ""
    JWT_PUBLIC_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Supabase Auth (remplace progressivement le JWT maison)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    # JWT Secret → Supabase Dashboard → Settings → API → JWT Settings
    # Utilisé par FastAPI pour vérifier les tokens émis par Supabase Auth
    SUPABASE_JWT_SECRET: str = ""

    # Stripe — hors scope MVP
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_STARTER: str = ""
    STRIPE_PRICE_PROFESSIONAL: str = ""
    STRIPE_PRICE_ENTERPRISE: str = ""

    # APIs de données
    IMF_BASE_URL: str = "https://www.imf.org/external/datamapper/api/v1"
    IMF_PORTWATCH_URL: str = "https://portwatch.imf.org/api/v1"
    IMF_PORTWATCH_KEY: str = ""
    WB_BASE_URL: str = "https://api.worldbank.org/v2"
    BCEAO_BASE_URL: str = "https://www.bceao.int/api"
    ACLED_API_KEY: str = ""
    ACLED_EMAIL: str = ""
    NASA_EARTHDATA_TOKEN: str = ""

    # AWS — hors scope MVP
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-west-1"
    S3_BUCKET_DATA_LAKE: str = "mansa-data-lake"

    # Email — hors scope MVP
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def database_url_async(self) -> str:
        """URL asyncpg pour FastAPI — convertit le format Railway si nécessaire."""
        return _make_asyncpg_url(self.DATABASE_URL)

    @property
    def database_url_sync_value(self) -> str:
        """URL psycopg2 pour Alembic."""
        raw = self.DATABASE_URL_SYNC or self.DATABASE_URL
        # Normaliser postgres:// → postgresql://
        return raw.replace("postgres://", "postgresql://", 1)

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str) and value.lower() in {"release", "prod", "production"}:
            return False
        return value


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()