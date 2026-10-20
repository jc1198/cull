# Vision comparison v2 — stopped at criteria gate

The one real `buildCullCriteria` call used `Golden hour portraits with candid expressions and sharp eyes` through the existing proxy and installed criteria model. Its result still contains no portrait/person subject criterion. Per the requested gate, no v2 photo inference calls were made and no criteria regeneration was attempted. V1 artifacts were preserved.

## Source changes

1. Added the subject-preservation instruction to the criteria prompt in `src/lib/ollama.js`.
2. Raised only the evaluation call's `options.num_predict` from 120 to 250.

The evaluation prompt, schemas, models, and image encoding were not changed. The existing inference-contract test's expected cap was updated to 250; `node --test tests/ollama.test.mjs` passed.

The existing harness now accepts `--v2` for separate criteria/results/report paths, reuses the exact v1 image cache, adds a one-second delay before cloud attempts, and backs off/retries 429 RESOURCE_EXHAUSTED responses. Final-request latency excludes waits; rate-limit attempts and retry counts are recorded separately. This network retry path was not exercised because the criteria gate failed.

## Frozen criteria v2

```json
[
  {
    "signal": "golden hour light",
    "weight": "high",
    "description": "photo has warm, soft light with golden tones"
  },
  {
    "signal": "candid expression",
    "weight": "medium",
    "description": "subject has natural, unposed facial expression"
  },
  {
    "signal": "sharp eyes",
    "weight": "high",
    "description": "subject's eyes are focused and expressive"
  }
]
```

## Diff against v1

```diff
- {"signal": "warm light", "weight": "high", "description": "photo has orange or golden toned light"}
- {"signal": "candid expressions", "weight": "high", "description": "subject has natural, unposed facial expressions"}
- {"signal": "sharp eyes", "weight": "high", "description": "subject's eyes are focused and clear"}
- {"signal": "golden hour ambiance", "weight": "medium", "description": "photo captures the soft, diffused light of golden hour"}
+ {"signal": "golden hour light", "weight": "high", "description": "photo has warm, soft light with golden tones"}
+ {"signal": "candid expression", "weight": "medium", "description": "subject has natural, unposed facial expression"}
+ {"signal": "sharp eyes", "weight": "high", "description": "subject's eyes are focused and expressive"}
```

- Warm light became golden hour light; the description now requires soft light.
- Candid expressions became candid expression and moved from high to medium.
- Sharp eyes stayed high, but “focused and clear” became “focused and expressive.”
- The medium-weight golden hour ambiance criterion disappeared.
- No portrait/person criterion was added.

No obvious near-duplicate lighting criteria remain in this v2 array. This is an observation only; no additional fix was made.

## Results and predictions

Not measured: zero v2 photo calls, zero cloud retries. There is no v2 photo table, accuracy, consistency, latency, token usage, or model-reason evidence. All four predictions remain untested.

The attempted prompt instruction did not achieve subject preservation on this single criteria generation. These data do not establish a usable local path or any added value from cloud. V1 conclusions remain the only measured photo comparison. Cleanup stays queued, and no further implementation was performed.
