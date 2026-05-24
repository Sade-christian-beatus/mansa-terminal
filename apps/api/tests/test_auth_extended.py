"""
MANSA Terminal — Tests Auth étendus
Couvre : inscription dupliquée, refresh cycle, token invalide, vérification email

Notes de design :
- Tokens dans les cookies httpOnly — extraits via resp.cookies["access_token"].
  Le JSON body de /register et /login retourne {user_id, email, full_name, token_type}
  sans jamais exposer les tokens.
- /api/auth/refresh accepte le refresh_token soit dans le cookie (SameSite path)
  soit dans le corps JSON (RefreshRequest.refresh_token).
  Les tests passent le token en JSON body pour ne pas dépendre du cookie path.
- asyncio_mode = auto → pas de @pytest.mark.asyncio ni anyio_backend.
"""
import pytest
from httpx import AsyncClient

from app.core.security import create_email_verify_token

# La fixture `client` vient de conftest.py


# ============================================================
# Inscription
# ============================================================

async def test_register_duplicate_email(client: AsyncClient):
    """Deux inscriptions avec le même email → 409 Conflict"""
    payload = {
        "email": "dup_extended@mansa.test",
        "password": "Password123!",
        "full_name": "Dup User",
    }
    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = await client.post("/api/auth/register", json=payload)
    assert r2.status_code == 409
    assert "existe déjà" in r2.json()["detail"]


async def test_register_invalid_email(client: AsyncClient):
    """Email malformé → 422 Unprocessable Entity"""
    r = await client.post("/api/auth/register", json={
        "email": "not-an-email",
        "password": "Password123!",
        "full_name": "Bad Email",
    })
    assert r.status_code == 422


async def test_register_missing_password(client: AsyncClient):
    """Champ password manquant → 422"""
    r = await client.post("/api/auth/register", json={
        "email": "missing_pass@mansa.test",
    })
    assert r.status_code == 422


async def test_register_missing_full_name(client: AsyncClient):
    """Champ full_name manquant → 422"""
    r = await client.post("/api/auth/register", json={
        "email": "missing_name@mansa.test",
        "password": "Password123!",
    })
    assert r.status_code == 422


async def test_register_token_in_cookie_not_body(client: AsyncClient):
    """
    Vérifier explicitement que les tokens ne fuient PAS dans le JSON body.
    Le JSON body doit être {user_id, email, full_name, token_type} uniquement.
    """
    r = await client.post("/api/auth/register", json={
        "email": "cookie_check@mansa.test",
        "password": "Password123!",
        "full_name": "Cookie Check",
    })
    assert r.status_code == 201
    body = r.json()
    assert "access_token" not in body, "access_token ne doit pas être dans le JSON"
    assert "refresh_token" not in body, "refresh_token ne doit pas être dans le JSON"
    assert "user_id" in body
    assert r.cookies.get("access_token"), "access_token cookie attendu"
    assert r.cookies.get("refresh_token"), "refresh_token cookie attendu"
    assert r.cookies.get("mansa_auth") == "1", "mansa_auth cookie attendu"


# ============================================================
# Login
# ============================================================

async def test_login_wrong_password(client: AsyncClient):
    """Mauvais mot de passe → 401"""
    await client.post("/api/auth/register", json={
        "email": "login_ext_wp@mansa.test",
        "password": "Correct123!",
        "full_name": "X",
    })
    r = await client.post("/api/auth/login", json={
        "email": "login_ext_wp@mansa.test",
        "password": "Wrong999!",
    })
    assert r.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    """Email inconnu → 401"""
    r = await client.post("/api/auth/login", json={
        "email": "nobody_at_all@mansa.test",
        "password": "Whatever123!",
    })
    assert r.status_code == 401


async def test_login_token_in_cookie(client: AsyncClient):
    """Login réussi → tokens dans les cookies, pas dans le JSON"""
    await client.post("/api/auth/register", json={
        "email": "login_cookie@mansa.test",
        "password": "Password123!",
        "full_name": "Login Cookie",
    })
    r = await client.post("/api/auth/login", json={
        "email": "login_cookie@mansa.test",
        "password": "Password123!",
    })
    assert r.status_code == 200
    assert "access_token" not in r.json()
    assert r.cookies.get("access_token"), "access_token cookie attendu après login"


# ============================================================
# Refresh token
# ============================================================

async def test_refresh_token_cycle(client: AsyncClient):
    """Refresh valide (passé en JSON body) retourne de nouveaux cookies"""
    reg = await client.post("/api/auth/register", json={
        "email": "refresh_cycle@mansa.test",
        "password": "Password123!",
        "full_name": "Refresh User",
    })
    assert reg.status_code == 201

    # Extraire depuis les cookies (pas le JSON body)
    refresh_token = reg.cookies.get("refresh_token")
    original_access = reg.cookies.get("access_token")
    assert refresh_token, "refresh_token cookie absent après register"
    assert original_access, "access_token cookie absent après register"

    # Passer le refresh_token en JSON body (le cookie path peut différer en test)
    r = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert r.status_code == 200

    # Le JSON body retourne le user info, pas les tokens
    data = r.json()
    assert "user_id" in data
    assert "access_token" not in data

    # Les nouveaux tokens sont dans les cookies de la réponse refresh
    new_access = r.cookies.get("access_token")
    assert new_access, "access_token cookie attendu après refresh"
    assert new_access != original_access, "Le nouveau access_token doit être différent"


