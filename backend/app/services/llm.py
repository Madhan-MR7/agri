"""Gemini helpers: generation, embeddings, language detection and translation."""
from functools import lru_cache

from langdetect import DetectorFactory, detect

from app.config import settings

DetectorFactory.seed = 0

# Languages offered in the app (code -> display name used in prompts)
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
}


@lru_cache
def _genai():
    import google.generativeai as genai

    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in .env")
    genai.configure(api_key=settings.gemini_api_key)
    return genai


def generate(prompt: str) -> str:
    model = _genai().GenerativeModel(settings.gemini_chat_model)
    resp = model.generate_content(prompt)
    return (resp.text or "").strip()


def embed_text(text: str, task_type: str = "RETRIEVAL_QUERY") -> list[float]:
    """Embed a search query (default) or, with task_type="RETRIEVAL_DOCUMENT", a knowledge-base chunk."""
    emb = _genai().embed_content(
        model=settings.gemini_embed_model,
        content=text,
        task_type=task_type,
        output_dimensionality=settings.gemini_embed_dim,
    )
    return emb["embedding"]


def embed_documents(texts: list[str]) -> list[list[float]]:
    """Batch-embed knowledge-base chunks (one API call for the whole list)."""
    emb = _genai().embed_content(
        model=settings.gemini_embed_model,
        content=texts,
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=settings.gemini_embed_dim,
    )
    return emb["embedding"]


def lang_of_text(text: str) -> str:
    try:
        return detect(text)
    except Exception:  # noqa: BLE001
        return "en"


def resolve_language(text: str, preferred: str | None) -> str:
    """The farmer's chosen language wins; otherwise detect it from the message."""
    if preferred and preferred in SUPPORTED_LANGUAGES:
        return preferred
    return lang_of_text(text)


def translate(text: str, target_lang_code: str) -> str:
    name = SUPPORTED_LANGUAGES.get(target_lang_code, target_lang_code)
    return generate(f"Translate to {name} ('{target_lang_code}'). Only return the translated text:\n{text}")


def to_english(text: str) -> str:
    return text if lang_of_text(text) == "en" else translate(text, "en")


def from_english(text_en: str, target_lang: str) -> str:
    return text_en if target_lang == "en" else translate(text_en, target_lang)
