"""
Tests for _compute_metrics in backtest_engine.

Verifies that PerformanceMetrics calculations are mathematically correct for
a variety of known equity curves.

Metrics covered:
  • total_return
  • cagr
  • sharpe_ratio
  • max_drawdown
  • volatility
  • calmar_ratio
  • win_rate / profit_factor (from trade records)
  • time_in_market
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from services.backtest_engine import _compute_metrics
from schemas.backtest import TradeRecord


# ── Helpers ───────────────────────────────────────────────────────────────────

def _equity(values: list[float], start: str = "2020-01-01") -> pd.Series:
    idx = pd.date_range(start, periods=len(values), freq="D")
    return pd.Series(values, index=idx, dtype=float)


def _buy(date: str, price: float, shares: float) -> TradeRecord:
    return TradeRecord(
        date=date, action="BUY", price=price, shares=shares,
        cash_after=0.0, portfolio_value=price * shares,
    )


def _sell(date: str, price: float, shares: float, cash: float) -> TradeRecord:
    return TradeRecord(
        date=date, action="SELL", price=price, shares=shares,
        cash_after=cash, portfolio_value=cash,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Flat equity (no change)
# ══════════════════════════════════════════════════════════════════════════════

class TestFlatEquity:
    """An equity curve that never moves should produce all-zero risk metrics."""

    @pytest.fixture
    def metrics(self):
        eq = _equity([10_000.0] * 365, start="2020-01-01")
        return _compute_metrics(eq, [], 10_000.0)

    def test_total_return_zero(self, metrics):
        assert math.isclose(metrics.total_return, 0.0, abs_tol=1e-9)

    def test_cagr_zero(self, metrics):
        assert math.isclose(metrics.cagr, 0.0, abs_tol=1e-9)

    def test_max_drawdown_zero(self, metrics):
        assert math.isclose(metrics.max_drawdown, 0.0, abs_tol=1e-9)

    def test_sharpe_zero(self, metrics):
        # std of zero returns → Sharpe must be exactly 0
        assert math.isclose(metrics.sharpe_ratio, 0.0, abs_tol=1e-9)

    def test_volatility_zero(self, metrics):
        assert math.isclose(metrics.volatility, 0.0, abs_tol=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
# Total return
# ══════════════════════════════════════════════════════════════════════════════

class TestTotalReturn:

    def test_doubles(self):
        eq = _equity([10_000.0, 10_000.0, 20_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.total_return, 1.0, rel_tol=1e-9)

    def test_triples(self):
        eq = _equity([10_000.0, 30_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.total_return, 2.0, rel_tol=1e-9)

    def test_loses_half(self):
        eq = _equity([10_000.0, 5_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.total_return, -0.5, rel_tol=1e-9)

    def test_return_is_final_minus_initial_over_initial(self):
        v0, vf = 8_000.0, 11_500.0
        eq = _equity([v0, 9_000.0, 10_000.0, vf])
        m = _compute_metrics(eq, [], v0)
        expected = (vf - v0) / v0
        assert math.isclose(m.total_return, expected, rel_tol=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
# Max drawdown
# ══════════════════════════════════════════════════════════════════════════════

class TestMaxDrawdown:

    def test_peak_then_trough(self):
        # Peaks at 20k, falls to 10k → drawdown = -50 %
        eq = _equity([10_000.0, 20_000.0, 10_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.max_drawdown, -0.5, rel_tol=1e-6)

    def test_always_increasing_no_drawdown(self):
        eq = _equity([1.0, 2.0, 3.0, 4.0, 5.0])
        m = _compute_metrics(eq, [], 1.0)
        assert math.isclose(m.max_drawdown, 0.0, abs_tol=1e-9)

    def test_max_drawdown_is_negative(self):
        eq = _equity([10_000.0, 15_000.0, 8_000.0, 12_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert m.max_drawdown <= 0.0

    def test_multiple_drawdowns_worst_reported(self):
        # First drawdown: 20k→12k = -40 %; second: 25k→10k = -60 %
        eq = _equity([10_000.0, 20_000.0, 12_000.0, 25_000.0, 10_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.max_drawdown, -0.6, rel_tol=1e-6)


# ══════════════════════════════════════════════════════════════════════════════
# CAGR
# ══════════════════════════════════════════════════════════════════════════════

class TestCAGR:

    def test_one_year_double_is_100pct(self):
        """Growing from 10k to 20k in exactly 365 days → CAGR ≈ 100 %."""
        eq = _equity([10_000.0] * 364 + [20_000.0], start="2020-01-01")
        m = _compute_metrics(eq, [], 10_000.0)
        # 365 days = 364/365.25 ≈ 0.997 years
        assert math.isclose(m.cagr, 1.0, abs_tol=0.02)

    def test_cagr_positive_for_growing_equity(self):
        eq = _equity([10_000.0] * 200 + [15_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert m.cagr > 0

    def test_cagr_negative_for_shrinking_equity(self):
        eq = _equity([10_000.0] * 200 + [5_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert m.cagr < 0


# ══════════════════════════════════════════════════════════════════════════════
# Sharpe ratio
# ══════════════════════════════════════════════════════════════════════════════

class TestSharpeRatio:

    def test_sharpe_positive_for_steady_growth(self):
        # Zigzag uptrend: alternating bumps give non-zero std while mean log-return > 0
        values = [10_000.0 + i * 50 + (200 if i % 2 == 0 else -100) for i in range(252)]
        eq = _equity(values)
        m = _compute_metrics(eq, [], 10_000.0)
        assert m.sharpe_ratio > 0

    def test_sharpe_not_nan(self):
        eq = _equity([10_000.0 + i * 10 for i in range(252)])
        m = _compute_metrics(eq, [], 10_000.0)
        assert not math.isnan(m.sharpe_ratio)

    def test_sharpe_is_zero_for_flat_equity(self):
        eq = _equity([10_000.0] * 252)
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.sharpe_ratio, 0.0, abs_tol=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
# Calmar ratio
# ══════════════════════════════════════════════════════════════════════════════

class TestCalmarRatio:

    def test_calmar_is_cagr_over_abs_max_drawdown(self):
        eq = _equity([10_000.0, 20_000.0, 12_000.0, 25_000.0, 24_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        expected = m.cagr / abs(m.max_drawdown) if abs(m.max_drawdown) > 1e-9 else 0.0
        assert math.isclose(m.calmar_ratio, expected, rel_tol=1e-9)

    def test_calmar_zero_for_flat_equity(self):
        eq = _equity([10_000.0] * 252)
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.calmar_ratio, 0.0, abs_tol=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
# Win rate and profit factor
# ══════════════════════════════════════════════════════════════════════════════

class TestTradeMetrics:

    def test_win_rate_100_pct_for_all_profitable_trades(self):
        eq = _equity([10_000.0, 12_000.0, 10_000.0, 14_000.0])
        trades = [
            _buy("2020-01-01", price=10.0, shares=1_000.0),
            _sell("2020-01-02", price=12.0, shares=1_000.0, cash=12_000.0),
            _buy("2020-01-03", price=10.0, shares=1_000.0),
            _sell("2020-01-04", price=14.0, shares=1_000.0, cash=14_000.0),
        ]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert math.isclose(m.win_rate, 1.0, rel_tol=1e-9)

    def test_win_rate_0_pct_for_all_losing_trades(self):
        eq = _equity([10_000.0, 8_000.0, 10_000.0, 6_000.0])
        trades = [
            _buy("2020-01-01", price=10.0, shares=1_000.0),
            _sell("2020-01-02", price=8.0, shares=1_000.0, cash=8_000.0),
            _buy("2020-01-03", price=10.0, shares=1_000.0),
            _sell("2020-01-04", price=6.0, shares=1_000.0, cash=6_000.0),
        ]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert math.isclose(m.win_rate, 0.0, abs_tol=1e-9)

    def test_win_rate_50_pct_for_mixed_trades(self):
        eq = _equity([10_000.0, 12_000.0, 10_000.0, 8_000.0])
        trades = [
            _buy("2020-01-01", price=10.0, shares=1_000.0),
            _sell("2020-01-02", price=12.0, shares=1_000.0, cash=12_000.0),
            _buy("2020-01-03", price=10.0, shares=1_000.0),
            _sell("2020-01-04", price=8.0, shares=1_000.0, cash=8_000.0),
        ]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert math.isclose(m.win_rate, 0.5, rel_tol=1e-9)

    def test_profit_factor_ratio(self):
        """Gross profit=2000, Gross loss=1000 → profit_factor=2.0."""
        eq = _equity([10_000.0, 12_000.0, 10_000.0, 9_000.0])
        trades = [
            _buy("2020-01-01", price=10.0, shares=1_000.0),
            _sell("2020-01-02", price=12.0, shares=1_000.0, cash=12_000.0),
            _buy("2020-01-03", price=10.0, shares=1_000.0),
            _sell("2020-01-04", price=9.0, shares=1_000.0, cash=9_000.0),
        ]
        m = _compute_metrics(eq, trades, 10_000.0)
        # gross_profit = (12-10)*1000 = 2000, gross_loss = (10-9)*1000 = 1000
        assert m.profit_factor is not None
        assert math.isclose(m.profit_factor, 2.0, rel_tol=1e-6)

    def test_no_trades_win_rate_is_none(self):
        eq = _equity([10_000.0, 12_000.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert m.win_rate is None

    def test_no_closed_trades_profit_factor_is_none(self):
        # Only a BUY with no corresponding SELL
        eq = _equity([10_000.0, 12_000.0])
        trades = [_buy("2020-01-01", price=10.0, shares=1_000.0)]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert m.profit_factor is None


# ══════════════════════════════════════════════════════════════════════════════
# Time in market
# ══════════════════════════════════════════════════════════════════════════════

class TestTimeInMarket:

    def test_no_trades_zero_time_in_market(self):
        eq = _equity([10_000.0] * 10)
        m = _compute_metrics(eq, [], 10_000.0)
        assert math.isclose(m.time_in_market, 0.0, abs_tol=1e-9)

    def test_full_time_in_market_for_bnh(self):
        """Single BUY at day 0 with no SELL → 100 % time in market."""
        eq = _equity([10_000.0 + i * 100 for i in range(100)])
        trades = [_buy("2020-01-01", price=100.0, shares=100.0)]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert math.isclose(m.time_in_market, 1.0, rel_tol=1e-9)

    def test_time_in_market_bounded_0_to_1(self):
        eq = _equity([10_000.0, 12_000.0, 8_000.0, 11_000.0])
        trades = [
            _buy("2020-01-01", price=10.0, shares=1_000.0),
            _sell("2020-01-03", price=8.0, shares=1_000.0, cash=8_000.0),
        ]
        m = _compute_metrics(eq, trades, 10_000.0)
        assert 0.0 <= m.time_in_market <= 1.0


# ══════════════════════════════════════════════════════════════════════════════
# Metrics schema integrity
# ══════════════════════════════════════════════════════════════════════════════

class TestMetricsSchema:
    """Sanity-check that _compute_metrics always returns a valid PerformanceMetrics."""

    def test_returns_performance_metrics_instance(self):
        from schemas.backtest import PerformanceMetrics
        eq = _equity([10_000.0, 11_000.0, 9_500.0])
        m = _compute_metrics(eq, [], 10_000.0)
        assert isinstance(m, PerformanceMetrics)

    def test_all_required_fields_present(self):
        # Need ≥3 points so we get ≥2 log-returns and a defined std
        eq = _equity([10_000.0, 10_500.0, 11_000.0, 10_750.0, 11_200.0])
        m = _compute_metrics(eq, [], 10_000.0)
        required = [
            "total_return", "cagr", "sharpe_ratio", "max_drawdown",
            "volatility", "calmar_ratio", "time_in_market",
        ]
        for field in required:
            assert hasattr(m, field), f"Missing field: {field}"
            val = getattr(m, field)
            assert not math.isnan(val), f"Field '{field}' is NaN"

    def test_metrics_stable_on_single_day(self):
        """Edge case: single-element equity should not explode."""
        eq = pd.Series([10_000.0], index=pd.date_range("2020-01-01", periods=1))
        # CAGR and other metrics won't be meaningful but should not raise exceptions
        try:
            _compute_metrics(eq, [], 10_000.0)
        except Exception as exc:
            pytest.fail(f"_compute_metrics raised with single-day equity: {exc}")
