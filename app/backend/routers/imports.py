"""Router for CSV import operations."""

import os
import shutil
import tempfile

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from schemas.imports import (
    DeleteResponse,
    ImportListResponse,
    ImportStatusResponse,
    ImportUploadResponse,
)
from services.csv_processor import process_csv
from services.import_service import (
    create_import,
    delete_import,
    get_import_status,
    list_imports,
    update_import,
)

router = APIRouter(prefix="/api/imports", tags=["imports"])


@router.post("/upload", response_model=ImportUploadResponse)
async def upload_csv(file: UploadFile, background_tasks: BackgroundTasks):
    """
    Upload a CSV file for import. The file is saved to a temp location
    and processing runs in the background. Returns immediately with an import_id.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    # Save uploaded file to a temp location (handles large files via streaming)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    finally:
        tmp.close()

    # Create import record
    import_id = create_import(file.filename)

    # Schedule background processing
    background_tasks.add_task(_process_and_cleanup, tmp_path, import_id)

    return ImportUploadResponse(import_id=import_id, status="pending")


def _process_and_cleanup(file_path: str, import_id: str) -> None:
    """Run the CSV processor and then remove the temp file."""
    try:
        process_csv(file_path, import_id)
    finally:
        if os.path.exists(file_path):
            os.unlink(file_path)


@router.get("", response_model=ImportListResponse)
def list_all_imports(skip: int = 0, limit: int = 20):
    """List all imports, sorted by most recent first."""
    data, total = list_imports(skip=skip, limit=limit)
    return ImportListResponse(data=data, total=total)


@router.get("/{import_id}/status", response_model=ImportStatusResponse)
def get_status(import_id: str):
    """Get the current status and progress of an import."""
    record = get_import_status(import_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Import not found.")
    return record


@router.delete("/{import_id}", response_model=DeleteResponse)
def remove_import(import_id: str, background_tasks: BackgroundTasks):
    """Delete an import and all its associated stock price records.
    
    Marks the import as 'deleting' immediately and runs the actual
    deletion of stock price data in the background (can be millions of rows).
    """
    record = get_import_status(import_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Import not found.")

    # Mark as deleting so the UI can show feedback immediately
    update_import(import_id, {"status": "deleting"})

    # Run the heavy deletion in the background
    background_tasks.add_task(delete_import, import_id)

    return DeleteResponse(deleted=True)
