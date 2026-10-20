# Taste screen polish — prompt for the coding agent

---

Four changes to the step 2 taste-setting screen, plus a spec update. UI only — no model, prompt,
schema, or benchmark changes. Read `cull-v2-build-spec.md` first; parts of this deliberately
change it, and those parts are marked.

## Step 0 — Orient, then stop

Report before editing:

1. The component that renders the canvas and photo grid, and how its height relates to the console.
2. The console component and how its slots are ordered and conditionally rendered.
3. Where the photo array lives in state and what removes from it, if anything does.
4. Whether an undo toast component already exists for `Move to cuts`, and its API.
5. How `Run Cull on N photos` and `N photos added` derive their counts.
6. Any existing transition or animation utilities in the codebase.

Stop there. Wait for confirmation.

## Change 1 — Scroll the photo library

The grid clips at the console's top edge and can't be scrolled. On a 13" display at fullscreen
even the first row is cut off.

- Make **only the photo grid** scrollable. The `Cull` wordmark, `Running on:`, and
  `N photos added` stay fixed.
- Strengthen the existing gradient fade at the console's top edge. A row cut cleanly through the
  middle of the thumbnails reads as a rendering bug; the fade is what makes it read as "more
  below."
- Preserve scroll position across a console collapse or expand. The canvas changes height and the
  photos under the cursor must not jump.

## Change 2 — Remove a photo

- On hover over a thumbnail in step 2, show an X in the corner.
- **Make the X keyboard-reachable and focusable**, with a visible focus ring. A hover-only control
  doesn't exist for anyone not using a mouse.
- Click removes the photo immediately. **No confirmation modal.**
- Show an undo toast for 5 seconds: `Photo removed · Undo`. Reuse the `Move to cuts` toast if one
  exists.
- Update `N photos added` and `Run Cull on N photos`.

**Why no modal:** the build spec gives `Move to cuts` a 5-second undo toast, and that is the more
consequential action — it discards a result the model produced. Removing a photo before analysis
discards nothing. A heavier confirmation on the lighter action inverts the product's own hierarchy.

## Change 3 — Reorder the console slots

**This changes the build spec.** Current spec order is label, input, priorities panel, chips,
buttons. New order:

1. Step label, with `Revert changes` right-aligned on the same row
2. Description input
3. Constraint chips
4. Priorities panel
5. Buttons

The console now reads in authorship order: the user's input above, Cull's interpretation below.
The old order put the model's output between two user inputs, which contradicts the spec's own
argument that chips are the user's input and never the model's output.

**Exactly one `Revert changes` control**, on the step-label row, scoped to the whole console.
Don't add a second one to the priorities panel header.

## Change 4 — Collapse the console

Step 2 only. The analyzing and results consoles have nothing worth collapsing, so no caret appears
there.

**Collapsed shows:** step label, caret, state summary, description input, constraint chips,
buttons.

**Collapsed hides:** the priorities panel, and only the priorities panel.

The rule is semantic, not positional: *collapse hides Cull's interpretation.*

### Triggers

- **Initial state:** collapsed when the photo grid's natural height exceeds the available canvas
  height; expanded when it fits. Evaluate once on entering step 2.
- **Manual:** the caret toggles. The **whole collapsed bar** is clickable, not just the glyph.
- **Automatic expand:** only on `Show priorities` / `Update priorities`. That button names the
  hidden content, so expanding is the button doing what its label says.
- **Never expand** on focus, on click into the input, or on typing. The console is bottom-anchored,
  so expanding would move the input while the user is typing into it. That is the criteria-flicker
  bug in a different form.
- **No scroll trigger.** The spec already rejects chrome that reacts to scrolling: *"A user who
  scrolled deliberately shouldn't be fought."*
- A manual choice persists for the rest of the step.

### Collapsed bar summary

| State | Summary |
|---|---|
| Before the first read | none |
| Current | `4 priorities · current` |
| Stale | `4 priorities · needs update` |

## Change 5 — Motion

The transition must not snap. These specifics matter:

- Animate height with **`grid-template-rows: 0fr → 1fr`** on a wrapper. Do not use `max-height` —
  it animates to a value larger than the content, so the tail of the transition is dead time that
  reads as a stall. `height: auto` doesn't transition at all.
- Give the collapsing wrapper `overflow: hidden` so the priorities cards keep their natural height
  instead of squashing.
- Fade the panel content alongside the height change, on a shorter duration, so it doesn't look cut
  off at the edge.
- Rotate the caret 180°. Don't swap glyphs.
- **One duration and easing for everything that moves**, around 220 ms. The canvas resize and the
  console height are the same layout change. If they animate independently the grid snaps while the
  console glides, which looks worse than no animation.
- **Render the initial state without animation.** If it starts collapsed, it must be collapsed on
  first paint — not expanded and then collapsing.
- Honor `prefers-reduced-motion`: snap instantly, no transition.

## Change 6 — Update the spec

Edit `cull-v2-build-spec.md`:

- New slot order in the Layout section.
- The collapse behavior, its triggers, and the collapsed-bar summary states.
- The photo-removal interaction and its undo toast.
- A `Reversed decisions` entry for the slot reorder, with the reasoning: the collapse requirement
  exposed that the original order grouped by position rather than by authorship.

Four cases of code drifting from this spec are already documented. Don't make this a fifth.

## Verify

1. Demo model selected, full flow across all four states.
2. On a 13" viewport, step 2 opens collapsed and the first grid row is fully visible.
3. On a large viewport with few photos, step 2 opens expanded.
4. Typing a long description never moves the input.
5. `Show priorities` expands the console and reveals the panel in one transition.
6. Removing a photo updates both counts, and undo restores it in the same grid position.
7. Tab reaches every X. Focus rings are visible.
8. With `prefers-reduced-motion` on, nothing animates.
9. Scroll partway down the grid, collapse, expand — the same photos stay under the cursor.

## Out of scope

- The chip labels read `Exclude blurry shots`, `Best of duplicates`, `Faces in focus`; the spec
  specifies `No closed eyes`, `Best of duplicates`, `Sharpest frame only`, `Faces in focus`. Note
  it, change nothing.
- Everything in the queued known-issues list in `CLAUDE.md`.
- Any model, prompt, schema, or benchmark change.

List anything else worth fixing at the end. Don't fix it.
