"""Tests for the pricing decision audit cache."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

import decision_cache
from decision_cache import get_stats, reset_cache, store_decision
from rule_engine import evaluate


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the decision cache before each test."""
    reset_cache()
    yield
    reset_cache()


def _make_decision(variant_id: int = 1, cart_total: float = 50.0, base_price: float = 29.99) -> None:
    result = evaluate(variant_id, base_price, cart_total)
    store_decision(variant_id, cart_total, result)


def test_store_decision_increments_count():
    _make_decision(variant_id=1)
    _make_decision(variant_id=2)
    _make_decision(variant_id=3)

    stats = get_stats()
    assert stats["cache_size"] == 3


def test_cache_never_decrements():
    for i in range(1, 6):
        _make_decision(variant_id=i)

    stats_after_five = get_stats()
    assert stats_after_five["cache_size"] == 5

    for i in range(6, 11):
        _make_decision(variant_id=i)

    stats_after_ten = get_stats()
    assert stats_after_ten["cache_size"] == 10


def test_get_stats_structure():
    _make_decision()
    stats = get_stats()

    assert "cache_size" in stats
    assert "total_decisions" in stats
    assert "estimated_memory_kb" in stats


def test_estimated_memory_grows():
    _make_decision(variant_id=1)
    stats_one = get_stats()
    memory_after_one = stats_one["estimated_memory_kb"]

    for i in range(2, 11):
        _make_decision(variant_id=i)

    stats_ten = get_stats()
    memory_after_ten = stats_ten["estimated_memory_kb"]

    assert memory_after_ten > memory_after_one
