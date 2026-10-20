# Vision comparison v3

Models: qwen3-vl:2b-instruct; gemini-flash-lite-latest. Gemini response versions: gemini-3.5-flash-lite.

Subject-first required object added to criteria schema and prompt; named subjects map to a high-weight first array entry. Evaluation prompt/schema, models, image cache and num_predict=250 unchanged from v2. One criteria generation. Three interleaved rounds with alternating arm order; one-second delay before each cloud attempt, 429 backoff/retry. Timings exclude pacing and backoff, include normal loading/cache effects, and use nearest-rank p95. They are not uncached throughput estimates.

## Frozen criteria v3

```json
[
  {
    "signal": "portrait",
    "weight": "high",
    "description": "photo shows a human subject with a face and eyes"
  },
  {
    "signal": "golden hour light",
    "weight": "high",
    "description": "photo has warm, golden light casting soft shadows"
  },
  {
    "signal": "candid expression",
    "weight": "medium",
    "description": "subject's face shows natural, unposed emotion"
  },
  {
    "signal": "sharp eyes",
    "weight": "high",
    "description": "subject's eyes are focused and expressive"
  }
]
```

Diff against v1 (unchanged entries omitted):

```diff
- {"signal":"warm light","weight":"high","description":"photo has orange or golden toned light"}
- {"signal":"candid expressions","weight":"high","description":"subject has natural, unposed facial expressions"}
- {"signal":"sharp eyes","weight":"high","description":"subject's eyes are focused and clear"}
- {"signal":"golden hour ambiance","weight":"medium","description":"photo captures the soft, diffused light of golden hour"}
+ {"signal":"portrait","weight":"high","description":"photo shows a human subject with a face and eyes"}
+ {"signal":"golden hour light","weight":"high","description":"photo has warm, golden light casting soft shadows"}
+ {"signal":"candid expression","weight":"medium","description":"subject's face shows natural, unposed emotion"}
+ {"signal":"sharp eyes","weight":"high","description":"subject's eyes are focused and expressive"}
```


## Raw criteria response

```json
{
  "subject": {
    "named": true,
    "signal": "portrait",
    "description": "photo shows a human subject with a face and eyes"
  },
  "criteria": [
    {
      "signal": "golden hour light",
      "weight": "high",
      "description": "photo has warm, golden light casting soft shadows"
    },
    {
      "signal": "candid expression",
      "weight": "medium",
      "description": "subject's face shows natural, unposed emotion"
    },
    {
      "signal": "sharp eyes",
      "weight": "high",
      "description": "subject's eyes are focused and expressive"
    }
  ]
}
```


| Photo | My label | My note | Local majority | Cloud majority |
|---|---|---|---|---|
| tphoto1.jpg | keep | golden hour portrait and candid expression detected. doesn't have sharp eyes, but meets the other criteria | keep | keep |
| tphoto2.jpg | keep | sharp eyes, golden hour lighting, candid expression | keep | keep |
| tphoto3.jpg | keep | this portrait has golden hour lighting and sharp eyes and candid expression | keep | keep |
| tphoto4.jpeg | cut | shadow over phase and bad lighting | keep | keep |
| tphoto5.jpeg | cut | bad lighting, eyes are not in focus | cut | cut |
| tphoto6.JPG | cut | cold light | cut | cut |
| tphoto7.jpeg | cut | cold light, no portrait and no subjects in photo | cut | cut |
| tphoto8.jpg | cut | golden light but no person as a subject | cut | cut |
| tphoto9.jpg | cut | golden light but no person as subject | cut | cut |
| tphoto10.jpg | cut | golden light but no subject | cut | cut |

## local

1. Keeps found: **3/3**.
2. False keeps: **1/7**.
3. Self-consistency: **10/10**. Per-photo verdicts (runs 1/2/3):
   - tphoto1.jpg: keep / keep / keep (unanimous).
   - tphoto2.jpg: keep / keep / keep (unanimous).
   - tphoto3.jpg: keep / keep / keep (unanimous).
   - tphoto4.jpeg: keep / keep / keep (unanimous).
   - tphoto5.jpeg: cut / cut / cut (unanimous).
   - tphoto6.JPG: cut / cut / cut (unanimous).
   - tphoto7.jpeg: cut / cut / cut (unanimous).
   - tphoto8.jpg: cut / cut / cut (unanimous).
   - tphoto9.jpg: cut / cut / cut (unanimous).
   - tphoto10.jpg: cut / cut / cut (unanimous).
4. Per category (majority agreement with labels):
   - portrait-warm: 3/3; 3 kept.
   - portrait-poor: 1/2; 1 kept.
   - flat-cold: 2/2; 0 kept.
   - nonportrait-warm: 3/3; 0 kept.
5. tphoto1: keep / keep / keep. Full reasons below.
6. Median **8227.5 ms**; p95 **17345 ms**. Gemini tokens: not applicable.

429 retries: 0. Invalid responses: 0/30; unresolved majorities: none. Invalid responses are never counted as cuts or consistent verdicts.

