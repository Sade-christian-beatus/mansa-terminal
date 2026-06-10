"""Tests — Markets (FX, Indices, Commodités)"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_fx_requires_auth(client):
    """GET /api/markets/fx sans token → 401/403."""
    resp = await client.get("/api/markets/fx")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_fx_structure_with_fallback(client, override_auth, override_db):
    """GET /api/markets/fx retourne la structure correcte même avec l'API live down."""
    # Mock DB vide (pas de taux en base)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    # Mock Frankfurter indisponible → fallback statique
    with patch("app.routers.markets._fetch_live_fx_rates", return_value={}):
        resp = await client.get("/api/markets/fx")

    assert resp.status_code == 200
    data = resp.json()

    assert "rates" in data
    assert "base" in data
    assert data["base"] == "USD"
    assert "as_of" in data
    assert "is_live" in data
    assert isinstance(data["rates"], list)
    assert len(data["rates"]) > 0

    rate = data["rates"][0]
    assert "currency_code" in rate
    assert "rate_official" in rate
    assert "rate_parallel" in rate
    assert "is_live" in rate


@pytest.mark.asyncio
async def test_fx_live_data_when_available(client, override_auth, override_db):
    """GET /api/markets/fx avec données live Frankfurter."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    fake_rates = {"EUR": 0.92, "NGN": 1580.0, "ZAR": 18.4, "KES": 129.5,
                  "EGP": 50.8, "MAD": 9.95, "GHS": 15.6, "ETB": 57.2, "TZS": 2640.0}

    with patch("app.routers.markets._fetch_live_fx_rates", return_value=fake_rates):
        resp = await client.get("/api/markets/fx")

    assert resp.status_code == 200
    data = resp.json()
    assert data["is_live"] is True

    # XOF doit être dérivé de EUR
    xof = next((r for r in data["rates"] if r["currency_code"] == "XOF"), None)
    assert xof is not None
    assert xof["is_live"] is True


@pytest.mark.asyncio
async def test_indices_structure(client, override_auth):
    """GET /api/markets/indices retourne la liste des indices."""
    with patch("app.routers.markets._fetch_live_indices", return_value={}):
        resp = await client.get("/api/markets/indices")

    assert resp.status_code == 200
    data = resp.json()
    assert "indices" in data
    assert len(data["indices"]) > 0

    idx = data["indices"][0]
    assert "name" in idx
    assert "value" in idx
    assert "change_1d" in idx
    assert "is_live" in idx


@pytest.mark.asyncio
async def test_commodities_structure(client, override_auth):
    """GET /api/markets/commodities retourne la structure correcte."""
    with patch("app.routers.markets._fetch_live_commodities", return_value={}):
        resp = await client.get("/api/markets/commodities")

    assert resp.status_code == 200
    data = resp.json()
    assert "commodities" in data
    assert "is_live" in data
    assert len(data["commodities"]) == 10

    commodity = data["commodities"][0]
    assert "code" in commodity
    assert "name" in commodity
    assert "value" in commodity
    assert "unit" in commodity
    assert "is_live" in commodity
    assert "relevance" in commodity


@pytest.mark.asyncio
async def test_commodities_fallback_values(client, override_auth):
    """Commodités en mode fallback : les valeurs doivent être positives."""
    with patch("app.routers.markets._fetch_live_commodities", return_value={}):
        resp = await client.get("/api/markets/commodities")

    for c in resp.json()["commodities"]:
        assert c["value"] > 0
        assert c["is_live"] is False
        assert c["source"] == "MANSA Fallback"
