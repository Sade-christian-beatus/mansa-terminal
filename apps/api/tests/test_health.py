"""Tests — Health endpoint"""
import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    """GET /health doit retourner status=ok sans authentification."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "ok"


@pytest.mark.asyncio
async def test_root_returns_service_info(client):
    """GET / doit retourner le nom du service."""
    resp = await client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert "MANSA" in data.get("service", "")
    assert "version" in data


@pytest.mark.asyncio
async def test_docs_accessible_in_dev(client):
    """GET /docs accessible hors production."""
    resp = await client.get("/docs")
    assert resp.status_code == 200
