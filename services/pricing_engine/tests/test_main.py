"""Integration tests for the Store Pricing Engine FastAPI application."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import decision_cache
from decision_cache import reset_cache
from main import app


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the decision cache before each test."""
    reset_cache()
    yield
    reset_cache()


@pytest.mark.asyncio
async def test_health_returns_200():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["service"] == "store-pricing-engine"
    assert body["status"] == "ok"


@pytest.mark.asyncio
async def test_price_endpoint_returns_valid_response():
    payload = {"variant_id": 42, "base_price": 29.99, "cart_total": 60.0}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/price", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert "variant_id" in body
    assert "base_price" in body
    assert "final_price" in body
    assert "discount_pct" in body
    assert "rule_matched" in body
    assert "rules_evaluated" in body
    assert body["variant_id"] == 42
    assert body["base_price"] == pytest.approx(29.99)


@pytest.mark.asyncio
async def test_cache_stats_grows_after_price_calls():
    payload = {"variant_id": 10, "base_price": 19.99, "cart_total": 30.0}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(3):
            await client.post("/price", json=payload)
        response = await client.get("/pricing/cache-stats")

    assert response.status_code == 200
    stats = response.json()
    assert stats["total_decisions"] >= 3


@pytest.mark.asyncio
async def test_price_with_dd_trace_headers():
    """Ensure the /price endpoint does not crash when W3C trace headers are present."""
    payload = {"variant_id": 55, "base_price": 49.99, "cart_total": 80.0}
    headers = {
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/price", json=payload, headers=headers)

    assert response.status_code == 200
