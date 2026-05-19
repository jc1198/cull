# Cull — Project Documentation

## Overview

Cull is a local AI-powered photo culling app. A photographer drops in a batch of photos, describes what they're looking for ("golden light, candid moments, sharp focus"), and the app evaluates each photo against structured criteria, surfacing keeps and cuts with one-sentence reasoning per photo.

All inference runs locally via Ollama — no cloud API required for photo evaluation.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 (custom design tokens) |
| Vision model | `llava:7b` via Ollama |
| Proxy | Express 5 (`proxy.js`) on port 3001 |
| Legacy APIs (unused in current flow) | Gemini 2.5 Flash, Anthropic Claude Haiku |

`npm run dev` starts both the Vite dev server and the Express proxy concurrently via `concurrently`.

---

## Key File Paths

```
cull/
├── proxy.js                      # Express proxy — bridges Vite → Ollama (avoids CORS)
├── src/
│   ├── App.jsx                   # Root component; owns all app state and step transitions
│   ├── lib/
│   │   ├── ollama.js             # Active inference layer (buildCullCriteria, evaluatePhoto, fileToBase64)
│   │   ├── mock.js               # Mock responses for offline dev
│   │   ├── cullPhoto.js          # Gemini-based per-photo eval (legacy, not used in current flow)
│   │   ├── extractIntents.js     # Gemini intent extraction (legacy, not used in current flow)
│   │   ├── gemini.js             # Direct Gemini fetch wrapper
│   │   ├── anthropic.js          # Anthropic SDK client (used only by refineResults.js)
│   │   └── refineResults.js      # Claude Haiku conversational refinement (wired up but not called in UI)
│   └── components/
│       ├── Nav.jsx               # Top nav bar (logo + sign-in stub)
│       ├── DropZone.jsx          # Drag-and-drop / browse file picker
│       ├── ThumbnailGrid.jsx     # Grid of loaded photo thumbnails
│       ├── TasteBanner.jsx       # CTA banner after photos load ("Describe your taste →")
│       ├── TastingScreen.jsx     # Taste textarea + editable criteria panel + Run Cull button
│       ├── ProcessingView.jsx    # Progress bar + live thumbnail feed while culling runs
│       ├── ResultsView.jsx       # Two-column keeps/cuts grid + sticky detail panel
│       ├── CUIBar.jsx            # Single-line conversational input bar
│       └── ChipRow.jsx           # Context-sensitive chip row (changes per step)
```

---

## App State Steps

`App.jsx` drives a linear state machine via `step`:

```
upload → loaded → tasting → processing → results
```

| Step | What's shown | Key action |
|------|-------------|-----------|
| `upload` | DropZone + CUIBar + chips | User drops photos |
| `loaded` | ThumbnailGrid + TasteBanner + CUIBar | User clicks "Describe your taste" |
| `tasting` | TastingScreen (textarea + criteria panel) | 800ms debounce calls `buildCullCriteria` on each keystroke; criteria are editable before running |
| `processing` | ProcessingView (progress bar + live thumbnails) | `buildCullCriteria` → loop `evaluatePhoto` per photo |
| `results` | ResultsView (grid + detail panel) | Move to cuts/keeps, star, undo (5s window) |

### Chip sets by step

```js
upload:     ['Landscape', 'Street photo', 'Portrait', 'Events', 'Architecture']
loaded:     ['Moody / dramatic', 'Clean & bright', 'Candid / natural', 'Minimalist']
tasting:    ['No closed eyes', 'Best of duplicates', 'Sharpest frame only', 'Faces in focus']
results:    ['Export selects', 'Show cuts/keeps instead', 'Re-rank by sharpness', 'Starred only']
```

---

## Environment Variables

Stored in `.env.local` (never commit):

| Variable | Purpose |
|----------|---------|
| `VITE_GEMINI_API_KEY` | Gemini API key (used by legacy `cullPhoto.js` / `extractIntents.js`) |
| `VITE_MOCK_API` | Set `true` to use mock responses instead of any real API |
| `VITE_ANTHROPIC_API_KEY` | Anthropic API key (used by `refineResults.js`; dangerouslyAllowBrowser) |

