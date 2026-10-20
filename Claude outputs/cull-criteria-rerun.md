# Criteria fix and re-run — prompt for the coding agent

---

The comparison found the failure upstream of both vision models. Fix one thing in the criteria
prompt, re-freeze, and re-run the existing harness unchanged.

## What the last run showed

The frozen criteria were:

```
warm light            high    photo has orange or golden toned light
candid expressions    high    subject has natural, unposed facial expressions
sharp eyes            high    subject's eyes are focused and clear
golden hour ambiance  medium  photo captures the soft, diffused light of golden hour
```

The taste string was `Golden hour portraits with candid expressions and sharp eyes`.
`buildCullCriteria` dropped **portraits** — the subject of the sentence — so nothing in the array
requires a person in the photo.

A bison satisfies warm light, a natural unposed expression, and focused clear eyes. Both models
kept all three nonportrait-warm photos and both were correct to, given what they were given.

## Change exactly one thing

In the criteria prompt only, add an instruction that the subject named in the description must
become a criterion. Something close to:

```
If the description names a subject type — portraits, landscapes, wildlife, architecture, street —
include a criterion requiring that subject to be present in the photo. A photo that does not
contain the named subject cannot satisfy the description.
```

Do not change the evaluation prompt, the schema, the models, the image encoding, or anything in
`src/` beyond this one prompt string.

**Also raise `num_predict` on the evaluation call from 120 to 250.** `tphoto10` returned invalid
JSON in all three local runs because the reason field hit the cap mid-object. That cap was set too
tight. A schema prevents malformed JSON only when the model has room to finish.

That is two changes: one behavioral, one a defect fix. Record both.

## Re-freeze and re-run

1. Call `buildCullCriteria` once with the same taste string. Save to
   `benchmarks/frozen-criteria-v2.json`. Keep the v1 file.
2. Report the new array before running anything. If it still has no subject criterion, stop and
   say so rather than proceeding.
3. Re-run both arms exactly as before: 3 rounds × 10 photos × 2 models, interleaved, alternating
   arm order, same images, same scoring.

Add a one-second delay before each cloud call. Free-tier Flash-Lite caps requests per minute, and
the interleaving with local calls happened to keep the last run under it. Don't rely on that
accident. The delay is excluded from the reported latency — measure the request itself, not the
wait.

If a call returns `429 RESOURCE_EXHAUSTED`, back off and retry that one call rather than
abandoning the round, and report how many retries happened. A retried call is still one
measurement; a missing call is a hole in the majority vote.

## Test this prediction

Say whether each holds:

- The three nonportrait-warm photos (`tphoto8`, `tphoto9`, `tphoto10`) flip to `cut` in both arms.
- `tphoto4` stays a false keep in both arms. It is a portrait, so the new criterion cannot help;
  both models read its lighting as warm where I labelled it a cut.
- `tphoto5` stays correct on local and unstable on cloud.
- Local finishes around 9/10, cloud around 8/10, both above the 7/10 cut-all baseline.

A prediction that fails is more interesting than one that holds. Report what actually happened
before commenting on whether it matched.

## Report

Same format as `vision-comparison-report.md`:

1. The v2 criteria array, and a diff against v1.
2. Photo table — my label, my note, local majority, cloud majority.
3. Per arm: keeps found, false keeps, self-consistency, per-category, median and p95 ms, invalid
   responses.
4. Full reason text for `tphoto4`, `tphoto5`, and any photo where the arms disagree.
5. Whether each prediction above held.

Keep the same caution as last time about cache contamination in the timing numbers.

## Also observe, do not fix

`golden hour ambiance` at medium duplicates `warm light` at high. Note whether v2 still produces
near-duplicate criteria. That is a criteria-quality question for later, not part of this change.

## Then stop

State whether the data now supports a usable local path, and whether the cloud arm adds anything.
Do not implement anything further. Cleanup stays queued.
