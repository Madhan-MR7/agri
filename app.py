import os
import io
import base64
from typing import List, Tuple
import traceback
from gtts import gTTS

from flask import Flask, request, jsonify,send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import tensorflow as tf
from tensorflow.keras.models import model_from_json
from PIL import Image
import numpy as np
import hashlib

# Gemini (LLM + Embeddings)
import google.generativeai as genai

# Pinecone
from pinecone import Pinecone

# STT (offline, multilingual)
from faster_whisper import WhisperModel

# TTS
from gtts import gTTS

# Language detection
from langdetect import detect, DetectorFactory
DetectorFactory.seed = 0


load_dotenv()
# ✅ Serve audio files statically



with open("crop_model.json", "r") as json_file:
    loaded_model_json = json_file.read()

cnn_model = model_from_json(loaded_model_json)
cnn_model.load_weights("crop_model.weights.h5")
print("✅ CNN Model loaded successfully.")

# Load API keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")
DEFAULT_NAMESPACE = os.getenv("DEFAULT_NAMESPACE", "global")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Pinecone client
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX)

# Whisper model
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")
whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")

# Flask app
app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "tmp_tts"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------- HELPERS ----------
CLASS_NAMES = [
    "Rice Bacterial Blight", "Rice Blast", "wheat is healthy", "wheat yellow rust",
    "rice brown spot", "Rice Tungro","Sugarcane is Healthy", "Sugarcane_Mosaic", "Sugarcane Redrot", "Sugarcane Rust",
    "Sugarcane Yellow Leaf", "Wheat Brown Rust"
]

def classify_disease_image(image_path: str) -> str:
    """Run CNN inference and return predicted disease name."""
    img = Image.open(image_path).convert("RGB").resize((128, 128))
    img_array = np.expand_dims(np.array(img) / 255.0, axis=0)
    predictions = cnn_model.predict(img_array)
    predicted_class_index = np.argmax(predictions)
    return CLASS_NAMES[predicted_class_index]

def lang_of_text(text: str) -> str:
    try:
        return detect(text)
    except Exception:
        return "en"

def ensure_user_namespace(user_phone: str) -> str:
    return DEFAULT_NAMESPACE

def embed_text(text: str) -> List[float]:
    emb = genai.embed_content(model="text-embedding-004", content=text)
    return emb["embedding"]

def pinecone_query(vector: List[float], namespace: str, top_k: int = 25):
    return index.query(vector=vector, top_k=top_k, include_metadata=True, namespace=namespace)

def translate_with_gemini(text: str, target_lang_code: str) -> str:
    gm = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"Translate to '{target_lang_code}'. Only return translated text:\n{text}"
    resp = gm.generate_content(prompt)
    return (resp.text or "").strip()

def to_english(text: str) -> str:
    return text if lang_of_text(text) == "en" else translate_with_gemini(text, "en")

def from_english(text_en: str, target_lang: str) -> str:
    return text_en if target_lang == "en" else translate_with_gemini(text_en, target_lang)
def hybrid_answer(user_query_en: str, namespace: str) -> Tuple[str, List[str], str]:
    print(f"\nℹ️ [RAG DEBUG] Querying index: {PINECONE_INDEX}, namespace: '{namespace}' for: {user_query_en[:80]}...")

    vec = embed_text(user_query_en)
    res = pinecone_query(vector=vec, namespace=namespace, top_k=25)

    contexts = []
    citations = []
    source_type = "model"

    # 🔥 Define a relevance threshold
    SIMILARITY_THRESHOLD = 0.75  

    if res and res.get("matches"):
        print(f"ℹ️ [RAG DEBUG] Pinecone returned {len(res['matches'])} matches.")
        for i, m in enumerate(res["matches"], start=1):
            score = m.get("score", 0)
            print(f"   🔎 Match {i}: score={score:.4f}")
            if score >= SIMILARITY_THRESHOLD:  # ✅ Only keep relevant matches
                md = m.get("metadata", {})
                snippet = md.get("text") or md.get("chunk") or ""
                if snippet:
                    contexts.append(snippet)
                    citations.append(md.get("source", "document"))
            else:
                print(f"   ⚠️ Discarded match {i} (score too low).")

    if contexts:
        source_type = "rag"
        print(f"✅ RAG HIT: Using {len(contexts)} relevant context(s) (score ≥ {SIMILARITY_THRESHOLD})")
    else:
        print(f"⚠️ No relevant context found (or all scores below {SIMILARITY_THRESHOLD}) → Using Gemini only")

    context_block = "\n\n---\n".join(contexts[:5]) if contexts else ""
    gm = genai.GenerativeModel("gemini-2.5-flash")
    full_prompt = f"""
You are a professional agriculture advisor.
Provide clear, structured answers.

QUESTION:
{user_query_en}

CONTEXT (if available):
{context_block}

INSTRUCTIONS:
- Use bullet points.
- Include Disease Name, Symptoms, Cause/Disease Cycle, and Management.
- Keep sentences short and farmer-friendly.
"""
    resp = gm.generate_content(full_prompt)
    answer = (resp.text or "").strip()

    # Store in Pinecone only if no good context was found
    if not contexts and answer.strip():
        try:
            vector_id = hashlib.sha256(user_query_en.encode()).hexdigest()
            upsert_response = index.upsert(
                vectors=[{
                    "id": f"qa-{vector_id}",
                    "values": vec,
                    "metadata": {
                        "text": answer,
                        "question": user_query_en,
                        "source": "gemini-auto"
                    }
                }],
                namespace=namespace
            )
            print("✅ [RAG DEBUG] Upsert response:", upsert_response.to_dict())

            verify = index.query(vector=vec, namespace=namespace, top_k=1, include_metadata=True)
            print("🔍 [RAG DEBUG] Verification query result:", verify)

        except Exception as e:
            print(f"⚠️ Failed to store in Pinecone: {e}")

    return answer, citations, source_type


