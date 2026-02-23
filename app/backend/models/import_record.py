"""
MongoDB document shape for the 'imports' collection.

{
    "_id": ObjectId,
    "filename": str,
    "uploaded_at": datetime (UTC),
    "status": "pending" | "processing" | "completed" | "failed",
    "total_rows": int,
    "processed_rows": int,
    "symbols_count": int,
    "error": str | None
}
"""

IMPORTS_COLLECTION = "imports"

VALID_STATUSES = ("pending", "processing", "completed", "failed")
