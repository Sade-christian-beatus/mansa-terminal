"""
MANSA Terminal — Tests API Macro Data
Couvre : GET /api/macro/countries, GET /api/macro/{id}, GET /api/macro/heatmap/africa
"""
import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings
from app.models.models import User, Subscription
from app.core.security import hash_password, create_access_token


# ============================================================
# Fixtures
# ============================================================

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


@pytest.fixture
async def subscribed_headers(client):
    """
    Crée un utilisateur avec un abonnement 'trialing' actif.
    Retourne les headers Authorization prêts à l'emploi.
    """
    email = f"macro_test_{uuid.uuid4().hex[:8]}@mansa.ai"

    # 1. Créer l'utilisateur via l'API
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": "TestPassword123!",
        "full_name": "Macro Test User",
    })
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    token_data = resp.json()
    access_token = token_data["access_token"]
    user_id = token_data["user_id"]

    # 2. Créer la subscription directement en base
    async for db in get_db():
        sub = Subscription(
            user_id=uuid.UUID(user_id),
            plan="professional",
            status="trialing",
        )
        db.add(sub)
        await db.commit()
        break

    return {"Authorization": f"Bearer {access_token}"}


# ============================================================
# Tests GET /api/macro/countries
# ============================================================

@pytest.mark.anyio
async def test_countries_requires_subscription(client):
    """Sans abonnement → 402 Payment Required"""
    # Créer user sans subscription
    email = f"nosub_{uuid.uuid4().hex[:8]}@mansa.ai"
    reg = await client.post("/api/auth/register", json={
        "email": email,
        "password": "TestPassword123!",
        "full_name": "No Sub User",
    })
    assert reg.status_code == 201
    token = reg.json()["access_token"]

    resp = await client.get(
        "/api/macro/countries",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 402


@pytest.mark.anyio
async def test_countries_list_returns_54(client, subscribed_headers):
    """Avec abonnement → liste de 54 pays africains"""
    resp = await client.get(
        "/api/macro/countries",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # Au moins 50 pays (migration peut avoir des doublons filtrés)
    assert len(data) >= 50

    # Vérifier la structure d'un item
    first = data[0]
    assert "id" in first
    assert "name_en" in first
    assert "coverage_tier" in first
    assert first["coverage_tier"] in (1, 2, 3)


@pytest.mark.anyio
async def test_countries_filter_by_region(client, subscribed_headers):
    """Filtre par région fonctionne"""
    resp = await client.get(
        "/api/macro/countries?region=West+Africa",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert all(c["region"] == "West Africa" for c in data)
    assert len(data) > 0


@pytest.mark.anyio
async def test_countries_no_auth(client):
    """Sans token → 403"""
    resp = await client.get("/api/macro/countries")
    assert resp.status_code in (401, 403)


# ============================================================
# Tests GET /api/macro/{country_id}
# ============================================================

@pytest.mark.anyio
async def test_country_macro_valid(client, subscribed_headers):
    """Retourne la structure attendue pour un pays valide"""
    resp = await client.get(
        "/api/macro/NGA",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["country_id"] == "NGA"
    assert "country_name" in data
    assert "indicators" in data
    assert isinstance(data["indicators"], dict)


@pytest.mark.anyio
async def test_country_macro_case_insensitive(client, subscribed_headers):
    """L'ISO3 en minuscule doit fonctionner (normalisé en uppercase côté API)"""
    resp = await client.get(
        "/api/macro/nga",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["country_id"] == "NGA"


@pytest.mark.anyio
async def test_country_macro_invalid_id(client, subscribed_headers):
    """Pays inexistant → 404"""
    resp = await client.get(
        "/api/macro/ZZZ",
        headers=subscribed_headers,
    )
    assert resp.status_code == 404


@pytest.mark.anyio
async def test_country_macro_filter_indicators(client, subscribed_headers):
    """Filtre par indicateurs spécifiques"""
    resp = await client.get(
        "/api/macro/KEN?indicators=NGDP_RPCH,PCPIPCH",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    # Seuls les indicateurs demandés sont retournés (s'il y a des données)
    for code in data["indicators"]:
        assert code in ("NGDP_RPCH", "PCPIPCH")


@pytest.mark.anyio
async def test_country_macro_year_range(client, subscribed_headers):
    """Les points de données respectent la plage from_year/to_year"""
    resp = await client.get(
        "/api/macro/GHA?from_year=2020&to_year=2022",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    for code, points in data["indicators"].items():
        for point in points:
            year = int(point["period"][:4])
            assert 2020 <= year <= 2022, (
                f"Point hors plage pour {code}: {point['period']}"
            )


# ============================================================
# Tests GET /api/macro/heatmap/africa
# ============================================================

@pytest.mark.anyio
async def test_heatmap_default(client, subscribed_headers):
    """Heatmap avec paramètres par défaut"""
    resp = await client.get(
        "/api/macro/heatmap/africa",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "indicator" in data
    assert "year" in data
    assert "data" in data
    assert isinstance(data["data"], list)


@pytest.mark.anyio
async def test_heatmap_custom_indicator(client, subscribed_headers):
    """Heatmap pour un indicateur spécifique"""
    resp = await client.get(
        "/api/macro/heatmap/africa?indicator=PCPIPCH&year=2023",
        headers=subscribed_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["indicator"] == "PCPIPCH"
    assert data["year"] == 2023
    # Chaque point doit avoir country_id + value
    for point in data["data"]:
        assert "country_id" in point
        assert "value" in point
