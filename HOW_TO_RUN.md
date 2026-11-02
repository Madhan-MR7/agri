# How to run AgriBot

A step-by-step guide to run the whole app on a Windows PC with an Android phone. You start
three things, each in its own terminal:

| # | What | Where |
|---|---|---|
| 1 | Databases (PostgreSQL, MongoDB, Neo4j) | Docker |
| 2 | Backend API (FastAPI) | `backend/` |
| 3 | Mobile app (React Native / Expo) | `mobile/`, opened in **Expo Go** on your phone |

The first-time setup downloads roughly 1.5 GB (Docker images, PyTorch, npm packages). After that,
starting the app takes about a minute.

---

## 0. Install the tools (one time)

| Tool | Version | Get it |
|---|---|---|
| Git | any | https://git-scm.com/download/win |
| Docker Desktop | latest | https://www.docker.com/products/docker-desktop |
| Python | **3.12** (3.11 also works; avoid 3.13+) | https://www.python.org/downloads/ — tick "Add to PATH" |
| Node.js | 20 or 22 LTS | https://nodejs.org |
| Expo Go | latest | Play Store / App Store on your phone |

You also need:
- A **Gemini API key**: https://aistudio.google.com/apikey
- A **Pinecone API key** and the name of the index holding the crop-disease documents:
  https://app.pinecone.io (ask the project owner for the index name)

## 1. Get the code

```bash
git clone https://github.com/Madhan-MR7/agri.git
cd agri
```

## 2. Create your `.env` (secrets)

Copy the template and fill in your keys:

```bash
copy .env.example .env
```

Open `.env` and set at least:

```ini
GEMINI_API_KEY=your-gemini-key
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX=your-index-name
```

> **Never commit `.env` or paste keys into any other file.** `.env` is gitignored. If a key ever
> reaches GitHub, Google and Pinecone may disable it, so delete it and create a new one.

The database settings in `.env.example` already match `docker-compose.yml`; leave them as they are.

## 3. Start the databases (terminal 1)

Open **Docker Desktop** and wait until it shows **Engine running**, then:

```bash
docker compose up -d
docker compose ps
```

All three containers should be `running (healthy)` after a minute:

| Database | Address on your PC | Used for |
|---|---|---|
| PostgreSQL | `localhost:5433` | farmers, crop recommendations |
| MongoDB | `localhost:27018` | chat history, disease reports |
| Neo4j | `localhost:7687`, browser UI http://localhost:7474 | knowledge graph (graph RAG) |

> The ports are **5433** and **27018** (not the defaults 5432/27017) so they don't clash with a
> PostgreSQL or MongoDB already installed on Windows.

## 4. Set up and start the backend (terminal 2)

### 4.1 Create the virtual environment (one time)

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate
```

Your prompt now starts with `(.venv)`. Run `.venv\Scripts\activate` again in every new terminal
you use for the backend.

### 4.2 Install packages (one time)

Install the CPU version of PyTorch **first**. Otherwise pip downloads the much larger GPU build.

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install --default-timeout=120 --retries 10 -r requirements.txt
```

**Slow or unstable internet?** pip can't resume an interrupted download. If it stalls on PyTorch,
download the wheel in your browser instead (it can resume), then install that file. For Python
3.12 on Windows:

1. Open the CPU wheel list and download the `torch-…+cpu-cp312-cp312-win_amd64.whl` file for the
   newest version: https://download.pytorch.org/whl/cpu/torch/
2. Install it, then the rest:
   ```bash
   pip install "%USERPROFILE%\Downloads\torch-<version>+cpu-cp312-cp312-win_amd64.whl"
   pip install torchvision --index-url https://download.pytorch.org/whl/cpu
   pip install --default-timeout=120 --retries 10 -r requirements.txt
   ```

### 4.3 Train the crop recommendation model (one time)

```bash
python -m ml.train_crop_model
```

