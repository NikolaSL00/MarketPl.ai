"""Router for querying stock price data."""

from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from database import stock_prices_collection
from schemas.stock_prices import (
    StockPricePageResponse,
    StockPriceRow,
    SymbolInfo,
    SymbolListResponse,
)

router = APIRouter(prefix="/api/stock-prices", tags=["stock-prices"])

# In-memory cache for the expensive symbols aggregation
_symbols_cache: dict = {"data": None, "expires_at": 0.0}
SYMBOLS_CACHE_TTL = 60  # seconds


@router.get("", response_model=StockPricePageResponse)
def get_stock_prices(
    symbol: Optional[str] = None,
    date_from: Optional[str] = Query(None, description="ISO date, e.g. 2020-01-01"),
    date_to: Optional[str] = Query(None, description="ISO date, e.g. 2024-12-31"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
):
    """Query stock prices with optional filters, paginated and sorted by date ascending."""
    filter_query: dict = {}

    if symbol:
        filter_query["symbol"] = symbol.upper()

    date_filter: dict = {}
    if date_from:
        date_filter["$gte"] = datetime.fromisoformat(date_from)
    if date_to:
        date_filter["$lte"] = datetime.fromisoformat(date_to)
    if date_filter:
        filter_query["date"] = date_filter

    # Use fast estimated count for unfiltered queries (metadata-based, instant)
    if filter_query:
        total = stock_prices_collection.count_documents(filter_query)
    else:
        total = stock_prices_collection.estimated_document_count()

    cursor = (
        stock_prices_collection.find(filter_query, {"_id": 0, "import_id": 0})
        .sort("date", 1)
        .skip(skip)
        .limit(limit)
    )

    data = [_serialize_price(doc) for doc in cursor]

    return StockPricePageResponse(data=data, total=total, skip=skip, limit=limit)


@router.get("/symbols", response_model=SymbolListResponse)
def get_symbols():
    """Return distinct symbols with their security name and record count. Cached for 60s."""
    now = time.time()

    if _symbols_cache["data"] is not None and now < _symbols_cache["expires_at"]:
        return SymbolListResponse(symbols=_symbols_cache["data"])

    pipeline = [
        {
            "$group": {
                "_id": "$symbol",
                "security_name": {"$first": "$security_name"},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
        {
            "$project": {
                "_id": 0,
                "symbol": "$_id",
                "security_name": 1,
                "count": 1,
            }
        },
    ]
    results = list(stock_prices_collection.aggregate(pipeline, allowDiskUse=True))

    _symbols_cache["data"] = results
    _symbols_cache["expires_at"] = now + SYMBOLS_CACHE_TTL

    return SymbolListResponse(symbols=results)


def invalidate_symbols_cache() -> None:
    """Call after import completion or deletion to bust the cache."""
    _symbols_cache["data"] = None
    _symbols_cache["expires_at"] = 0.0


def _serialize_price(doc: dict) -> dict:
    """Convert a MongoDB stock price document to a clean dict."""
    return {
        "symbol": doc["symbol"],
        "security_name": doc["security_name"],
        "date": doc["date"],
        "open": doc["open"],
        "high": doc["high"],
        "low": doc["low"],
        "close": doc["close"],
        "adj_close": doc["adj_close"],
        "volume": doc["volume"],
    }
