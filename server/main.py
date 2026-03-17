"""
Telepath — AI Meeting Intelligence
FastAPI backend: Gemini Live relay for video/audio analytics.
"""

import asyncio
import base64
import json
import logging
import os
import pathlib
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR = pathlib.Path(__file__).parent.parent
SERVER_DIR = pathlib.Path(__file__).parent

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
LIVE_MODEL     = "models/gemini-2.0-flash-exp"

# ── System Prompt ─────────────────────────────────────────────────────────────
TELEPATH_PROMPT = """You are Telepath, an advanced AI designed to understand the emotional and cognitive state of a meeting.
You observe through video frames and listen to the audio stream.

Your goal is to provide real-time insights to the moderator. 
Analyze:
- Facial expressions (confusion, boredom, excitement)
- Tone and speaking patterns
- Social dynamics (who is being interrupted, who hasn't spoken)

Be subtle but helpful. 
When you detect something important, call 'update_meeting_dashboard'.

Dashboard Guidelines:
- Understanding level: 0-100%
- Engagement level: 0-100%
- alert: A short message like "Confusion spike detected" or "Energy is falling" (or null)
- observation: A concise social insight like "Sarah has tried to speak 3 times but was interrupted" or "Budget discussion is causing anxiety."

Respond verbally with calm, insightful observations only when necessary. Don't over-talk."""

# ── Tool Definition ──────────────────────────────────────────────────────────
MEETING_TOOL = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name="update_meeting_dashboard",
            description="Update the live dashboard with meeting metrics and social insights.",
            parameters=types.Schema(
                type=types.Type.OBJECT,
                properties={
                    "understanding": types.Schema(type=types.Type.INTEGER, description="0-100 understanding score"),
                    "engagement":    types.Schema(type=types.Type.INTEGER, description="0-100 engagement score"),
                    "alert":         types.Schema(type=types.Type.STRING, description="Urgent alert message"),
                    "observation":   types.Schema(type=types.Type.STRING, description="Subtle social dynamic observation"),
                },
            ),
        )
    ]
)

LIVE_CONFIG = types.LiveConnectConfig(
    response_modalities=["AUDIO"],
    system_instruction=types.Content(
        role="model",
        parts=[types.Part(text=TELEPATH_PROMPT)],
    ),
    speech_config=types.SpeechConfig(
        voice_config=types.VoiceConfig(
            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
        )
    ),
    tools=[MEETING_TOOL],
)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Telepath")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"Telepath session {session_id} connected")

    if not GEMINI_API_KEY:
        await websocket.send_json({"type": "error", "message": "GEMINI_API_KEY not configured on server."})
        await websocket.close()
        return

    client = genai.Client(api_key=GEMINI_API_KEY)

    try:
        async with client.aio.live.connect(model=LIVE_MODEL, config=LIVE_CONFIG) as gemini:

            async def browser_to_gemini():
                while True:
                    try:
                        msg = await websocket.receive()
                    except (WebSocketDisconnect, RuntimeError):
                        break

                    if msg.get("type") == "websocket.disconnect":
                        break

                    # Audio frame (binary)
                    if "bytes" in msg and msg["bytes"]:
                        await gemini.send(
                            input=types.LiveClientRealtimeInput(
                                media_chunks=[types.Blob(data=msg["bytes"], mime_type="audio/pcm;rate=16000")]
                            )
                        )

                    # JSON message (text)
                    elif "text" in msg and msg["text"]:
                        try:
                            data = json.loads(msg["text"])
                        except:
                            continue

                        # Video frame (image)
                        if data.get("type") == "image":
                            img_bytes = base64.b64decode(data["data"])
                            await gemini.send(
                                input=types.LiveClientRealtimeInput(
                                    media_chunks=[types.Blob(data=img_bytes, mime_type="image/jpeg")]
                                )
                            )
                        elif data.get("type") == "end_turn":
                            await gemini.send(end_of_turn=True)

            async def gemini_to_browser():
                async for response in gemini.receive():
                    try:
                        # Audio output
                        if response.server_content and response.server_content.model_turn:
                            for part in response.server_content.model_turn.parts:
                                if part.inline_data and "audio" in part.inline_data.mime_type:
                                    audio_b64 = base64.b64encode(part.inline_data.data).decode()
                                    await websocket.send_json({"type": "audio", "data": audio_b64})

                        # Tool calls (Dashboard updates)
                        if response.tool_call:
                            for fn in response.tool_call.function_calls:
                                if fn.name == "update_meeting_dashboard":
                                    await websocket.send_json({
                                        "type": "meeting_update",
                                        "payload": dict(fn.args),
                                    })
                                    # Ack tool
                                    await gemini.send(
                                        input=types.LiveClientToolResponse(
                                            function_responses=[
                                                types.FunctionResponse(
                                                    name=fn.name, id=fn.id, response={"result": "Dashboard updated."}
                                                )
                                            ]
                                        )
                                    )
                        
                        # Interruption (Barge-in)
                        if response.server_content and response.server_content.interrupted:
                            await websocket.send_json({"type": "interrupted"})

                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        logger.error(f"Receive loop error: {e}")

            send_task    = asyncio.create_task(browser_to_gemini())
            receive_task = asyncio.create_task(gemini_to_browser())
            done, pending = await asyncio.wait(
                [send_task, receive_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()

    except Exception as e:
        logger.error(f"Telepath fatal error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass

# ── Serve frontend static files ───────────────────────────────────────────────
@app.get("/")
async def serve_index():
    return FileResponse(ROOT_DIR / "index.html")

app.mount("/", StaticFiles(directory=str(ROOT_DIR), html=False), name="static")
