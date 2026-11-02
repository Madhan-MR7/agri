"""MongoDB: unstructured / high-volume data (chat history, disease reports)."""
import logging
from datetime import datetime, timezone

from pymongo import DESCENDING, MongoClient

from app.config import settings

log = logging.getLogger(__name__)

_client = MongoClient(settings.mongo_url, serverSelectionTimeoutMS=3000, tz_aware=True)
db = _client[settings.mongo_db]
chats = db["chat_messages"]
disease_reports = db["disease_reports"]


def init_mongo() -> None:
    try:
        chats.create_index([("phone", 1), ("created_at", DESCENDING)])
        disease_reports.create_index([("phone", 1), ("created_at", DESCENDING)])
    except Exception as e:  # noqa: BLE001
        log.warning("MongoDB unavailable at startup: %s", e)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def safe_insert(collection, doc: dict) -> None:
    """Persisting history must never break the farmer-facing response."""
    try:
        collection.insert_one({**doc, "created_at": _now()})
    except Exception as e:  # noqa: BLE001
        log.warning("Mongo insert into %s failed: %s", collection.name, e)


def recent(collection, phone: str, limit: int = 20) -> list[dict]:
    try:
        cur = collection.find({"phone": phone}, {"_id": 0}).sort("created_at", DESCENDING).limit(limit)
        return list(cur)
    except Exception as e:  # noqa: BLE001
        log.warning("Mongo read from %s failed: %s", collection.name, e)
        return []


def count(collection, phone: str) -> int:
    try:
        return collection.count_documents({"phone": phone})
    except Exception as e:  # noqa: BLE001
        log.warning("Mongo count on %s failed: %s", collection.name, e)
        return 0
