import logging

from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.collection import Collection

from config import settings

logger = logging.getLogger(__name__)

mongo_client: MongoClient = MongoClient(settings.mongodb_uri)
db: Database = mongo_client[settings.mongodb_db_name]

imports_collection: Collection = db["imports"]
stock_prices_collection: Collection = db["stock_prices"]


def ensure_indexes() -> None:
    """Create MongoDB indexes for optimal query performance."""
    # Primary lookup: filter by symbol + sort/range by date
    stock_prices_collection.create_index(
        [("symbol", ASCENDING), ("date", ASCENDING)],
        unique=True,
        name="symbol_date_unique",
    )
    # Date-only queries (no symbol filter)
    stock_prices_collection.create_index(
        [("date", ASCENDING)],
        name="date_asc",
    )
    # Cascade delete & symbols-per-import lookups
    stock_prices_collection.create_index(
        [("import_id", ASCENDING)],
        name="import_id_lookup",
    )
    # Symbols aggregation: covers $group on symbol with $first security_name
    stock_prices_collection.create_index(
        [("symbol", ASCENDING), ("security_name", ASCENDING)],
        name="symbol_name_agg",
    )
    # Imports: sort by uploaded_at (newest first)
    imports_collection.create_index(
        [("uploaded_at", DESCENDING)],
        name="uploaded_at_desc",
    )
    imports_collection.create_index(
        [("status", ASCENDING)],
        name="status_lookup",
    )


def cleanup_orphaned_prices() -> None:
    """Remove stock_price documents whose import_id no longer exists in imports.

    Also cleans up any imports stuck in transient states (processing/deleting/pending)
    from a previous unclean shutdown.
    """
    # Clean up imports stuck in transient states from previous run
    stuck = imports_collection.find(
        {"status": {"$in": ["processing", "deleting", "pending"]}},
        {"_id": 1},
    )
    stuck_ids = [doc["_id"] for doc in stuck]
    if stuck_ids:
        logger.info("Cleaning up %d stuck imports", len(stuck_ids))
        stock_prices_collection.delete_many({"import_id": {"$in": stuck_ids}})
        imports_collection.delete_many({"_id": {"$in": stuck_ids}})

    # Find all distinct import_ids in stock_prices
    price_import_ids = stock_prices_collection.distinct("import_id")
    if not price_import_ids:
        return

    # Find which of those still exist in imports collection
    existing = imports_collection.find(
        {"_id": {"$in": price_import_ids}},
        {"_id": 1},
    )
    existing_ids = {doc["_id"] for doc in existing}

    # Orphaned = import_ids in stock_prices with no matching import record
    orphaned_ids = [iid for iid in price_import_ids if iid not in existing_ids]
    if orphaned_ids:
        logger.info("Removing orphaned stock prices for %d missing imports", len(orphaned_ids))
        result = stock_prices_collection.delete_many({"import_id": {"$in": orphaned_ids}})
        logger.info("Deleted %d orphaned stock price documents", result.deleted_count)