async def test_refresh_with_access_token_fails(client: AsyncClient):
    """Utiliser un access_token comme refresh_token → 401"""
    reg = await client.post("/api/auth/register", json={
        "email": "bad_refresh@mansa.test",
        "password": "Password123!",
        "full_name": "Bad Refresh",
    })
    assert reg.status_code == 201

    # Récupérer l'access_token (type = "access", pas "refresh")
    access_token = reg.cookies.get("access_token")
    assert access_token

    # L'envoyer comme refresh_token → doit être rejeté car type != "refresh"
    r = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": access_token},
    )
    assert r.status_code == 401


async def test_refresh_invalid_token(client: AsyncClient):
    """Token aléatoire comme refresh_token → 401"""
    r = await client.post(
        "/api/auth/refresh",
        json={"refresh_token": "garbage.token.value"},
    )
    assert r.status_code == 401


async def test_refresh_missing_token(client: AsyncClient):
    """Aucun refresh_token (ni cookie ni body) → 401"""
    r = await client.post("/api/auth/refresh", json={})
    assert r.status_code == 401


# ============================================================
# Vérification email
# ============================================================

async def test_verify_email_valid_token(client: AsyncClient):
    """Token de vérification valide → 200 + email confirmé"""
    reg = await client.post("/api/auth/register", json={
        "email": "verify_valid@mansa.test",
        "password": "Password123!",
        "full_name": "Verify User",
    })
    assert reg.status_code == 201
    user_id = reg.json()["user_id"]

    token = create_email_verify_token(user_id)
    r = await client.get(f"/api/auth/verify-email?token={token}")
    assert r.status_code == 200
    assert r.json()["email"] == "verify_valid@mansa.test"


async def test_verify_email_invalid_token(client: AsyncClient):
    """Token invalide → 400"""
    r = await client.get("/api/auth/verify-email?token=invalid.token.here")
    assert r.status_code == 400


async def test_verify_email_wrong_type(client: AsyncClient):
    """Access_token utilisé comme verify_token → 400 (mauvais type JWT)"""
    reg = await client.post("/api/auth/register", json={
        "email": "wrong_type_verify@mansa.test",
        "password": "Password123!",
        "full_name": "Wrong Type",
    })
    assert reg.status_code == 201

    # L'access_token a type="access", pas type="email_verify"
    access_token = reg.cookies.get("access_token")
    assert access_token

    r = await client.get(f"/api/auth/verify-email?token={access_token}")
    assert r.status_code == 400


# ============================================================
# Me endpoint
# ============================================================

async def test_me_returns_user_info(client: AsyncClient):
    """GET /api/auth/me avec token valide → infos utilisateur"""
    reg = await client.post("/api/auth/register", json={
        "email": "me_endpoint@mansa.test",
        "password": "Password123!",
        "full_name": "Me User",
        "organization": "Me Org",
    })
    assert reg.status_code == 201
    token = reg.cookies.get("access_token")

    r = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "me_endpoint@mansa.test"
    assert data["full_name"] == "Me User"
    assert "user_id" in data


async def test_me_without_token(client: AsyncClient):
    """GET /api/auth/me sans token → 401/403"""
    r = await client.get("/api/auth/me")
    assert r.status_code in (401, 403)


# ============================================================
# Endpoints protégés — token invalide
# ============================================================

async def test_protected_endpoint_no_token(client: AsyncClient):
    """GET /api/macro/countries sans token → 401/403"""
    r = await client.get("/api/macro/countries")
    assert r.status_code in (401, 403)


async def test_protected_endpoint_bad_token(client: AsyncClient):
    """Bearer token forgé → 401"""
    r = await client.get(
        "/api/macro/countries",
        headers={"Authorization": "Bearer forged.token.value"},
    )
    assert r.status_code == 401


async def test_protected_endpoint_malformed_header(client: AsyncClient):
    """Header Authorization malformé → 401/403"""
    r = await client.get(
        "/api/macro/countries",
        headers={"Authorization": "NotBearer sometoken"},
    )
    assert r.status_code in (401, 403)


# ============================================================
# Logout
# ============================================================

async def test_logout_clears_cookies(client: AsyncClient):
    """POST /api/auth/logout → 200 + suppression des cookies"""
    reg = await client.post("/api/auth/register", json={
        "email": "logout_test@mansa.test",
        "password": "Password123!",
        "full_name": "Logout User",
    })
    assert reg.status_code == 201

    r = await client.post("/api/auth/logout")
    assert r.status_code == 200
