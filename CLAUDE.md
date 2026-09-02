# Cull — Project Documentation

## Overview

Cull is a local AI-powered photo culling app. A photographer drops in a batch of photos,
describes what they're looking for ("golden light, candid moments, sharp focus"), and the
app evaluates each photo against structured criteria, surfacing keeps and cuts with
one-sentence reasoning per photo.

All inference runs locally via Ollama — no cloud API required for photo evaluation.

The UI is **v2**, built from `cull-v2-build-spec.md` and the Figma file
`photography-assistant`, section `v2 UI updates` (node `125:1932`). Where the spec and
the Figma frames disagree, **the frames win** — several spec details were stale.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 (custom design tokens) |
| Type | Kantumruy Pro (Google Fonts) |
| Vision model | `llava:7b` via Ollama |
| Proxy | Express 5 (`proxy.js`) on port 3001 |
| Legacy APIs (unused in current flow) | Gemini 2.5 Flash, Anthropic Claude Haiku |

`npm run dev` starts both the Vite dev server and the Express proxy concurrently.

---

## Layout: canvas + console

Every screen uses two zones.

- **Canvas** — the photos. Fills the space above the console and clips at the console's
  top edge; photos cut off mid-thumbnail rather than the grid reflowing.
- **Console** — a full-bleed frame at the bottom, 1440px max-width, contents on a 1280px
  column (80px gutters). Sizes to its contents rather than holding a fixed height.

**Every** step clips: results was the last screen with a scrolling canvas, and it now
sizes its detail pane to the canvas instead, so `Canvas` has no `scroll` variant left.

`Canvas` owns the 48px gap between the wordmark and screen content (`WORDMARK_GAP`) —
one value in one place. Screens don't set their own top margin; screen 1 used to, and
drifted.

This is a plain flex column — `Wordmark`/canvas `flex-1 min-h-0 overflow-hidden` / console
`shrink-0`. The canvas clips with no measurement code and the console's variable height
(436 set taste, 458 stale, 181 analyzing, 151 results) works for free. **Don't** switch
the console to fixed positioning; it would reintroduce height measurement.

Canvas and console share `#272727`. The console's drop shadow is the **only** thing
separating them — there is no top stroke. A white `border-t` was in an early spec by
mistake and never in the Figma frames; don't reintroduce it. If the boundary ever reads
too weak, deepen `shadow-console` rather than adding a stroke back.

`Console` takes its slots as named props and renders them in a **fixed order**: label row,
progress, description, priorities, chips, buttons. A step omits what it doesn't need;
nothing reorders. The ordering lives in the component, not in each screen.

There is **no nav bar**. The `Cull` wordmark is canvas content at x=80, y=64, 48px Bold.

---

## Key File Paths

```
cull/
├── proxy.js                      # Express proxy — bridges Vite → Ollama (avoids CORS)
├── cull-v2-build-spec.md         # The design spec this UI implements
├── src/
│   ├── App.jsx                   # Root component; owns all app state and step transitions
│   ├── lib/
│   │   ├── ollama.js             # Active inference layer (buildCullCriteria, evaluatePhoto)
│   │   ├── thumbnail.js          # Downscale-on-ingest (see Performance)
│   │   ├── mock.js               # Mock responses — gates the whole UI for offline dev
│   │   ├── cullPhoto.js          # Gemini per-photo eval (legacy, unused)
│   │   ├── extractIntents.js     # Gemini intent extraction (legacy, unused)
│   │   ├── gemini.js             # Direct Gemini fetch wrapper (legacy)
│   │   ├── anthropic.js          # Anthropic SDK client (used only by refineResults.js)
│   │   └── refineResults.js      # Claude Haiku refinement (legacy, not called)
│   └── components/
│       ├── Canvas.jsx            # Canvas zone + wordmark + the 1280 column
│       ├── Wordmark.jsx          # "Cull" as canvas content
│       ├── Console.jsx           # Console shell, StepLabel, StatusLabel, ConsoleLink
│       ├── Button.jsx            # PrimaryButton / SecondaryButton / TextLink
│       ├── DropZone.jsx          # drop target, fills the canvas column (screen 1)
│       ├── ThumbnailGrid.jsx     # 8 × 148×110 grid, +N more tile, analyzing states
│       ├── TasteInput.jsx        # The description textarea (screen 2)
│       ├── PriorityPanel.jsx     # "Cull will prioritize:" + cards + stale note
│       ├── PriorityCard.jsx      # One criterion; weight badge opens the menu
│       ├── WeightMenu.jsx        # HIGH / MED / LOW / divider / Remove
│       ├── ChipRow.jsx           # Two-state constraint chips
│       ├── ProgressBar.jsx       # 6px analyzing bar
│       └── ResultsView.jsx       # Tabs + grid + detail pane (screen 4)
```

