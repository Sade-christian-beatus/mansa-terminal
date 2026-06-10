"""
MANSA Terminal — Test fixtures
Shared setup pour pytest : client HTTP async, DB de test, mocks.
"""
import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, MagicMock

# ── Forcer l'env de test avant tout import de l'app ─────────────────────────
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test_secret_key_32_chars_minimum!!")
os.environ.setdefault("JWT_SECRET_KEY", "test_jwt_secret_key_32_chars_min!")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://mansa:mansa_dev@localhost:5432/mansa_test")
os.environ.setdefault("DATABASE_URL_SYNC", "postgresql://mansa:mansa_dev@localhost:5432/mansa_test")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-key")
os.environ.setdefault("SUPABASE_URL", "http://localhost:54321")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret-for-supabase-32ch!")
os.environ.setdefault("SENTRY_DSN", "")

from app.main import app
from app.core.database import get_db


@pytest_asyncio.fixture
async def client():
    """Client HTTP async pour tester les endpoints FastAPI sans serveur réel."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def mock_user():
    """Simule un utilisateur actif avec abonnement."""
    user = MagicMock()
    user.id = "00000000-0000-0000-0000-000000000001"
    user.email = "test@mansa.ai"
    user.full_name = "Test Analyst"
    user.role = "analyst"
    user.is_active = True
    user.subscription_status = "active"
    return user


@pytest.fixture
def mock_db():
    """Session DB mockée — évite les vraies requêtes en tests unitaires."""
    from sqlalchemy.ext.asyncio import AsyncSession
    session = AsyncMock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.add = MagicMock()
    return session


@pytest.fixture
def override_auth(mock_user):
    """Bypass l'authentification pour les tests."""
    from app.core.dependencies import require_active_subscription
    app.dependency_overrides[require_active_subscription] = lambda: mock_user
    yield mock_user
    app.dependency_overrides.clear()


@pytest.fixture
def override_db(mock_db):
    """Bypass la vraie DB pour les tests unitaires."""
    app.dependency_overrides[get_db] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.clear()
