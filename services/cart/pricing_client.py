"""
Pricing Engine Client

Handles communication with the store-pricing-engine service. Isolated from
cart application state so it can be tested independently of database models.
"""
import logging
import os
from typing import Optional

import httpx
from ddtrace import tracer
from ddtrace.propagation.http import HTTPPropagator

PRICING_ENGINE_ENABLED: bool = os.getenv("FEATURE_FLAG_DYNAMIC_PRICING", "false").lower() == "true"
PRICING_ENGINE_URL: str = os.getenv("PRICING_ENGINE_URL", "http://store-pricing-engine:8002")

logger = logging.getLogger(__name__)


async def fetch_adjusted_price(
    variant_id: int,
    base_price: float,
    cart_total: float,
    parent_span=None,
) -> float:
    """
    Call the pricing engine and return the adjusted price for a variant.

    Returns base_price unchanged if the pricing engine is disabled, unreachable,
    or returns a non-200 response. The cart never fails due to pricing engine errors.
    """
    if not PRICING_ENGINE_ENABLED:
        return base_price

    pricing_span = tracer.start_span("cart.pricing_check", child_of=parent_span)
    try:
        pricing_headers: dict = {}
        ctx = tracer.current_trace_context()
        if ctx:
            HTTPPropagator.inject(ctx, pricing_headers)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{PRICING_ENGINE_URL}/price",
                json={
                    "variant_id": variant_id,
                    "base_price": base_price,
                    "cart_total": cart_total,
                },
                headers=pricing_headers,
                timeout=10.0,
            )

        adjusted_price = base_price
        if resp.status_code == 200:
            data = resp.json()
            adjusted_price = float(data.get("final_price", base_price))
            pricing_span.set_tag("pricing.rules_evaluated", data.get("rules_evaluated", 0))
            pricing_span.set_tag("pricing.rule_matched", data.get("rule_matched", -1))
            pricing_span.set_tag("pricing.final_price", adjusted_price)

        pricing_span.set_tag("pricing.enabled", True)
        return adjusted_price

    except Exception as exc:
        logger.warning("Pricing engine unavailable, using catalog price: %s", exc)
        pricing_span.set_tag("pricing.enabled", False)
        pricing_span.set_tag("error", True)
        return base_price

    finally:
        pricing_span.finish()