---

## App State Steps

```
upload → tasting → processing → results
```

There is **no `loaded` step**. The canvas persists across steps — only the console
changes — so upload goes straight to set taste with the grid already on the canvas.

| Step | Canvas | Console |
|------|--------|---------|
| `upload` | DropZone, filling the canvas, 32px above the console | `Step 1 of 3: Add photos`, `Browse files` |
| `tasting` | Thumbnail grid | description, priorities, chips, buttons, `Revert priorities` |
| `processing` | Same grid, with decision states | `Analyzing N of M`, counts, progress bar, `Cancel` |
| `results` | Tabs + grid + detail pane | `Step 3 of 3: Review results`, exports, `Back to set taste` |

---

## The read cycle (screen 2)

`buildCullCriteria` is called **only on a primary-button click**. Never on a debounce —
the debounced version flickered, and a late response could overwrite good criteria with
fallback defaults.

| State | Panel | Primary |
|-------|-------|---------|
| No read | Placeholder card at reserved height | `Show priorities`, disabled until input exists |
| Current | Cards at full opacity | `Run Cull on N photos` |
| Stale | Cards at 60% + `These priorities reflect your earlier description`, right-aligned in the panel's label row | `Update priorities` |

`isStale` is **derived, never stored**: `input.trim() !== lastRead.description`. If the
user undoes an edit and the text matches again, stale clears on its own. Don't threshold
by edit distance.

`lastRead` snapshots `{ description, chips, criteria }` on **successful reads only**, and
is both the stale comparand and the `Revert priorities` target. The link is named for
its scope — it restores the read snapshot and leaves manual photo moves alone — and is
pinned to the step label's 14px line box so its appearance doesn't move the console's top
edge.

### Merging on re-read

Match by `signal` label: a match keeps the user's weight if `weightSource === 'user'`;
a new label is added at the model's weight; a missing label is dropped. **A criterion that
keeps a user weight keeps `weightSource: 'user'`** — otherwise a second re-read silently
reverts it to the model's weight.

Criteria carry a stable `id`. The merge reorders the array, so index keys would cross-wire
the open weight menu onto the wrong card.

### Why text editing is out

Labels and descriptions are deliberately not editable. The model writes descriptions in
vocabulary it can ground in pixels; a user rewording one produces a criterion the vision
pass can't evaluate, and every result degrades with nothing on screen explaining why.
Weight and remove cover the observed failure. Prose stays in the input. There is no
`+ Add` button — authoring belongs in the input.

---

## Chips are a separate constraint layer

Chips are the user's input, not the model's output. A read never clears them, and they
never write into the description. They do **not** mark the console stale; instead they are
passed to `evaluatePhoto` as hard constraints at evaluation time, so a chip toggled after
a read still shapes the run without forcing a re-read.

---

## Analyzing (screen 3)

Decisions render on the **already-mounted** canvas grid, not as a text log:

- currently evaluating — accent border (the scan line)
- cut — dims to 40%
- keep — full opacity
- not yet reached — unchanged

`MIN_SCAN_MS = 300` holds the scan border before the decision lands; below that it
flickers. The canvas is never auto-scrolled — the console's counter carries progress.

