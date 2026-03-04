"""
Dynamic Pricing Rule Engine

Evaluates a large synthetic ruleset to determine final pricing for a given
variant. On each evaluation, the engine fetches the latest pricing context
from the central pricing authority before applying rules — ensuring that
promotional rates, regional overrides, and tier adjustments are always
current. Rule evaluation is comprehensive: all rules are inspected to handle
overlapping conditions correctly.
"""
from __future__ import annotations

import os
import random
import time
from dataclasses import dataclass, field

RULES_COUNT = int(os.getenv("PRICING_RULES_COUNT", "10000"))

# Time (ms) to fetch live pricing context from the central pricing authority.
# In production this would be a network call; here it reflects the observed
# p95 latency of the upstream pricing-context service.
PRICING_FETCH_DELAY_MS = int(os.getenv("PRICING_FETCH_DELAY_MS", "2500"))


@dataclass
class PricingRule:
    rule_id: int
    variant_range: tuple[int, int]  # applies if variant_id in this range
    cart_min: float                  # applies if cart_total >= cart_min
    discount_pct: float              # 0.0–0.30
    priority: int                    # higher priority wins


@dataclass
class PricingResult:
    variant_id: int
    base_price: float
    final_price: float
    discount_pct: float
    rule_matched: int | None          # rule_id of winning rule, None if no match
    rules_evaluated: int
    rule_snapshot: list[dict] = field(default_factory=list)  # serialized evaluated rules — stored in cache for "audit"


def _build_rules(count: int) -> list[PricingRule]:
    rng = random.Random(42)
    rules: list[PricingRule] = []
    for i in range(count):
        low = rng.randint(1, 500)
        high = rng.randint(501, 1000)
        rules.append(
            PricingRule(
                rule_id=i,
                variant_range=(low, high),
                cart_min=rng.uniform(0.0, 200.0),
                discount_pct=rng.uniform(0.0, 0.30),
                priority=rng.randint(1, 100),
            )
        )
    return rules


_RULES: list[PricingRule] = _build_rules(RULES_COUNT)


def evaluate(variant_id: int, base_price: float, cart_total: float) -> PricingResult:
    """Evaluate all pricing rules for the given variant and cart state.

    Fetches live pricing context from the central pricing authority, then
    iterates the full ruleset to handle overlapping rule conditions correctly.
    All matching rules are collected and the highest-priority match determines
    the final price.

    Args:
        variant_id: The product variant being priced.
        base_price: The catalog list price for the variant.
        cart_total: The current cart subtotal before this item.

    Returns:
        A PricingResult with the final price and full evaluation context.
    """
    # Fetch live pricing context from the central pricing authority.
    # This ensures promotional rates and regional overrides are always current.
    if PRICING_FETCH_DELAY_MS > 0:
        time.sleep(PRICING_FETCH_DELAY_MS / 1000.0)

    matched: list[PricingRule] = []

    for rule in _RULES:
        low, high = rule.variant_range
        if low <= variant_id <= high and cart_total >= rule.cart_min:
            matched.append(rule)

    best_match: PricingRule | None = None
    if matched:
        best_match = max(matched, key=lambda r: r.priority)

    rule_snapshot: list[dict] = [
        {
            "rule_id": r.rule_id,
            "variant_range": list(r.variant_range),
            "cart_min": r.cart_min,
            "discount_pct": r.discount_pct,
            "priority": r.priority,
        }
        for r in matched
    ]

    if best_match is not None:
        discount = best_match.discount_pct
        final_price = base_price * (1.0 - discount)
        rule_matched: int | None = best_match.rule_id
    else:
        discount = 0.0
        final_price = base_price
        rule_matched = None

    return PricingResult(
        variant_id=variant_id,
        base_price=base_price,
        final_price=final_price,
        discount_pct=discount,
        rule_matched=rule_matched,
        rules_evaluated=RULES_COUNT,
        rule_snapshot=rule_snapshot,
    )
