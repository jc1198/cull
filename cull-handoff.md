# Cull — handoff

**22 September 2026.** Written to be read cold by whoever picks this up next, including me.

## Where it stands

The local inference work is finished and did not reach a usable result. The app runs correctly on
an 8GB M1 — no timeouts, no parse failures — at roughly 17 minutes for a 116-photo batch, with a
vision model whose perception is unreliable. One architecture decision is open and everything else
is either shipped or documented.

Nothing is broken. Stopping here leaves the repo in a working state.

## Shipped to the repo

All of this is committed and working. No UI components were touched.

- **Two models instead of one.** `buildCullCriteria` runs `qwen3:1.7b` (text only, ~1.4GB).
  `evaluatePhoto` runs the picker's selection, now `qwen3-vl:2b-instruct`. The picker selects the
  vision model only; the criteria model is a constant with a `/health` check and a fallback to the
  selected model when it isn't installed.
- **JSON schemas on both calls** via Ollama's `format`. The normalization ladder stays as a
  fallback for `llava:7b`, with warnings on each branch.
- **`reason` declared before `decision`** in the evaluation schema. Constrained decoding follows
  declaration order, so the model reasons before it decides instead of rationalizing afterward.
  This measurably changed decisions.
- **768px encode** through `encodeForModel()` in `lib/thumbnail.js`. The original `File` stays on
  the photo object for export.
- **Generation parameters inside `options`.** They were at the top level, where Ollama ignores
  them. `num_ctx` is now set explicitly rather than left to a version-dependent default.
- **`think: false`** on both calls. Qwen3 emits reasoning traces otherwise.
- **`keep_alive` sequencing.** Criteria model unloads after its call; vision model holds for 10
  minutes so Ollama doesn't evict it mid-batch.
- **Per-call timeouts**: 30s criteria, 90s evaluate, 95s proxy.
- **Response counters logged**: `prompt_eval_count`, `eval_count`, durations.
- **Catalog updated** in `models.js`, with a `requiresMoreThan8GB` flag on `llama3.2-vision`
  stored but not surfaced.

## What the numbers say

Criteria path, `qwen3:1.7b`: 5,559 ms including 2,951 ms model load. Three identical runs, clean
JSON, nothing invented. **This half works and should not move.**

Evaluation path, `qwen3-vl:2b-instruct`, clean run with Chrome and Vite stopped:

| | |
|---|---|
| Per photo | ~8.8 s (p95, uncached) |
| Projected, 116 photos | ~17 min |
| Prompt / output tokens | 1,265 / 68 |
| Image share of prompt | 86% of tokens, 94% of prefill time |

`qwen3-vl:4b-instruct` runs 31% CPU / 69% GPU and times out. It does not fit in 8GB.

**The bottleneck is image prefill, and the knob is out of reach.** The server log shows
`image_min_pixels: 1048576` — a 1024×1024 floor. A 768px encode is 390,912 pixels and gets
upscaled back to the floor, which is why 768px and 512px both consumed exactly 1,265 tokens.
Cutting that floor 4× would take the batch to ~8.6 minutes. Upstream Ollama does not expose it;
llama.cpp has `--image-min-tokens` for exactly this, one layer down.

The vision encoder runs on Metal, not CPU. Ruled out.

Full-resolution images consume 4,206 tokens against a 4,096 context and are refused outright, so
**the 768px downscale is a correctness requirement, not a speed optimization.** Both things are
true and they were easy to confuse.

## What's decided

- Two models, not one. The criteria path stays local.
- Reason before decision in the schema.
- 768px encode.
- The 8GB M1 cannot run this product. That is a finding with a mechanism behind it, not a tuning
  failure.

## What's open

**One decision: where `evaluatePhoto` runs.** Three defensible answers.

1. **Cloud for the evaluation pass.** Gemini Flash-Lite, roughly $0.05 per 116-photo batch. Keeps
   criteria local. Costs the privacy claim in the positioning and needs an API key in a product
   that removed sign-in on purpose. Proves the model-agnostic architecture claim instead of
   asserting it.
