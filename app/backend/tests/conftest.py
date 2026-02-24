"""
Pytest configuration for the backend test suite.

Because backtest_engine.py imports ``database.stock_prices_collection`` at
module level (MongoDB), we have to inject a mock *before* the module is first
imported.  The conftest is loaded by pytest before any test module, which
makes it the right place to do this.
"""
import sys
import os
from unittest.mock import MagicMock

# ── 1.  Make sure the backend package root is on sys.path ─────────────────────
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── 2.  Stub out the MongoDB client *before* any engine import ────────────────
_mock_collection = MagicMock()
_mock_db_module = MagicMock()
_mock_db_module.stock_prices_collection = _mock_collection

# Prevent a real pymongo connection from being attempted
sys.modules.setdefault("database", _mock_db_module)
