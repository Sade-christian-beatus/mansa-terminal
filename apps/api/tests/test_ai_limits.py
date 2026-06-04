"""
MANSA Terminal — Tests AI Analyst (quotas + accès)
Couvre :
  - 402 si pas d'abonnement
  - Cap journalier Starter (10/jour)
  - Cap journalier Professional (50/jour) — non bloquant à 49 requêtes
  - Endpoint GET /api/ai/quota
  - Historique : vide, rempli, pagination

Notes de design :
  - Après register(), un trial Professional 30j est auto-créé.
    → `_create_user_with_plan()` dans l'ancien code créait un doublon → MultipleResultsFound.
    → On utilise les fixtures conftest.py : starter_user, professional_user, trialing_user.
  - user_no_subscription est créé directement en DB (bypass register) pour éviter le trial auto.
  - insert_ai_queries(user_id, count, today=True) permet de simuler un quota consommé.
  - Le mock Anthropic est un AsyncContextManager qui simule le streaming SSE.
  - asyncio_mode = auto → pas de @pytest.mark.asyncio ni anyio_backend.
"""
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient

from app.models.models import AIQuery

# Fixtures depuis conftest.py :
#   client, user_no_subscription, starter_user, professional_user, trialing_user
# Helpers depuis conftest.py :
from conftest import insert_ai_queries, _get_db_session


# ── Mock Anthropic AsyncAnthropic streaming ───────────────────────────────────

class _FakeStream:
    """
    Simule `anthropic.AsyncAnthropic().messages.stream(...)`.
    Utilisé comme AsyncContextManager retournant un stream SSE minimal.
    """
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    @property
    def text_stream(self):
        async def _gen():
            yield "Analyse macro: PIB Nigeria 2024 estimé à 4.5 %."
        return _gen()

    async def get_final_message(self):
        msg = MagicMock()
        msg.usage.input_tokens = 15
        msg.usage.output_tokens = 25
        return msg


# ============================================================
# Accès sans abonnement → 402
# ============================================================

async def test_ai_query_no_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """Sans abonnement → 402 sur POST /api/ai/query"""
    r = await client.post(
        "/api/ai/query",
        json={"question": "Analyse le PIB du Nigeria"},
        headers=user_no_subscription["headers"],
    )
    assert r.status_code == 402


async def test_ai_history_no_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """Sans abonnement → 402 sur GET /api/ai/history"""
    r = await client.get(
        "/api/ai/history",
        headers=user_no_subscription["headers"],
    )
    assert r.status_code == 402


async def test_ai_quota_no_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """Sans abonnement → 402 sur GET /api/ai/quota"""
    r = await client.get(
        "/api/ai/quota",
        headers=user_no_subscription["headers"],
    )
    assert r.status_code == 402


# ============================================================
# Quota journalier Starter (10/jour)
# ============================================================

async def test_starter_daily_cap_enforced(
    client: AsyncClient,
    starter_user: dict,
):
    """
    Plan Starter : cap journalier = 10 requêtes/jour.
    Insérer 10 requêtes TODAY → la 11ème doit retourner 429.
    """
    await insert_ai_queries(starter_user["user_id"], count=10, today=True)

    r = await client.post(
        "/api/ai/query",
        json={"question": "Une requête de trop"},
        headers=starter_user["headers"],
    )
    assert r.status_code == 429
    assert "Quota journalier" in r.json()["detail"]
    assert "10" in r.json()["detail"]   # limite affichée dans le message


async def test_starter_yesterday_queries_dont_count(
    client: AsyncClient,
    starter_user: dict,
):
    """
    Les requêtes d'hier ne comptent pas dans le cap journalier d'aujourd'hui.
    9 requêtes hier + 0 aujourd'hui → requête acceptée.
    """
    await insert_ai_queries(starter_user["user_id"], count=9, today=False)

    with patch(
        "app.routers.ai_analyst.client.messages.stream",
        return_value=_FakeStream(),
    ):
        r = await client.post(
            "/api/ai/query",
            json={"question": "Analyse du Sénégal"},
            headers=starter_user["headers"],
        )
    # 200 streaming — pas bloqué
    assert r.status_code == 200


# ============================================================
# Quota journalier Professional (50/jour)
# ============================================================

async def test_professional_daily_cap_not_reached(
    client: AsyncClient,
    professional_user: dict,
):
    """
    Plan Professional : cap journalier = 50.
    Avec 49 requêtes today → la 50ème passe (juste en dessous du cap).
    """
    await insert_ai_queries(professional_user["user_id"], count=49, today=True)

    with patch(
        "app.routers.ai_analyst.client.messages.stream",
        return_value=_FakeStream(),
    ):
        r = await client.post(
            "/api/ai/query",
            json={"question": "Analyse Kenya"},
            headers=professional_user["headers"],
        )
    assert r.status_code == 200


async def test_professional_daily_cap_enforced(
    client: AsyncClient,
    professional_user: dict,
):
    """Plan Professional : 50 requêtes today → 51ème bloquée → 429"""
    await insert_ai_queries(professional_user["user_id"], count=50, today=True)

    r = await client.post(
        "/api/ai/query",
        json={"question": "Encore une requête"},
        headers=professional_user["headers"],
    )
    assert r.status_code == 429
    assert "Quota journalier" in r.json()["detail"]