Individual run agreement: 9/10, 9/10, 9/10 (secondary; cut-all baseline is 7/10).

## cloud

1. Keeps found: **3/3**.
2. False keeps: **1/7**.
3. Self-consistency: **9/10**. Per-photo verdicts (runs 1/2/3):
   - tphoto1.jpg: keep / keep / keep (unanimous).
   - tphoto2.jpg: keep / keep / keep (unanimous).
   - tphoto3.jpg: keep / keep / keep (unanimous).
   - tphoto4.jpeg: keep / keep / keep (unanimous).
   - tphoto5.jpeg: keep / cut / cut (mixed).
   - tphoto6.JPG: cut / cut / cut (unanimous).
   - tphoto7.jpeg: cut / cut / cut (unanimous).
   - tphoto8.jpg: cut / cut / cut (unanimous).
   - tphoto9.jpg: cut / cut / cut (unanimous).
   - tphoto10.jpg: cut / cut / cut (unanimous).
4. Per category (majority agreement with labels):
   - portrait-warm: 3/3; 3 kept.
   - portrait-poor: 1/2; 1 kept.
   - flat-cold: 2/2; 0 kept.
   - nonportrait-warm: 3/3; 0 kept.
5. tphoto1: keep / keep / keep. Full reasons below.
6. Median **1583.5 ms**; p95 **12298 ms**. Total Gemini usage: {"promptTokenCount":38736,"candidatesTokenCount":1291,"totalTokenCount":40027}.

429 retries: 0. Invalid responses: 0/30; unresolved majorities: none. Invalid responses are never counted as cuts or consistent verdicts.

Individual run agreement: 8/10, 9/10, 9/10 (secondary; cut-all baseline is 7/10).

## Full reasons

### tphoto1.jpg

- local, run 1, **keep**: The photo shows a human subject with a face and eyes, and the lighting is warm and golden, consistent with golden hour light. The subject's eyes are focused and expressive, and the image appears to be a candid expression. Therefore, it meets the primary requirement.
- local, run 2, **keep**: The photo shows a human subject with a face and eyes, and the lighting is warm and golden, consistent with golden hour light. The subject's eyes are focused and expressive, and the image appears to be a candid expression. Therefore, it meets the primary requirement.
- local, run 3, **keep**: The photo shows a human subject with a face and eyes, and the lighting is warm and golden, consistent with golden hour light. The subject's eyes are focused and expressive, and the image appears to be a candid expression. Therefore, it meets the primary requirement.
- cloud, run 1, **keep**: The photo features a human subject bathed in warm golden hour light with closed, peaceful eyes, perfectly satisfying the primary portrait requirement.
- cloud, run 2, **keep**: The photo features a person with closed eyes enjoying the warm golden hour light outdoors, fulfilling the primary requirement of a portrait with golden hour lighting.
- cloud, run 3, **keep**: The photo shows a human subject with her eyes closed, illuminated by warm golden hour light, satisfying the primary requirement for a backlit portrait.

### tphoto4.jpeg

- local, run 1, **keep**: The photo shows a human subject with a face and eyes, and the lighting appears to be warm and golden, casting soft shadows. The subject's eyes are focused and expressive, which satisfies the primary requirement. However, the description of the lighting as 'golden hour light' is not accurate, as the light is more evenly distributed and not clearly indicating the golden hour. The subject's expression appears to be natural and unposed, which satisfies the secondary criterion. Therefore, the photo meets the primary requirement.
- local, run 2, **keep**: The photo shows a human subject with a face and eyes, and the lighting appears to be warm and golden, casting soft shadows. The subject's eyes are focused and expressive, which satisfies the primary requirement. However, the description of the lighting as 'golden hour light' is not accurate, as the light is more evenly distributed and not clearly indicating the golden hour. The subject's expression appears to be natural and unposed, which satisfies the secondary criterion. Therefore, the photo meets the primary requirement.
- local, run 3, **keep**: The photo shows a human subject with a face and eyes, and the lighting appears to be warm and golden, casting soft shadows. The subject's eyes are focused and expressive, which satisfies the primary requirement. However, the description of the lighting as 'golden hour light' is not accurate, as the light is more evenly distributed and not clearly indicating the golden hour. The subject's expression appears to be natural and unposed, which satisfies the secondary criterion. Therefore, the photo meets the primary requirement.
- cloud, run 1, **keep**: The photo clearly shows a human subject with a face and visible eyes under warm, interior lighting with sharp focus, meeting the primary portrait requirements.
- cloud, run 2, **keep**: The photo clearly shows a human subject with a face and sharp eyes, and the lighting is warm with soft shadows.
- cloud, run 3, **keep**: The photo clearly shows a human subject with a face and sharp, expressive eyes, and features warm lighting creating soft shadows, thus satisfying the primary requirement.

### tphoto5.jpeg

