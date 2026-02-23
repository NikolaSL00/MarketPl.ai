from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field


class StockPriceRow(BaseModel):
    symbol: str
    security_name: str
    date: datetime
    open: float = Field(alias="open")
    high: float
    low: float
    close: float
    adj_close: float
    volume: int

    model_config = {"populate_by_name": True}


class StockPricePageResponse(BaseModel):
    data: list[StockPriceRow]
    total: int
    skip: int
    limit: int


class SymbolInfo(BaseModel):
    symbol: str
    security_name: str
    count: int


class SymbolListResponse(BaseModel):
    symbols: list[SymbolInfo]
