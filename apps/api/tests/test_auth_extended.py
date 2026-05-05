"""
MANSA Terminal — Tests Auth étendus
Couvre : inscription dupliquée, refresh cycle, token invalide, vérification email
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import create_email_verify_token


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


def unique_email() -> str:
    return f"auth_{uuid.uuid4().hex[:8]}@mansa.ai"


# ============================================================
# Inscription
# ============================================================

@pytest.mark.anyio
async def test_register_duplicate_email(client):
    """Deux inscriptions avec le même email → 409 Conflict"""
    email = unique_email()
    payload = {"email": email, "password": "Password123!", "full_name": "Dup User"}

    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/auth/register", json=payload)
    assert r2.status_code == 409
    assert "existe déjà" in r2.json()["detail"]


@pytest.mark.anyio
async def test_register_invalid_email(client):
    """Email malformé → 422 Unprocessable Entity"""
    r = await client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Bad Email",
    })
    assert r.status_code == 422


@pytest.mark.anyio
async def test_register_missing_fields(client):
    """Champs requis manquants → 422"""
    r = await client.post("/api/auth/register", json={"email": unique_email()})
    assert r.status_code == 422


# ============================================================
# Login
# ============================================================

@pytest.mark.anyio
async def test_login_wrong_password(client):
    """Mauvais mot de passe → 401"""
    email = unique_email()
    await client.post("/api/auth/register", json={
        "email": email, "password": "Correct123!", "full_name": "X",
    })
    r = await client.post("/api/auth/login", json={
        "email": email, "password": "Wrong999!",
    })
    assert r.status_code == 401


@pytest.mark.anyio
async def test_login_unknown_email(client):
    """Email inconnu → 401"""
    r = await client.post("/api/auth/login", json={
        "email": "nobody@mansa.ai",
        "password": "Whatever123!",
    })
    assert r.status_code == 401


# ============================================================
# Refresh token
# ============================================================

@pytest.mark.anyio
async def test_refresh_token_cycle(client):
    """Refresh valide retourne de nouveaux tokens"""
    email = unique_email()
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Refresh User",
    })
    assert reg.status_code == 201
    refresh_token = reg.json()["refresh_token"]

    r = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    # Les nouveaux tokens doivent être différents
    assert data["access_token"] != reg.json()["access_token"]


@pytest.mark.anyio
async def test_refresh_with_access_token_fails(client):
    """Utiliser un access token comme refresh → 401"""
    email = unique_email()
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Bad Refresh",
    })
    access_token = reg.json()["access_token"]

    r = await client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert r.status_code == 401


@pytest.mark.anyio
async def test_refresh_invalid_token(client):
    """Token aléatoire → 401"""
    r = await client.post("/api/auth/refresh", json={"refresh_token": "garbage.token.value"})
    assert r.status_code == 401


# ============================================================
# Vérification email
# ============================================================

@pytest.mark.anyio
async def test_verify_email_valid_token(client):
    """Token valide → 200 et compte vérifié"""
    email = unique_email()
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Verify User",
    })
    user_id = reg.json()["user_id"]

    token = create_email_verify_token(user_id)
    r = await client.get(f"/api/auth/verify-email?token={token}")
    assert r.status_code == 200
    assert r.json()["email"] == email


@pytest.mark.anyio
async def test_verify_email_invalid_token(client):
    """Token invalide → 400"""
    r = await client.get("/api/auth/verify-email?token=invalid.token.here")
    assert r.status_code == 400


@pytest.mark.anyio
async def test_verify_email_wrong_type(client):
    """Access token utilisé comme verify token → 400"""
    email = unique_email()
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "Wrong Type",
    })
    access_token = reg.json()["access_token"]

    r = await client.get(f"/api/auth/verify-email?token={access_token}")
    assert r.status_code == 400


# ============================================================
# Endpoints protégés sans token
# ============================================================

@pytest.mark.anyio
async def test_protected_endpoint_no_token(client):
    """GET /api/macro/countries sans token → 401/403"""
    r = await client.get("/api/macro/countries")
    assert r.status_code in (401, 403)


@pytest.mark.anyio
async def test_protected_endpoint_bad_token(client):
    """Bearer token forgé → 401"""
    r = await client.get(
        "/api/macro/countries",
        headers={"Authorization": "Bearer forged.token.value"},
    )
    assert r.status_code == 401
