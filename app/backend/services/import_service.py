"""Service for managing import records in MongoDB."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from database import imports_collection, stock_prices_collection


def create_import(filename: str) -> str:
    """Create a new import record with status 'pending'. Returns the import_id as string."""
    doc = {
        "filename": filename,
        "uploaded_at": datetime.now(timezone.utc),
        "status": "pending",
        "total_rows": 0,
        "processed_rows": 0,
        "symbols_count": 0,
        "error": None,
    }
    result = imports_collection.insert_one(doc)
    return str(result.inserted_id)


def get_import_status(import_id: str) -> Optional[dict]:
    """Fetch a single import record by id. Returns None if not found."""
    if not ObjectId.is_valid(import_id):
        return None
    doc = imports_collection.find_one({"_id": ObjectId(import_id)})
    if doc is None:
        return None
    return _serialize_import(doc)


def list_imports(skip: int = 0, limit: int = 20) -> tuple[list[dict], int]:
    """Return paginated list of imports (newest first) and total count."""
    total = imports_collection.count_documents({})
    cursor = (
        imports_collection.find()
        .sort("uploaded_at", -1)
        .skip(skip)
        .limit(limit)
    )
    data = [_serialize_import(doc) for doc in cursor]
    return data, total


def delete_import(import_id: str) -> bool:
    """Delete an import record and all associated stock prices.
    
    Sets status to 'deleting' first so any running processor stops,
    then removes stock prices and the import record itself.
    """
    from routers.stock_prices import invalidate_symbols_cache

    if not ObjectId.is_valid(import_id):
        return False
    oid = ObjectId(import_id)

    # Mark as deleting so the CSV processor stops inserting
    imports_collection.update_one(
        {"_id": oid},
        {"$set": {"status": "deleting"}},
    )

    # Delete all stock prices for this import
    stock_prices_collection.delete_many({"import_id": oid})

    # Delete the import record itself
    result = imports_collection.delete_one({"_id": oid})

    if result.deleted_count > 0:
        invalidate_symbols_cache()
    return result.deleted_count > 0


def update_import(import_id: str, update: dict) -> None:
    """Update fields on an import record."""
    imports_collection.update_one(
        {"_id": ObjectId(import_id)},
        {"$set": update},
    )


def _serialize_import(doc: dict) -> dict:
    """Convert a MongoDB import document to a JSON-safe dict."""
    # Ensure uploaded_at is serialized as a UTC ISO string with 'Z' suffix
    # so the browser interprets it correctly.
    uploaded_at = doc["uploaded_at"]
    if hasattr(uploaded_at, "isoformat"):
        uploaded_at_str = uploaded_at.isoformat()
        # MongoDB datetimes are UTC but may lack tzinfo after round-trip
        if not uploaded_at_str.endswith("Z") and "+" not in uploaded_at_str:
            uploaded_at_str += "Z"
    else:
        uploaded_at_str = uploaded_at
    return {
        "id": str(doc["_id"]),
        "filename": doc["filename"],
        "uploaded_at": uploaded_at_str,
        "status": doc["status"],
        "total_rows": doc.get("total_rows", 0),
        "processed_rows": doc.get("processed_rows", 0),
        "symbols_count": doc.get("symbols_count", 0),
        "error": doc.get("error"),
    }
