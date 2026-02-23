"""Service for chunked CSV parsing, validation, and bulk insertion into MongoDB."""

from __future__ import annotations

import logging

import pandas as pd
from bson import ObjectId
from pymongo.errors import BulkWriteError

from config import settings
from database import stock_prices_collection
from models.stock_price import EXPECTED_CSV_COLUMNS
from services.import_service import update_import
from routers.stock_prices import invalidate_symbols_cache

logger = logging.getLogger(__name__)

# Map CSV column names → MongoDB field names
COLUMN_RENAME_MAP = {
    "Symbol": "symbol",
    "Security Name": "security_name",
    "Date": "date",
    "Open": "open",
    "High": "high",
    "Low": "low",
    "Close": "close",
    "Adj Close": "adj_close",
    "Volume": "volume",
}


def process_csv(file_path: str, import_id: str) -> None:
    """
    Read a CSV file in chunks, validate, coerce types, and bulk-insert into
    the stock_prices collection. Updates the import record with progress.

    This function is designed to run as a background task.
    Checks for cancellation (status='deleting') between chunks.
    """
    from services.import_service import get_import_status

    oid = ObjectId(import_id)

    # Transition to processing
    update_import(import_id, {"status": "processing"})

    try:
        # Count total rows first (fast scan)
        total_rows = _count_csv_rows(file_path)
        update_import(import_id, {"total_rows": total_rows})

        processed = 0
        header_validated = False
        chunk_count = 0

        reader = pd.read_csv(
            file_path,
            chunksize=settings.csv_chunk_size,
            dtype=str,  # Read everything as string initially for validation
            keep_default_na=False,
        )

        for chunk in reader:
            # Check if import was cancelled/deleted between chunks
            current = get_import_status(import_id)
            if current is None or current.get("status") == "deleting":
                logger.info("Import %s was cancelled, stopping processing", import_id)
                # Clean up any rows already inserted for this import
                stock_prices_collection.delete_many({"import_id": oid})
                invalidate_symbols_cache()
                return

            # Validate header on the first chunk
            if not header_validated:
                _validate_header(chunk.columns.tolist())
                header_validated = True

            # Coerce types and clean data
            documents = _transform_chunk(chunk, oid)

            if documents:
                inserted = _bulk_insert(documents)
                processed += inserted
            else:
                # All rows in chunk were invalid/dropped
                processed += 0

            chunk_count += 1
            
            # Update symbols count every 10 chunks during processing
            update_data = {"processed_rows": processed}
            if chunk_count % 10 == 0:
                symbols_count = len(
                    stock_prices_collection.distinct("symbol", {"import_id": oid})
                )
                update_data["symbols_count"] = symbols_count
            
            update_import(import_id, update_data)

        # Final cancellation check before marking complete
        current = get_import_status(import_id)
        if current is None or current.get("status") == "deleting":
            logger.info("Import %s was cancelled after processing, cleaning up", import_id)
            stock_prices_collection.delete_many({"import_id": oid})
            invalidate_symbols_cache()
            return

        # Compute distinct symbols for this import
        symbols_count = len(
            stock_prices_collection.distinct("symbol", {"import_id": oid})
        )

        update_import(
            import_id,
            {
                "status": "completed",
                "processed_rows": processed,
                "symbols_count": symbols_count,
            },
        )
        invalidate_symbols_cache()

    except Exception as exc:
        logger.exception("CSV processing failed for import %s", import_id)
        update_import(
            import_id,
            {"status": "failed", "error": str(exc)},
        )


def _count_csv_rows(file_path: str) -> int:
    """Fast line count (subtract 1 for header)."""
    count = 0
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        for _ in f:
            count += 1
    return max(count - 1, 0)  # subtract header


def _validate_header(columns: list[str]) -> None:
    """Raise ValueError if CSV columns don't match the expected schema."""
    normalized = [c.strip() for c in columns]
    expected = [c.strip() for c in EXPECTED_CSV_COLUMNS]
    if normalized != expected:
        raise ValueError(
            f"Invalid CSV header. Expected columns: {expected}, "
            f"got: {normalized}"
        )


def _transform_chunk(chunk: pd.DataFrame, import_id: ObjectId) -> list[dict]:
    """Clean and transform a pandas chunk into a list of MongoDB documents."""
    df = chunk.copy()

    # Strip whitespace from column names
    df.columns = df.columns.str.strip()

    # Rename columns to snake_case
    df = df.rename(columns=COLUMN_RENAME_MAP)

    # Parse date
    df["date"] = pd.to_datetime(df["date"], errors="coerce")

    # Cast numeric columns to float64
    for col in ("open", "high", "low", "close", "adj_close"):
        df[col] = pd.to_numeric(df[col], errors="coerce").astype("float64")

    # Cast volume to int64 (coerce errors → NaN then fill with 0)
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype("int64")

    # Drop rows missing critical fields (date, close, adj_close)
    df = df.dropna(subset=["date", "close", "adj_close"])

    # Strip string fields
    df["symbol"] = df["symbol"].astype(str).str.strip()
    df["security_name"] = df["security_name"].astype(str).str.strip()

    # Add import_id
    df["import_id"] = import_id

    # Convert to list of dicts
    return df.to_dict("records")


def _bulk_insert(documents: list[dict]) -> int:
    """
    Insert documents into stock_prices. Uses ordered=False so duplicate
    key violations (symbol+date unique index) are silently skipped.
    Returns count of actually inserted documents.
    """
    try:
        result = stock_prices_collection.insert_many(documents, ordered=False)
        return len(result.inserted_ids)
    except BulkWriteError as bwe:
        # nInserted tells us how many succeeded despite duplicate errors
        return bwe.details.get("nInserted", 0)