This takes under a minute. With no dataset it uses built-in demo data. To use real data, put a CSV
at `backend/ml/data/crop_recommendation.csv` (columns: `N, P, K, temperature, humidity, ph,
rainfall, soil_moisture, soil_type, water_availability, label`; the Kaggle "Crop
Recommendation" dataset works) and run the command again.

### 4.4 (Optional) Load the knowledge graph

```bash
python -m graph.ingest graph/sample_triples.csv
```

### 4.5 Start the API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Wait for `Application startup complete.` Then open http://localhost:8000/docs in your browser to
see and try every endpoint. Leave this terminal running.

> Use `--host 0.0.0.0` (not the default `127.0.0.1`), otherwise your phone can't connect.

## 5. Start the mobile app (terminal 3)

### 5.1 Install packages (one time)

```bash
cd mobile
npm install
```

If `npm install` stops with `ENOTEMPTY` or a network error, delete the half-finished folder and run
it again:

```bash
rmdir /s /q node_modules
npm install --prefer-offline
```

### 5.2 Start Expo

```bash
npx expo start
```

A QR code appears. Make sure your **phone and PC are on the same Wi-Fi** (or the PC is connected
to your phone's hotspot), then:

- **Android**: open **Expo Go**, then **Scan QR code**
- **iPhone**: scan the QR code with the **Camera** app

The app finds the backend automatically at `http://<your PC's IP>:8000`. It shows the address it
uses under **Settings** (gear icon). To use a different address, copy `mobile/.env.example` to
`mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL`, and restart with `npx expo start --clear`.

**Android emulator instead of a phone:** start an emulator from Android Studio's Device Manager,
then press `a` in the Expo terminal.

## 6. Allow your phone through the Windows firewall (one time)

If the app says **"Cannot reach the server"** while http://localhost:8000/health works on the PC,
the Windows Firewall is blocking the phone. This always happens when Windows marks your Wi-Fi as a
**Public** network. Fix it with **one** of these:

- **Settings → Network & internet → Wi-Fi → (your network) → Network profile type → Private**
  (only for your home Wi-Fi or your own hotspot), or
- Allow the API port. Open PowerShell **as administrator** and run:
  ```powershell
  New-NetFirewallRule -DisplayName "AgriBot API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private,Public
  ```

If Windows pops up "Allow Node.js / Python on networks?", click **Allow**.

## 7. Use the app

1. **Sign up**: phone number, name, village and preferred language (10 Indian languages).
2. **Recommend**: enter soil N, P, K, pH, moisture, climate, soil type and water availability.
   You get the best crops and a SHAP chart explaining which factors mattered.
3. **Dashboard**: your recommendation history, crop distribution, soil-nutrient trend, and the
   factors driving your results.
4. **Ask**: type or speak a farming question. The answer comes in your language, from the
   document knowledge base (Pinecone), the knowledge graph (Neo4j) and Gemini.
5. **Disease**: photograph or upload leaves. The YOLOv8 model draws a box around every leaf,
   names the disease, and AgriBot explains the remedies.
   Supported crops: apple, bell pepper, blueberry, cherry, corn, grape, peach, potato, raspberry,
   soybean, squash, strawberry, tomato.

## Every day after setup

```bash
# Terminal 1: databases (Docker Desktop must be running)
docker compose up -d

# Terminal 2: backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 3: app
cd mobile
npx expo start
```

## Troubleshooting

| Problem | Cause and fix |
|---|---|
| `password authentication failed for user "agribot"` | A Windows PostgreSQL is answering instead of Docker. Make sure `DATABASE_URL` in `.env` uses port **5433**. |
| `MongoDB unavailable at startup: Authentication failed` | Same for MongoDB: `MONGO_URL` must use port **27018**. |
| App: "Cannot reach the server" | Backend not running, phone on a different network, or firewall (see step 6). |
| App: "The AI service is unavailable … API key was reported as leaked" | Your Gemini key was exposed and disabled. Create a new one and update `.env`. |
| `404 models/... is not found` from Gemini | A model was retired. Set `GEMINI_CHAT_MODEL` / `GEMINI_EMBED_MODEL` in `.env` to a current model. |
| Disease tab: "Disease model not found" | `backend/models/plantdoc_yolov8n.pt` is missing. Restore it from git. |
| Disease tab: "No leaf detected" | Take a closer, well-lit photo of the leaf. |
| Recommend: "No crop model" | Run `python -m ml.train_crop_model` in `backend/`. |
| `'expo' is not recognized` | `npm install` didn't finish. Run it again in `mobile/`. |
| Code changes don't show on the phone | Shake the phone and tap **Reload**, or press `r` in the Expo terminal. |

## After switching the embedding model

If you change `GEMINI_EMBED_MODEL`, the vectors already stored in Pinecone no longer match new
questions. Re-embed them once (they keep their text, IDs and metadata):

```bash
cd backend
python -m scripts.reembed_pinecone --dry-run   # shows how many vectors
python -m scripts.reembed_pinecone
```
