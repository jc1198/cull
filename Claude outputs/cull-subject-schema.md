# Force the subject through the schema — prompt for the coding agent

---

You were right to stop at the gate. The instruction was applied and the criteria model ignored it,
so revert the approach rather than rewording the instruction.

## Why the prompt approach failed

v2 reworded every criterion and dropped the duplicate, so the model did read the new instruction.
It just doesn't treat "there must be a person in the photo" as a criterion. More prompt wording
won't change that.

This project has hit the same wall three times now. Prompting didn't produce valid JSON — a schema
did. Prompting didn't stop the model deciding before reasoning — declaring `reason` before
`decision` did. A prompt asks; a schema constrains. Use the schema.

## The change

Add a required `subject` object to `CRITERIA_SCHEMA`, **declared before `criteria`** so
constrained decoding generates it first and the criteria that follow are conditioned on it. Same
lever as the reason-first fix.

```js
const CRITERIA_SCHEMA = {
  type: 'object',
  properties: {
    subject: {
      type: 'object',
      properties: {
        named: {
          type: 'boolean',
          description: 'true when the description names a subject type the photo must contain',
        },
        signal: {
          type: 'string',
          description: 'short label for the subject, such as "portrait" or "wildlife"',
        },
        description: {
          type: 'string',
          description: 'what to look for in the photo to confirm the subject is present',
        },
      },
      required: ['named', 'signal', 'description'],
    },
    criteria: {
      // unchanged from v1
    },
  },
  required: ['subject', 'criteria'],
}
```

Update the criteria prompt to explain the `subject` field and show it in the example JSON. Keep
the subject-preservation instruction from v2 — it did no harm and the schema now backs it.

The model writes `description` in its own vocabulary, per the build spec's argument that the model
phrases criteria in terms it can ground in pixels. Don't hand-write that string.

## Map it into the existing array

In the client, when `subject.named` is true, prepend the subject to the criteria array as its
first element:

```js
{ signal: subject.signal, weight: 'high', description: subject.description }
```

When `named` is false, prepend nothing.

**The UI contract does not change.** `buildCullCriteria` still returns
`{ signal, weight, description }[]`. The priorities panel gets one more card, at the front, at
high weight — which the user can re-weight or remove like any other.

That placement is deliberate. The failure that cost this whole round was an omission, and an
omission has no symptom anywhere in the product except that panel. A subject card makes it
visible.

## Gate again

1. Call `buildCullCriteria` once with `Golden hour portraits with candid expressions and sharp eyes`.
2. Report the **raw model response** before normalization, plus the mapped array.
3. If `subject.named` is false, or the mapped array still has no subject criterion, stop and say
   so. Do not regenerate or retry.

## Then re-run

If the gate passes, save to `benchmarks/frozen-criteria-v3.json` and run the harness with `--v3`:
3 rounds × 10 photos × 2 arms, interleaved, one-second cloud delay, 429 backoff, same scoring as
v1.

Predictions to test, unchanged:

- `tphoto8`, `tphoto9`, `tphoto10` flip to `cut` in both arms.
- `tphoto4` stays a false keep in both. It's a portrait; the subject criterion can't help.
- `tphoto5` stays correct on local, unstable on cloud.
- Local ~9/10, cloud ~8/10, both above the 7/10 cut-all baseline.

Report what happened before commenting on whether it matched.

## Two observations, do not fix

Record these in the report:

1. **`candid expression` moved from `high` in v1 to `medium` in v2** with nothing in the
   instruction touching weights. Note whether v3 produces stable weights across generations. The
   criteria model may not be repeatable, which matters for the panel's snapshot and revert
   behavior.
2. **`sharp eyes` drifted from "focused and clear" to "focused and expressive."** Expressive is
   not a pixel property, and the build spec warns against criteria the vision pass can't ground.
   Note which wording v3 produces.

## Keep unchanged

The evaluation prompt, evaluation schema, models, image encoding, `num_predict: 250`, and the
queued cleanup.
