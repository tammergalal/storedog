"""Tests for the dynamic pricing rule engine."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

from rule_engine import RULES_COUNT, PricingResult, evaluate


def test_evaluate_returns_valid_result():
    result = evaluate(1, 29.99, 50.0)

    assert isinstance(result, PricingResult)
    assert result.variant_id == 1
    assert result.base_price == 29.99
    assert isinstance(result.final_price, float)
    assert isinstance(result.discount_pct, float)
    assert result.rules_evaluated == RULES_COUNT
    assert isinstance(result.rule_snapshot, list)


def test_evaluate_is_deterministic():
    result_a = evaluate(42, 19.99, 75.0)
    result_b = evaluate(42, 19.99, 75.0)

    assert result_a.final_price == result_b.final_price
    assert result_a.discount_pct == result_b.discount_pct
    assert result_a.rule_matched == result_b.rule_matched
    assert result_a.rules_evaluated == result_b.rules_evaluated


def test_rules_evaluated_count():
    result = evaluate(100, 49.99, 100.0)

    assert result.rules_evaluated == RULES_COUNT


def test_unknown_variant_returns_base_price():
    # variant_id=99999 is outside any generated range (all ranges are within 1–1000)
    result = evaluate(99999, 59.99, 0.0)

    assert result.final_price == result.base_price
    assert result.discount_pct == 0.0
    assert result.rule_matched is None
    assert result.rule_snapshot == []


def test_zero_price():
    result = evaluate(1, 0.0, 0.0)

    assert result.final_price == 0.0
    assert result.base_price == 0.0
