"""
MANSA Terminal — Tests FastAPI
Tests d'intégration pour les routes principales
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings

# ============================================================
# Fixtures
# ============================================================

TEST_DB_URL = settings.DATABASE_URL

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac

@pytest.fixture
async def auth_token(client):
    """Crée un utilisateur test et retourne son token"""
    response = await client.post("/api/auth/register", json={
        "email": "test@mansa.ai",
        "password": "SecurePassword123!",
        "full_name": "Test User",
        "organization": "Test Org",
    })
    assert response.status_code == 201
    return response.json()["access_token"]

@pytest.fixture
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ============================================================
# Tests Auth
# ============================================================

@pytest.mark.anyio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.anyio
async def test_register_user(client):
    response = await client.post("/api/auth/register", json={
        "email": "newuser@mansa.ai",
        "password": "SecurePassword123!",
        "full_name": "New User",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["email"] == "newuser@mansa.ai"


@pytest.mark.anyio
async def test_login_user(client):
    # D'abord créer l'utilisateur
    await client.post("/api/auth/register", json={
        "email": "login_test@mansa.ai",
        "password": "SecurePassword123!",
        "full_name": "Login Test",
    })

    # Puis login
    response = await client.post("/api/auth/login", json={
        "email": "login_test@mansa.ai",
        "password": "SecurePassword123!",
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.anyio
async def test_login_wrong_password(client):
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


# ============================================================
# Tests Macro (nécessite abonnement actif)
# ============================================================

@pytest.mark.anyio
async def test_countries_list_requires_auth(client):
    """Sans token → 403"""
    response = await client.get("/api/macro/countries")
    assert response.status_code in (401, 403)


@pytest.mark.anyio
async def test_billing_plans_public(client):
    """Plans de pricing accessibles sans auth"""
    response = await client.get("/api/billing/plans")
    assert response.status_code == 200
    data = response.json()
    assert "starter" in data
    assert "professional" in data
    assert "enterprise" in data


# ============================================================
# Tests AI Analyst
# ============================================================

@pytest.mark.anyio
async def test_ai_query_requires_subscription(client, auth_headers):
    """L'AI Analyst nécessite un abonnement"""
    response = await client.post(
        "/api/ai/query",
        json={"question": "Test question"},
        headers=auth_headers,
    )
    # Sans subscription → 402
    assert response.status_code in (402, 403)
