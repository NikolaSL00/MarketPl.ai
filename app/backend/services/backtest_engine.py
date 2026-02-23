"""Backtest simulation engine.

Implements Buy & Hold, Dollar-Cost Averaging, and MA Crossover strategies
following the conventions defined in finance-guide:
  - Adjusted Close as primary pricing
  - Strictly chronological data, forward-filled for missing days
  - No look-ahead bias: signals and orders executed at close of signal day
  - Risk-free rate = 0 for Sharpe ratio
  - 64-bit float precision throughout; NaN-safe Sharpe
"""
from __future__ import annotations

import math
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd

from database import stock_prices_collection
from schemas.backtest import (
    BacktestRequest,
    BacktestResponse,
    DCAInterval,
    DCAParams,
    EquityPoint,
    MACrossoverParams,
    PerformanceMetrics,
    StrategyType,
    TradeRecord,
)


# ── Data retrieval ────────────────────────────────────────────────────────────

def _fetch_prices(symbol: str, date_from: str, date_to: str) -> pd.DataFrame:
    """Return a daily adj_close Series indexed by date, forward-filled."""
    d_from = datetime.fromisoformat(date_from)
    d_to = datetime.fromisoformat(date_to)

    cursor = stock_prices_collection.find(
        {
            "symbol": symbol.upper(),
            "date": {"$gte": d_from, "$lte": d_to},
        },
        {"_id": 0, "date": 1, "adj_close": 1},
    ).sort("date", 1)

    rows = list(cursor)
    if not rows:
        return pd.DataFrame(columns=["adj_close"])

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"]).dt.normalize()
    df = df.drop_duplicates("date").set_index("date").sort_index()

    # Forward-fill any missing trading days in the calendar range
    all_days = pd.date_range(df.index[0], df.index[-1], freq="D")
    df = df.reindex(all_days).ffill().dropna()

    return df


def _fetch_security_name(symbol: str, date_from: str, date_to: str) -> Optional[str]:
    """Best-effort security name lookup for display purposes."""
    try:
        d_from = datetime.fromisoformat(date_from)
        d_to = datetime.fromisoformat(date_to)
    except ValueError:
        return None

    doc = stock_prices_collection.find_one(
        {
            "symbol": symbol.upper(),
            "date": {"$gte": d_from, "$lte": d_to},
            "security_name": {"$exists": True, "$ne": ""},
        },
        {"_id": 0, "security_name": 1},
        sort=[("date", 1)],
    )
    if not doc:
        doc = stock_prices_collection.find_one(
            {"symbol": symbol.upper(), "security_name": {"$exists": True, "$ne": ""}},
            {"_id": 0, "security_name": 1},
        )
    return (doc or {}).get("security_name")


# ── Metrics computation ───────────────────────────────────────────────────────

