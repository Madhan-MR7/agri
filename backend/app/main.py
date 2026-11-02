"""AgriBot API. Run from backend/:  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import mongo, neo4j_client
from app.db.postgres import init_db
from app.routers import assistant, crop, farmers, graph

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agribot")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    mongo.init_mongo()
    yield
    neo4j_client.close()


app = FastAPI(title="AgriBot API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

settings.static_dir.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")

@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception):
    """Always answer with JSON so the app can show a readable message instead of a parse error."""
    log.exception("Unhandled error", exc_info=exc)
    # Errors from Gemini / Google APIs (bad, expired, revoked or rate-limited key)
    if type(exc).__module__.startswith("google."):
        return JSONResponse(
            status_code=503,
            content={"detail": f"The AI service is unavailable right now ({getattr(exc, 'message', exc)})."},
        )
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})


app.include_router(farmers.router)
app.include_router(assistant.router)
app.include_router(crop.router)
app.include_router(graph.router)


@app.get("/health")
def health():
    return {"status": "ok"}
