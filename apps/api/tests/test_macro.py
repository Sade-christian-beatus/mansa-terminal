"""
MANSA Terminal — Tests API Macro Data
Couvre :
  - GET /api/macro/countries (liste + filtres)
  - GET /api/macro/{country_id} (indicateurs + filtres)
  - GET /api/macro/heatmap/africa

Notes de design :
  - Après register(), un trial Professional 30j est auto-créé.
    → `subscribed_headers` dans l'ancien code créait un doublon de Subscription.
    → On utilise la fixture `registered_user` de conftest.py (trial déjà présent).
  - `user_no_subscription` pour tester les 402.
  - asyncio_mode = auto → pas de @pytest.mark.asyncio ni anyio_backend.
"""
import pytest
from httpx import AsyncClient

# Fixtures depuis conftest.py :
#   client, registered_user, user_no_subscription


# ============================================================
# GET /api/macro/countries
# ============================================================

async def test_countries_no_auth(client: AsyncClient):
    """Sans token → 401/403"""
    resp = await client.get("/api/macro/countries")
    assert resp.status_code in (401, 403)


async def test_countries_requires_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """User sans abonnement → 402 Payment Required"""
    resp = await client.get(
        "/api/macro/countries",
        headers=user_no_subscription["headers"],
    )
    assert resp.status_code == 402


async def test_countries_list_with_trial(
    client: AsyncClient,
    registered_user: dict,
):
    """
    User avec trial Professional → accès autorisé.
    La liste peut être vide (pas de données en DB de test) mais pas 402/401.
    """
    resp = await client.get(
        "/api/macro/countries",
        headers=registered_user["headers"],
    )
    # 200 (liste) ou 404 (pas de données) — mais jamais 402 avec trial actif
    assert resp.status_code in (200, 404)


async def test_countries_list_returns_list(
    client: AsyncClient,
    registered_user: dict,
):
    """Réponse 200 → body est une liste"""
    resp = await client.get(
        "/api/macro/countries",
        headers=registered_user["headers"],
    )
    if resp.status_code == 200:
        data = resp.json()
        assert isinstance(data, list)
        # Si données présentes, vérifier la structure d'un item
        if data:
            first = data[0]
            assert "id" in first or "country_id" in first
            assert "name_en" in first


async def test_countries_filter_by_region(
    client: AsyncClient,
    registered_user: dict,
):
    """Filtre ?region=West+Africa → tous les résultats ont region=West Africa"""
    resp = await client.get(
        "/api/macro/countries?region=West+Africa",
        headers=registered_user["headers"],
    )
    if resp.status_code == 200:
        data = resp.json()
        assert all(c.get("region") == "West Africa" for c in data)


# ============================================================
# GET /api/macro/{country_id}
# ============================================================

async def test_country_macro_no_auth(client: AsyncClient):
    """Sans token → 401/403"""
    resp = await client.get("/api/macro/NGA")
    assert resp.status_code in (401, 403)


async def test_country_macro_no_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """Sans abonnement → 402"""
    resp = await client.get(
        "/api/macro/NGA",
        headers=user_no_subscription["headers"],
    )
    assert resp.status_code == 402


async def test_country_macro_valid(
    client: AsyncClient,
    registered_user: dict,
):
    """Pays valide → 200 avec structure attendue, ou 404 si pas de données"""
    resp = await client.get(
        "/api/macro/NGA",
        headers=registered_user["headers"],
    )
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        data = resp.json()
        assert data.get("country_id") == "NGA"
        assert "indicators" in data
        assert isinstance(data["indicators"], dict)


async def test_country_macro_case_insensitive(
    client: AsyncClient,
    registered_user: dict,
):
    """ISO3 en minuscule → normalisé en uppercase côté API"""
    resp = await client.get(
        "/api/macro/nga",
        headers=registered_user["headers"],
    )
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        assert resp.json()["country_id"] == "NGA"


async def test_country_macro_invalid_id(
    client: AsyncClient,
    registered_user: dict,
):
    """Pays inexistant → 404"""
    resp = await client.get(
        "/api/macro/ZZZ",
        headers=registered_user["headers"],
    )
    assert resp.status_code == 404


async def test_country_macro_filter_indicators(
    client: AsyncClient,
    registered_user: dict,
):
    """
    Filtre ?indicators=NGDP_RPCH,PCPIPCH → seuls ces indicateurs retournés.
    Si la DB est vide, indicators sera {} (pas d'erreur).
    """
    resp = await client.get(
        "/api/macro/KEN?indicators=NGDP_RPCH,PCPIPCH",
        headers=registered_user["headers"],
    )
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        data = resp.json()
        for code in data["indicators"]:
            assert code in ("NGDP_RPCH", "PCPIPCH"), (
                f"Indicateur inattendu retourné : {code}"
            )


async def test_country_macro_year_range(
    client: AsyncClient,
    registered_user: dict,
):
    """
    Filtre ?from_year=2020&to_year=2022 → points dans la plage.
    Si la DB de test est vide, indicators={} → test passé sans assertions.
    """
    resp = await client.get(
        "/api/macro/GHA?from_year=2020&to_year=2022",
        headers=registered_user["headers"],
    )
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        data = resp.json()
        for code, points in data.get("indicators", {}).items():
            for point in points:
                year = int(point["period"][:4])
                assert 2020 <= year <= 2022, (
                    f"Point hors plage pour {code}: {point['period']}"
                )


# ============================================================
# GET /api/macro/heatmap/africa
# ============================================================

async def test_heatmap_no_auth(client: AsyncClient):
    """Sans token → 401/403"""
    resp = await client.get("/api/macro/heatmap/africa")
    assert resp.status_code in (401, 403)


async def test_heatmap_no_subscription(
    client: AsyncClient,
    user_no_subscription: dict,
):
    """Sans abonnement → 402"""
    resp = await client.get(
        "/api/macro/heatmap/africa",
        headers=user_no_subscription["headers"],
    )
    assert resp.status_code == 402


async def test_heatmap_default(
    client: AsyncClient,
    registered_user: dict,
):
    """Heatmap avec paramètres par défaut → 200 avec structure attendue"""
    resp = await client.get(
        "/api/macro/heatmap/africa",
        headers=registered_user["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "indicator" in data
    assert "year" in data
    assert "data" in data
    assert isinstance(data["data"], list)


async def test_heatmap_custom_indicator(
    client: AsyncClient,
    registered_user: dict,
):
    """Heatmap pour PCPIPCH année 2023 → indicateur et année respectés"""
    resp = await client.get(
        "/api/macro/heatmap/africa?indicator=PCPIPCH&year=2023",
        headers=registered_user["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["indicator"] == "PCPIPCH"
    assert data["year"] == 2023
    # Chaque point doit avoir country_id + value
    for point in data["data"]:
        assert "country_id" in point
        assert "value" in point


async def test_heatmap_invalid_year(
    client: AsyncClient,
    registered_user: dict,
):
    """Année invalide → 422 ou 400 (validation Pydantic)"""
    resp = await client.get(
        "/api/macro/heatmap/africa?year=abc",
        headers=registered_user["headers"],
    )
    assert resp.status_code == 422
