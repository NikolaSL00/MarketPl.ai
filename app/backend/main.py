from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import ensure_indexes, cleanup_orphaned_prices, mongo_client
from routers import imports, stock_prices


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database indexes exist
    ensure_indexes()
    # Clean up orphaned data from interrupted imports
    cleanup_orphaned_prices()
    yield
    # Shutdown: close MongoDB connection
    mongo_client.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

# CORS – allow the frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(imports.router)
app.include_router(stock_prices.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db() -> dict[str, str]:
    mongo_client.admin.command("ping")
    return {"status": "ok", "database": settings.mongodb_db_name}
