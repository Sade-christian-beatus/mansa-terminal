"""
MANSA Terminal — Tests FastAPI : routes principales
Couvre : health check, register, login, macro auth, billing plans

Notes de design :
- Les tokens sont dans des cookies httpOnly (pas dans le JSON body).
  TokenResponse = {token_type, user_id, email, full_name} — PAS access_token.
- Chaque inscription crée automatiquement un trial Professional 30j.
  → Les tests qui attendent un 402 doivent utiliser `user_no_subscription`.
- asyncio_mode = auto → pas de @pytest.mark.asyncio ni anyio_backend.
"""
import pytest
from httpx import AsyncClient

# Les fixtures client, registered_user, user_no_subscription
# viennent automatiquement de tests/conftest.py


# ============================================================
# Health check
# ============================================================

async def test_health_check(client: AsyncClient):
    """GET /health → 200 {status: ok}"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ============================================================
# Inscription
# ============================================================

async def test_register_returns_user_info(client: AsyncClient):
    """
    POST /api/auth/register → 201
    Le JSON body contient {user_id, email, full_name, token_type}.
    Les tokens access_token et refresh_token sont en cookies httpOnly.
    """
    response = await client.post("/api/auth/register", json={
        "email": "main_test_register@mansa.test",
        "password": "SecurePassword123!",
        "full_name": "Main Test User",
        "organization": "Test Org",
    })
    assert response.status_code == 201
    data = response.json()

    # JSON body → metadata utilisateur, PAS les tokens
    assert "user_id" in data
    assert "email" in data
    assert data["email"] == "main_test_register@mansa.test"
    assert "access_token" not in data      # ← tokens en cookie seulement
    assert "refresh_token" not in data

    # Tokens dans les cookies httpOnly
    assert response.cookies.get("access_token"), "access_token cookie absent"
    assert response.cookies.get("refresh_token"), "refresh_token cookie absent"


async def test_register_creates_trial(client: AsyncClient):
    """
    Chaque inscription crée automatiquement un trial Professional 30j.
    Le user est donc actif et peut accéder aux endpoints protégés.
    """
    response = await client.post("/api/auth/register", json={
        "email": "trial_check@mansa.test",
        "password": "Password123!",
        "full_name": "Trial Check",
    })
    assert response.status_code == 201
    token = response.cookies.get("access_token")
    assert token

    # L'utilisateur peut accéder à un endpoint protégé par abonnement
    r = await client.get(
        "/api/macro/countries",
        headers={"Authorization": f"Bearer {token}"},
    )
    # 200 (données disponibles) ou 404 (table vide) — mais pas 402
    assert r.status_code != 402, "Le trial auto doit donner accès au contenu"


# ============================================================
# Connexion
# ============================================================

async def test_login_success(client: AsyncClient):
    """POST /api/auth/login → 200 + cookies"""
    # Créer d'abord un compte
    await client.post("/api/auth/register", json={
        "email": "login_main@mansa.test",
        "password": "SecurePassword123!",
        "full_name": "Login Main",
    })

    response = await client.post("/api/auth/login", json={
        "email": "login_main@mansa.test",
        "password": "SecurePassword123!",
    })
    assert response.status_code == 200
    # Tokens en cookies, pas dans le JSON
    assert response.cookies.get("access_token"), "access_token cookie absent après login"


async def test_login_wrong_password(client: AsyncClient):
    """Mauvais mot de passe → 401"""
    response = await client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    """Email inconnu → 401"""
    response = await client.post("/api/auth/login", json={
        "email": "nobody_exists@mansa.test",
        "password": "AnyPassword123!",
    })
    assert response.status_code == 401


# ============================================================
# Endpoint macro protégé (nécessite auth)
# ============================================================

async def test_countries_list_requires_auth(client: AsyncClient):
    """GET /api/macro/countries sans token → 401 ou 403"""
    response = await client.get("/api/macro/countries")
    assert response.status_code in (401, 403)


async def test_countries_list_requires_subscription(
    client: AsyncClient, user_no_subscription: dict
):
    """User sans abonnement → 402 Payment Required"""
    response = await client.get(
        "/api/macro/countries",
        headers=user_no_subscription["headers"],
    )
    assert response.status_code == 402


# ============================================================
# Billing (endpoint public)
# ============================================================

async def test_billing_plans_public(client: AsyncClient):
    """GET /api/billing/plans accessible sans auth → 200"""
    response = await client.get("/api/billing/plans")
    assert response.status_code == 200
    data = response.json()
    assert "starter" in data
    assert "professional" in data
    assert "enterprise" in data


# ============================================================
# AI Analyst — accès sans abonnement
# ============================================================

async def test_ai_query_requires_subscription(
    client: AsyncClient, user_no_subscription: dict
):
    """
    User sans abonnement → 402 sur POST /api/ai/query.
    IMPORTANT : utiliser user_no_subscription (pas registered_user qui a un trial).
    """
    response = await client.post(
        "/api/ai/query",
        json={"question": "Test question"},
        headers=user_no_subscription["headers"],
    )
    assert response.status_code == 402
