"""Farmer Q&A: text chat, voice chat and image-based disease detection."""
import logging
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.db import mongo
from app.schemas import ChatIn, ChatOut
from app.services import disease, llm, speech
from app.services.rag import hybrid_answer

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["assistant"])


@router.post("/chat", response_model=ChatOut)
def chat(body: ChatIn):
    lang = llm.resolve_language(body.message, body.language)
    query_en = llm.to_english(body.message)
    result = hybrid_answer(query_en)
    reply = llm.from_english(result.answer, lang)

    mongo.safe_insert(mongo.chats, {
        "phone": body.phone or "guest", "kind": "text", "language": lang,
        "question": body.message, "answer": reply, "source_type": result.source_type,
    })
    return ChatOut(reply_text=reply, language=lang, citations=result.citations, source_type=result.source_type)


@router.post("/voice")
def voice(
    request: Request,
    audio: UploadFile = File(...),
    phone: str = Form("guest"),
    language: str | None = Form(None),
):
    suffix = Path(audio.filename or "audio.m4a").suffix or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(audio.file.read())
        tmp_path = Path(tmp.name)
    try:
        user_text, detected = speech.transcribe(tmp_path)
    finally:
        tmp_path.unlink(missing_ok=True)

    if not user_text:
        return {"user_text": "", "reply_text": "I couldn't hear anything. Please try again.", "reply_audio_url": ""}

    lang = language if language in llm.SUPPORTED_LANGUAGES else detected
    result = hybrid_answer(llm.to_english(user_text))
    reply = llm.from_english(result.answer, lang)
    audio_rel = speech.synthesize(reply, lang)

    mongo.safe_insert(mongo.chats, {
        "phone": phone, "kind": "voice", "language": lang,
        "question": user_text, "answer": reply, "source_type": result.source_type,
    })
    return {
        "user_text": user_text,
        "language": lang,
        "reply_text": reply,
        "reply_audio_url": str(request.url_for("static", path=audio_rel)) if audio_rel else "",
        "citations": result.citations,
        "source_type": result.source_type,
    }


@router.post("/disease/detect")
def detect_disease(
    images: list[UploadFile] = File(...),
    user_query: str = Form(""),
    phone: str = Form("guest"),
    language: str | None = Form(None),
):
    lang = llm.resolve_language(user_query, language) if user_query or language else "en"
    results = []
    for image in images:
        try:
            diagnosis = disease.detect(image.file.read())
        except FileNotFoundError as e:
            raise HTTPException(503, str(e)) from e

        primary = diagnosis.primary
        if primary is None:
            reply = llm.from_english(
                "No leaf was recognised in this photo. Take a close, well-lit photo of a single affected leaf "
                "against a plain background and try again. Supported crops: apple, bell pepper, blueberry, cherry, "
                "corn, grape, peach, potato, raspberry, soybean, squash, strawberry and tomato.",
                lang,
            )
            results.append({
                "predicted_disease": "No leaf detected", "confidence": 0.0, "healthy": False, "detected": False,
                "detections": [], "summary": [], "reply_text": reply, "citations": [], "source_type": "model",
            })
            continue

        label = disease.display_name(primary.label)
        crop = disease.crop_of(primary.label)
        question = (
            f"The {crop} leaves look healthy. Give preventive care tips for {crop}."
            if primary.healthy
            else f"Give structured details for {label} on {crop} (Symptoms, Cause, Management and remedies)"
        )
        if user_query:
            question += f". Farmer's question: {llm.to_english(user_query)}"
        result = hybrid_answer(question, disease_mode=not primary.healthy)
        reply = llm.from_english(result.answer, lang)

        mongo.safe_insert(mongo.disease_reports, {
            "phone": phone, "crop": crop, "predicted_disease": label, "confidence": primary.confidence,
            "healthy": primary.healthy, "leaf_count": len(diagnosis.detections), "summary": diagnosis.summary(),
            "language": lang, "reply_text": reply,
        })
        results.append({
            "predicted_disease": label,
            "confidence": round(primary.confidence, 4),
            "healthy": primary.healthy,
            "detected": True,
            "detections": [d.as_dict() for d in diagnosis.detections],
            "summary": diagnosis.summary(),
            "reply_text": reply,
            "citations": result.citations,
            "source_type": result.source_type,
        })
    return {"results": results}


@router.get("/chat/history/{phone}")
def chat_history(phone: str, limit: int = 50):
    return {"messages": list(reversed(mongo.recent(mongo.chats, phone, limit)))}
