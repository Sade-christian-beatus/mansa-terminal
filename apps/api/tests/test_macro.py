"""Tests — Macro endpoints (fraîcheur, régions, heatmap)"""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_freshness_requires_auth(client):
    resp = await client.get("/api/macro/freshness")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_freshness_structure(client, override_auth, override_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/macro/freshness")
    assert resp.status_code == 200
    data = resp.json()
    assert "sources" in data
    assert "is_live" in data
    assert "last_updated" in data


@pytest.mark.asyncio
async def test_regions_uemoa(client, override_auth, override_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/macro/regions/UEMOA")
    assert resp.status_code == 200
    data = resp.json()
    assert data["zone"] == "UEMOA"
    assert "countries" in data
    assert "criteria" in data


@pytest.mark.asyncio
async def test_regions_cemac(client, override_auth, override_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/macro/regions/CEMAC")
    assert resp.status_code == 200
    assert resp.json()["zone"] == "CEMAC"


@pytest.mark.asyncio
async def test_regions_invalid_zone(client, override_auth):
    resp = await client.get("/api/macro/regions/INVALID")
    assert resp.status_code in (404, 422)


@pytest.mark.asyncio
async def test_export_requires_auth(client):
    resp = await client.get("/api/macro/export")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_heatmap_africa_accessible(client, override_auth, override_db):
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    override_db.execute = AsyncMock(return_value=mock_result)

    resp = await client.get("/api/macro/heatmap/africa?indicator=NGDP_RPCH")
    assert resp.status_code == 200
