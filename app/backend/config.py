from __future__ import annotations

import os
from typing import List

from dotenv import load_dotenv


load_dotenv()


class Settings:
    app_name: str = os.getenv("APP_NAME", "MarketPl.ai API")
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME", "marketpl")
    allowed_origins: List[str] = os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    csv_chunk_size: int = int(os.getenv("CSV_CHUNK_SIZE", "10000"))


settings = Settings()
