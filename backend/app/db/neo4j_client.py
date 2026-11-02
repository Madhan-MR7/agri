"""Neo4j: agricultural knowledge graph used for graph RAG."""
import logging
import time

from neo4j import Driver, GraphDatabase

from app.config import settings

log = logging.getLogger(__name__)

_driver: Driver | None = None
_last_failure = 0.0
_RETRY_SECONDS = 30


def get_driver() -> Driver | None:
    """Return a connected driver, or None if Neo4j is disabled/unreachable."""
    global _driver, _last_failure
    if not settings.graph_rag_enabled:
        return None
    if _driver is None and time.monotonic() - _last_failure > _RETRY_SECONDS:
        try:
            driver = GraphDatabase.driver(
                settings.neo4j_uri, auth=(settings.neo4j_user, settings.neo4j_password)
            )
            driver.verify_connectivity()
            _driver = driver
        except Exception as e:  # noqa: BLE001
            log.warning("Neo4j unavailable, graph RAG skipped: %s", e)
            _last_failure = time.monotonic()
    return _driver


def run_read(query: str, **params) -> list[dict]:
    driver = get_driver()
    if driver is None:
        return []
    with driver.session() as s:
        return [r.data() for r in s.run(query, **params)]


def run_write(query: str, **params) -> None:
    driver = get_driver()
    if driver is None:
        raise RuntimeError("Neo4j is not reachable; is `docker compose up -d neo4j` running?")
    with driver.session() as s:
        s.run(query, **params).consume()


def close() -> None:
    if _driver is not None:
        _driver.close()
