"""Tests — News RSS (router news.py)"""
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_news_requires_auth(client):
    """GET /api/news/feed sans token → 401/403."""
    resp = await client.get("/api/news/feed")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_news_fallback_when_rss_down(client, override_auth):
    """GET /api/news/feed retourne les articles de fallback si RSS indisponible."""
    # Mock httpx pour simuler RSS indisponibles
    with patch("app.routers.news._news_cache", {"data": None, "fetched_at": None}):
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=Exception("RSS down"))
            mock_client_class.return_value = mock_client

            resp = await client.get("/api/news/feed")

    assert resp.status_code == 200
    data = resp.json()
    assert "articles" in data
    assert len(data["articles"]) > 0


@pytest.mark.asyncio
async def test_news_structure(client, override_auth):
    """GET /api/news/feed retourne la structure attendue."""
    with patch("app.routers.news._news_cache", {"data": None, "fetched_at": None}):
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=Exception("RSS down"))
            mock_client_class.return_value = mock_client

            resp = await client.get("/api/news/feed")

    data = resp.json()
    assert "articles" in data
    assert "is_live" in data
    assert "source" in data

    if data["articles"]:
        article = data["articles"][0]
        assert "title" in article
        assert "source" in article


@pytest.mark.asyncio
async def test_news_limit_param(client, override_auth):
    """GET /api/news/feed?limit=3 retourne au plus 3 articles."""
    with patch("app.routers.news._news_cache", {"data": None, "fetched_at": None}):
        with patch("httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(side_effect=Exception("RSS down"))
            mock_client_class.return_value = mock_client

            resp = await client.get("/api/news/feed?limit=3")

    data = resp.json()
    assert len(data["articles"]) <= 3
