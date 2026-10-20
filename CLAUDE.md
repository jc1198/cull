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
| Vision model | User-selected local model via Ollama (Demo by default) |
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

`isStale` is **derived, never stored**: `input.trim() !== lastRead.description || model !== lastRead.model`. If the
user undoes an edit and the text matches again, stale clears on its own. Don't threshold
by edit distance.

`lastRead` snapshots `{ model, description, chips, criteria }` on **successful reads only**, and
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
| `VITE_MOCK_API` | Legacy setting; runtime model selection now controls demo/local inference |
| `VITE_GEMINI_API_KEY` | Gemini key (legacy modules only) |
| `VITE_ANTHROPIC_API_KEY` | Anthropic key (`refineResults.js`; dangerouslyAllowBrowser) |

## Mock Mode

Demo mode is the initial default and uses the existing mock fixtures. Selection is stored
in localStorage under `cull.selectedModel`; both inference calls receive the selected model
explicitly. `VITE_MOCK_API` no longer overrides runtime selection.

- `mockBuildCullCriteria` — 4 criteria at mixed weights on the first read; a deliberately
  **shifted** set on every read after (two labels match, one at a different model weight;
  one new; one gone) so the merge rule is testable end-to-end
- `mockEvaluatePhoto` — deterministic per index, ~70/30 keep/cut (83/33 at 116 photos),
  with a 320–580ms delay so the scan line and its dwell cap are observable
- `SEED = 4` is chosen so index 0 is a keep and the first screenful has no run of three
  cuts — an opening run of cuts makes analyzing read as though the taste profile isn't
  landing. Don't "simplify" the seed away.

Health checks run on mount, whenever the picker opens, and on Re-check, including in Demo
mode. The menu distinguishes unavailable Ollama from reachable Ollama with missing models.
Health requests time out after 5 seconds; stale requests cannot overwrite newer checks.

---

## Ollama-Specific Notes

### Model

The picker selects the photo evaluation model. `CRITERIA_MODEL` in `src/lib/models.js`
is `qwen3:1.7b`: Demo bypasses inference; otherwise `buildCullCriteria` checks `/health`
and uses the criteria model if installed, falling back to the selected vision model
with a warning naming the missing criteria model. The criteria model is plumbing,
not a second picker selection.

On the 8GB M1, Qwen's approximately 1.4GB text weights avoid loading a 7B vision model
for a text-only read. The vision catalog starts with `qwen3-vl:4b-instruct` (~3.3GB Q4)
and `qwen3-vl:2b-instruct` (~1.9GB). The installed plain `qwen3-vl:4b` tag resolved to the
thinking renderer/parser, so the 4B catalog entry explicitly uses instruct.
On Ollama 0.34.0, 4B instruct measured 31% CPU / 69% GPU at 4096 context;
plain 2B measured 100% GPU but returned JSON in `thinking` with empty `response`
despite `think: false`. The user approved switching the fallback to 2B instruct; see measurements below.
`llama3.2-vision` carries `requiresMoreThan8GB: true`; the picker does not render it yet.

Criteria sends top-level `keep_alive: '5m'` so repeated priority reads reuse the model.
Before the first unfinished photo of a real run/retry, App sends an empty-prompt
`keep_alive: 0` request for the installed criteria model, inside the existing error
handler. Demo skips this and image encoding. Evaluation uses `keep_alive: '10m'`.
This frees criteria memory before the vision pass; keep-alive does not guarantee
residency under memory pressure. Both generation requests send top-level `think: false`.

Generation controls belong inside `options`, never at the request-body top level.
The old top-level `num_predict: 1000` was inert; do not re-add it there.
Criteria uses `options: { num_predict: 600, temperature: 0, num_ctx: 2048 }`;
evaluation uses `{ num_predict: 120, temperature: 0, num_ctx: 4096 }`. Explicit context
limits avoid dependence on version/hardware defaults and bound the criteria KV cache.
Open question: what caused the old LLaVA JSON truncation? The inert cap did not fix it;
context exhaustion has not been established as its cause.
Client timeouts are 30s for criteria (including health lookup) and 90s for evaluation;
the proxy timeout is 95s.

### Proxy

`proxy.js` runs on **port 3001** and forwards to Ollama at `http://localhost:11434`, purely
to avoid CORS from the Vite origin. Accepts up to 50 MB bodies.
`GET /health` pings `ollama/api/tags`; `POST /evaluate` forwards to `ollama/api/generate`.

### Base64 stripping

`encodeForModel(file)` in `thumbnail.js` independently decodes each original during
evaluation, fits its longest edge to 768px without upscaling, and encodes JPEG q0.85.
It returns raw base64. The original File stays untouched. `fileToBase64` remains
exported but unused; `evaluatePhoto` still accepts and strips a data URL prefix.

### JSON parsing robustness

