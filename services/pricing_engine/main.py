from __future__ import annotations

import bootstrap  # noqa: F401 — must be first for dd-trace

import os
from typing import Optional

from ddtrace import tracer
from ddtrace.propagation.http import HTTPPropagator
from fastapi import FastAPI, Request
from pydantic import BaseModel

from decision_cache import get_stats, store_decision
from rule_engine import evaluate
from rules_middleware import register_middleware

app = FastAPI(title="Store Pricing Engine")

register_middleware(app)


class PriceRequest(BaseModel):
    variant_id: int
    base_price: float
    cart_total: float
    session_id: Optional[str] = None


class PriceResponse(BaseModel):
    variant_id: int
    base_price: float
    final_price: float
    discount_pct: float
    rule_matched: Optional[int]
    rules_evaluated: int


# --- Health ---


@app.get("/health")
def health():
    return {"service": "store-pricing-engine", "status": "ok"}


# --- Pricing ---


@app.post("/price", response_model=PriceResponse)
def price(body: PriceRequest, request: Request):
    ctx = HTTPPropagator.extract(dict(request.headers))
    if ctx.trace_id:
        with tracer.start_span("pricing_engine.evaluate_rules", child_of=ctx) as span:
            result = evaluate(body.variant_id, body.base_price, body.cart_total)
            store_decision(body.variant_id, body.cart_total, result)
            cache_stats = get_stats()
            span.set_tag("pricing.variant_id", body.variant_id)
            span.set_tag("pricing.rules_evaluated", result.rules_evaluated)
            span.set_tag("pricing.base_price", result.base_price)
            span.set_tag("pricing.final_price", result.final_price)
            span.set_tag("pricing.rule_matched", result.rule_matched if result.rule_matched is not None else -1)
            span.set_tag("pricing.cache_size", cache_stats["cache_size"])
    else:
        with tracer.start_span("pricing_engine.evaluate_rules") as span:
            result = evaluate(body.variant_id, body.base_price, body.cart_total)
            store_decision(body.variant_id, body.cart_total, result)
            cache_stats = get_stats()
            span.set_tag("pricing.variant_id", body.variant_id)
            span.set_tag("pricing.rules_evaluated", result.rules_evaluated)
            span.set_tag("pricing.base_price", result.base_price)
            span.set_tag("pricing.final_price", result.final_price)
            span.set_tag("pricing.rule_matched", result.rule_matched if result.rule_matched is not None else -1)
            span.set_tag("pricing.cache_size", cache_stats["cache_size"])

    return PriceResponse(
        variant_id=result.variant_id,
        base_price=result.base_price,
        final_price=result.final_price,
        discount_pct=result.discount_pct,
        rule_matched=result.rule_matched,
        rules_evaluated=result.rules_evaluated,
    )


# --- Observability ---


@app.get("/pricing/cache-stats")
def cache_stats():
    return get_stats()
