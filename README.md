# Cull

Local AI-powered photo culling for photographers.

Drop in a batch of photos, describe what you're looking for in plain language ("golden light, candid moments, sharp focus"), and Cull turns that into structured criteria, evaluates every photo against them, and hands back keeps and cuts with one-sentence reasoning per shot.

All vision inference runs locally through [Ollama](https://ollama.com) — your photos never leave your machine, and there's no cloud API key needed for culling.

---

## How it works

```
upload → loaded → tasting → processing → results
```

1. **Upload** — drag and drop a folder of photos (or browse).
2. **Tasting** — describe your taste. As you type, Cull asks the model for 3 structured culling criteria (`signal`, `weight`, `description`). The panel is **editable** — tweak the signals, descriptions, and weights before you commit.
3. **Processing** — each photo is sent at full resolution to `llava:7b` along with your criteria. `high`-weight criteria are framed as hard requirements, so an explicit "no closed eyes" isn't overridden by general quality scoring.
4. **Results** — a two-column keeps/cuts grid with a detail panel. Move photos between piles, star them, and undo (5-second window). Photos you override are tagged with a **"Manually moved"** pill so it's always clear what the model decided vs. what you did.

## Requirements

- Node.js 18+
- [Ollama](https://ollama.com) running locally
- The `llava:7b` model

```bash
ollama pull llava:7b
```

## Getting started

```bash
git clone https://github.com/jc1198/cull.git
cd cull
npm install
npm run dev
```

`npm run dev` starts two processes concurrently:

| Process | Port | Purpose |
|---------|------|---------|
| Vite dev server | 5173 | The React app |
| Express proxy (`proxy.js`) | 3001 | Bridges the browser to Ollama on `:11434`, avoiding CORS |

Then open http://localhost:5173.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite + proxy together |
| `npm run proxy` | Proxy only |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 |
| Vision model | `llava:7b` via Ollama |
| Proxy | Express 5 |
| Legacy (unused in the current flow) | Gemini 2.5 Flash, Anthropic Claude Haiku |

## Project layout

```
cull/
├── proxy.js                  # Express proxy: GET /health, POST /evaluate → Ollama
├── src/
│   ├── App.jsx               # Root component; owns app state and step transitions
│   ├── lib/
│   │   ├── ollama.js         # Active inference layer (buildCullCriteria, evaluatePhoto)
│   │   ├── mock.js           # Mock responses for offline dev
│   │   ├── cullPhoto.js      # Gemini per-photo eval (legacy)
│   │   ├── extractIntents.js # Gemini intent extraction (legacy)
│   │   ├── gemini.js         # Gemini fetch wrapper (legacy)
│   │   ├── anthropic.js      # Anthropic SDK client (legacy)
│   │   └── refineResults.js  # Claude Haiku conversational refinement (not wired into the UI)
│   └── components/
│       ├── Nav.jsx           ├── DropZone.jsx       ├── ThumbnailGrid.jsx
│       ├── TasteBanner.jsx   ├── TastingScreen.jsx  ├── ProcessingView.jsx
│       ├── ResultsView.jsx   ├── CUIBar.jsx         └── ChipRow.jsx
```

## Environment variables

Everything in the current culling flow works with no configuration. The optional keys below belong to the pre-Ollama modules and go in a `.env.local` (git-ignored):

| Variable | Purpose |
|----------|---------|
| `VITE_MOCK_API` | `true` to use canned responses instead of real API calls |
| `VITE_GEMINI_API_KEY` | Gemini key for the legacy `cullPhoto.js` / `extractIntents.js` path |
| `VITE_ANTHROPIC_API_KEY` | Anthropic key for `refineResults.js` |

Note: `VITE_MOCK_API` is only honoured by the legacy Gemini/Anthropic modules. The active Ollama path in `ollama.js` has no mock gate — stub the proxy response if you need to develop without Ollama running.

## Implementation notes

- **Full-resolution images.** Photos are read from the original `File` object, not a thumbnail or object URL. Downscaling was tried and reverted — llava needs the full frame for sharpness and exposure judgements.
- **Resilient JSON parsing.** `llava:7b` sometimes wraps output in markdown fences or nests the array. `ollama.js` strips fences, regex-extracts the first `[…]`/`{…}`, normalises nested shapes, and falls back to keyword inference on the raw text if parsing fails entirely.
- **Base64 handling.** Ollama's `images` field expects raw base64, so the `data:image/...;base64,` prefix is stripped before the request.
- **Single-call evaluation.** A two-call (describe, then judge) approach existed for Moondream compatibility; it was dropped once the model moved to llava, which handles structured JSON in one pass.

## License

No license specified.
