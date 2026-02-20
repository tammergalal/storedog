import os

import httpx
from ddtrace import tracer
from ddtrace.propagation.http import HTTPPropagator
from fastapi import HTTPException
from sqlalchemy.orm import Session

from cart_utils import recalculate_order

DISCOUNTS_URL = os.environ.get("DISCOUNTS_URL", "http://localhost:2814")


async def apply_coupon(order, coupon_code: str, db: Session):
    # H2: inject Datadog trace context for distributed tracing
    prop_headers: dict = {}
    ctx = tracer.current_trace_context()
    if ctx:
        HTTPPropagator.inject(ctx, prop_headers)

    # H11: perform status check inside the async with block
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{DISCOUNTS_URL}/discount-code",
                params={"discount_code": coupon_code},
                headers=prop_headers,
                timeout=5.0,
            )
        except httpx.RequestError:
            raise HTTPException(status_code=503, detail="Discounts service unavailable")

        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Invalid coupon code: {coupon_code}")

    discount = resp.json()

    if discount.get("tier") == "free_shipping":
        order.ship_total = 0
        order.discount_amount = 0
    else:
        # H12: avoid `or` which treats 0 as falsy
        value = discount["discount_value"] if "discount_value" in discount else discount.get("value", 0)
        order.discount_amount = float(order.subtotal) * (float(value) / 100)

    order.discount_code = coupon_code
    # H7: use shared recalculate_order instead of duplicating the formula
    recalculate_order(order, db)
    db.commit()
    db.refresh(order)
    return order
