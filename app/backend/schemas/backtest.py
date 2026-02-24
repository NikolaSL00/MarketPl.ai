"""Pydantic schemas for backtest configuration and results."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class StrategyType(str, Enum):
    buy_and_hold = "buy_and_hold"
    dca = "dca"
    ma_crossover = "ma_crossover"
    rsi = "rsi"
    bollinger_bands = "bollinger_bands"


class BuyAndHoldParams(BaseModel):
    """No additional parameters needed for Buy & Hold."""
    pass


class DCAInterval(str, Enum):
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"


class DCAParams(BaseModel):
    """Dollar-Cost Averaging parameters."""
    interval: DCAInterval = Field(
        default=DCAInterval.monthly,
        description="Investment frequency: weekly, monthly, or quarterly",
    )
    amount: float = Field(
        gt=0,
        description="Fixed dollar amount to invest each period",
        examples=[500.0],
    )


class MACrossoverParams(BaseModel):
    """Moving Average Crossover parameters."""
    short_window: int = Field(
        default=50,
        ge=5,
        le=200,
        description="Short-term moving average window (days)",
    )
    long_window: int = Field(
        default=200,
        ge=20,
        le=500,
        description="Long-term moving average window (days)",
    )


class RSIParams(BaseModel):
    """RSI momentum / mean-reversion parameters."""
    rsi_period: int = Field(
        default=14,
        ge=2,
        le=100,
        description="Lookback period for RSI calculation (days)",
    )
    oversold: float = Field(
        default=30.0,
        ge=5.0,
        le=49.0,
        description="RSI level below which the asset is considered oversold → BUY signal",
    )
    overbought: float = Field(
        default=70.0,
        ge=51.0,
        le=95.0,
        description="RSI level above which the asset is considered overbought → SELL signal",
    )


class BollingerBandsParams(BaseModel):
    """Bollinger Bands mean-reversion parameters."""
    bb_window: int = Field(
        default=20,
        ge=5,
        le=200,
        description="Rolling window for band calculation (days)",
    )
    bb_std: float = Field(
        default=2.0,
        ge=0.5,
        le=4.0,
        description="Number of standard deviations for the upper/lower bands",
    )


class BacktestRequest(BaseModel):
    """Request payload to run a backtest simulation."""
    symbol: str = Field(description="Stock/ETF ticker symbol, e.g. AAPL", examples=["AAPL"])
    date_from: str = Field(description="Start date in ISO format (YYYY-MM-DD)", examples=["2015-01-01"])
    date_to: str = Field(description="End date in ISO format (YYYY-MM-DD)", examples=["2020-12-31"])
    initial_capital: float = Field(gt=0, description="Starting capital in USD", examples=[10000.0])
    strategy: StrategyType = Field(description="Strategy type to simulate")
    strategy_params: Optional[dict] = Field(
        default=None,
        description=(
            "Strategy-specific parameters. "
            "For buy_and_hold: {} or null. "
            "For dca: {interval, amount}. "
            "For ma_crossover: {short_window, long_window}."
        ),
    )

    model_config = {"json_schema_extra": {
        "examples": [{
            "symbol": "AAPL",
            "date_from": "2015-01-01",
            "date_to": "2020-12-31",
            "initial_capital": 10000,
            "strategy": "buy_and_hold",
            "strategy_params": None,
        }]
    }}


# ── Result shapes ────────────────────────────────────────────────────────────

class EquityPoint(BaseModel):
    """One point on the portfolio equity curve."""
    date: str          # YYYY-MM-DD
    value: float       # Portfolio USD value


class TradeRecord(BaseModel):
    """A single executed trade."""
    date: str          # YYYY-MM-DD
    action: str        # "BUY" | "SELL"
    price: float       # Execution price (adj_close)
    shares: float      # Shares transacted
    cash_after: float  # Remaining cash after trade
    portfolio_value: float


class PerformanceMetrics(BaseModel):
    total_return: float        # Arithmetic return as a fraction, e.g. 0.423 = 42.3 %
    cagr: float                # Compound annual growth rate as a fraction
    sharpe_ratio: float        # Annualised Sharpe (rf = 0)
    max_drawdown: float        # Most negative drawdown fraction, e.g. -0.32
    volatility: float          # Annualised daily-return std dev
    calmar_ratio: float        # CAGR / |max_drawdown| — return per unit of worst pain
    best_year: Optional[float] # Highest single-calendar-year return
    worst_year: Optional[float]# Lowest single-calendar-year return
    recovery_days: Optional[int] # Days from max-drawdown trough to full recovery (None if not yet)
    win_rate: Optional[float]  # Fraction of profitable closed trades (None for B&H)
    profit_factor: Optional[float]  # Gross profit / gross loss (None if no losses)
    time_in_market: float      # Fraction of days where shares > 0


class BacktestResponse(BaseModel):
    """Full backtest result returned by the engine."""
    symbol: str
    security_name: Optional[str] = None
    strategy: str
    date_from: str
    date_to: str
    initial_capital: float
    total_invested: float   # equals initial_capital for B&H/MA; actual injected sum for DCA
    final_value: float
    equity_curve: List[EquityPoint]
    metrics: PerformanceMetrics
    trades: List[TradeRecord]


class SymbolDateRangeResponse(BaseModel):
    """Min/max date available for a given symbol."""
    symbol: str
    min_date: str
    max_date: str
    data_points: int


# ── Compare shapes ───────────────────────────────────────────────────────────

class StrategyConfig(BaseModel):
    """One strategy entry in a compare request."""
    strategy: StrategyType
    strategy_params: Optional[dict] = Field(default=None)


class CompareRequest(BaseModel):
    """Request to run multiple strategies on the same dataset."""
    symbol: str = Field(description="Stock/ETF ticker symbol", examples=["AAPL"])
    date_from: str = Field(description="Start date YYYY-MM-DD")
    date_to: str = Field(description="End date YYYY-MM-DD")
    initial_capital: float = Field(gt=0, description="Starting capital in USD")
    strategies: List[StrategyConfig] = Field(
        min_length=2, max_length=5,
        description="2 to 5 strategies to compare",
    )


class CompareResponse(BaseModel):
    """Multi-strategy comparison result."""
    symbol: str
    security_name: Optional[str] = None
    date_from: str
    date_to: str
    initial_capital: float
    results: List[BacktestResponse]


# ── Portfolio shapes ──────────────────────────────────────────────────────────

class RebalanceInterval(str, Enum):
    monthly = "monthly"
    quarterly = "quarterly"


class PortfolioHolding(BaseModel):
    """One symbol plus its weight in the portfolio."""
    symbol: str = Field(description="Ticker symbol, e.g. AAPL")
    weight: float = Field(gt=0.0, le=1.0, description="Allocation weight as a fraction, e.g. 0.6 = 60%")


class PortfolioBacktestRequest(BaseModel):
    holdings: List[PortfolioHolding] = Field(
        min_length=2, max_length=5,
        description="2–5 portfolio holdings with weights that must sum to 1.0 (±0.01 tolerance)",
    )
    date_from: str = Field(description="Start date YYYY-MM-DD")
    date_to: str = Field(description="End date YYYY-MM-DD")
    initial_capital: float = Field(gt=0, description="Total portfolio starting capital in USD")
    strategy: StrategyType = Field(description="Strategy applied uniformly to all holdings")
    strategy_params: Optional[dict] = Field(default=None, description="Strategy-specific parameters")
    rebalance: bool = Field(default=False, description="Whether to periodically rebalance to target weights")
    rebalance_interval: Optional[RebalanceInterval] = Field(
        default=None,
        description="Rebalance frequency; required when rebalance=True",
    )


class PortfolioHoldingResult(BaseModel):
    """Backtest result for a single holding within the portfolio."""
    symbol: str
    security_name: Optional[str] = None
    weight: float
    allocated_capital: float
    final_value: float
    total_invested: float
    equity_curve: List[EquityPoint]
    metrics: PerformanceMetrics


class PortfolioBacktestResponse(BaseModel):
    """Full portfolio backtest result."""
    date_from: str
    date_to: str
    initial_capital: float
    strategy: str
    rebalance: bool
    rebalance_interval: Optional[str] = None
    portfolio_equity_curve: List[EquityPoint]
    portfolio_metrics: PerformanceMetrics
    portfolio_final_value: float
    portfolio_total_invested: float
    holdings: List[PortfolioHoldingResult]
