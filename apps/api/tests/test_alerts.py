"""Tests — Alertes macro (router alerts.py)"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_alerts_requires_auth(client):
    """GET /api/alerts/macro sans token → 401 ou 403."""
    resp = await client.get("/api/alerts/macro")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_alerts_returns_structure(client, override_auth, override_db):
    """GET /api/alerts/macro retourne la structure attendue."""
    # Mock la requête DB — retourne des indicateurs simulés
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [
        MagicMock(
            country_id="NGA",
            indicator_code="PCPIPCH",
            value=32.5,
            period="2024",
            unit="%",
            source="IMF WEO",
        ),
        MagicMock(
            country_id="SDN",
            indicator_code="PCPIPCH",
            value=65.0,
            period="2024",
            unit="%",
            source="IMF WEO",
        ),
    ]
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/alerts/macro?limit=5")
    assert resp.status_code == 200
    data = resp.json()

    assert "alerts" in data
    assert "summary" in data
    assert "total" in data["summary"]
    assert "critical" in data["summary"]
    assert "high" in data["summary"]
    assert "medium" in data["summary"]


@pytest.mark.asyncio
async def test_alerts_severity_filter(client, override_auth, override_db):
    """GET /api/alerts/macro?severity=critical filtre correctement."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/alerts/macro?severity=critical")
    assert resp.status_code == 200
    data = resp.json()
    # Toutes les alertes retournées doivent être critical
    for alert in data.get("alerts", []):
        assert alert.get("severity") == "critical"


@pytest.mark.asyncio
async def test_alerts_year_param(client, override_auth, override_db):
    """GET /api/alerts/macro accepte le paramètre year."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/alerts/macro?year=2023")
    assert resp.status_code == 200
