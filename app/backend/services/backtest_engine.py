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
    BollingerBandsParams,
    CompareRequest,
    CompareResponse,
    DCAInterval,
    DCAParams,
    EquityPoint,
    MACrossoverParams,
    PerformanceMetrics,
    RSIParams,
    StrategyConfig,
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

    # Calmar Ratio: CAGR / |max_drawdown|
    calmar_ratio = (cagr / abs(max_drawdown)) if abs(max_drawdown) > 1e-9 else 0.0

    # Best / Worst calendar-year return
    best_year: Optional[float] = None
    worst_year: Optional[float] = None
    try:
        yearly = equity.resample("YE").last()
        if len(yearly) >= 2:
            ann_rets = yearly.pct_change().dropna()
            if len(ann_rets) > 0:
                best_year = float(ann_rets.max())
                worst_year = float(ann_rets.min())
    except Exception:
        pass

    # Recovery days: days from trough of max drawdown until equity returns to pre-trough peak
    recovery_days: Optional[int] = None
    try:
        running_peak = equity.cummax()
        drawdown_series = (equity - running_peak) / running_peak
        trough_date = drawdown_series.idxmin()
        peak_at_trough = float(running_peak[trough_date])
        post_trough = equity[trough_date:]
        recovered = post_trough[post_trough >= peak_at_trough * (1 - 1e-9)]
        if len(recovered) > 0:
            recovery_days = (recovered.index[0] - trough_date).days
    except Exception:
        pass

    return PerformanceMetrics(
        total_return=total_return,
        cagr=cagr,
        sharpe_ratio=sharpe_ratio,
        max_drawdown=max_drawdown,
        volatility=volatility,
        calmar_ratio=calmar_ratio,
        best_year=best_year,
        worst_year=worst_year,
        recovery_days=recovery_days,
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


# ── RSI strategy ──────────────────────────────────────────────────────────────

def _compute_rsi(prices: pd.Series, period: int) -> pd.Series:
    """Wilder's RSI using EMA with alpha=1/period (adjust=False)."""
    delta = prices.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))


def _run_rsi(
    prices: pd.DataFrame,
    initial_capital: float,
    params: RSIParams,
) -> Tuple[pd.Series, List[TradeRecord]]:
    """
    RSI Mean-Reversion strategy.
    BUY (all-in) the first bar the RSI drops below the oversold threshold.
    SELL (all-out) the first bar the RSI rises above the overbought threshold.
    No look-ahead: signal and execution share the same close.
    """
    adj = prices["adj_close"]
    rsi_series = _compute_rsi(adj, params.rsi_period)

    cash = initial_capital
    shares = 0.0
    in_market = False
    trades: List[TradeRecord] = []
    equity_values: List[float] = []

    for i, (dt, price) in enumerate(adj.items()):
        price_f = float(price)
        curr_rsi = rsi_series.iloc[i]

        if not math.isnan(curr_rsi):
            # Enter: RSI drops below oversold → all-in
            if not in_market and curr_rsi < params.oversold and cash > 0:
                new_shares = cash / price_f
                shares += new_shares
                cash = 0.0
                in_market = True
                trades.append(TradeRecord(
                    date=dt.strftime("%Y-%m-%d"),
                    action="BUY",
                    price=price_f,
                    shares=new_shares,
                    cash_after=cash,
                    portfolio_value=shares * price_f,
                ))
            # Exit: RSI rises above overbought → all-out
            elif in_market and curr_rsi > params.overbought and shares > 0:
                proceeds = shares * price_f
                old_shares = shares
                cash += proceeds
                shares = 0.0
                in_market = False
                trades.append(TradeRecord(
                    date=dt.strftime("%Y-%m-%d"),
                    action="SELL",
                    price=price_f,
                    shares=old_shares,
                    cash_after=cash,
                    portfolio_value=cash,
                ))

        equity_values.append(cash + shares * price_f)

    equity = pd.Series(equity_values, index=adj.index, dtype=float)
    return equity, trades


# ── Bollinger Bands strategy ──────────────────────────────────────────────────

