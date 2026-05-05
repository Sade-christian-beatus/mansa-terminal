"""
MANSA Terminal — Tests AI Analyst (quotas + accès)
Couvre : subscription requise, quota Starter 50 req/mois, historique
"""
import pytest
import uuid
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from app.models.models import Subscription, AIQuery
from app.core.security import create_access_token


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
    return f"ai_{uuid.uuid4().hex[:8]}@mansa.ai"


async def _create_user_with_plan(client, plan: str) -> dict:
    """Crée un user + subscription et retourne {user_id, access_token, headers}"""
    email = unique_email()
    reg = await client.post("/api/auth/register", json={
        "email": email, "password": "Password123!", "full_name": "AI Test",
    })
    assert reg.status_code == 201
    user_id = reg.json()["user_id"]
    access_token = reg.json()["access_token"]

    async for db in get_db():
        db.add(Subscription(
            user_id=uuid.UUID(user_id),
            plan=plan,
            status="active",
        ))
        await db.commit()
        break

    return {
        "user_id": user_id,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"},
    }


# ============================================================
# Accès sans abonnement
# ============================================================

@pytest.mark.anyio
async def test_ai_query_no_subscription(client):
    """Sans abonnement → 402"""
    reg = await client.post("/api/auth/register", json={
        "email": unique_email(),
        "password": "Password123!",
        "full_name": "No Sub",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    r = await client.post(
        "/api/ai/query",
        json={"question": "Test"},
        headers=headers,
    )
    assert r.status_code == 402


@pytest.mark.anyio
async def test_ai_history_no_subscription(client):
    """Historique sans abonnement → 402"""
    reg = await client.post("/api/auth/register", json={
        "email": unique_email(),
        "password": "Password123!",
        "full_name": "No Sub History",
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    r = await client.get("/api/ai/history", headers=headers)
    assert r.status_code == 402


# ============================================================
# Quota Starter
# ============================================================

@pytest.mark.anyio
async def test_starter_quota_enforced(client):
    """Plan Starter avec 50+ requêtes ce mois → 429"""
    from datetime import datetime, timezone
    user = await _create_user_with_plan(client, "starter")

    # Insérer 50 requêtes fictives pour ce mois
    async for db in get_db():
        for _ in range(50):
            db.add(AIQuery(
                user_id=uuid.UUID(user["user_id"]),
                question="Historical query",
                response="Response",
                input_tokens=100,
                output_tokens=200,
                countries_mentioned=[],
                duration_ms=500,
            ))
        await db.commit()
        break

    # La 51ème requête doit être bloquée
    r = await client.post(
        "/api/ai/query",
        json={"question": "One more query"},
        headers=user["headers"],
    )
    assert r.status_code == 429
    assert "Quota mensuel" in r.json()["detail"]


@pytest.mark.anyio
async def test_professional_no_quota(client):
    """Plan Professional : pas de quota, requête autorisée (mock Claude)"""
    user = await _create_user_with_plan(client, "professional")

    # Insérer 100 requêtes — ne doit pas bloquer
    async for db in get_db():
        for _ in range(100):
            db.add(AIQuery(
                user_id=uuid.UUID(user["user_id"]),
                question="Pro query",
                response="Response",
                input_tokens=100,
                output_tokens=200,
                countries_mentioned=[],
                duration_ms=500,
            ))
        await db.commit()
        break

    # Mock le client Anthropic pour ne pas appeler l'API réelle
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = iter(["Test response"])
    mock_message = MagicMock()
    mock_message.usage.input_tokens = 10
    mock_message.usage.output_tokens = 20
    mock_stream.get_final_message = MagicMock(return_value=mock_message)

    with patch("app.routers.ai_analyst.client.messages.stream",
               return_value=mock_stream):
        r = await client.post(
            "/api/ai/query",
            json={"question": "Pro query after 100"},
            headers=user["headers"],
        )
    # 200 (streaming) — pas de 429
    assert r.status_code == 200


# ============================================================
# Historique
# ============================================================

@pytest.mark.anyio
async def test_ai_history_empty(client):
    """Historique vide pour un nouvel utilisateur abonné"""
    user = await _create_user_with_plan(client, "professional")

    r = await client.get("/api/ai/history", headers=user["headers"])
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.anyio
async def test_ai_history_returns_queries(client):
    """Historique retourne les requêtes sauvegardées"""
    user = await _create_user_with_plan(client, "professional")

    async for db in get_db():
        db.add(AIQuery(
            user_id=uuid.UUID(user["user_id"]),
            question="Analyse le Sénégal",
            response="Réponse détaillée...",
            input_tokens=50,
            output_tokens=150,
            countries_mentioned=["SEN"],
            duration_ms=1200,
        ))
        await db.commit()
        break

    r = await client.get("/api/ai/history", headers=user["headers"])
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["question"] == "Analyse le Sénégal"
    assert data[0]["countries"] == ["SEN"]
    assert data[0]["tokens_used"] == 200
