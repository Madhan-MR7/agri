# AgriBot

Mobile assistant for farmers: multilingual Q&A (vector + graph RAG), crop disease detection from
photos, and crop recommendation with SHAP explanations on a dashboard.

**New here? Follow [HOW_TO_RUN.md](HOW_TO_RUN.md)** for a step-by-step setup guide (Windows +
Android) with troubleshooting. This README covers the architecture and reference details.

| Layer | Tech |
|---|---|
| Mobile app | React Native + Expo, TypeScript (`mobile/`) |
| API | FastAPI (`backend/`) |
| Structured data: farmers, crop recommendations | PostgreSQL (Docker) |
| Chat history, disease reports | MongoDB (Docker) |
| Knowledge graph for graph RAG | Neo4j (Docker) |
| Vector RAG | Pinecone + Gemini embeddings |
| LLM / translation | Gemini |
| Crop recommendation | scikit-learn RandomForest + SHAP TreeExplainer |
| Disease detection | YOLOv8-nano trained on PlantDoc, 30 classes / 13 crops (`backend/models/plantdoc_yolov8n.pt`) |
| Voice | faster-whisper (STT) + gTTS (TTS) |

## 1. Start the databases

Requires Docker Desktop running.

```bash
docker compose up -d
```

- PostgreSQL → `localhost:5433`, MongoDB → `localhost:27018`
- Neo4j → bolt `localhost:7687`, browser UI at http://localhost:7474 (user `neo4j`)

Credentials default to the values in `.env.example`; copy the database section into your `.env`
to change them.

## 2. Run the backend

Use Python 3.11 or 3.12 (TensorFlow does not support every newer version yet).

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Disease detection uses the YOLOv8n PlantDoc model at `backend/models/plantdoc_yolov8n.pt`
(mAP50 0.53 on PlantDoc validation). Install CPU PyTorch first so pip doesn't fetch the much larger
CUDA build:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

It detects every leaf in a photo with a box and one of 30 PlantDoc classes (apple, bell pepper,
blueberry, cherry, corn, grape, peach, potato, raspberry, soybean, squash, strawberry, tomato).
To use a retrained model, replace the `.pt` file or set `DISEASE_MODEL_PATH`.

Train the crop recommendation model (see "Crop recommendation data" below):

```bash
python -m ml.train_crop_model
```

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs: http://localhost:8000/docs

### Main endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/farmers` | Create / update farmer profile (PostgreSQL) |
| POST | `/api/chat` | Text question → answer in the farmer's language |
| POST | `/api/voice` | Audio question → text + spoken answer |
| POST | `/api/disease/detect` | Leaf image(s) → detected leaves with boxes + remedies |
| GET | `/api/crop/model-info` | Features, crops, global SHAP importance |
| POST | `/api/crop/recommend` | Soil/climate inputs → top crops + SHAP |
| GET | `/api/dashboard/{phone}` | Everything the crop dashboard shows |
| GET | `/api/graph/status` | Node / relationship counts in Neo4j |
| POST | `/api/graph/facts` | Debug: graph facts retrieved for a question |

## 3. Run the mobile app (React Native + Expo)

Install the **Expo Go** app on your Android phone or iPhone (Play Store / App Store).

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone). The phone and PC must be on
the same Wi-Fi. The app calls the backend at `http://<PC's IP>:8000` automatically. To use another
address, copy `mobile/.env.example` to `mobile/.env` and set `EXPO_PUBLIC_API_BASE_URL`.

If the phone can't connect, allow ports 8081 (Expo) and 8000 (API) through Windows Firewall, or
start Expo with `npx expo start --tunnel`. Note that `--tunnel` only exposes Expo, not the API, so
the API still needs to be reachable on your LAN.

Android emulator: start it from Android Studio, then press `a` in the Expo terminal.

Code layout: routes live in `mobile/src/app/` (Expo Router: `(tabs)/index.tsx` is the crop
dashboard, plus `chat`, `disease`, `recommend`, `result`, `settings`). Shared code lives in
`src/lib/` (API client, session) and `src/components/` (UI, SHAP/pie/line charts).

## Crop recommendation data

Features: N, P, K, temperature, humidity, pH, rainfall, soil moisture, soil type and water availability.

- Put your dataset at `backend/ml/data/crop_recommendation.csv` (or pass `--csv`). It needs a `label`
  column plus any of the feature columns above. The Kaggle "Crop Recommendation" dataset works
  as-is. Features missing from your CSV are left out of the model.
- With no CSV, the trainer generates a **synthetic demo dataset** from typical agronomic ranges so
  the app works end to end. Retrain on real data before trusting the recommendations. The dashboard
  shows which data source the model was trained on.

## Graph RAG (Neo4j)

Chat and disease answers combine three sources: Pinecone document chunks, Neo4j knowledge-graph
facts (2-hop neighbourhood of entities named in the question), and Gemini. Graph facts let the bot
answer multi-step questions, such as "which fungicide treats the rust that attacks wheat in cool
humid weather?".

Load triples (CSV columns `head, head_type, relation, tail, tail_type[, source, ...]`):

```bash
cd backend
python -m graph.ingest graph/sample_triples.csv
```

To build triples from unstructured text (`.txt` / `.md`), extract them with Gemini, review the CSV, then ingest it:

```bash
python -m graph.extract_triples path/to/docs --out graph/import/extracted_triples.csv
python -m graph.ingest graph/import/extracted_triples.csv
```

Check what the graph returns for a question: `POST /api/graph/facts {"question": "..."}`.
