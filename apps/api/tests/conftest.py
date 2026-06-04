"""
MANSA Terminal — Fixtures partagées pour tous les tests

Points d'attention :
- Les tokens sont dans des cookies httpOnly, PAS dans le JSON body.
  → On les extrait via `response.cookies["access_token"]`.
- L'inscription auto-crée un trial Professional 30j.
  → On ne recrée JAMAIS de subscription manuellement après register().
  → Pour tester "sans subscription", on crée l'user directement en DB (bypass API).
- Les tests utilisent pytest-asyncio (asyncio_mode = auto dans pytest.ini).
  → Pas besoin de @pytest.mark.asyncio ni de fixture anyio_backend.
"""
import uuid
from datetime import datetime, timezone, timedelta
from typing import AsyncGenerator

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_db
from app.core.security import hash_password, create_access_token
from app.models.models import User, Subscription, AIQuery


# ── Client HTTP (réutilisé dans chaque module) ────────────────────────────

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Client ASGI sans serveur réseau — rapide, isolé."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac


# ── Helpers internes ──────────────────────────────────────────────────────

def _unique_email(prefix: str = "test") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@mansa.test"


async def _get_db_session() -> AsyncSession:
    """Récupère une session DB pour les opérations directes (bypass API)."""
    async for session in get_db():
        return session
    raise RuntimeError("Impossible d'obtenir une session DB")


# ── Fixture : user enregistré (a un trial Professional auto) ─────────────

@pytest.fixture
async def registered_user(client: AsyncClient) -> dict:
    """
    Inscrit un user via l'API → reçoit automatiquement un trial 30j Professional.
    Retourne : {user_id, email, headers, cookies}

    IMPORTANT : les tokens sont dans les cookies de la réponse.
    Pour les appels suivants utiliser `headers` (Bearer extrait du cookie)
    OU laisser httpx renvoyer les cookies automatiquement (même client).
    """
    email = _unique_email("user")
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": "Test User",
        "organization": "Test Org",
    })
    assert resp.status_code == 201, f"Register failed: {resp.text}"

    # Tokens en cookies httpOnly — extraire pour le header Bearer
    access_token = resp.cookies.get("access_token")
    assert access_token, "access_token cookie absent de la réponse d'inscription"

    return {
        "user_id": resp.json()["user_id"],
        "email": email,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"},
    }


# ── Fixture : user SANS subscription (créé directement en DB) ─────────────

@pytest.fixture
async def user_no_subscription() -> dict:
    """
    Crée un user directement en DB, SANS passer par l'API register.
    → Pas de trial auto-créé.
    → Utile pour tester les 402 Payment Required.
    """
    email = _unique_email("nosub")
    user = User(
        email=email,
        hashed_password=hash_password("Password123!"),
        full_name="No Subscription User",
        is_active=True,
    )
    db = await _get_db_session()
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "user_id": str(user.id),
        "email": email,
        "access_token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ── Fixture : user avec plan spécifique ──────────────────────────────────

async def _make_user_with_plan(
    client: AsyncClient,
    plan: str,
    status: str = "active",
    trial_days: int | None = None,
) -> dict:
    """
    Inscrit un user (crée trial auto), puis MODIFIE la subscription
    pour la faire correspondre au plan/status voulu.
    """
    email = _unique_email(f"{plan}_{status}")
    resp = await client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "full_name": f"{plan.title()} User",
    })
    assert resp.status_code == 201
    user_id = resp.json()["user_id"]
    access_token = resp.cookies.get("access_token")

    # Mettre à jour la subscription auto-créée (pas d'INSERT pour éviter les doublons)
    db = await _get_db_session()
    from sqlalchemy import select, update
    await db.execute(
        update(Subscription)
        .where(Subscription.user_id == uuid.UUID(user_id))
        .values(
            plan=plan,
            status=status,
            trial_ends_at=(
                datetime.now(timezone.utc) + timedelta(days=trial_days)
                if trial_days is not None else None
            ),
        )
    )
    await db.commit()

    return {
        "user_id": user_id,
        "email": email,
        "access_token": access_token,
        "headers": {"Authorization": f"Bearer {access_token}"},
    }


@pytest.fixture
async def starter_user(client: AsyncClient) -> dict:
    return await _make_user_with_plan(client, plan="starter", status="active")


@pytest.fixture
async def professional_user(client: AsyncClient) -> dict:
    return await _make_user_with_plan(client, plan="professional", status="active")


@pytest.fixture
async def trialing_user(client: AsyncClient) -> dict:
    """User en trial 30j — c'est l'état par défaut après inscription."""
    return await _make_user_with_plan(client, plan="professional", status="trialing", trial_days=30)


# ── Helper : insérer des AIQuery pour simuler un quota consommé ───────────

async def insert_ai_queries(user_id: str, count: int, today: bool = True) -> None:
    """
    Insère `count` AIQuery pour simuler des requêtes déjà effectuées.
    `today=True` → created_at = now (compte dans le cap journalier).
    `today=False` → created_at = hier (hors cap journalier).
    """
    db = await _get_db_session()
    ts = datetime.now(timezone.utc) if today else datetime.now(timezone.utc) - timedelta(days=2)
    for _ in range(count):
        q = AIQuery(
            user_id=uuid.UUID(user_id),
            question="Historical query",
            response="Response text",
            input_tokens=50,
            output_tokens=100,
            countries_mentioned=[],
            duration_ms=300,
        )
        # Forcer le timestamp pour contrôler si la requête compte aujourd'hui
        q.created_at = ts
        db.add(q)
    await db.commit()
