/**
 * Telepath — telepath.js
 * Frontend logic for Camera/Mic capture and real-time dashboard updates.
 */
'use strict';

const $ = id => document.getElementById(id);

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const elWebcam       = $('webcam');
const elCanvas       = $('frame-canvas');
const elStartBtn     = $('start-btn');
const elMicBtn       = $('mic-btn');
const elStatusLabel  = document.querySelector('.status-label');
const elStatusPill   = $('connection-status');
const elClock        = $('session-clock');
const elUnderstanding = $('metric-understanding');
const elEngagement    = $('metric-engagement');
const elObservations  = $('observations-list');
const elAlertConfusion = $('alert-confusion');
const elWaveform      = $('waveform-display');
const elWaveIdle      = $('wave-idle-label');

/* ── Config ──────────────────────────────────────────────────────────────── */
const WS_URL = (() => {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host  = location.host || 'localhost:8000';
  return `${proto}://${host}/ws`;
})();

const SESSION_ID = crypto.randomUUID();
const FRAME_RATE = 1; // 1 fps for video capture
const MIC_SAMPLE_RATE = 16000;
const AI_SAMPLE_RATE  = 24000;

/* ── State ───────────────────────────────────────────────────────────────── */
const state = {
  active: false,
  connected: false,
  recording: false,
  timerSec: 0,
  timerHandle: null,
  stream: null,
  ws: null,
  frameInterval: null,
  audioCtx: null,
  playCtx: null,
  nextPlayTime: 0,
  gainNode: null,
};

/* ── Initialization ──────────────────────────────────────────────────────── */
elStartBtn.addEventListener('click', startSession);

async function startSession() {
  elStartBtn.classList.add('hidden');
  elMicBtn.classList.remove('hidden');
  
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    
    elWebcam.srcObject = state.stream;
    state.active = true;
    
    connectWS();
    startCapture();
    initAudio();
    startTimer();
    
    setStatus('online', 'Live Analysis');
  } catch (err) {
    console.error('Permission denied:', err);
    alert('Camera/Mic permission is required for Telepath.');
    elStartBtn.classList.remove('hidden');
  }
}

function setStatus(cls, label) {
  elStatusPill.className = `status-pill status-${cls}`;
  elStatusLabel.textContent = label;
}

/* ── WebSocket ───────────────────────────────────────────────────────────── */
function connectWS() {
  const url = `${WS_URL}/${SESSION_ID}`;
  state.ws = new WebSocket(url);
  state.ws.binaryType = 'arraybuffer';

  state.ws.addEventListener('open', () => {
    state.connected = true;
  });

  state.ws.addEventListener('message', onWsMessage);
  
  state.ws.addEventListener('close', () => {
    state.connected = false;
    setStatus('offline', 'Disconnected');
    stopSession();
  });
}

function onWsMessage(evt) {
  if (typeof evt.data === 'string') {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'audio')            handleAudioChunk(msg.data);
    else if (msg.type === 'meeting_update') handleMeetingUpdate(msg.payload);
  }
}

/* ── Video Capture ────────────────────────────────────────────────────────── */
function startCapture() {
  state.frameInterval = setInterval(() => {
    if (!state.connected) return;
    
    const context = elCanvas.getContext('2d');
    elCanvas.width = 300; // Lower res for Gemini optimization
    elCanvas.height = 225;
    context.drawImage(elWebcam, 0, 0, elCanvas.width, elCanvas.height);
    
    const dataUrl = elCanvas.toDataURL('image/jpeg', 0.6);
    const base64 = dataUrl.split(',')[1];
    
    sendJSON({ type: 'image', data: base64 });
  }, 1000 / FRAME_RATE);
}

function sendJSON(obj) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(obj));
  }
}

/* ── Audio Processing ────────────────────────────────────────────────────── */
async function initAudio() {
  state.audioCtx = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
  await state.audioCtx.audioWorklet.addModule('audio-processor.js');
  
  const source = state.audioCtx.createMediaStreamSource(state.stream);
  const workletNode = new AudioWorkletNode(state.audioCtx, 'pcm-processor');
  
  workletNode.port.onmessage = e => {
    if (state.ws?.readyState === WebSocket.OPEN) {
      state.ws.send(e.data); // Binary PCM
    }
  };
  
  source.connect(workletNode);
  
  // Playback Context
  state.playCtx = new AudioContext({ sampleRate: AI_SAMPLE_RATE });
  state.gainNode = state.playCtx.createGain();
  state.gainNode.connect(state.playCtx.destination);
}

function handleAudioChunk(base64) {
  const ctx = state.playCtx;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  
  const pcm16 = new DataView(bytes.buffer);
  const samples = bytes.length / 2;
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float32[i] = pcm16.getInt16(i * 2, true) / 32768;
  }
  
  const buf = ctx.createBuffer(1, float32.length, AI_SAMPLE_RATE);
  buf.copyToChannel(float32, 0);
  
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(state.gainNode);
  
  const startAt = Math.max(state.nextPlayTime, ctx.currentTime + 0.05);
  src.start(startAt);
  state.nextPlayTime = startAt + buf.duration;
}

/* ── Dashboard Logic ─────────────────────────────────────────────────────── */
function handleMeetingUpdate(payload) {
  const { understanding, engagement, alert, observation } = payload;
  
  if (understanding !== undefined) {
    elUnderstanding.querySelector('.metric-value').textContent = `${understanding}%`;
    elUnderstanding.querySelector('.progress-bar-fill').style.width = `${understanding}%`;
  }
  
  if (engagement !== undefined) {
    elEngagement.querySelector('.metric-value').textContent = `${engagement}%`;
    elEngagement.querySelector('.progress-bar-fill').style.width = `${engagement}%`;
  }
  
  if (alert) {
    elAlertConfusion.classList.remove('hidden');
    elAlertConfusion.querySelector('.alert-text').textContent = alert;
    setTimeout(() => elAlertConfusion.classList.add('hidden'), 5000);
  }
  
  if (observation) {
    const item = document.createElement('div');
    item.className = 'observation-item';
    if (observation.toLowerCase().includes('interrupted')) item.classList.add('important');
    item.textContent = observation;
    elObservations.prepend(item);
    
    // Keep only last 5
    while (elObservations.children.length > 5) {
      elObservations.removeChild(elObservations.lastChild);
    }
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function startTimer() {
  state.timerHandle = setInterval(() => {
    state.timerSec++;
    const m = String(Math.floor(state.timerSec / 60)).padStart(2,'0');
    const s = String(state.timerSec % 60).padStart(2,'0');
    elClock.textContent = `${m}:${s}`;
  }, 1000);
}

function stopSession() {
  clearInterval(state.frameInterval);
  clearInterval(state.timerHandle);
  state.stream?.getTracks().forEach(t => t.stop());
}
