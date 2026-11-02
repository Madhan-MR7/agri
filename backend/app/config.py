import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent

# .env lives at the repo root; a backend/.env overrides it if present
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default)


def _bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _path(name: str, default: str) -> Path:
    p = Path(os.getenv(name, default))
    return p if p.is_absolute() else BACKEND_DIR / p


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str = field(default_factory=lambda: _env("GEMINI_API_KEY"))
    gemini_chat_model: str = field(default_factory=lambda: _env("GEMINI_CHAT_MODEL", "gemini-2.5-flash"))
    gemini_embed_model: str = field(default_factory=lambda: _env("GEMINI_EMBED_MODEL", "gemini-embedding-001"))
    # Must match the Pinecone index dimension
    gemini_embed_dim: int = field(default_factory=lambda: int(_env("GEMINI_EMBED_DIM", "768")))

    pinecone_api_key: str = field(default_factory=lambda: _env("PINECONE_API_KEY"))
    pinecone_index: str = field(default_factory=lambda: _env("PINECONE_INDEX"))
    default_namespace: str = field(default_factory=lambda: _env("DEFAULT_NAMESPACE", "global"))
    rag_similarity_threshold: float = field(
        default_factory=lambda: float(_env("RAG_SIMILARITY_THRESHOLD", "0.75"))
    )
    rag_cache_llm_answers: bool = field(default_factory=lambda: _bool("RAG_CACHE_LLM_ANSWERS", True))

    database_url: str = field(
        default_factory=lambda: _env(
            "DATABASE_URL", "postgresql+psycopg://agribot:agribot_pass@localhost:5433/agribot"
        )
    )
    mongo_url: str = field(
        default_factory=lambda: _env(
            "MONGO_URL", "mongodb://agribot:agribot_pass@localhost:27018/?authSource=admin"
        )
    )
    mongo_db: str = field(default_factory=lambda: _env("MONGO_DB", "agribot"))

    neo4j_uri: str = field(default_factory=lambda: _env("NEO4J_URI", "bolt://localhost:7687"))
    neo4j_user: str = field(default_factory=lambda: _env("NEO4J_USER", "neo4j"))
    neo4j_password: str = field(default_factory=lambda: _env("NEO4J_PASSWORD", "agribot_pass"))
    graph_rag_enabled: bool = field(default_factory=lambda: _bool("GRAPH_RAG_ENABLED", True))

    # YOLOv8n trained on PlantDoc (plantdoc_final run, imgsz 800)
    disease_model_path: Path = field(
        default_factory=lambda: _path("DISEASE_MODEL_PATH", "models/plantdoc_yolov8n.pt")
    )
    disease_conf_threshold: float = field(
        default_factory=lambda: float(_env("DISEASE_CONF_THRESHOLD", "0.25"))
    )
    disease_imgsz: int = field(default_factory=lambda: int(_env("DISEASE_IMGSZ", "800")))
    # Photos with less foliage-coloured area than this are treated as "no leaf found"
    disease_min_plant_fraction: float = field(
        default_factory=lambda: float(_env("DISEASE_MIN_PLANT_FRACTION", "0.05"))
    )
    crop_model_path: Path = field(
        default_factory=lambda: _path("CROP_MODEL_PATH", "ml/artifacts/crop_recommender.joblib")
    )
    whisper_model: str = field(default_factory=lambda: _env("WHISPER_MODEL", "small"))

    static_dir: Path = BACKEND_DIR / "static"


settings = Settings()