def _compute_metrics(
    equity: pd.Series,
    trades: List[TradeRecord],
    initial_capital: float,
) -> PerformanceMetrics:
    """Compute per-finance-guide performance and risk metrics."""
    v0 = initial_capital
    vf = float(equity.iloc[-1])

    # Total return (arithmetic)
    total_return = (vf - v0) / v0

    # CAGR
    years = (equity.index[-1] - equity.index[0]).days / 365.25
    cagr = (vf / v0) ** (1.0 / years) - 1.0 if years > 0 else 0.0

    # Daily log returns
    log_ret = np.log(equity / equity.shift(1)).dropna()

    # Annualised volatility
    std_daily = float(log_ret.std())
    volatility = std_daily * math.sqrt(252)

    # Sharpe ratio (rf = 0)
    mean_daily = float(log_ret.mean())
    sharpe_ratio = (mean_daily / std_daily * math.sqrt(252)) if std_daily > 1e-12 else 0.0

    # Max drawdown
    running_peak = equity.cummax()
    drawdown = (equity - running_peak) / running_peak
    max_drawdown = float(drawdown.min())

    # Time in market (fraction of days where shares > 0) — approximated via
    # equity != initial_capital once invested (BUY present in trades)
    buy_dates = {t.date for t in trades if t.action == "BUY"}
    sell_dates_map: dict[str, str] = {}
    last_buy: Optional[str] = None
    for t in trades:
        if t.action == "BUY":
            last_buy = t.date
        elif t.action == "SELL" and last_buy:
            sell_dates_map[last_buy] = t.date
            last_buy = None

    if buy_dates:
        # For B&H and DCA we just count days with shares > 0
        # We detect this by checking the equity curve: days where value > cash_threshold
        # Simpler: for B&H all days after first buy; for DCA same; for MA, periods between BUY/SELL
        in_market_days = 0
        total_days = len(equity)
        in_market = False
        sell_set = {t.date for t in trades if t.action == "SELL"}
        buy_list = sorted(buy_dates)
        sell_list = sorted(sell_set)
        for d_str in [d.strftime("%Y-%m-%d") for d in equity.index]:
            if d_str in buy_dates:
                in_market = True
            if d_str in sell_set:
                in_market = False
            if in_market:
                in_market_days += 1
        time_in_market = in_market_days / total_days if total_days > 0 else 0.0
    else:
        time_in_market = 0.0

    # Win rate and profit factor from closed pairs (BUY → SELL)
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None

    buy_price_stack: list[Tuple[float, float]] = []  # (price, shares)
    gross_profit = 0.0
    gross_loss = 0.0
    wins = 0
    total_closed = 0

    for t in trades:
        if t.action == "BUY":
            buy_price_stack.append((t.price, t.shares))
        elif t.action == "SELL" and buy_price_stack:
            bought_price, bought_shares = buy_price_stack.pop(0)
            pnl = (t.price - bought_price) * min(t.shares, bought_shares)
            total_closed += 1
            if pnl > 0:
                wins += 1
                gross_profit += pnl
            else:
                gross_loss += abs(pnl)

    if total_closed > 0:
        win_rate = wins / total_closed
        profit_factor = (gross_profit / gross_loss) if gross_loss > 1e-9 else None

    return PerformanceMetrics(
        total_return=total_return,
        cagr=cagr,
        sharpe_ratio=sharpe_ratio,
        max_drawdown=max_drawdown,
        volatility=volatility,
        win_rate=win_rate,
        profit_factor=profit_factor,
        time_in_market=time_in_market,
    )


# ── Strategy implementations ──────────────────────────────────────────────────

def _run_buy_and_hold(
    prices: pd.DataFrame,
    initial_capital: float,
) -> Tuple[pd.Series, List[TradeRecord]]:
    """Deploy full capital at t₀. No rebalancing or exit."""
    adj = prices["adj_close"]
    t0_price = float(adj.iloc[0])
    shares = initial_capital / t0_price
    cash = 0.0

    trades: List[TradeRecord] = [
        TradeRecord(
            date=adj.index[0].strftime("%Y-%m-%d"),
            action="BUY",
            price=t0_price,
            shares=shares,
            cash_after=cash,
            portfolio_value=shares * t0_price,
        )
    ]

    equity = adj * shares
    return equity, trades


def _dca_interval_days(interval: DCAInterval) -> int:
    """Return approximate calendar days between DCA injections."""
    return {"weekly": 7, "monthly": 30, "quarterly": 91}[interval]


def _run_dca(
    prices: pd.DataFrame,
    params: DCAParams,
) -> Tuple[pd.Series, List[TradeRecord], float]:
    """
    Standard DCA: inject a fresh `amount` at each interval boundary and immediately
    buy shares at the close price.  No capital pool — contributions are new money.
    Returns (equity_series, trades, total_injected).
    """
    adj = prices["adj_close"]
    interval_days = _dca_interval_days(params.interval)

    shares = 0.0
    total_injected = 0.0
    trades: List[TradeRecord] = []
    equity_values: List[float] = []

    last_invest_date: Optional[date] = None

    for dt, price in adj.items():
        current_date = dt.date()
        price_f = float(price)

        invest_now = (last_invest_date is None) or (
            (current_date - last_invest_date).days >= interval_days
        )

        if invest_now:
            # Inject fresh capital and immediately deploy it all
            new_shares = params.amount / price_f
            shares += new_shares
            total_injected += params.amount
            last_invest_date = current_date
            portfolio_value = shares * price_f
            trades.append(TradeRecord(
                date=current_date.strftime("%Y-%m-%d"),
                action="BUY",
                price=price_f,
                shares=new_shares,
                cash_after=0.0,
                portfolio_value=portfolio_value,
            ))

        equity_values.append(shares * price_f)

    equity = pd.Series(equity_values, index=adj.index, dtype=float)
    return equity, trades, total_injected


