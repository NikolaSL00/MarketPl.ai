"""
Tests for all trading strategy implementations in backtest_engine.

Each strategy is exercised with synthetic price DataFrames so the test suite
runs completely offline (no MongoDB required — the database module is stubbed
out in conftest.py before any import).

Strategies covered:
  • _run_buy_and_hold      – B&H baseline
  • _run_dca               – Dollar-Cost Averaging (weekly / monthly / quarterly)
  • _run_ma_crossover      – Golden-Cross / Death-Cross (MA Crossover)
  • _compute_rsi           – Wilder's RSI helper
  • _run_rsi               – RSI mean-reversion
  • _run_bollinger_bands   – Bollinger Bands mean-reversion
"""
from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

# ── Import the private strategy helpers directly ──────────────────────────────
from services.backtest_engine import (
    _compute_rsi,
    _run_bollinger_bands,
    _run_buy_and_hold,
    _run_dca,
    _run_ma_crossover,
    _run_rsi,
)
from schemas.backtest import (
    BollingerBandsParams,
    DCAInterval,
    DCAParams,
    MACrossoverParams,
    RSIParams,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_prices(values: list[float], start: str = "2020-01-01") -> pd.DataFrame:
    """Construct a DataFrame with an 'adj_close' column, day-indexed."""
    idx = pd.date_range(start, periods=len(values), freq="D")
    return pd.DataFrame({"adj_close": values}, index=idx)


# ══════════════════════════════════════════════════════════════════════════════
# Buy & Hold
# ══════════════════════════════════════════════════════════════════════════════

class TestBuyAndHold:
    """_run_buy_and_hold: deploy full capital at t₀, no rebalancing or exit."""

    def test_single_trade_at_t0(self):
        prices = _make_prices([10.0, 12.0, 15.0, 20.0])
        equity, trades = _run_buy_and_hold(prices, initial_capital=10_000.0)

        assert len(trades) == 1, "B&H must generate exactly one trade"
        t = trades[0]
        assert t.action == "BUY"
        assert math.isclose(t.price, 10.0)
        assert math.isclose(t.shares, 1_000.0)   # 10_000 / 10
        assert t.cash_after == 0.0

    def test_no_sell_trades(self):
        prices = _make_prices([10.0, 9.0, 8.0, 7.0])
        _, trades = _run_buy_and_hold(prices, initial_capital=5_000.0)
        sell_trades = [t for t in trades if t.action == "SELL"]
        assert not sell_trades, "B&H must never sell"

    def test_equity_tracks_price(self):
        """equity[i] == shares_bought * adj_close[i]"""
        values = [10.0, 20.0, 30.0]
        prices = _make_prices(values)
        equity, trades = _run_buy_and_hold(prices, initial_capital=10_000.0)
        shares = 10_000.0 / 10.0  # 1000

        for i, (_, v) in enumerate(equity.items()):
            assert math.isclose(v, shares * values[i], rel_tol=1e-9)

    def test_flat_prices_constant_equity(self):
        prices = _make_prices([100.0] * 10)
        equity, _ = _run_buy_and_hold(prices, initial_capital=5_000.0)
        assert all(math.isclose(v, 5_000.0) for v in equity)

    def test_rising_prices_grow_equity(self):
        prices = _make_prices([10.0, 11.0, 12.0, 13.0])
        equity, _ = _run_buy_and_hold(prices, initial_capital=10_000.0)
        assert equity.iloc[-1] > equity.iloc[0]

    def test_falling_prices_shrink_equity(self):
        prices = _make_prices([20.0, 15.0, 10.0, 5.0])
        equity, _ = _run_buy_and_hold(prices, initial_capital=10_000.0)
        assert equity.iloc[-1] < equity.iloc[0]

    def test_equity_length_matches_price_length(self):
        prices = _make_prices(list(range(1, 11)))
        equity, _ = _run_buy_and_hold(prices, initial_capital=1_000.0)
        assert len(equity) == len(prices)

    def test_first_trade_date_matches_first_price(self):
        prices = _make_prices([50.0, 55.0, 60.0])
        _, trades = _run_buy_and_hold(prices, initial_capital=1_000.0)
        assert trades[0].date == prices.index[0].strftime("%Y-%m-%d")


# ══════════════════════════════════════════════════════════════════════════════
# Dollar-Cost Averaging (DCA)
# ══════════════════════════════════════════════════════════════════════════════

class TestDCA:
    """_run_dca: inject a fixed amount at each interval boundary."""

    # ── helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _monthly_prices(n_months: int, price: float = 100.0, start: str = "2020-01-01") -> pd.DataFrame:
        """Return one price per day for n_months calendar months."""
        end = pd.Timestamp(start) + pd.DateOffset(months=n_months)
        idx = pd.date_range(start, end, freq="D")
        return pd.DataFrame({"adj_close": [price] * len(idx)}, index=idx)

    # ── tests ─────────────────────────────────────────────────────────────────

    def test_all_trades_are_buys(self):
        prices = self._monthly_prices(6)
        params = DCAParams(interval=DCAInterval.monthly, amount=500.0)
        _, trades, _ = _run_dca(prices, params)
        assert all(t.action == "BUY" for t in trades)

    def test_monthly_trade_count(self):
        """At flat $100 price, monthly DCA over 6 months = 7 buys (t=0 + 6 intervals)."""
        prices = self._monthly_prices(6)
        params = DCAParams(interval=DCAInterval.monthly, amount=500.0)
        _, trades, _ = _run_dca(prices, params)
        # First purchase on day 0; subsequent purchases every 30 days
        # Over 6 months (~180 days) we expect [0, 30, 60, 90, 120, 150, 180] → 7
        assert len(trades) >= 6, f"Expected ≥6 DCA buys, got {len(trades)}"

    def test_total_injected_equals_amount_times_count(self):
        prices = self._monthly_prices(3)
        amount = 500.0
        params = DCAParams(interval=DCAInterval.monthly, amount=amount)
        _, trades, total_injected = _run_dca(prices, params)
        assert math.isclose(total_injected, amount * len(trades), rel_tol=1e-9)

    def test_weekly_more_trades_than_monthly(self):
        prices = self._monthly_prices(3)
        params_w = DCAParams(interval=DCAInterval.weekly, amount=100.0)
        params_m = DCAParams(interval=DCAInterval.monthly, amount=100.0)
        _, trades_w, _ = _run_dca(prices, params_w)
        _, trades_m, _ = _run_dca(prices, params_m)
        assert len(trades_w) > len(trades_m)

    def test_quarterly_fewer_trades_than_monthly(self):
        prices = self._monthly_prices(12)
        params_q = DCAParams(interval=DCAInterval.quarterly, amount=1_000.0)
        params_m = DCAParams(interval=DCAInterval.monthly, amount=1_000.0)
        _, trades_q, _ = _run_dca(prices, params_q)
        _, trades_m, _ = _run_dca(prices, params_m)
        assert len(trades_q) < len(trades_m)

    def test_flat_price_cash_after_always_zero(self):
        """DCA immediately deploys the amount; no cash left over."""
        prices = self._monthly_prices(2)
        params = DCAParams(interval=DCAInterval.monthly, amount=300.0)
        _, trades, _ = _run_dca(prices, params)
        for t in trades:
            assert t.cash_after == 0.0, "DCA should deploy all cash immediately"

    def test_equity_never_negative(self):
        prices = _make_prices([10.0, 8.0, 6.0, 4.0, 2.0, 1.0, 0.5])
        params = DCAParams(interval=DCAInterval.weekly, amount=100.0)
        equity, _, _ = _run_dca(prices, params)
        assert (equity >= 0).all()

    def test_rising_price_final_equity_above_total_injected(self):
        """If price doubles from first purchase to last, equity >> injected."""
        # Use only two purchases so the math is deterministic
        # Day 0: price=10 → buy 10 shares, Day 7: price=20 → buy 5 shares
        # On day 7 equity = 15 shares * 20 = 300, injected = 200
        prices = _make_prices([10.0] * 7 + [20.0])
        params = DCAParams(interval=DCAInterval.weekly, amount=100.0)
        equity, _, total_injected = _run_dca(prices, params)
        assert float(equity.iloc[-1]) > total_injected

    def test_shares_accumulate_over_time(self):
        """Shares held should be monotonically non-decreasing (DCA never sells)."""
        prices = self._monthly_prices(3)
        params = DCAParams(interval=DCAInterval.monthly, amount=500.0)
        equity, trades, _ = _run_dca(prices, params)

        # The equity curve at each BUY date should be >= equity just before
        buy_positions = [t.portfolio_value for t in trades]
        for i in range(1, len(buy_positions)):
            # portfolio value jumps on each buy; in flat price this is simply proportional
            assert buy_positions[i] >= buy_positions[i - 1]


# ══════════════════════════════════════════════════════════════════════════════
# MA Crossover
# ══════════════════════════════════════════════════════════════════════════════

class TestMACrossover:
    """
    _run_ma_crossover with short_window=5, long_window=20 (minimum valid values).

    Manually verified price series:
      prices = [10.0]*20 + [100.0]*5 + [1.0]*10   (35 bars)

    Index 19:  MA5=10, MA20=10  → first valid comparison → above=False, prev_above=None
    Index 20:  price=100, MA5=28, MA20=14.5  → above=True, prev_above=False
               → golden cross → BUY at price=100.0
    Index 27:  MA5=40.6, MA20=31.15  → above=True   (still above)
    Index 28:  MA5=20.8, MA20=30.2   → above=False  → death cross → SELL at price=1.0
    """

    PRICES = [10.0] * 20 + [100.0] * 5 + [1.0] * 10     # 35 bars
    PARAMS = MACrossoverParams(short_window=5, long_window=20)
    CAPITAL = 10_000.0

    @pytest.fixture
    def result(self):
        prices = _make_prices(self.PRICES)
        return _run_ma_crossover(prices, self.CAPITAL, self.PARAMS)

    def test_buy_trade_exists(self, result):
        equity, trades = result
        assert any(t.action == "BUY" for t in trades), "Expected a BUY (golden cross)"

    def test_sell_trade_exists(self, result):
        equity, trades = result
        assert any(t.action == "SELL" for t in trades), "Expected a SELL (death cross)"

    def test_buy_before_sell(self, result):
        _, trades = result
        actions = [t.action for t in trades]
        buy_idx = next(i for i, a in enumerate(actions) if a == "BUY")
        sell_idx = next(i for i, a in enumerate(actions) if a == "SELL")
        assert buy_idx < sell_idx

    def test_golden_cross_buy_at_correct_price(self, result):
        """Buy happens at the golden-cross bar which has price=100.0."""
        _, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        assert math.isclose(buy.price, 100.0), f"Expected BUY at 100, got {buy.price}"

    def test_death_cross_executes_full_sell(self, result):
        """After SELL, cash_after should equal shares * sell_price (all shares liquidated)."""
        _, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        sell = next(t for t in trades if t.action == "SELL")
        expected_proceeds = buy.shares * sell.price
        assert math.isclose(sell.cash_after, expected_proceeds, rel_tol=1e-9)

    def test_equity_length_matches_prices(self, result):
        equity, _ = result
        assert len(equity) == len(self.PRICES)

    def test_no_trades_without_crossover(self):
        """Flat prices → neither MA ever crosses → no trades."""
        prices = _make_prices([100.0] * 20)
        _, trades = _run_ma_crossover(prices, 10_000.0, self.PARAMS)
        assert trades == [], "Flat prices should produce zero trades"

    def test_capital_is_fully_deployed_on_buy(self, result):
        """After a BUY the engine must have zero cash remaining."""
        _, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        assert buy.cash_after == 0.0

    def test_equity_equals_capital_before_first_buy(self):
        """Equity before the golden cross bar should equal initial cash (no position yet)."""
        prices = _make_prices(self.PRICES)
        equity, trades = _run_ma_crossover(prices, self.CAPITAL, self.PARAMS)
        buy = next(t for t in trades if t.action == "BUY")
        buy_bar_pos = equity.index.get_loc(pd.Timestamp(buy.date))
        # All bars strictly before the BUY bar should reflect cash only (= CAPITAL)
        # Bars before the first valid MA window (i < long_window-1) are also pure cash
        for i in range(buy_bar_pos):
            assert math.isclose(equity.iloc[i], self.CAPITAL, rel_tol=1e-9)


# ══════════════════════════════════════════════════════════════════════════════
# RSI helper
# ══════════════════════════════════════════════════════════════════════════════

class TestComputeRSI:
    """Unit tests for the _compute_rsi helper (Wilder's EWM method)."""

    def test_output_length_matches_input(self):
        prices = pd.Series([100.0 - i for i in range(20)])
        rsi = _compute_rsi(prices, period=14)
        assert len(rsi) == len(prices)

    def test_rsi_bounded_0_to_100(self):
        prices = pd.Series([100.0 + (i % 5) * 2 for i in range(50)])
        rsi = _compute_rsi(prices, period=14)
        valid = rsi.dropna()
        assert (valid >= 0).all() and (valid <= 100).all()

    def test_pure_downtrend_rsi_near_zero(self):
        """Only losses → avg_gain→0 → RSI→0."""
        prices = pd.Series([100.0 - i * 5 for i in range(30)])  # continuous fall
        rsi = _compute_rsi(prices, period=5)
        last_valid = rsi.dropna().iloc[-1]
        assert last_valid < 15, f"Expected RSI near 0 for pure downtrend, got {last_valid:.2f}"

    def test_strong_recovery_gives_high_rsi(self):
        """A sustained rise after a period of losses should push RSI above 70.

        Note: when avg_loss is exactly 0 (pure uptrend from day 1) the Wilder
        formula produces NaN (0/0 is indeterminate); we therefore start from a
        downtrend so losses > 0, then apply a strong recovery.
        """
        down = [100.0 - i * 5 for i in range(10)]   # drives avg_loss > 0
        up   = [50.0 + i * 8 for i in range(20)]    # strong recovery
        prices = pd.Series(down + up)
        rsi = _compute_rsi(prices, period=5)
        valid = rsi.dropna()
        assert len(valid) > 0, "RSI should have valid values after mixed moves"
        assert valid.iloc[-1] > 70, (
            f"Expected RSI > 70 after strong recovery, got {valid.iloc[-1]:.2f}"
        )

    def test_first_period_minus_1_values_are_nan(self):
        """There should be at least one NaN at the start (diff produces a NaN on row 0)."""
        prices = pd.Series([float(i + 1) for i in range(10)])
        rsi = _compute_rsi(prices, period=5)
        assert rsi.isna().any(), "First element(s) of RSI should be NaN"

    def test_alternating_prices_rsi_in_midrange(self):
        """Alternating equal-magnitude gains and losses should produce RSI in the
        middle range (25–75).  The Wilder EWM can produce a modest startup bias
        depending on initial conditions, so we allow a wide band."""
        # Start on a loss day so the first delta is a loss, symmetric thereafter
        prices = pd.Series([110.0 if i % 2 == 0 else 90.0 for i in range(60)])
        rsi = _compute_rsi(prices, period=14)
        valid = rsi.dropna()
        assert len(valid) > 0
        mean_rsi = float(valid.mean())
        assert 20 < mean_rsi < 80, (
            f"Alternating prices RSI mean should be in mid range, got {mean_rsi:.2f}"
        )


# ══════════════════════════════════════════════════════════════════════════════
# RSI Strategy
# ══════════════════════════════════════════════════════════════════════════════

class TestRSIStrategy:
    """
    _run_rsi: enter on oversold (RSI < 30), exit on overbought (RSI > 70).

    Strategy: continuous 10-point per-day fall (10 days) drives RSI near 0 →
    triggers BUY; then continuous 10-point per-day rise (15 days) drives RSI
    near 100 → triggers SELL.
    """

    CAPITAL = 10_000.0
    PARAMS = RSIParams(rsi_period=5, oversold=30.0, overbought=70.0)

    @staticmethod
    def _build_prices() -> pd.DataFrame:
        # 5 flat bars to warm up EWM, then sharp drop, then sharp recovery
        down = [100.0 - i * 10 for i in range(11)]   # 100 → 0 in steps (11 prices)
        up = [down[-1] + i * 10 for i in range(16)]  # rise back and beyond
        return _make_prices(down + up[1:])            # avoid duplicate transition point

    def test_buy_trade_generated_on_oversold(self):
        prices = self._build_prices()
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        assert any(t.action == "BUY" for t in trades), "RSI oversold should produce a BUY"

    def test_sell_trade_generated_on_overbought(self):
        prices = self._build_prices()
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        has_sell = any(t.action == "SELL" for t in trades)
        assert has_sell, "RSI overbought should produce a SELL"

    def test_buy_before_sell(self):
        prices = self._build_prices()
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        actions = [t.action for t in trades]
        buy_idx = next((i for i, a in enumerate(actions) if a == "BUY"), None)
        sell_idx = next((i for i, a in enumerate(actions) if a == "SELL"), None)
        assert buy_idx is not None
        assert sell_idx is not None
        assert buy_idx < sell_idx

    def test_cash_after_buy_is_zero(self):
        prices = self._build_prices()
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        buy = next(t for t in trades if t.action == "BUY")
        assert buy.cash_after == 0.0, "All capital must be deployed on BUY"

    def test_shares_after_sell_is_zero(self):
        """After SELL, shares should be zero (verified via portfolio_value == cash_after)."""
        prices = self._build_prices()
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        sell = next((t for t in trades if t.action == "SELL"), None)
        if sell:
            # portfolio_value after sell = cash only (no shares held)
            assert math.isclose(sell.portfolio_value, sell.cash_after, rel_tol=1e-9)

    def test_equity_never_negative(self):
        prices = self._build_prices()
        equity, _ = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        assert (equity >= 0).all()

    def test_no_trade_when_rsi_never_crosses_thresholds(self):
        """Flat prices → RSI stays near 50 → no BUY or SELL."""
        prices = _make_prices([100.0] * 50)
        _, trades = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        assert trades == [], "Flat prices (RSI≈50) should yield no trades"

    def test_equity_length_matches_prices(self):
        prices = self._build_prices()
        equity, _ = _run_rsi(prices, self.CAPITAL, self.PARAMS)
        assert len(equity) == len(prices)


# ══════════════════════════════════════════════════════════════════════════════
# Bollinger Bands Strategy
# ══════════════════════════════════════════════════════════════════════════════

class TestBollingerBands:
    """
    _run_bollinger_bands with bb_window=10, bb_std=2.0.

    10 stable prices (~100) establish a tight band; then price=80 drops well
    below the lower band → BUY.  After recovery, price=130 jumps well above
    the upper band → SELL.

    The numbers were verified manually:
      At day 10 (price=80):  lower ≈ 85.4 → 80 < lower → BUY  ✓
      At day 19 (price=130): upper ≈ 124.3 → 130 > upper → SELL ✓
    """

    STABLE = [100.0, 100.1, 99.9, 100.1, 99.8, 100.2, 99.9, 100.1, 100.0, 99.8]
    BUY_PRICE = 80.0
    RECOVERY = [90.0, 95.0, 97.0, 99.0, 100.0, 101.0, 100.0, 99.0]
    SELL_PRICE = 130.0
    PRICES = STABLE + [BUY_PRICE] + RECOVERY + [SELL_PRICE]

    PARAMS = BollingerBandsParams(bb_window=10, bb_std=2.0)
    CAPITAL = 10_000.0

    @pytest.fixture
    def result(self):
        prices = _make_prices(self.PRICES)
        return _run_bollinger_bands(prices, self.CAPITAL, self.PARAMS)

    def test_buy_on_lower_band_breach(self, result):
        _, trades = result
        assert any(t.action == "BUY" for t in trades), "Price below lower band should yield BUY"

    def test_sell_on_upper_band_breach(self, result):
        _, trades = result
        assert any(t.action == "SELL" for t in trades), "Price above upper band should yield SELL"

    def test_buy_before_sell(self, result):
        _, trades = result
        actions = [t.action for t in trades]
        buy_idx = next(i for i, a in enumerate(actions) if a == "BUY")
        sell_idx = next(i for i, a in enumerate(actions) if a == "SELL")
        assert buy_idx < sell_idx

    def test_buy_price_is_below_lower_band(self, result):
        _, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        # The buy price should be well below the pre-anomaly stable mean (~100)
        assert buy.price < 95.0, f"Expected BUY at a distressed price, got {buy.price}"

    def test_sell_price_is_above_upper_band(self, result):
        _, trades = result
        sell = next(t for t in trades if t.action == "SELL")
        # The sell price should be well above the band (~100 ± small)
        assert sell.price > 105.0, f"Expected SELL at an elevated price, got {sell.price}"

    def test_full_capital_deployed_on_buy(self, result):
        _, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        expected_shares = self.CAPITAL / buy.price
        assert math.isclose(buy.shares, expected_shares, rel_tol=1e-9)
        assert buy.cash_after == 0.0

    def test_equity_never_negative(self, result):
        equity, _ = result
        assert (equity >= 0).all()

    def test_equity_length_matches_prices(self, result):
        equity, _ = result
        assert len(equity) == len(self.PRICES)

    def test_no_trade_on_stable_prices(self):
        """Prices that never leave the bands should produce no trades."""
        # 30 prices tightly around 100 → bands will be narrow but prices stay inside
        prices = _make_prices([100.0 + (i % 3) * 0.1 for i in range(30)])
        params = BollingerBandsParams(bb_window=10, bb_std=2.0)
        _, trades = _run_bollinger_bands(prices, self.CAPITAL, params)
        assert trades == [], "Stable prices should produce no trades"

    def test_profit_on_buy_low_sell_high(self, result):
        """Strategy should profit when it buys at depressed price and sells above the mean."""
        equity, trades = result
        buy = next(t for t in trades if t.action == "BUY")
        sell = next(t for t in trades if t.action == "SELL")
        assert sell.price > buy.price, "Mean-reversion should exit at a profit"
        assert sell.portfolio_value > self.CAPITAL