- local, run 1, **cut**: The photo shows a group of people in a dimly lit environment with a strong red light, which is not golden hour light. The primary requirement specifies that the photo must have warm, golden light casting soft shadows and sharp eyes, but the lighting in this image is red, not golden. Therefore, the photo does not satisfy the primary requirement.
- local, run 2, **cut**: The photo shows a group of people in a dimly lit environment with a strong red light, which is not golden hour light. The primary requirement specifies that the photo must have warm, golden light casting soft shadows and sharp eyes, but the lighting in this image is red, not golden. Therefore, the photo does not satisfy the primary requirement.
- local, run 3, **cut**: The photo shows a group of people in a dimly lit environment with a strong red light, which is not golden hour light. The primary requirement specifies that the photo must have warm, golden light casting soft shadows and sharp eyes, but the lighting in this image is red, not golden. Therefore, the photo does not satisfy the primary requirement.
- cloud, run 1, **keep**: The photo shows human subjects with visible faces and eyes, under a warm reddish lighting environment, so it meets the primary requirement.
- cloud, run 2, **cut**: The photo features human subjects with visible faces, but the heavy red lighting replaces the warm golden hour light specified in the primary requirement.
- cloud, run 3, **cut**: The photo features human subjects with visible faces, but the lighting is heavily tinted red from stage lights rather than warm golden hour sunlight, failing the lighting requirement.


## Predictions: observed outcomes first

- tphoto8.jpg: local cut / cut / cut; cloud cut / cut / cut.
- tphoto9.jpg: local cut / cut / cut; cloud cut / cut / cut.
- tphoto10.jpg: local cut / cut / cut; cloud cut / cut / cut.
Prediction 1 (nonportrait-warm cuts in both arms): **held** by majority. V1 local tphoto10 was unresolved, so its transition is from invalid to a verdict, not a literal keep-to-cut flip.

tphoto4: local keep / keep / keep; cloud keep / keep / keep. Prediction 2 (false keep in both): **held**.

tphoto5: local cut / cut / cut; cloud keep / cut / cut. Prediction 3 (local correct, cloud unstable): **held**.

Majority agreement: local **9/10**, cloud **9/10**. Prediction 4 expected approximately 9/10 local and 8/10 cloud. Exact point targets: not met; both above the 7/10 cut-all baseline: yes.

## Criteria-quality observations

Candid expressions: v1 high; v2 medium; v3 medium. Golden-hour lighting and sharp eyes remain high in all three. V3 matches v2 weights for the shared concepts, but weights were not stable across versions. Each version changed the prompt or schema and had only one real criteria generation; this does not establish nondeterminism or repeatability under identical inputs. Snapshot/revert behavior was not changed.

Sharp eyes: v1 “focused and clear”; v2 and v3 “focused and expressive.” The vague expressive wording persists; no wording repair was made. V3 candid expression also uses “natural, unposed emotion.”

V3 has one lighting criterion, with no separate golden hour ambiance duplicate. The subject description was generated by the criteria model and mapped verbatim into the first high-weight card. No human-authored portrait description was substituted.

## Interpretation

The data supports a usable local path on this ten-photo set: 3/3 keeps found, 1/7 false keeps, 10/10 repeatable verdicts, and 0/30 invalid responses. Cloud adds no majority accuracy here and is less consistent; its measured median latency is lower. This is evidence for retaining the local path, not proof of generalization beyond the labelled set.

tphoto4 remains the shared false keep. The local reason explicitly says the lighting is not accurately described as golden hour, then nevertheless keeps the photo. All six tphoto1 verdicts also remain keep, matching the human label while bypassing its sharp-eyes exception. Stable verdicts therefore do not establish fully trustworthy reasons.

The subject requirement explains the nonportrait cuts in the recorded reasons. However, regenerated criteria also changed weights and visual wording, so improvements elsewhere cannot be attributed solely to the added subject field.

The 250-token cap was retained, and no local responses were invalid. The longest local response was 115 tokens, below the old 120-token cap. These runs therefore do not isolate the effect of the cap increase: the subject requirement also shortened the nonportrait reasons.

No changes were made after measurement to improve scores. Evaluation logic/schema, models, encoding, cap, UI, snapshot/revert behavior, and queued cleanup remain as specified. Existing contract tests cover named and unnamed subjects, first-position mapping, property order, and invalid subject rejection; they passed. The rate-limit retry branch was not exercised because no 429 responses occurred.

## Timing caveat

These timings include initial model loading and normal backend caching, with one-second cloud pacing and retry backoff excluded. Exact repeated images/prompts can be cached, so repetition speed is not evidence of fresh-image throughput or cold-start consistency. Reported cached prompt-token totals by round:

```json
[
  {
    "arm": "local",
    "rounds": [
      {
        "run": 1,
        "cachedPromptTokens": 36
      },
      {
        "run": 2,
        "cachedPromptTokens": 12569
      },
      {
        "run": 3,
        "cachedPromptTokens": 12569
      }
    ]
  },
  {
    "arm": "cloud",
    "rounds": [
      {
        "run": 1,
        "cachedPromptTokens": 0
      },
      {
        "run": 2,
        "cachedPromptTokens": 0
      },
      {
        "run": 3,
        "cachedPromptTokens": 0
      }
    ]
  }
]
```
