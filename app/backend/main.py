from fastapi import FastAPI
from pymongo import MongoClient

from config import settings


app = FastAPI(title=settings.app_name)

mongo_client = MongoClient(settings.mongodb_uri)
database = mongo_client[settings.mongodb_db_name]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db() -> dict[str, str]:
    mongo_client.admin.command("ping")
    return {"status": "ok", "database": settings.mongodb_db_name}