def _run_ma_crossover(
    prices: pd.DataFrame,
    initial_capital: float,
    params: MACrossoverParams,
) -> Tuple[pd.Series, List[TradeRecord]]:
    """
    Golden Cross / Death Cross strategy.
    BUY when short MA crosses above long MA.
    SELL (exit all) when short MA crosses below long MA.
    Execution at close of the signal day — no look-ahead.
    """
    adj = prices["adj_close"]
    short_ma = adj.rolling(params.short_window).mean()
    long_ma = adj.rolling(params.long_window).mean()

    cash = initial_capital
    shares = 0.0
    trades: List[TradeRecord] = []
    equity_values: List[float] = []

    prev_above: Optional[bool] = None  # was short > long on previous day?

    for i, (dt, price) in enumerate(adj.items()):
        price_f = float(price)
        s = short_ma.iloc[i]
        l = long_ma.iloc[i]

        if not (math.isnan(s) or math.isnan(l)):
            above = s > l

            if prev_above is not None:
                # Golden Cross
                if above and not prev_above and cash > 0:
                    new_shares = cash / price_f
                    shares += new_shares
                    cash = 0.0
                    portfolio_value = shares * price_f
                    trades.append(TradeRecord(
                        date=dt.strftime("%Y-%m-%d"),
                        action="BUY",
                        price=price_f,
                        shares=new_shares,
                        cash_after=cash,
                        portfolio_value=portfolio_value,
                    ))
                # Death Cross
                elif not above and prev_above and shares > 0:
                    proceeds = shares * price_f
                    old_shares = shares
                    cash += proceeds
                    shares = 0.0
                    portfolio_value = cash
                    trades.append(TradeRecord(
                        date=dt.strftime("%Y-%m-%d"),
                        action="SELL",
                        price=price_f,
                        shares=old_shares,
                        cash_after=cash,
                        portfolio_value=portfolio_value,
                    ))
            prev_above = above

        equity_values.append(cash + shares * price_f)

    equity = pd.Series(equity_values, index=adj.index, dtype=float)
    return equity, trades


# ── Public entry point ────────────────────────────────────────────────────────

def run_backtest(request: BacktestRequest) -> BacktestResponse:
    """Fetch data, dispatch to strategy, compute metrics, and return full result."""
    prices = _fetch_prices(request.symbol, request.date_from, request.date_to)
    security_name = _fetch_security_name(request.symbol, request.date_from, request.date_to)

    if prices.empty or len(prices) < 2:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail="Not enough price data in the selected date range.",
        )

    params = request.strategy_params or {}

    total_invested = request.initial_capital  # overridden for DCA below

    if request.strategy == StrategyType.buy_and_hold:
        equity, trades = _run_buy_and_hold(prices, request.initial_capital)

    elif request.strategy == StrategyType.dca:
        dca_p = DCAParams(**params)
        equity, trades, total_invested = _run_dca(prices, dca_p)

    elif request.strategy == StrategyType.ma_crossover:
        ma_p = MACrossoverParams(**params)
        if len(prices) < ma_p.long_window:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Not enough data for a {ma_p.long_window}-day long MA. "
                    f"Only {len(prices)} data points available."
                ),
            )
        equity, trades = _run_ma_crossover(prices, request.initial_capital, ma_p)

    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Unknown strategy.")

    metrics = _compute_metrics(equity, trades, total_invested)

    equity_curve = [
        EquityPoint(date=dt.strftime("%Y-%m-%d"), value=round(float(v), 2))
        for dt, v in equity.items()
    ]

    return BacktestResponse(
        symbol=request.symbol.upper(),
        security_name=security_name,
        strategy=request.strategy.value,
        date_from=request.date_from,
        date_to=request.date_to,
        initial_capital=request.initial_capital,
        total_invested=round(total_invested, 2),
        final_value=round(float(equity.iloc[-1]), 2),
        equity_curve=equity_curve,
        metrics=metrics,
        trades=trades,
    )
