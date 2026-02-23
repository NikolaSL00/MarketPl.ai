from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ImportUploadResponse(BaseModel):
    import_id: str
    status: str


class ImportStatusResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime
    status: str
    total_rows: int = 0
    processed_rows: int = 0
    symbols_count: int = 0
    error: Optional[str] = None


class ImportListResponse(BaseModel):
    data: list[ImportStatusResponse]
    total: int


class DeleteResponse(BaseModel):
    deleted: bool