`VITE_MOCK_API` is checked in `cullPhoto.js`, `extractIntents.js`, and `refineResults.js`. The Ollama path in `ollama.js` has no mock gate — mock the proxy endpoint manually if needed.

---

## Mock Mode

Setting `VITE_MOCK_API=true` activates mock responses in the legacy Gemini/Anthropic modules:

- `mockCullPhoto` — alternates keep/cut by index with canned reasoning
- `mockRefineResults` — returns a static filter action
- `MOCK_INTENTS` — static array of intent strings

The current active flow (`ollama.js`) does **not** check `VITE_MOCK_API`. To develop without Ollama running, either stub the proxy response or add a mock gate to `ollama.js` manually.

---

## Ollama-Specific Notes

### Model

`llava:7b` — switched from `moondream` after reliability issues with structured JSON output. `moondream` is still referenced in git history but is no longer used.

Pull the model before first run:
```
ollama pull llava:7b
```

### Proxy

`proxy.js` runs on **port 3001** and forwards to Ollama at `http://localhost:11434`. It exists solely to avoid CORS restrictions from the Vite dev origin (`http://localhost:5173`). The proxy accepts up to 50 MB request bodies.

Endpoints:
- `GET /health` — pings `ollama/api/tags`, returns `{ connected: bool, models: [] }`
- `POST /evaluate` — forwards body directly to `ollama/api/generate`

### Base64 stripping

`fileToBase64` in `ollama.js` returns the full data URL (e.g. `data:image/jpeg;base64,...`). The `stripDataUrl` helper inside `evaluatePhoto` removes the `data:…,` prefix before sending to Ollama — Ollama's `images` field expects raw base64, not a data URL. The `fileToBase64` in `cullPhoto.js` (legacy Gemini path) splits on `,` immediately and returns only the raw base64.

### Full resolution images

Photos are sent to `evaluatePhoto` from `photo.file` (the original `File` object), not from the object URL or any thumbnail. This ensures Ollama receives full-resolution data. The `photo.url` object URL is only used for display.

### JSON parsing robustness

`llava:7b` sometimes wraps output in markdown fences (`` ```json `` ... ` ``` ``) or uses nested structures. `ollama.js` includes:
- `stripFences` — removes `` ``` `` wrappers
- `parseJsonArray` / `parseJsonObject` — regex-extract and parse the first `[…]` or `{…}`
- Nested array normalisation in `buildCullCriteria` for `[[{...}]]`, `[{criteria:[...]}]`, `{criteria:[...]}` shapes
- Plain-text fallback in `evaluatePhoto` if JSON parse fails (infers decision from "keep"/"cut" keywords)

### Criteria weights as hard requirements

`evaluatePhoto` separates `high`-weight criteria from the rest in the prompt — high-weight signals are framed as the **primary requirement** that must be satisfied for a keep, regardless of secondary criteria. This prevents the model from overriding explicit requirements with general quality scoring.

---

## Design Decisions

- **Criteria are editable before running.** The tasting step debounces `buildCullCriteria` on every keystroke (800ms) and displays the criteria panel so photographers can tweak signal names, descriptions, and weights before committing. Criteria built during tasting are reused in the run rather than rebuilt.
- **`originalDecision` is preserved.** Each result stores both `decision` (mutable) and `originalDecision` (set once at evaluation time). The detail panel shows a "Manually moved" pill when they differ, making it clear which photos the user overrode vs. what the model decided.
- **Undo is ephemeral (5s).** Moving a photo to cuts shows an undo banner that auto-dismisses after 5 seconds. There is no persistent undo history.
- **`selectedId` resets on tab switch.** Switching between keeps and cuts clears `selectedId` to prevent the detail panel from showing a photo from the wrong list.
- **No compression before Ollama.** Earlier versions sent downscaled thumbnails; this was reverted because llava needs full-resolution context for quality signals like sharpness and exposure.
- **Single-call JSON approach for `evaluatePhoto`.** A two-call (description + verdict) approach was tried for Moondream compatibility but dropped when the model switched to llava, which handles structured JSON output reliably in a single call.
- **Gemini/Anthropic modules are kept but unused.** `cullPhoto.js`, `extractIntents.js`, `gemini.js`, `anthropic.js`, and `refineResults.js` remain in the codebase as the pre-Ollama foundation. They are not called from `App.jsx`.
