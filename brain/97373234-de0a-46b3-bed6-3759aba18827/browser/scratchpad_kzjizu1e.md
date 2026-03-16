# Cogito Server Testing Plan
- [x] Open http://localhost:8000/ and hard refresh
- [x] Wait 3 seconds
- [x] Take screenshot and save to specified path
- [x] Check console for errors and WS state
- [x] Verify status pill (Cogito · Live)
- [x] Report findings

## Findings
- Status Pill: "Cogito · Live" with a **GREEN** dot.
- WebSocket State: `1` (OPEN).
- Console Errors:
  - `Server error: received 1008 (policy violation) Generative Language API has not been used in project 305248837586 before or it is disabled.`
  - `Server error: received 1008 (policy violation) models/gemini-2.0-flash-live-001 is not found for API version v1beta, or is not supported for bidiGenerateContent.`
- Screenshot saved at: `/Users/angela/.gemini/antigravity/brain/97373234-de0a-46b3-bed6-3759aba18827/cogito_live_test_1773685064699.png`