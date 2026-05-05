"""
MANSA Terminal — Configuration centralisée
Toutes les variables d'environnement validées avec Pydantic
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "https://app.mansa.ai",
    ]

    # Base de données
    DATABASE_URL: str = "postgresql://mansa:mansa_dev_password@localhost:5432/mansa_db"
    DATABASE_URL_SYNC: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL_ID: str = "claude-sonnet-4-20250514"
    ANTHROPIC_MAX_TOKENS: int = 2000

    # Observabilité
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    # Auth JWT
    JWT_SECRET_KEY: str = "dev_jwt_secret_change_later"
    JWT_ALGORITHM: str = "HS256"
    # RS256 en production : coller les clés PEM sur une seule ligne (\n encodé)
    JWT_PRIVATE_KEY: str = ""
    JWT_PUBLIC_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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
    def database_url_sync_value(self) -> str:
        return self.DATABASE_URL_SYNC or self.DATABASE_URL

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