# ============================================================
# Trialing user (trial Professional — cap 30/jour)
# ============================================================

async def test_trialing_daily_cap_enforced(
    client: AsyncClient,
    trialing_user: dict,
):
    """Trial Professional : cap journalier = 30"""
    await insert_ai_queries(trialing_user["user_id"], count=30, today=True)

    r = await client.post(
        "/api/ai/query",
        json={"question": "Test trial cap"},
        headers=trialing_user["headers"],
    )
    assert r.status_code == 429
    assert "30" in r.json()["detail"]


# ============================================================
# Endpoint GET /api/ai/quota
# ============================================================

async def test_quota_endpoint_initial(
    client: AsyncClient,
    professional_user: dict,
):
    """Quota à zéro pour un nouveau professional user"""
    r = await client.get(
        "/api/ai/quota",
        headers=professional_user["headers"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "professional"
    assert data["daily_used"] == 0
    assert data["daily_limit"] == 50
    assert data["daily_remaining"] == 50


async def test_quota_endpoint_after_queries(
    client: AsyncClient,
    starter_user: dict,
):
    """Quota mis à jour après insertion de requêtes"""
    await insert_ai_queries(starter_user["user_id"], count=7, today=True)

    r = await client.get(
        "/api/ai/quota",
        headers=starter_user["headers"],
    )
    assert r.status_code == 200
    data = r.json()
    assert data["plan"] == "starter"
    assert data["daily_used"] == 7
    assert data["daily_limit"] == 10
    assert data["daily_remaining"] == 3


async def test_quota_endpoint_ignores_yesterday(
    client: AsyncClient,
    starter_user: dict,
):
    """Les requêtes d'hier n'affectent pas le quota du jour"""
    await insert_ai_queries(starter_user["user_id"], count=5, today=False)

    r = await client.get(
        "/api/ai/quota",
        headers=starter_user["headers"],
    )
    assert r.status_code == 200
    assert r.json()["daily_used"] == 0


# ============================================================
# Historique GET /api/ai/history
# ============================================================

async def test_ai_history_empty(
    client: AsyncClient,
    professional_user: dict,
):
    """Historique vide pour un nouveau user sans requêtes"""
    r = await client.get(
        "/api/ai/history",
        headers=professional_user["headers"],
    )
    assert r.status_code == 200
    assert r.json() == []


async def test_ai_history_returns_queries(
    client: AsyncClient,
    professional_user: dict,
):
    """L'historique retourne les requêtes sauvegardées avec les bons champs"""
    # Insérer une AIQuery directement en DB via le helper conftest
    db = await _get_db_session()
    db.add(AIQuery(
        user_id=uuid.UUID(professional_user["user_id"]),
        question="Analyse le Sénégal",
        response="Réponse détaillée...",
        input_tokens=50,
        output_tokens=150,
        countries_mentioned=["SEN"],
        duration_ms=1200,
    ))
    await db.commit()

    r = await client.get(
        "/api/ai/history",
        headers=professional_user["headers"],
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 1
    assert data[0]["question"] == "Analyse le Sénégal"
    assert data[0]["countries"] == ["SEN"]
    assert data[0]["tokens_used"] == 200   # 50 + 150


async def test_ai_history_pagination_cap(
    client: AsyncClient,
    professional_user: dict,
):
    """
    L'historique est cappé à 100 max même si limit > 100 est demandé.
    Insère 5 requêtes et vérifie qu'elles sont toutes là.
    """
    await insert_ai_queries(professional_user["user_id"], count=5, today=True)

    r = await client.get(
        "/api/ai/history?limit=200",   # dépasse le cap interne de 100
        headers=professional_user["headers"],
    )
    assert r.status_code == 200
    # 5 résultats car on n'a inséré que 5 (vérification fonctionnelle)
    assert len(r.json()) == 5


async def test_ai_history_user_isolation(
    client: AsyncClient,
    professional_user: dict,
    starter_user: dict,
):
    """
    Un user ne voit que SES propres requêtes — pas celles d'un autre user.
    """
    # Insérer 3 requêtes pour professional_user
    await insert_ai_queries(professional_user["user_id"], count=3, today=True)

    # Consulter l'historique depuis starter_user → 0 résultats
    r = await client.get(
        "/api/ai/history",
        headers=starter_user["headers"],
    )
    assert r.status_code == 200
    assert r.json() == [], "starter_user ne doit pas voir les requêtes de professional_user"


# ============================================================
# Streaming réussi (mock Claude)
# ============================================================

async def test_query_streams_response(
    client: AsyncClient,
    professional_user: dict,
):
    """
    Une requête valide retourne un StreamingResponse 200 text/event-stream.
    Claude est mocké pour éviter l'appel API réel.
    """
    with patch(
        "app.routers.ai_analyst.client.messages.stream",
        return_value=_FakeStream(),
    ):
        r = await client.post(
            "/api/ai/query",
            json={"question": "Quelle est la croissance du PIB au Nigeria ?"},
            headers=professional_user["headers"],
        )
    assert r.status_code == 200
    assert "text/event-stream" in r.headers.get("content-type", "")
    # Le contenu SSE doit contenir au moins un événement "data:"
    assert "data:" in r.text