def _run_bollinger_bands(
    prices: pd.DataFrame,
    initial_capital: float,
    params: BollingerBandsParams,
) -> Tuple[pd.Series, List[TradeRecord]]:
    """
    Bollinger Bands mean-reversion strategy.
    BUY (all-in) when the close drops below the lower band (μ − k·σ).
    SELL (all-out) when the close rises above the upper band (μ + k·σ).
    Execution at the signal bar's close — no look-ahead.
    """
    adj = prices["adj_close"]
    sma = adj.rolling(params.bb_window).mean()
    std = adj.rolling(params.bb_window).std()
    upper = sma + params.bb_std * std
    lower = sma - params.bb_std * std

    cash = initial_capital
    shares = 0.0
    in_market = False
    trades: List[TradeRecord] = []
    equity_values: List[float] = []

    for i, (dt, price) in enumerate(adj.items()):
        price_f = float(price)
        u = upper.iloc[i]
        l = lower.iloc[i]

        if not (math.isnan(u) or math.isnan(l)):
            # Enter: price closes below lower band → oversold, mean-reversion entry
            if not in_market and price_f < l and cash > 0:
                new_shares = cash / price_f
                shares += new_shares
                cash = 0.0
                in_market = True
                trades.append(TradeRecord(
                    date=dt.strftime("%Y-%m-%d"),
                    action="BUY",
                    price=price_f,
                    shares=new_shares,
                    cash_after=cash,
                    portfolio_value=shares * price_f,
                ))
            # Exit: price closes above upper band → overbought, take profit
            elif in_market and price_f > u and shares > 0:
                proceeds = shares * price_f
                old_shares = shares
                cash += proceeds
                shares = 0.0
                in_market = False
                trades.append(TradeRecord(
                    date=dt.strftime("%Y-%m-%d"),
                    action="SELL",
                    price=price_f,
                    shares=old_shares,
                    cash_after=cash,
                    portfolio_value=cash,
                ))

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

    elif request.strategy == StrategyType.rsi:
        rsi_p = RSIParams(**params)
        if len(prices) < rsi_p.rsi_period * 3:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Not enough data for RSI-{rsi_p.rsi_period}. "
                    f"Only {len(prices)} data points available."
                ),
            )
        equity, trades = _run_rsi(prices, request.initial_capital, rsi_p)

    elif request.strategy == StrategyType.bollinger_bands:
        bb_p = BollingerBandsParams(**params)
        if len(prices) < bb_p.bb_window * 2:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Not enough data for Bollinger Bands with window {bb_p.bb_window}. "
                    f"Only {len(prices)} data points available."
                ),
            )
        equity, trades = _run_bollinger_bands(prices, request.initial_capital, bb_p)

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


def _run_single_strategy(
    strategy_cfg: StrategyConfig,
    prices: pd.DataFrame,
    initial_capital: float,
    symbol: str,
    security_name: Optional[str],
    date_from: str,
    date_to: str,
) -> BacktestResponse:
    """Run one strategy config against already-fetched prices."""
    params = strategy_cfg.strategy_params or {}
    total_invested = initial_capital

    if strategy_cfg.strategy == StrategyType.buy_and_hold:
        equity, trades = _run_buy_and_hold(prices, initial_capital)

    elif strategy_cfg.strategy == StrategyType.dca:
        dca_p = DCAParams(**params)
        equity, trades, total_invested = _run_dca(prices, dca_p)

    elif strategy_cfg.strategy == StrategyType.ma_crossover:
        ma_p = MACrossoverParams(**params)
        equity, trades = _run_ma_crossover(prices, initial_capital, ma_p)

    elif strategy_cfg.strategy == StrategyType.rsi:
        rsi_p = RSIParams(**params)
        equity, trades = _run_rsi(prices, initial_capital, rsi_p)

    elif strategy_cfg.strategy == StrategyType.bollinger_bands:
        bb_p = BollingerBandsParams(**params)
        equity, trades = _run_bollinger_bands(prices, initial_capital, bb_p)

    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Unknown strategy.")

    metrics = _compute_metrics(equity, trades, total_invested)
    equity_curve = [
        EquityPoint(date=dt.strftime("%Y-%m-%d"), value=round(float(v), 2))
        for dt, v in equity.items()
    ]
    return BacktestResponse(
        symbol=symbol.upper(),
        security_name=security_name,
        strategy=strategy_cfg.strategy.value,
        date_from=date_from,
        date_to=date_to,
        initial_capital=initial_capital,
        total_invested=round(total_invested, 2),
        final_value=round(float(equity.iloc[-1]), 2),
        equity_curve=equity_curve,
        metrics=metrics,
        trades=trades,
    )