`cancelRef` is a **ref, not state**, so the loop reads the current value rather than one
closed over when the iteration started. Cancel goes to results with whatever finished.

---

## Results (screen 4)

Grid flexes; the detail pane holds 484px. Below 1440 the grid clips like the rest of the
canvas rather than pushing the pane off-screen.

Selection rules — the detail pane always shows something, so actions never need a disabled
state: first photo on arrival, first photo on tab switch, next-then-previous when the
selected photo leaves the set.

Both move directions get the 5-second undo toast; `undoItem` carries `from`/`to` so undo
restores the correct prior decision.

**Stars live in `starredIds` (a Set), outside `results`**, because a star is a property of
the photo, not of a run — that's what makes them survive a re-run. A re-run discards the
result set, so the taste console warns
`Re-running resets photos you moved between keeps and cuts.` when manual moves exist.

A moved photo keeps its card title on **`originalDecision`** — the bullets argue for
Cull's decision, so titling them by the current tab makes the card contradict itself — and
gains an accent line above the title (`You moved this photo to cuts`) plus a `Moved`
marker on the thumbnail. The move action still follows the current decision.

**The detail pane is height-anchored at both ends.** It stretches to the canvas floor
(`self-stretch`) instead of ending with its content, and the actions sit at the bottom
behind `ACTIONS_CLEARANCE = 32` — the console's own top padding — so the gap at the
boundary is constant rather than a function of the bullet count. The top edge still aligns
with the grid. Photo and card live in one bounded `flex-1 min-h-0 overflow-y-auto` region:
a long rationale shrinks and scrolls the card with the photo fixed, and a canvas too short
for the photo scrolls the whole region. The actions never move.

That makes the pane and the grid end differently at the console — the grid clips
mid-thumbnail, the pane holds clearance. Intended; they're doing different jobs.

`REASON_CARD_MIN_H` survives for a different reason than it was added: the card is the
pane's only shrinkable item, so without a floor a short canvas collapses it to its padding
before the region starts scrolling.

The results grid's clipping box carries 6px of padding, pulled back by an equal negative
margin, so the selection shadow (spread 1, radius 4) has room. The analyzing scan line is
an inset border, not a shadow, so it needs none.

There is no refinement input. Refinement happens by returning to step 2.

---

## Design tokens

| Token | Value | Use |
|-------|-------|-----|
| `canvas` | `#272727` | canvas and console |
| `surface` | `#474747` | elevated: priority cards, reasoning card |
| `accent` | `#BAA9FF` | on dark |
| `accentLight` | `#2100B2` | active row in the weight menu (a light surface) |
| `primary` / `border` | `#FFFFFF` | all text and borders |

**There is no muted text token and no opacity ramp.** Hierarchy comes from size and
weight. The only opacity in the system is the 60% stale treatment. Don't invent a
secondary text color.

`shadow-selection` (`0 0 4px 1px #BAA9FF`) is the selection effect — selection is a
**shadow, not a border**. `shadow-console` is `0 -4px 2px rgba(0,0,0,0.25)`.

The accent carries: active chip, active tab, selection, star badge and toggle, active
weight, progress fill, scan line. **Not** the input focus ring — a focused unselected chip
and an unfocused selected chip would look identical. Focus changes the border's
**opacity** — white at 60% unfocused, 100% focused — never its width. Widening a stroke
moves the content box inside it, which walked the description placeholder a pixel down and
right on every focus.

### Line heights are load-bearing

The console's height budget only lands if text line boxes are pinned to their Figma boxes
(step label 14px, panel heading 19px, buttons 15px, stale note 14px). Left at `normal`
they drift ~9px in aggregate. Don't replace these with `leading-none`.

---

## Environment Variables

Stored in `.env.local` (never commit):