Both requests pass top-level `format` JSON schemas and restate the shape in prompts.
Criteria unwraps `{ criteria: [...] }` into the existing array contract. Legacy fences
and normalization branches remain with warnings; invalid priorities still log/throw.
Evaluation requires keep/cut plus string reason and throws on unusable output; there
is no plain-text decision fallback. Schema decoding constrains generated shape but
request errors, empty responses, or interrupted output can still fail validation.
Both call sites log prompt/output token counts and all four duration counters from
Ollama (durations are nanoseconds). The proxy forwards them unchanged.

### Measurement checkpoint (2026-09-10, Ollama 0.34.0)

Anchor: `test_photos/_DSC1403.jpg`, 4928×3264; encoded size 768×509.
Full-res Qwen 4B instruct returned HTTP 400: 4206 requested tokens exceed 4096 context.
No `prompt_eval_count` was returned on this failure. The 768px repeat with the same
pre-schema prompt timed out at 90s, also without counters. Full-res LLaVA timed out
at 90s with 4096 context, running 33% CPU / 67% GPU. Its count is unavailable.
A 768px plain Qwen 2B call using the final prompt reported `prompt_eval_count: 1265`,
`eval_count: 43`, but empty response/JSON in thinking caused the run to stop. This is
a different model/prompt, not a controlled before/after token comparison.
Three schema criteria reads returned identical arrays, 108 output tokens each, no
normalization warnings, and elapsed 10085/3599/3324 ms with 5m residency.

The approved 2B instruct fallback stayed at 100% GPU / 4096 context. Seven photos
completed: median 13475 ms, nearest-rank p95 19237 ms, median prompt tokens 1265,
median output tokens 68. Photo 8 failed with proxy 502 / `fetch failed`. All seven
responses parsed; no normalization warnings. A full repeat failed at Chrome launch
(180s timeout), so **there is no passing 10-photo measurement**. Applying the median
to 116 photos gives ~26m03s of successful inference only; this is not a reliable
end-to-end projection. No further settings were tuned.

Demo completed all four states with ten photos and no inference requests/errors.
The browser regression suite passed using generated, decodable PNG fixtures.
A real LLaVA selection worked for the criteria read (Qwen text model), then its first
768px evaluation failed without a response; real LLaVA compatibility is not validated.
Full counters, three criteria arrays, raw responses, and errors are saved in
`benchmarks/inference-2026-09-10.json`.


### Criteria weights as hard requirements

`evaluatePhoto` frames `high`-weight criteria as the primary requirement that must be
satisfied for a keep, then chip constraints as absolute overrides, then the rest as
secondary. This stops the model overriding explicit requirements with general quality
scoring.

---

## Performance

- **Thumbnails are downscaled on ingest** (`lib/thumbnail.js`, 296×220 ≈ 2× the tile) and
  the original `File` is retained for export. Model input is a separate 768px pass
  during evaluation. Thumbnail decode failures fall back to the original object URL;
  model encoding failures throw through the existing run-failure path.
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

## Known issues

- `src/lib/gemini.js`, `src/lib/cullPhoto.js`, and `src/lib/extractIntents.js` are
  unreachable. Delete them along with `VITE_GEMINI_API_KEY` in `.env.local`,
  `README.md`, and `CLAUDE.md`. Held until the benchmark is finished, since
  `callGemini` is its reference implementation. Queued cleanup only; not part of
  the benchmark work.
- Vision correctness remains unverified: 2B instruct returned `keep` for one sign
  while its own reason said the required warm light was absent; another reason
  attributed facial expressions and sharp eyes to a sign. Schema shape is not
  evidence of correct decisions. Do not tune prompts without user review.
- On Ollama 0.34.0, plain Qwen 2B placed its JSON in `thinking` with empty `response`
  despite `think: false`; use the approved instruct catalog variants.
- Proxy errors hide Ollama's original response body. The full-res context error
  appeared in the UI path as generic 502; direct inspection revealed the 4206/4096
  token error. Diagnostic error forwarding remains outside this change.

- `tasteProfile()` feeds chips into criteria generation. The build spec says chips
  are an evaluation-time layer the model never infers, contradicting that decision.
- Every evaluation error marks Ollama offline, including malformed model output.
  Model errors and connection errors should not share a state, especially after schemas.
- The criteria prompt asks for three criteria and demonstrates two.
- `reason` is requested as one sentence, so the sentence splitter yields one bullet.
  The build spec calls for four. Changing this costs generation time and waits for
  real batch measurements.

## Not built

- The expanded canvas view behind the `+N more` tile (tile renders, inert, marked TODO)
- Desktop export (browser export is implemented)

---

## Model picker

`src/components/ModelPicker.jsx` supplies the top-right Running on pill and portal menu.
`src/hooks/useOllamaHealth.js` owns health requests; `src/lib/models.js` owns the model
catalog, tag matching, persistence key, and model-aware stale predicate. Original Figma
SVG exports live in `src/assets/model-picker/`.

### Typography, spacing, and motion

- The complete label-and-pill row is **28px tall**: a 20px pill with **4px top and
  bottom padding around the row**. The label and pill have an **8px horizontal gap**.
- `Running on:` uses Kantumruy Pro **SemiBold (600), 16px, with a 19px line box**,
  vertically centered beside the pill. Do not restore the earlier 24px line box or
  top alignment. Chrome's rendered font was verified as `KantumruyProRoman-SemiBold`;
  synthetic weight is disabled for this label.
