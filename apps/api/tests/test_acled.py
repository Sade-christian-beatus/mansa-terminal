"""Tests — ACLED conflits (router acled.py)"""
import pytest


@pytest.mark.asyncio
async def test_acled_events_requires_auth(client):
    """GET /api/acled/events sans token → 401/403."""
    resp = await client.get("/api/acled/events")
    assert resp.status_code in (401, 403, 422)


@pytest.mark.asyncio
async def test_acled_events_returns_structure(client, override_auth):
    """GET /api/acled/events retourne la structure attendue."""
    resp = await client.get("/api/acled/events")
    assert resp.status_code == 200
    data = resp.json()

    assert "events" in data
    assert "summary" in data
    assert isinstance(data["events"], list)
    assert len(data["events"]) > 0

    # Vérifier la structure d'un événement
    event = data["events"][0]
    assert "country_id" in event
    assert "name" in event
    assert "flag" in event
    assert "risk_level" in event
    assert "events_2024" in event
    assert "fatalities_2024" in event
    assert "risk_color" in event
    assert "trend_label" in event


@pytest.mark.asyncio
async def test_acled_events_risk_filter(client, override_auth):
    """GET /api/acled/events?risk_level=critical ne retourne que des pays critiques."""
    resp = await client.get("/api/acled/events?risk_level=critical")
    assert resp.status_code == 200
    data = resp.json()
    for event in data["events"]:
        assert event["risk_level"] == "critical"


@pytest.mark.asyncio
async def test_acled_events_sort_by_events(client, override_auth):
    """GET /api/acled/events?sort_by=events_2024 trie correctement."""
    resp = await client.get("/api/acled/events?sort_by=events_2024&limit=5")
    assert resp.status_code == 200
    data = resp.json()
    events = data["events"]
    if len(events) >= 2:
        assert events[0]["events_2024"] >= events[1]["events_2024"]


@pytest.mark.asyncio
async def test_acled_hotspots_returns_top5(client, override_auth):
    """GET /api/acled/hotspots retourne exactement 5 pays."""
    resp = await client.get("/api/acled/hotspots")
    assert resp.status_code == 200
    data = resp.json()
    assert "hotspots" in data
    assert len(data["hotspots"]) == 5

    # Vérifier le classement
    for i, h in enumerate(data["hotspots"]):
        assert h["rank"] == i + 1
        assert "country_id" in h
        assert "fatalities_2024" in h


@pytest.mark.asyncio
async def test_acled_summary_totals_consistent(client, override_auth):
    """Le total du summary = somme critical+high+medium+low."""
    resp = await client.get("/api/acled/events")
    assert resp.status_code == 200
    summary = resp.json()["summary"]
    computed = summary["critical"] + summary["high"] + summary["medium"] + summary["low"]
    assert computed == summary["countries_covered"]