def run_compare(request: CompareRequest) -> CompareResponse:
    """Fetch prices once, run each strategy, return all results."""
    prices = _fetch_prices(request.symbol, request.date_from, request.date_to)
    security_name = _fetch_security_name(request.symbol, request.date_from, request.date_to)

    if prices.empty or len(prices) < 2:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail="Not enough price data in the selected date range.",
        )

    results = [
        _run_single_strategy(
            cfg, prices, request.initial_capital,
            request.symbol, security_name,
            request.date_from, request.date_to,
        )
        for cfg in request.strategies
    ]

    return CompareResponse(
        symbol=request.symbol.upper(),
        security_name=security_name,
        date_from=request.date_from,
        date_to=request.date_to,
        initial_capital=request.initial_capital,
        results=results,
    )


def run_portfolio_backtest(request) -> "PortfolioBacktestResponse":
    """
    Run a multi-symbol portfolio backtest.

    Steps:
    1. Fetch price data for all holdings.
    2. Restrict to the strict date intersection across all symbols.
    3. For each period (single period if no rebalancing; one period per rebalance boundary otherwise):
       a. Allocate capital proportionally by weight.
       b. Run the strategy for that sub-period.
       c. Collect equity curves and trades.
    4. Sum holding equity curves to produce portfolio equity curve.
    5. Compute portfolio-level metrics from the summed curve.
    6. Return PortfolioBacktestResponse.
    """
    from schemas.backtest import (
        PortfolioBacktestResponse, PortfolioHoldingResult,
        StrategyConfig, StrategyType, DCAParams, MACrossoverParams,
        RSIParams, BollingerBandsParams, DCAInterval, EquityPoint
    )
    from fastapi import HTTPException

    date_from = request.date_from
    date_to = request.date_to
    initial_capital = request.initial_capital
    strategy = request.strategy
    params = request.strategy_params or {}

    # Fetch all price data
    all_prices: dict[str, pd.DataFrame] = {}
    security_names: dict[str, Optional[str]] = {}
    for h in request.holdings:
        sym = h.symbol.upper()
        df = _fetch_prices(sym, date_from, date_to)
        if df.empty or len(df) < 2:
            raise HTTPException(
                status_code=422,
                detail=f"Not enough price data for symbol '{sym}' in the selected date range.",
            )
        all_prices[sym] = df
        security_names[sym] = _fetch_security_name(sym, date_from, date_to)

    # Compute strict date intersection
    common_index = None
    for df in all_prices.values():
        idx = df.index
        if common_index is None:
            common_index = idx
        else:
            common_index = common_index.intersection(idx)

    if common_index is None or len(common_index) < 2:
        raise HTTPException(
            status_code=422,
            detail="Not enough overlapping trading days across the selected symbols.",
        )

    # Restrict all price series to common dates
    for sym in all_prices:
        all_prices[sym] = all_prices[sym].loc[common_index]

    # Determine actual date range after intersection
    actual_from = common_index[0].strftime("%Y-%m-%d")
    actual_to = common_index[-1].strftime("%Y-%m-%d")

    # ── Run strategies ─────────────────────────────────────────────────────────
    def run_one_holding(sym: str, prices_df: pd.DataFrame, capital: float) -> tuple:
        """Returns (equity_series, trades, total_invested_for_holding)."""
        total_inv = capital
        if strategy == StrategyType.buy_and_hold:
            eq, tr = _run_buy_and_hold(prices_df, capital)
        elif strategy == StrategyType.dca:
            dca_p = DCAParams(**params)
            eq, tr, total_inv = _run_dca(prices_df, dca_p)
        elif strategy == StrategyType.ma_crossover:
            ma_p = MACrossoverParams(**params)
            eq, tr = _run_ma_crossover(prices_df, capital, ma_p)
        elif strategy == StrategyType.rsi:
            rsi_p = RSIParams(**params)
            eq, tr = _run_rsi(prices_df, capital, rsi_p)
        elif strategy == StrategyType.bollinger_bands:
            bb_p = BollingerBandsParams(**params)
            eq, tr = _run_bollinger_bands(prices_df, capital, bb_p)
        else:
            raise HTTPException(status_code=400, detail="Unknown strategy.")
        return eq, tr, total_inv

    # ── No rebalancing case ────────────────────────────────────────────────────
    if not request.rebalance:
        holding_equities: dict[str, pd.Series] = {}
        holding_trades: dict[str, list] = {}
        holding_total_invested: dict[str, float] = {}

        for h in request.holdings:
            sym = h.symbol.upper()
            allocated = initial_capital * h.weight
            eq, tr, ti = run_one_holding(sym, all_prices[sym], allocated)
            holding_equities[sym] = eq
            holding_trades[sym] = tr
            holding_total_invested[sym] = ti

        portfolio_equity = sum(holding_equities.values())

    # ── Rebalancing case ───────────────────────────────────────────────────────
    else:
        interval = request.rebalance_interval
        if interval is None:
            interval_str = "monthly"
        else:
            interval_str = interval.value if hasattr(interval, "value") else str(interval)

        freq = "MS" if interval_str == "monthly" else "QS"

        period_starts = pd.date_range(
            start=common_index[0],
            end=common_index[-1],
            freq=freq,
        )
        period_starts = period_starts.union([common_index[0]])
        period_starts = period_starts[period_starts <= common_index[-1]]

        boundaries = sorted(set(period_starts.tolist() + [common_index[-1] + pd.Timedelta(days=1)]))

        holding_equities_parts: dict[str, list] = {h.symbol.upper(): [] for h in request.holdings}
        holding_trades_all: dict[str, list] = {h.symbol.upper(): [] for h in request.holdings}
        holding_total_invested_acc: dict[str, float] = {h.symbol.upper(): 0.0 for h in request.holdings}

        current_capital: dict[str, float] = {
            h.symbol.upper(): initial_capital * h.weight for h in request.holdings
        }

        for period_idx in range(len(boundaries) - 1):
            period_start = boundaries[period_idx]
            period_end = boundaries[period_idx + 1] - pd.Timedelta(days=1)

            mask = (common_index >= period_start) & (common_index <= period_end)
            sub_index = common_index[mask]
            if len(sub_index) < 1:
                continue

            sub_prices: dict[str, pd.DataFrame] = {
                sym: all_prices[sym].loc[sub_index] for sym in all_prices
            }

            if period_idx > 0:
                total_value = sum(current_capital.values())
                for h in request.holdings:
                    sym = h.symbol.upper()
                    current_capital[sym] = total_value * h.weight

            for h in request.holdings:
                sym = h.symbol.upper()
                if len(sub_prices[sym]) < 1:
                    continue
                eq, tr, ti = run_one_holding(sym, sub_prices[sym], current_capital[sym])
                holding_equities_parts[sym].append(eq)
                holding_trades_all[sym].extend(tr)
                holding_total_invested_acc[sym] += ti
                current_capital[sym] = float(eq.iloc[-1])

        holding_equities = {}
        holding_trades = {}
        holding_total_invested = {}
        for h in request.holdings:
            sym = h.symbol.upper()
            parts = holding_equities_parts[sym]
            if parts:
                holding_equities[sym] = pd.concat(parts)
            else:
                holding_equities[sym] = pd.Series(
                    [initial_capital * h.weight] * len(common_index),
                    index=common_index,
                )
            holding_trades[sym] = holding_trades_all[sym]
            holding_total_invested[sym] = holding_total_invested_acc[sym]

        portfolio_equity = sum(holding_equities.values())

    # ── Build results ──────────────────────────────────────────────────────────
    portfolio_total_invested = sum(holding_total_invested.values())
    portfolio_metrics = _compute_metrics(portfolio_equity, [], portfolio_total_invested)

    portfolio_equity_curve = [
        EquityPoint(date=dt.strftime("%Y-%m-%d"), value=round(float(v), 2))
        for dt, v in portfolio_equity.items()
    ]

    holding_results = []
    for h in request.holdings:
        sym = h.symbol.upper()
        eq = holding_equities[sym]
        h_metrics = _compute_metrics(eq, holding_trades[sym], holding_total_invested[sym])
        h_equity_curve = [
            EquityPoint(date=dt.strftime("%Y-%m-%d"), value=round(float(v), 2))
            for dt, v in eq.items()
        ]
        holding_results.append(PortfolioHoldingResult(
            symbol=sym,
            security_name=security_names[sym],
            weight=h.weight,
            allocated_capital=round(initial_capital * h.weight, 2),
            final_value=round(float(eq.iloc[-1]), 2),
            total_invested=round(holding_total_invested[sym], 2),
            equity_curve=h_equity_curve,
            metrics=h_metrics,
        ))

    return PortfolioBacktestResponse(
        date_from=actual_from,
        date_to=actual_to,
        initial_capital=initial_capital,
        strategy=strategy.value if hasattr(strategy, "value") else str(strategy),
        rebalance=request.rebalance,
        rebalance_interval=request.rebalance_interval.value if request.rebalance_interval else None,
        portfolio_equity_curve=portfolio_equity_curve,
        portfolio_metrics=portfolio_metrics,
        portfolio_final_value=round(float(portfolio_equity.iloc[-1]), 2),
        portfolio_total_invested=round(portfolio_total_invested, 2),
        holdings=holding_results,
    )
