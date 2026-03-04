"""
Pricing Decision Cache

Stores pricing decisions for audit and analytics purposes.
Each decision record includes full rule evaluation context.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone

from rule_engine import PricingResult

_decisions: list[dict] = []
_lock = threading.Lock()


def store_decision(variant_id: int, cart_total: float, result: PricingResult) -> None:
    """Append a pricing decision to the audit cache.

    Args:
        variant_id: The product variant that was priced.
        cart_total: The cart subtotal at the time of evaluation.
        result: The full PricingResult including rule evaluation context.
    """
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "variant_id": variant_id,
        "cart_total": cart_total,
        "base_price": result.base_price,
        "final_price": result.final_price,
        "discount_pct": result.discount_pct,
        "rule_matched": result.rule_matched,
        "rules_evaluated": result.rules_evaluated,
        "rule_snapshot": result.rule_snapshot,
    }
    with _lock:
        _decisions.append(record)


def get_stats() -> dict:
    """Return cache statistics for observability.

    Returns:
        A dict with cache_size, total_decisions, and estimated_memory_kb.
    """
    with _lock:
        size = len(_decisions)
        estimated_kb = sum(len(str(d)) for d in _decisions) / 1024

    return {
        "cache_size": size,
        "total_decisions": size,
        "estimated_memory_kb": round(estimated_kb, 2),
    }


def reset_cache() -> None:
    """Clear all stored decisions. Intended for use in tests only."""
    with _lock:
        _decisions.clear()
