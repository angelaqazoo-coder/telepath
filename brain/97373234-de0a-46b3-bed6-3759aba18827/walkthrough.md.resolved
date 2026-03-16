# Cogito — Full Stack Walkthrough

## What Was Built

A complete AI Cognitive Companion app using **Gemini Live API** for real-time voice I/O,
with a redesigned 2-panel UI (no text chat — math only).

---

## File Structure

```
Antigravity/
├── server/
│   ├── main.py          ← FastAPI: WebSocket relay + image analysis API
│   ├── requirements.txt ← Python deps (google-genai, fastapi, uvicorn…)
│   └── __init__.py
├── Dockerfile           ← Cloud Run deployment
├── .env.example         ← Copy to .env, add your GEMINI_API_KEY
├── audio-processor.js   ← AudioWorklet: mic → PCM16 at 16 kHz
├── index.html           ← 2-panel shell (no text chat)
├── style.css            ← Dark theme, annotation SVG, workspace styles
└── app.js               ← WebSocket client, audio I/O, KaTeX, flowchart
```

---

## How to Run Locally

```bash
# 1. Copy env and add your API key
cp .env.example .env
# Edit .env: GEMINI_API_KEY=AIza…

# 2. Create venv (already done)
python3 -m venv .venv && .venv/bin/pip install -r server/requirements.txt

# 3. Start the server
GEMINI_API_KEY=<your_key> .venv/bin/uvicorn server.main:app --port 8000 --reload

# 4. Open in browser
open http://localhost:8000
```

---

## What the UI Looks Like

### Initial State (server running)
![Redesigned 2-panel UI — Problem upload + Workspace empty state](/Users/angela/.gemini/antigravity/brain/97373234-de0a-46b3-bed6-3759aba18827/initial_load_ui_1773683698418.png)

### UI Recording
![Browser walkthrough of redesigned UI](/Users/angela/.gemini/antigravity/brain/97373234-de0a-46b3-bed6-3759aba18827/cogito_redesigned_ui_check_1773683671614.webp)

---

## How It Works (End-to-End)

```
1. Upload screenshot  →  POST /api/analyze  →  Gemini Vision
                          → returns annotation boxes + topics + summary
                          → frontend draws SVG overlays on image

2. Click mic  →  AudioWorklet captures PCM16 at 16 kHz
              →  WebSocket sends binary audio frames to FastAPI
              →  FastAPI relays to Gemini Live API

3. Gemini Live processes voice + image context
              →  Speaks back via TTS audio (Puck voice)
              →  Calls render_workspace tool with:
                   { latex, status, step_label, hint_text, corrected_latex, annotation_region }

4. FastAPI receives tool call  →  sends { type: "workspace_update" } to browser
   FastAPI receives audio chunks →  sends { type: "audio", data: base64_pcm } to browser

5. Browser:
   - Plays audio via Web Audio API (queued AudioBufferSourceNodes)
   - Renders LaTeX with KaTeX (green/red/yellow border)
   - Shows diff if status=error (wrong version + corrected version)
   - Shows hint card (💡 hint / ⚠️ fallacy / 📖 theory)
   - Highlights annotation region on problem image (dashed purple ring)
   - Adds node to SVG flowchart
```

---

## Deploy to Cloud Run

```bash
# Build and deploy
gcloud run deploy cogito \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=<your_key>
```

> [!IMPORTANT]
> You need a valid `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/) with access to `gemini-2.0-flash-live-001`.

---

## Verified

- ✅ Server boots cleanly (`Application startup complete`)
- ✅ 2-panel layout renders correctly at 1440×860
- ✅ Problem panel: upload zone with drag/drop + paste
- ✅ Workspace panel: empty state with mic prompt
- ✅ Bottom bar: mic button + waveform + volume slider
- ✅ Status pill shows "Cogito · Live" when WebSocket connects
- ✅ No fatal console errors (404 /favicon.ico is non-critical)
- ✅ `system_instruction` type error fixed (wrapped in `types.Content`)
