# Cull v2 — build spec

Implementation reference for the redesigned Cull UI. Covers all four screens: add photos,
set taste, analyzing, and review results.

Supersedes the design-decision sections of `cull-case-study-reference.md`. Where the two
disagree, this document is current. Decisions reversed since that document are listed
under [Reversed decisions](#reversed-decisions).

Figma file: `photography-assistant`, section `v2 UI updates` (node `125:1932`).

## Layout

Every screen uses two zones.

- **Canvas** — the photos. Fills the space above the console and clips at the console's
  top edge.
- **Console** — a full-bleed frame anchored to the bottom of the viewport, 1440px wide.
  Contents sit on a 1280px column starting at x=80.

Canvas and console carry the same fill (`#272727`). **The console's drop shadow —
`0 -4px 2px rgba(0,0,0,0.25)` — is the only thing separating them.** There is no top
stroke on the console; an earlier draft of this spec called for a white one, which was a
mistake and was never in the Figma frames. It reads as a soft 5px darkening above the
console edge, and a thumbnail row clipping there passes under it rather than being cut by
a line. If the boundary ever needs strengthening, deepen the shadow — don't add a stroke.

The canvas persists across steps. Don't clear or replace the grid on a step transition —
only the console changes. The one exception is review results, where the canvas splits
into a grid and a detail pane.

The console sizes itself to its contents rather than holding a fixed height. Taste
setting runs about 436px; analyzing runs about 181px.

The console holds its slots in a fixed order. A step omits slots it doesn't need, but
nothing reorders:

1. Step label, with a right-aligned secondary control on the same row
2. Description input
3. Priorities panel
4. Constraint chips
5. Buttons

## Step labels

The label slot carries a step when the user can act, and a status when they can't.

| Screen | Label | Right-aligned |
|---|---|---|
| Empty drop zone | `Step 1 of 3: Add photos` | — |
| Set taste | `Step 2 of 3: Set taste` | `Revert priorities` |
| Analyzing | `Analyzing 12 of 116` | — |
| Review results | `Step 3 of 3: Review results` | `116 photos` |

Analysis is a wait, not a step. Style the status in regular weight so it doesn't read as
a step label with a missing prefix.

## Screen 1 — Add photos

Drop zone on the canvas. Console holds the step label and `Browse files`.

The zone fills the canvas between two clearances: **48px above, 32px below**. The 48 is
the canvas's own wordmark-to-content gap, which every other screen already used — screen 1
was the outlier, so the value belongs to the canvas rather than to any screen. The 32 is
the console's top padding, the same clearance the detail pane holds. The frame's 459px was
a viewport, not a constraint — the zone taking the remaining height is fine, but running
edge to edge with no clearance is not.

On upload the canvas fills with a thumbnail grid at 148 × 110, 8 columns, 8px gutters.
Show 23 thumbnails plus a `+N more` tile that opens the expanded view.

The expanded view is a scrolling grid of the full batch. Once expanded, it stays expanded
across steps — the canvas honors whatever view the user set.

## Screen 2 — Set taste

### Description input

A single textarea, 1280 × 80. This is the only place the user writes prose.

Set it in the sans-serif UI face, not monospace. This is the one surface where the
product sounds like a person talking.

Placeholder before any input:

```
Describe what you're looking for in this batch of photos (e.g. "Moody landscape shots, prefer silhouettes at golden hour")
```

**Note:** Users will write batch context that isn't visually evaluable — location names,
event names, dates. Instruct `buildCullCriteria` to discard anything the vision pass
can't ground in an image rather than inventing a criterion for it. A criterion the model
can't score produces a silent accuracy loss with no visible cause.

### Priorities panel

Cards generated from the `buildCullCriteria` response. The array that populates the panel
is the same array sent to `evaluatePhoto`, so an edit to the panel changes what the model
compares each photo against.

Cards fill the container at 64px tall — four across the 1280px column at 308px each,
three at 416px.

| Element | Source | Editable |
|---|---|---|
| Label | `signal` | No |
| Weight badge | `weight` | Yes — opens the weight menu |
| Description | `description` | No |
| Remove | — | Yes — in the weight menu |

### Weight menu

Opens from the weight badge. Four rows: `HIGH`, `MED`, `LOW`, a divider, then `Remove`.

The active weight renders in the accent color; the others render white. `Remove` is
sentence case — the all-caps treatment belongs to the weight tokens, and the divider plus
the casing keep it from reading as a fourth weight.

Open the menu upward when there isn't room below.

### Why text editing is out

Inline editing of labels and descriptions is deliberately not supported.

The model writes descriptions in vocabulary it can ground in pixels. `Warm, low-angle
sun` works because the model chose it. A user typing `the good light` produces a
criterion the vision pass can't evaluate, every result degrades, and nothing on screen
explains why. That reproduces the truncated-JSON failure: a visible symptom several
layers from its cause.

Weight and remove cover the observed failure. When the model invented `soft shadows`, the
fix was deleting it, not rewording it. For a genuine misread, the user removes the
criterion, adjusts the description, and re-reads. Prose stays in the input.

**Note:** If usage shows users frequently removing a criterion and immediately
re-reading, that's the signal that text editing would have helped.

### Why there is no Add button

Adding a criterion is authoring, and authoring belongs in the input. Once the panel holds
items the user wrote, it stops being Cull's interpretation and becomes a mixed list where
the model's inference and the user's dictation are indistinguishable. That distinction is
what the panel exists to show.

### Constraint chips

Two states, same shape and weight:

- **Active** — accent outline and label, with an `×` to remove
- **Available** — white outline and label, with a `+` to add

Don't distinguish them with opacity; a dimmed chip reads as disabled rather than
available. A re-read doesn't clear active chips — chips are the user's input, not the
model's output.

### The read cycle

| State | Panel | Primary button |
|---|---|---|
| No read yet | Empty placeholder at reserved height | `Show priorities →`, disabled until input exists |
| Current | Cards at full opacity | `Run Cull on N photos` |
| Stale | Cards at 60%, with `These priorities reflect your earlier description` right-aligned in the `Cull will prioritize:` label row | `Update priorities` |

Call `buildCullCriteria` only on a primary button click. Don't call it on a debounce as
the user types — the debounced version flickers, and a late response can overwrite good
criteria with fallback defaults.

Reserve the panel's height in the empty and loading states so the console doesn't change
height when cards arrive.

The stale note belongs **in** the `Cull will prioritize:` label row, right-aligned — the
position `Revert priorities` holds on the step-label row. That row already exists and has
empty space, so the note costs no height. As its own row below the cards it grew the
console and pushed the console's top edge up the moment it appeared.

Set a min-width on the primary so the row doesn't shift when the label swaps.

### Reaching stale

Compare the trimmed input against the text of the last read. Any difference marks the
console stale.

Don't threshold this by edit distance. Guessing which edits matter reintroduces the
mismatch the panel prevents. If the user undoes their edit and the text matches the last
read again, the stale state clears on its own.

### Merging on re-read

Match new criteria against existing ones by `signal` label:

- **Label matches** — keep the user's weight if they set one manually. Their edit wins
  over the model's fresh assignment.
- **Label is new** — add it at whatever weight the model assigned.
- **Label is gone** — drop it. The description changed, and that's the user's own doing.

This requires tracking, per criterion, whether the current weight was set by the user or
by the model. That flag isn't in the current state shape.

### Revert priorities

One control, one meaning: restore the console to the last state a read ran on.

- Snapshot the description text and criteria array on every successful read.
- Restore both, discarding manual weight edits made after that read.
- Show the control only when the console differs from the snapshot.
- Hide it before the first read and after a revert.
- Right-aligned on the step-label row, as a text link, constrained to the step label's
  line box so its appearance doesn't grow the row and shift the console's top edge.

Don't label it `Undo` — in a frame containing a text field, undo reads as "undo my last
keystroke," which is what the keyboard shortcut already does.

Name the scope. It restores the description, the chips and the criteria — the read
snapshot — and deliberately leaves manual photo moves alone, since those were never in
that snapshot. Sitting inches from the re-run warning, an unscoped `Revert changes` reads
as a promise to undo the moves too, and then as a bug when it doesn't.

## Screen 3 — Analyzing

The console collapses to a status readout and one exit. Everything else locks: the
description is hidden, the priorities panel is hidden, chips are hidden, and the batch
can't be modified.

Console contents:

1. `Analyzing N of 116` in the label slot
2. A 6px progress bar across the full 1280px column
3. `Cancel`

`Revert priorities` is hidden — there's nothing to revert into.

### Live feedback on the canvas

Decisions render on the grid rather than as a text log. A scrolling list of 116 rows is
unreadable and pushes the console past its height budget.

- **Currently evaluating** — accent border on the thumbnail, moving through the grid as a
  scan line
- **Cut** — dims to 40%
- **Keep** — returns to full opacity
- **Not yet reached** — unchanged

Cap the minimum time the scan border stays on a thumbnail. At sub-300ms per photo it
becomes a flicker.

Don't auto-scroll the canvas to follow the scan. A user who scrolled deliberately
shouldn't be fought; the console's counter carries the progress.

### Performance

The thumbnails are already mounted from the previous step, so the class changes are
cheap. Two things that aren't:

- Memoize the thumbnail component and key it by photo id. Without that, each streamed
  decision re-renders all 116.
- Downscale to thumbnails on ingest and keep the original `File` for base64 encoding.
  Full-resolution blobs held as decoded bitmaps are the real memory cost.

### Cancel

Cancel goes to results with whatever finished. Partial results are usable results, and
the streaming architecture already produces them incrementally.

## Screen 4 — Review results

The canvas splits: grid on the left at 772px, detail pane on the right at 484px. This is
the only step where the user works with an individual photo rather than the batch.

### Filter tabs

Above the grid: `Keeps 84`, `Cuts 32`, `Starred 1`. Active tab uses the accent color with
an underline.

### Grid

5 columns at 148 × 110. Starred photos carry a filled accent star badge in the top-right
corner of the thumbnail. Give the badge a shadow or backing shape so it holds against a
bright image.

Selection uses an accent border — the same accent as the tabs and the star, not a
separate blue.

Starred photos carry the star badge; manually moved photos carry the `Moved` marker; a
photo can carry both. The selection effect is a shadow at spread 1 / radius 4, so it
reaches ~5px past the thumbnail: the grid's clipping box needs ~6px of room on every side
or the glow clips on the outer tiles. Keep the clip itself on the grid — below 1440 the
grid must still clip rather than push the detail pane off-screen.

### Detail pane

- Selected photo at 484 × 280
- Reasoning card on a dark elevated surface, one step lighter than the canvas
- Card title reads `Why Cull kept this` on keeps and `Why Cull cut this` on cuts
- Four bullets from the `reason` field
- Actions below: `Move to cuts` and the star toggle

#### The pane is height-anchored at both ends

The pane fills the canvas height rather than ending where its content does. Photo at the
top, rationale below it, **actions pinned to the bottom with 32px of clearance above the
console** — the same 32px as the console's own top padding, so the two zones breathe
symmetrically across the boundary.

Sized by content, the gap above the console tracked the bullet count: cramped under a long
rationale, loose under a short one, and moving by the height of the override line whenever
a moved photo was selected. Pinning the actions makes that gap a constant, and the card
grows into the space between the photo and the actions instead of pushing anything.

The pane's top edge still aligns with the grid — that alignment is load-bearing; only the
bottom changes.

The pane and the grid therefore end differently at the console: the grid clips
mid-thumbnail, the pane holds its clearance. That's intended. They're doing different
jobs — one is a batch bleeding off the edge, the other a single object with a baseline.

Two levels of give when the content outruns the canvas, in order:

1. A long rationale shrinks the card, which scrolls inside itself. The photo stays put.
2. A canvas too short even for the photo scrolls the photo-plus-card region as a whole.

The actions never move in either case. The card keeps a minimum height of four
single-line bullets — not to stop the pane shifting any more, that's the pinned actions'
job, but because the card is the pane's only shrinkable item and without a floor a short
canvas collapses it to its own padding before anything else gives.

The star toggle is labelled, not icon-only: `Star` with an outline glyph when unstarred,
`Starred` with a filled glyph and an accent fill when starred.

`Move to cuts` becomes `Move to keeps` on the cuts tab. Both need the 5-second undo toast
— the reverse action is equally a mistake someone can make.

#### The card after a manual move

A moved photo has two decisions: Cull's and the user's. The card must not conflate them.

- **The title stays keyed to Cull's original decision**, not the tab the photo now sits
  in, because the bullets are the reasoning for that decision. A photo Cull kept and the
  user moved to cuts titled `Why Cull cut this` over four bullets arguing for a keep is a
  card contradicting itself.
- **A line above the title states the override**, in the accent color:
  `You moved this photo to cuts`, or `…to keeps` in the other direction. It renders only
  when `decision !== originalDecision`.
- The move action still follows where the photo *is* — a photo now in cuts offers
  `Move to keeps`.

The grid carries the same state so it's visible before selection: a `Moved` marker on the
thumbnail. Keep it visually distinct from the star badge — no accent fill, no glyph — the
two co-occur. Top-left, across from the star rather than below it, so it survives the row
the canvas clips at the console edge.

### Selection rules

The detail pane always shows something, so the actions never need a disabled state.

| Event | Selection |
|---|---|
| Arriving at results | First photo in keeps |
| Switching tabs | First photo in the new set |
| Moving the selected photo out of the set | Next photo in the grid; previous if it was last |
| Re-running from step 2 | First photo in keeps |

### Empty sets

`Starred` is reachable at zero and shows a centered message on the canvas column, not the
full viewport width. Keep the tab reachable rather than disabling it — a user who clicks
it learns the feature exists.

Disable `Export starred` when the starred count is zero.

### Console

- Step label with `116 photos` right-aligned
- `Export keeps` (primary), `Export starred`, `Back to set taste` (text link)

There is no refinement input on this screen. Refinement happens by returning to step 2,
where the description input and the priorities panel already live. A second refinement
grammar would be a second way to say the same thing, and would need its own
interpretation surface.

### Re-running after manual edits

`Back to set taste` and a re-run discard the result set. Two rules:

- **Preserve stars across runs.** A photo the user marked as a hero shot stays marked.
- **Warn about manual moves.** When manual cuts or keeps exist, show a line in the taste
  console before running: `Re-running resets photos you moved between keeps and cuts.`
  No count and no plural variant — the count isn't the thing at risk. `Replaces` didn't
  say what happens to the photo, and the tabs are named Keeps and Cuts, so the warning
  uses the same words the user just clicked.

## Accent color

The accent carries: active chip, active tab, selection border, star badge and toggle,
active weight in the menu, progress fill, and the analyzing scan line.

Don't use it for the input focus ring. A focused unselected chip and an unfocused
selected chip would look identical.

Focus changes the border's **opacity** — white at 60% unfocused, 100% focused. Not its
width: a border growing from 1px to 2px moves the content box inside it, which shifts the
placeholder a pixel down and right at the moment the user commits to typing.

## Reversed decisions

Cut from `cull-case-study-reference.md`:

- **Dynamic chip updates.** Chips no longer repopulate as the user types. The debounced
  model call was the source of the flicker bug.
- **Inline text editing of criteria.** Replaced by weight and remove only.
- **The `+ Add` criterion button.** Authoring belongs in the input.
- **The refinement input on results.** Replaced by `Back to set taste`.
- **The persistent CUI bar as originally specified.** Replaced by the console, which
  changes role by step but is a zone rather than a single input.

## Open items

- Chip constraint weighting is described in the original spec as harder than prose, but
  nothing in the UI communicates that. Either show the difference or drop the claim.
- No user testing has been done.
- The model picker described in the reference doc is unbuilt, as is the export flow.