import uuid
from flask import url_for

def tts_file(text: str, lang_code: str) -> str:
    """Generate TTS audio, save to static/audio/, return URL."""
    try:
        if not text.strip():
            print("⚠️ [TTS] No text to speak.")
            return ""

        tts = gTTS(text=text, lang=lang_code)
        os.makedirs("static/audio", exist_ok=True)

        # Unique filename
        filename = f"reply_{uuid.uuid4().hex}.mp3"
        filepath = os.path.join("static/audio", filename)

        tts.save(filepath)
        print(f"✅ [TTS] Saved file: {filepath}")

        # Return public URL
        return url_for("static", filename=f"audio/{filename}", _external=True)

    except Exception as e:
        print(f"❌ [TTS ERROR] {e}")
        traceback.print_exc()
        return ""




def stt_transcribe(file_path: str) -> Tuple[str, str]:
    segments, info = whisper.transcribe(file_path, task="transcribe", vad_filter=True)
    out_text = "".join([seg.text for seg in segments]).strip()
    lang_code = info.language or lang_of_text(out_text) or "en"
    return out_text, lang_code
@app.route("/tmp_tts/<filename>")
def serve_audio(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename, mimetype="audio/mp3")
@app.route("/image-disease", methods=["POST"])
def image_disease():
    try:
        image_files = request.files.getlist("images")
        if not image_files:
            return jsonify({"error": "No images provided"}), 400

        user_query = request.form.get("user_query", "").strip()
        os.makedirs("tmp_images", exist_ok=True)
        results = []

        for i, image_file in enumerate(image_files):
            tmp_path = os.path.join("tmp_images", f"input_{i}.jpg")
            image_file.save(tmp_path)

            disease_name = classify_disease_image(tmp_path)
            namespace = ensure_user_namespace(None)

            # Build query: include user text if present
            query_text = f"Give structured details for {disease_name} disease (Symptoms, Cause, Management)"
            if user_query:
                query_text += f". {user_query}"

            answer_en, citations, source_type = hybrid_answer(query_text, namespace)

            results.append({
                "predicted_disease": disease_name,
                "reply_text": answer_en,
                "citations": citations,
                "source_type": source_type
            })

        return jsonify({"results": results})

    except Exception as e:
        print(f"❌ /image-disease error: {e}")
        traceback.print_exc()  # 🔥 print full stack trace
        return jsonify({"error": str(e)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        user_text = (data.get("message") or "").strip()
        user_phone = (data.get("userPhone") or "").strip()

        if not user_text:
            return jsonify({"error": "message is required"}), 400

        user_lang = lang_of_text(user_text)
        query_en = to_english(user_text)
        namespace = ensure_user_namespace(user_phone)

        answer_en, citations, source_type = hybrid_answer(query_en, namespace)
        answer_out = from_english(answer_en, user_lang)

        return jsonify({
            "reply_text": answer_out,
            "language": user_lang,
            "citations": citations,
            "source_type": source_type
        })
    except Exception as e:
        print(f"❌ /chat error: {e}")
        traceback.print_exc()  # shows exact cause
        return jsonify({"error": str(e)}), 500



import subprocess

@app.route("/voice", methods=["POST"])
def voice():
    try:
        if "audio" not in request.files:
            return jsonify({"error": "audio file is required"}), 400

        audio_file = request.files["audio"]
        user_phone = request.form.get("userPhone", "").strip()

        os.makedirs("tmp_audio", exist_ok=True)
        tmp_path = os.path.join("tmp_audio", "in.webm")
        audio_file.save(tmp_path)
        print(f"✅ Saved audio file at: {tmp_path}")

        # STT
        user_text, user_lang = stt_transcribe(tmp_path)
        print(f"✅ Transcribed text: {user_text} | Lang: {user_lang}")

        if not user_text:
            return jsonify({
                "error": "No speech detected",
                "reply_text": "I couldn't hear anything. Please try again.",
                "reply_audio_url": ""
            }), 200

        # Hybrid Answer
        namespace = ensure_user_namespace(user_phone)
        query_en = to_english(user_text)
        answer_en, citations, source_type = hybrid_answer(query_en, namespace)
        answer_out = from_english(answer_en, user_lang)

        # ✅ Generate file instead of base64
        audio_url = tts_file(answer_out, user_lang)

        return jsonify({
            "user_text": user_text,
            "user_lang": user_lang,
            "reply_text": answer_out,
            "reply_lang": user_lang,
            "reply_audio_url": audio_url,
            "citations": citations,
            "source_type": source_type
        })

    except Exception as e:
        print(f"❌ /voice error: {e}")
        traceback.print_exc()
        return jsonify({
            "error": "Server error while processing voice message",
            "reply_text": "⚠️ Something went wrong while processing your voice message.",
            "reply_audio_url": ""
        }), 200



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