- The pill has an 8px radius and 4px internal padding. Its label uses Kantumruy Pro
  Medium (500), 10px, with a 12px line box. Outer row padding and internal pill padding
  are separate requirements.
- Opening and closing use a **240ms** expand/collapse animation with
  `cubic-bezier(0.22, 1, 0.36, 1)`. The portal menu reveals from the pill's bounds using
  clip-path and opacity; the anchor width transitions with it so the label moves smoothly.
  The trigger crossfades over 160ms. Closing retains the menu until the animation finishes,
  while immediately removing its interactivity and accessibility exposure.
- Interrupted transitions resume from their current visual state. Reduced-motion
  preferences disable the menu animation and anchor/trigger transitions.
- Picker motion and typography styles live in `src/index.css`; font families and weights
  are loaded in `index.html` (including JetBrains Mono for command text).

### Selection and recovery

- Demo is always selectable. Installed models are selectable after the health response;
  missing models offer a persistent copy command only when Ollama is reachable.
- Untagged names match `:latest`, not arbitrary versions. Unknown installed models display
  their name without invented size or description.
- Switching clears results and manual result moves, preserves photos/stars/input/chips and
  the old priority snapshot, and returns results or failed runs to set taste. Old priorities
  stay dimmed and require Update priorities when the snapshot model differs. Revert cannot
  make a different model's priorities current. Late reads from a previous selection are ignored.
- While analysis is active the pill is inert without visual dimming. A failed request stops
  the run rather than inventing a decision. The console offers retry from the failed photo,
  switching to Demo (returning to set taste), or viewing finished photos. Retry uses the
  original run snapshot and appends only unfinished photos. Criteria requests time out
  after 30s; photo evaluation after 90s (proxy: 95s).
- Copy success shows the Figma toast for five seconds and leaves the menu open. Escape,
  outside click, focus departure, and model selection close the menu. Arrow keys navigate.

Validation: `node --test tests/models.test.mjs`; `npm run build`; and, with the dev server
running, `node tests/model-picker.browser.mjs` using an installed Playwright and Chrome.
Set `PLAYWRIGHT_MODULE` to an absolute Playwright module path to use a bundled installation.
The browser suite intercepts health/inference requests; it does not require a live model.

---

## Drop zone glass treatment

The reference is Figma frame `144:293`, rectangle `144:296` in `photography-assistant`.
The rectangle uses a native **GLASS** effect: radius 4, depth 20, refraction 0.8,
light angle -45°, light intensity 0.8, dispersion 0.5, and splay 0. Its fill is
`rgba(209, 209, 209, 0.2)`, its corners are 12px, and it has no explicit Figma stroke.

`DropZone.jsx` applies `.drop-zone-glass`, defined in `src/index.css`. This is a **CSS
approximation** of Figma's native glass material: the translucent fill, 4px backdrop blur
(including the WebKit prefix), and a soft 20px inset white shadow provide the surface.
A masked, 1px gradient rim supplies upper-left illumination and a subtle opposite-edge
highlight. The rim is an absolute pseudo-element with `pointer-events: none`, so it
doesn't change layout or intercept file drops/clicks.

Keep the existing flexible canvas sizing and 32px bottom clearance; the reference's
459px height is not a fixed-height requirement. The glass update changes only the surface
treatment, not upload behavior. It was visually checked in Chrome and the build passed.

## Local benchmark photo fixtures

Photo fixtures are not included in the repo. The benchmarks expect local photos in
`test_photos/` (local-levers runs) and `applicability_probe/` (vision comparisons).
`benchmarks/ground-truth.json` refers to the comparison photos by filename.
The generated `benchmarks/vision-comparison-images.json` cache is also excluded.

## Browser export

`src/lib/export/index.js` provides set selection, collision resolution, the sequential abortable export loop, original-byte sources, and `getExportWriter()`. `browserWriter.js` alone owns the directory picker API; replace the factory writer and source adapter for desktop. The writer contract is documented in the export module. `ExportDialog.jsx` imports only the export module and reuses console, button, status, and progress components. Cancel completes any in-flight file and stops before the next file; already written files remain. Native modal dialog behavior traps focus and Escape cancels export while writing.

A Tauri migration must also replace the existing File-based reads in `App.jsx` (model encoding) and `ResultsView.jsx` (full preview). Those reads remain unchanged here. No Tauri installation or Rust is included.

Verify mocks by selecting the runtime Demo model. `VITE_MOCK_API` still does not override runtime model selection. Run unit tests with `node --test tests/*.test.mjs` and build with `npm run build`.

Export verification includes an App-state harness using the real Demo fixtures and an in-memory writer for both sets, plus writer API fakes. It does not replace browser visual/focus testing or a real folder-picker test. Browser directory APIs do not provide atomic create-if-absent: collision checks avoid existing names, and exclusive writable mode prevents simultaneous writable streams where supported, but an external process creating the same name between checking and creating remains a race. Failed writes may leave an empty destination file; exports do not delete files.