2. **Local only, raise the minimum to 16GB.** Keeps the positioning intact. The demo won't run on
   the machine it was built on.
3. **Document the ceiling and demo elsewhere.** Nothing more to build; the write-up absorbs the
   result.

Cost analysis is in `claude/cull-inference-options.md`.

## If you resume, do this one thing first

Run the ten labelled photos in `benchmarks/ground-truth.json` through Gemini Flash-Lite with the
**current prompt unchanged**, and compare against the 2B's results on the same ten. Costs about
half a cent.

One variable, large expected effect, decisive either way. If cloud scores 9–10 and local scores
around 6, the architecture decision is made. If cloud also misses `tphoto1`, the prompt layer is
the problem and you know where to spend.

**Score it on the three keeps, not on overall agreement.** The set is 3 keeps to 7 cuts, so
cutting everything scores 70%. The number that matters is whether a variant finds all three keeps
without falsely keeping any of the seven. `tphoto1` is the case to watch — it's the one photo
labelled `keep` despite missing a stated criterion.

## Known issues, queued and unfixed

Recorded in `CLAUDE.md`. None blocks anything.

- `tasteProfile()` feeds constraint chips into criteria generation. The build spec says chips are
  the user's input and never the model's output. The code contradicts a documented decision.
- Every evaluation error marks Ollama offline, including malformed model output. A model error and
  a connection error are different failures sharing one state.
- `reason` returns one sentence; the build spec calls for four bullets, so the splitter yields one.
- The criteria prompt asks for three criteria and demonstrates two.
- `requiresMoreThan8GB` is stored but unsurfaced. Surfacing it needs a `ModelPicker` row-mapping
  change and a copy decision.

## The Analyzing screen needs redesigning

Independent of which model ships. The screen caps the scan border at a 300ms minimum dwell, which
implies it was drawn against sub-second throughput. The real number is ~8.8 seconds. At that speed
the scan line isn't a scan line and the live-decision canvas — the best idea on that screen — has
nothing to show for long stretches.

## Things I got wrong, so nobody repeats them

- **Claimed `num_ctx` defaults to 2048.** It's 4K below 24 GiB VRAM. The coding agent caught it.
- **Called context exhaustion the cause of the old `llava:7b` truncation.** It's a hypothesis. The
  truncation cause is still unresolved and attempts to reproduce it timed out. Don't let it get
  written up as solved.
- **Asserted an "applicability gap"** — that the weight system couldn't express "this criterion
  doesn't apply to this photo," and that cutting a golden-hour landscape for lacking a face was a
  defect. Jorge's own labels cut all three golden-light non-portraits. The gap isn't there for this
  taste string. The model was right and I was projecting a preference he doesn't have.
- **Designed a four-variant prompt experiment on an unreliable base.** The 2B gave opposite
  readings of the same photo's light across two runs. Prompt variants can't be separated from
  perception noise at n=10. Fix the substrate before tuning the layer above it.

A real gap did survive: `tphoto1` was kept despite missing a `high` criterion, while the
evaluation prompt treats any failed `high` criterion as a forced cut. Weighted judgment versus
all-or-nothing gating. Worth testing once the vision model is reliable.

## Where things live

| | |
|---|---|
| Build spec | `cull-v2-build-spec.md` (project) |
| Case study reference | `cull-case-study-reference.md` (project) |
| Inference options and costs | `claude/cull-inference-options.md` (project) |
| Case study material from this work | `claude/cull-case-study-inference-chapter.md` (project) |
| Ground truth, 10 photos | `benchmarks/ground-truth.json` |
| Measurement runs | `benchmarks/inference-2026-09-10.json`, `benchmarks/local-levers-*` |
| Node harness | `benchmarks/local-levers.mjs` |
| Persistent context | `CLAUDE.md` |

**Note:** `cull-case-study-inference-chapter.md` still presents the applicability gap as a headline
finding. That section is contradicted by the ground-truth labels and needs revising before any of
it is published.
