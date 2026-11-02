"""Speech-to-text (faster-whisper) and text-to-speech (gTTS)."""
import logging
import uuid
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.services.llm import lang_of_text

log = logging.getLogger(__name__)


@lru_cache
def _whisper():
    from faster_whisper import WhisperModel

    return WhisperModel(settings.whisper_model, device="cpu", compute_type="int8")


def transcribe(file_path: Path) -> tuple[str, str]:
    segments, info = _whisper().transcribe(str(file_path), task="transcribe", vad_filter=True)
    text = "".join(seg.text for seg in segments).strip()
    return text, info.language or lang_of_text(text) or "en"


def synthesize(text: str, lang_code: str) -> str | None:
    """Save an mp3 under static/audio and return its path relative to /static."""
    from gtts import gTTS

    if not text.strip():
        return None
    try:
        out_dir = settings.static_dir / "audio"
        out_dir.mkdir(parents=True, exist_ok=True)
        filename = f"reply_{uuid.uuid4().hex}.mp3"
        gTTS(text=text, lang=lang_code).save(str(out_dir / filename))
        return f"audio/{filename}"
    except Exception as e:  # noqa: BLE001
        log.warning("TTS failed: %s", e)
        return None
