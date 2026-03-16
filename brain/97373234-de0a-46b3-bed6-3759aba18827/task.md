# Cogito — Hackathon Score Improvements

## Phase 1: Presentation (30% of score)
- [ ] README.md with architecture diagram
- [ ] Cloud Run deployment

## Phase 2: Innovation — barge-in (40% of score)
- [ ] Backend: detect `server_content.interrupted`, send `{type:"interrupted"}` to browser
- [ ] Frontend: track active AudioBufferSourceNodes
- [ ] Frontend: on `interrupted`, stop all queued audio, reset playback queue

## Phase 3: Innovation — image generation (40% of score)
- [ ] Backend: `/api/generate_diagram` endpoint using `gemini-2.5-flash-image`
- [ ] Frontend: "Visualise" button in workspace
- [ ] Frontend: diagram display card in workspace
- [ ] style.css: diagram card styles

## Phase 4: Cloud Run Deploy
- [ ] Check gcloud CLI installed
- [ ] Deploy to Cloud Run with GEMINI_API_KEY env var

## Phase 5: Verification
- [ ] Barge-in test: speak while AI is talking
- [ ] Image generation test: click Visualise
- [ ] Cloud Run URL accessible
- [ ] Update walkthrough
