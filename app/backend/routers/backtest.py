"""Router for backtest configuration and execution."""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from database import stock_prices_collection
from schemas.backtest import (
    BacktestRequest,
    BacktestResponse,
    BollingerBandsParams,
    CompareRequest,
    CompareResponse,
    DCAParams,
    MACrossoverParams,
    PortfolioBacktestRequest,
    PortfolioBacktestResponse,
    RSIParams,
    StrategyType,
    SymbolDateRangeResponse,
)
from services import backtest_engine

router = APIRouter(prefix="/api/backtest", tags=["backtest"])


def _validate_strategy_params(request: BacktestRequest) -> None:
    """Validate strategy-specific parameters match the chosen strategy."""
    params = request.strategy_params or {}

    if request.strategy == StrategyType.dca:
        try:
            DCAParams(**params)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid DCA parameters: {exc}",
            )
    elif request.strategy == StrategyType.ma_crossover:
        try:
            parsed = MACrossoverParams(**params)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid MA Crossover parameters: {exc}",
            )
        if parsed.short_window >= parsed.long_window:
            raise HTTPException(
                status_code=422,
                detail="short_window must be less than long_window.",
            )


@router.post("", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest):
    """Run a backtest simulation using the backtest engine."""
    # Validate dates
    try:
        date_from = datetime.fromisoformat(request.date_from)
        date_to = datetime.fromisoformat(request.date_to)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    if date_from >= date_to:
        raise HTTPException(status_code=422, detail="date_from must be before date_to.")

    # Validate symbol exists
    count = stock_prices_collection.count_documents({"symbol": request.symbol.upper()})
    if count == 0:
        raise HTTPException(status_code=404, detail=f"No data found for symbol '{request.symbol}'.")

    # Validate strategy params
    _validate_strategy_params(request)

    # Run the simulation
    return backtest_engine.run_backtest(request)


@router.post("/compare", response_model=CompareResponse)
def run_compare(request: CompareRequest):
    """Run multiple strategies on the same dataset and return compared results."""
    # Validate dates
    try:
        date_from = datetime.fromisoformat(request.date_from)
        date_to = datetime.fromisoformat(request.date_to)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    if date_from >= date_to:
        raise HTTPException(status_code=422, detail="date_from must be before date_to.")

    if len(request.strategies) < 2:
        raise HTTPException(status_code=422, detail="At least 2 strategies required for comparison.")

    # Validate symbol exists
    count = stock_prices_collection.count_documents({"symbol": request.symbol.upper()})
    if count == 0:
        raise HTTPException(status_code=404, detail=f"No data found for symbol '{request.symbol}'.")

    # Validate each strategy's params
    for cfg in request.strategies:
        bare = BacktestRequest(
            symbol=request.symbol,
            date_from=request.date_from,
            date_to=request.date_to,
            initial_capital=request.initial_capital,
            strategy=cfg.strategy,
            strategy_params=cfg.strategy_params,
        )
        _validate_strategy_params(bare)

    return backtest_engine.run_compare(request)


@router.post("/portfolio", response_model=PortfolioBacktestResponse)
def run_portfolio_backtest(request: PortfolioBacktestRequest):
    """Run a multi-symbol portfolio backtest with optional rebalancing."""
    from datetime import datetime

    # Validate dates
    try:
        date_from = datetime.fromisoformat(request.date_from)
        date_to = datetime.fromisoformat(request.date_to)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    if date_from >= date_to:
        raise HTTPException(status_code=422, detail="date_from must be before date_to.")

    # Validate weights sum to ~1.0
    total_weight = sum(h.weight for h in request.holdings)
    if abs(total_weight - 1.0) > 0.01:
        raise HTTPException(
            status_code=422,
            detail=f"Holdings weights must sum to 1.0 (got {total_weight:.4f}).",
        )

    # Validate rebalance config
    if request.rebalance and not request.rebalance_interval:
        raise HTTPException(
            status_code=422,
            detail="rebalance_interval is required when rebalance=True.",
        )

    # Validate all symbols exist
    for h in request.holdings:
        count = stock_prices_collection.count_documents({"symbol": h.symbol.upper()})
        if count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for symbol '{h.symbol.upper()}'.",
            )

    # Validate strategy params (reuse existing helper)
    bare = BacktestRequest(
        symbol=request.holdings[0].symbol,
        date_from=request.date_from,
        date_to=request.date_to,
        initial_capital=request.initial_capital,
        strategy=request.strategy,
        strategy_params=request.strategy_params,
    )
    _validate_strategy_params(bare)

    return backtest_engine.run_portfolio_backtest(request)


@router.get(
    "/symbols/{symbol}/date-range",
    response_model=SymbolDateRangeResponse,
)
def get_symbol_date_range(symbol: str):
    """Return the min and max date available for a given symbol."""
    upper_symbol = symbol.upper()

    pipeline = [
        {"$match": {"symbol": upper_symbol}},
        {
            "$group": {
                "_id": None,
                "min_date": {"$min": "$date"},
                "max_date": {"$max": "$date"},
                "data_points": {"$sum": 1},
            }
        },
    ]
    results = list(stock_prices_collection.aggregate(pipeline))

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for symbol '{upper_symbol}'.",
        )

    row = results[0]
    return SymbolDateRangeResponse(
        symbol=upper_symbol,
        min_date=row["min_date"].strftime("%Y-%m-%d"),
        max_date=row["max_date"].strftime("%Y-%m-%d"),
        data_points=row["data_points"],
    )