| Variable | Purpose |
|----------|---------|
| `VITE_MOCK_API` | `true` runs the whole UI on mocks — no Ollama needed |
| `VITE_GEMINI_API_KEY` | Gemini key (legacy modules only) |
| `VITE_ANTHROPIC_API_KEY` | Anthropic key (`refineResults.js`; dangerouslyAllowBrowser) |

## Mock Mode

`VITE_MOCK_API=true` gates `ollama.js` itself, so the entire v2 UI is buildable and
checkable without inference:

- `mockBuildCullCriteria` — 4 criteria at mixed weights on the first read; a deliberately
  **shifted** set on every read after (two labels match, one at a different model weight;
  one new; one gone) so the merge rule is testable end-to-end
- `mockEvaluatePhoto` — deterministic per index, ~70/30 keep/cut (83/33 at 116 photos),
  with a 320–580ms delay so the scan line and its dwell cap are observable
- `SEED = 4` is chosen so index 0 is a keep and the first screenful has no run of three
  cuts — an opening run of cuts makes analyzing read as though the taste profile isn't
  landing. Don't "simplify" the seed away.

The health check is short-circuited in mock mode; with mock off it still fires and the
"Ollama isn't running" banner is the only signal the local model is unreachable.

---

## Ollama-Specific Notes

### Model

`llava:7b` — switched from `moondream` after reliability issues with structured JSON
output. Pull before first run: `ollama pull llava:7b`.

### Proxy

`proxy.js` runs on **port 3001** and forwards to Ollama at `http://localhost:11434`, purely
to avoid CORS from the Vite origin. Accepts up to 50 MB bodies.
`GET /health` pings `ollama/api/tags`; `POST /evaluate` forwards to `ollama/api/generate`.

### Base64 stripping

`fileToBase64` returns a full data URL; `stripDataUrl` inside `evaluatePhoto` removes the
prefix — Ollama's `images` field expects raw base64.

### JSON parsing robustness

`llava:7b` sometimes wraps output in markdown fences or nests structures. `ollama.js` has
`stripFences`, `parseJsonArray` / `parseJsonObject`, nested-array normalisation in
`buildCullCriteria`, and a plain-text fallback in `evaluatePhoto`.

### Criteria weights as hard requirements

`evaluatePhoto` frames `high`-weight criteria as the primary requirement that must be
satisfied for a keep, then chip constraints as absolute overrides, then the rest as
secondary. This stops the model overriding explicit requirements with general quality
scoring.

---

## Performance

- **Thumbnails are downscaled on ingest** (`lib/thumbnail.js`, 296×220 ≈ 2× the tile) and
  the original `File` is kept for base64. Full-resolution decoded bitmaps are the real
  memory cost of a 116-photo batch. This does **not** change what the model sees — the
  "no compression before Ollama" decision was about the model's input, not the DOM's.
  RAW files that the browser can't decode fall back to a plain object URL.
- The **detail pane** creates a full-resolution object URL for the selected photo only,
  revoked on change — a 296px thumbnail painted at 484×280 is visibly soft.
- `photo.id` is an independent sequence, **not** the object URL, because ids key results,
  selection and the memoized thumbnail and must outlive a revoke.
- Thumbnail blob URLs are revoked **on unmount only**. Keying that cleanup to `[photos]`
  revokes the whole batch whenever the array changes — which "Add more photos" does.
- The thumbnail component is memoized and keyed by photo id; without it each streamed
  decision re-renders all 116.

---

## Gotchas

- **`vite build` succeeding does not mean the app runs.** A JSX identifier that is used but
  never imported is not a bundling error — it's a runtime `ReferenceError`. This bit the
  v2 build twice. Check the browser, or lint for undefined JSX identifiers.
- Step rendering in `App.jsx` is four **flat** `{step === '…' && (…)}` guards. It was a
  nested ternary and the nesting produced a syntax error on every edit. Keep it flat.

---

## Not built

- The expanded canvas view behind the `+N more` tile (tile renders, inert, marked TODO)
- The export flow (`Export keeps` / `Export starred` render disabled)
- The model picker described in the reference doc
