"""
Tests for the dynamic pricing engine client (pricing_client.py).

Tests import pricing_client directly — no sqlalchemy or schemas dependency —
so they run on any Python 3.8+ installation as well as inside Docker (Python 3.11).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_pricing_response(final_price: float, rules_evaluated: int, rule_matched: int):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "final_price": final_price,
        "rules_evaluated": rules_evaluated,
        "rule_matched": rule_matched,
    }
    return resp


def _make_mock_client(response=None, raise_exc=None):
    """Return a mock AsyncClient whose .post() either returns response or raises raise_exc."""
    mock_client = AsyncMock()
    if raise_exc is not None:
        mock_client.post = AsyncMock(side_effect=raise_exc)
    else:
        mock_client.post = AsyncMock(return_value=response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


def _make_mock_span():
    span = MagicMock()
    span.set_tag = MagicMock()
    span.finish = MagicMock()
    return span


# ---------------------------------------------------------------------------
# Tests: disabled
# ---------------------------------------------------------------------------

class TestPricingEngineDisabled:
    @pytest.mark.asyncio
    async def test_pricing_engine_not_called_when_disabled(self):
        """When PRICING_ENGINE_ENABLED is False, no HTTP call is made."""
        mock_client = _make_mock_client(response=_make_pricing_response(24.99, 10000, 42))

        with patch("pricing_client.PRICING_ENGINE_ENABLED", False), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client):
            import pricing_client
            result = await pricing_client.fetch_adjusted_price(
                variant_id=1, base_price=29.99, cart_total=60.0
            )

        mock_client.post.assert_not_called()
        assert result == 29.99


# ---------------------------------------------------------------------------
# Tests: enabled
# ---------------------------------------------------------------------------

class TestPricingEngineEnabled:
    @pytest.mark.asyncio
    async def test_pricing_engine_called_with_correct_payload(self):
        """When enabled, POST /price is called with the correct URL and body."""
        mock_resp = _make_pricing_response(final_price=24.99, rules_evaluated=10000, rule_matched=42)
        mock_client = _make_mock_client(response=mock_resp)
        mock_span = _make_mock_span()
        mock_tracer = MagicMock()
        mock_tracer.start_span.return_value = mock_span
        mock_tracer.current_trace_context.return_value = None

        with patch("pricing_client.PRICING_ENGINE_ENABLED", True), \
             patch("pricing_client.PRICING_ENGINE_URL", "http://store-pricing-engine:8002"), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client), \
             patch("pricing_client.tracer", mock_tracer):
            import pricing_client
            result = await pricing_client.fetch_adjusted_price(
                variant_id=7, base_price=19.99, cart_total=59.97
            )

        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "http://store-pricing-engine:8002/price"
        body = call_args[1]["json"]
        assert body["variant_id"] == 7
        assert body["base_price"] == 19.99
        assert body["cart_total"] == 59.97
        assert result == 24.99

    @pytest.mark.asyncio
    async def test_pricing_engine_non_200_returns_base_price(self):
        """A non-200 response from the pricing engine falls back to base_price."""
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        mock_client = _make_mock_client(response=mock_resp)
        mock_span = _make_mock_span()
        mock_tracer = MagicMock()
        mock_tracer.start_span.return_value = mock_span
        mock_tracer.current_trace_context.return_value = None

        with patch("pricing_client.PRICING_ENGINE_ENABLED", True), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client), \
             patch("pricing_client.tracer", mock_tracer):
            import pricing_client
            result = await pricing_client.fetch_adjusted_price(
                variant_id=9, base_price=15.00, cart_total=30.0
            )

        assert result == 15.00


# ---------------------------------------------------------------------------
# Tests: graceful degradation
# ---------------------------------------------------------------------------

class TestPricingEngineGracefulDegradation:
    @pytest.mark.asyncio
    async def test_pricing_engine_graceful_degradation(self):
        """If pricing engine raises a network error, base_price is returned unchanged."""
        import httpx as real_httpx
        mock_client = _make_mock_client(raise_exc=real_httpx.RequestError("connection refused"))
        mock_span = _make_mock_span()
        mock_tracer = MagicMock()
        mock_tracer.start_span.return_value = mock_span
        mock_tracer.current_trace_context.return_value = None

        with patch("pricing_client.PRICING_ENGINE_ENABLED", True), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client), \
             patch("pricing_client.tracer", mock_tracer):
            import pricing_client
            result = await pricing_client.fetch_adjusted_price(
                variant_id=5, base_price=39.99, cart_total=80.0
            )

        assert result == 39.99


# ---------------------------------------------------------------------------
# Tests: span tags
# ---------------------------------------------------------------------------

class TestPricingSpanTags:
    @pytest.mark.asyncio
    async def test_pricing_span_tags_set_correctly(self):
        """On a 200 response, span must carry pricing.enabled, rules_evaluated, final_price."""
        mock_resp = _make_pricing_response(final_price=24.99, rules_evaluated=10000, rule_matched=42)
        mock_client = _make_mock_client(response=mock_resp)
        mock_span = _make_mock_span()
        mock_tracer = MagicMock()
        mock_tracer.start_span.return_value = mock_span
        mock_tracer.current_trace_context.return_value = None

        with patch("pricing_client.PRICING_ENGINE_ENABLED", True), \
             patch("pricing_client.PRICING_ENGINE_URL", "http://store-pricing-engine:8002"), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client), \
             patch("pricing_client.tracer", mock_tracer):
            import pricing_client
            await pricing_client.fetch_adjusted_price(
                variant_id=2, base_price=19.99, cart_total=50.0
            )

        tag_calls = {call[0][0]: call[0][1] for call in mock_span.set_tag.call_args_list}
        assert tag_calls.get("pricing.enabled") is True
        assert tag_calls.get("pricing.rules_evaluated") == 10000
        assert tag_calls.get("pricing.final_price") == 24.99
        mock_span.finish.assert_called_once()

    @pytest.mark.asyncio
    async def test_span_finished_on_error(self):
        """span.finish() must be called even when the pricing engine raises."""
        import httpx as real_httpx
        mock_client = _make_mock_client(raise_exc=real_httpx.RequestError("timeout"))
        mock_span = _make_mock_span()
        mock_tracer = MagicMock()
        mock_tracer.start_span.return_value = mock_span
        mock_tracer.current_trace_context.return_value = None

        with patch("pricing_client.PRICING_ENGINE_ENABLED", True), \
             patch("pricing_client.httpx.AsyncClient", return_value=mock_client), \
             patch("pricing_client.tracer", mock_tracer):
            import pricing_client
            await pricing_client.fetch_adjusted_price(
                variant_id=3, base_price=9.99, cart_total=20.0
            )

        mock_span.finish.assert_called_once()
