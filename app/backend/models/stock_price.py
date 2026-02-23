"""
MongoDB document shape for the 'stock_prices' collection.

{
    "symbol": str,
    "security_name": str,
    "date": datetime,
    "open": float,
    "high": float,
    "low": float,
    "close": float,
    "adj_close": float,
    "volume": int,
    "import_id": ObjectId
}
"""

STOCK_PRICES_COLLECTION = "stock_prices"

EXPECTED_CSV_COLUMNS = [
    "Symbol",
    "Security Name",
    "Date",
    "Open",
    "High",
    "Low",
    "Close",
    "Adj Close",
    "Volume",
]
