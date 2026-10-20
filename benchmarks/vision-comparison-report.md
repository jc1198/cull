# Vision comparison

Models: qwen3-vl:2b-instruct; gemini-flash-lite-latest. Gemini response versions: gemini-3.5-flash-lite.

One criteria generation; exact evaluatePhoto prompt, no constraints; identical Canvas JPEG q0.85, longest edge 768px. Local options unchanged (no explicit seed). Gemini temperature 0 and reason-first responseSchema/propertyOrdering. The frozen array contains three high-weight criteria and one medium-weight criterion. No warmup calls or retries. Local tphoto10 hit the unchanged 120-token cap in all three rounds; no decision was inferred from its reason. Execution paused after the first invalid result, then resumed only the remaining calls. Ollama reported almost complete prompt-cache hits in rounds two and three; latency is a mixture of initial and cached requests, not an uncached throughput estimate. Timings include request/response latency and initial model loading; p95 uses nearest rank. Three interleaved rounds, alternating arm order.

| Photo | My label | My note | Local majority | Cloud majority |
|---|---|---|---|---|
| tphoto1.jpg | keep | golden hour portrait and candid expression detected. doesn't have sharp eyes, but meets the other criteria | keep | keep |
| tphoto2.jpg | keep | sharp eyes, golden hour lighting, candid expression | keep | keep |
| tphoto3.jpg | keep | this portrait has golden hour lighting and sharp eyes and candid expression | keep | keep |
| tphoto4.jpeg | cut | shadow over phase and bad lighting | keep | keep |
| tphoto5.jpeg | cut | bad lighting, eyes are not in focus | cut | keep |
| tphoto6.JPG | cut | cold light | cut | cut |
| tphoto7.jpeg | cut | cold light, no portrait and no subjects in photo | cut | cut |
| tphoto8.jpg | cut | golden light but no person as a subject | keep | keep |
| tphoto9.jpg | cut | golden light but no person as subject | keep | keep |
| tphoto10.jpg | cut | golden light but no subject | unresolved | keep |

## local

1. Keeps found: **3/3**.
2. False keeps: **3/7**.
3. Self-consistency: **9/10**. Per-photo verdicts (runs 1/2/3):
   - tphoto1.jpg: keep / keep / keep (unanimous).
   - tphoto2.jpg: keep / keep / keep (unanimous).
   - tphoto3.jpg: keep / keep / keep (unanimous).
   - tphoto4.jpeg: keep / keep / keep (unanimous).
   - tphoto5.jpeg: cut / cut / cut (unanimous).
   - tphoto6.JPG: cut / cut / cut (unanimous).
   - tphoto7.jpeg: cut / cut / cut (unanimous).
   - tphoto8.jpg: keep / keep / keep (unanimous).
   - tphoto9.jpg: keep / keep / keep (unanimous).
   - tphoto10.jpg: invalid / invalid / invalid (invalid response(s)).
4. Per category (majority agreement with labels):
   - portrait-warm: 3/3; 3 kept.
   - portrait-poor: 1/2; 1 kept.
   - flat-cold: 2/2; 0 kept.
   - nonportrait-warm: 0/3; 2 kept.
5. tphoto1: keep / keep / keep. Full reasons below.
6. Median **3368 ms**; p95 **10023 ms**. Gemini tokens: not applicable.

Invalid responses: 3/30; unresolved majorities: tphoto10.jpg. Invalid responses are never counted as cuts or consistent verdicts.

Individual run agreement: 6/10, 6/10, 6/10 (secondary; cut-all baseline is 7/10).

## cloud

1. Keeps found: **3/3**.
2. False keeps: **5/7**.
3. Self-consistency: **7/10**. Per-photo verdicts (runs 1/2/3):
   - tphoto1.jpg: keep / keep / keep (unanimous).
   - tphoto2.jpg: keep / keep / keep (unanimous).
   - tphoto3.jpg: keep / keep / keep (unanimous).
   - tphoto4.jpeg: keep / keep / cut (mixed).
   - tphoto5.jpeg: cut / keep / keep (mixed).
   - tphoto6.JPG: cut / cut / cut (unanimous).
   - tphoto7.jpeg: cut / cut / cut (unanimous).
   - tphoto8.jpg: keep / keep / keep (unanimous).
   - tphoto9.jpg: keep / keep / cut (mixed).
   - tphoto10.jpg: keep / keep / keep (unanimous).
4. Per category (majority agreement with labels):
   - portrait-warm: 3/3; 3 kept.
   - portrait-poor: 0/2; 2 kept.
   - flat-cold: 2/2; 0 kept.
   - nonportrait-warm: 0/3; 3 kept.
5. tphoto1: keep / keep / keep. Full reasons below.
6. Median **1368.5 ms**; p95 **1934 ms**. Total Gemini usage: {"promptTokenCount":38646,"candidatesTokenCount":1364,"totalTokenCount":40010}.

Invalid responses: 0/30; unresolved majorities: none. Invalid responses are never counted as cuts or consistent verdicts.

Individual run agreement: 6/10, 5/10, 7/10 (secondary; cut-all baseline is 7/10).

## Full reasons

### tphoto1.jpg

- local, run 1, **keep**: The photo features warm, golden-toned light that is characteristic of the golden hour, casting a soft glow on the subject. The subject's facial expression is natural and unposed, with her eyes closed and a relaxed demeanor, which aligns with the requirement for candid expressions. The eyes are focused and clear, and the lighting is consistent with the golden hour ambiance. Therefore, the photo satisfies the primary requirement.
- local, run 2, **keep**: The photo features warm, golden-toned light that is characteristic of the golden hour, casting a soft glow on the subject. The subject's facial expression is natural and unposed, with her eyes closed and a relaxed demeanor, which aligns with the requirement for candid expressions. The eyes are focused and clear, and the lighting is consistent with the golden hour ambiance. Therefore, the photo satisfies the primary requirement.
- local, run 3, **keep**: The photo features warm, golden-toned light that is characteristic of the golden hour, casting a soft glow on the subject. The subject's facial expression is natural and unposed, with her eyes closed and a relaxed demeanor, which aligns with the requirement for candid expressions. The eyes are focused and clear, and the lighting is consistent with the golden hour ambiance. Therefore, the photo satisfies the primary requirement.
- cloud, run 1, **keep**: The photo features a subject basking in warm golden hour light with a natural, serene expression and clear details, perfectly fulfilling all primary requirements.
- cloud, run 2, **keep**: The photo captures a person with natural, unposed expression under a warm, golden-toned light.
- cloud, run 3, **keep**: The photo captures a person with natural, serene expression enjoying warm golden hour light, satisfying the primary requirement of warm light, candid expressions, and sharp focus.

### tphoto4.jpeg

- local, run 1, **keep**: The photo has warm, orange-toned lighting, which is consistent with the description of a golden or warm light. The subject's facial expression is natural and unposed, and his eyes are focused and clear. These elements satisfy the primary requirement.
- local, run 2, **keep**: The photo has warm, orange-toned lighting, which is consistent with the description of a golden or warm light. The subject's facial expression is natural and unposed, and his eyes are focused and clear. These elements satisfy the primary requirement.
- local, run 3, **keep**: The photo has warm, orange-toned lighting, which is consistent with the description of a golden or warm light. The subject's facial expression is natural and unposed, and his eyes are focused and clear. These elements satisfy the primary requirement.
- cloud, run 1, **keep**: The photo features a subject with a natural, unposed facial expression and sharp, focused eyes, illuminated by warm orange-toned lighting, thus satisfying all primary requirements.
- cloud, run 2, **keep**: The photo features a subject with a natural, candid expression and sharp, focused eyes, illuminated by warm orange-toned lighting.
- cloud, run 3, **cut**: The photo shows a person with a natural expression wearing a cap, but the lighting is indoor and artificial rather than the warm golden hour light specified.

### tphoto5.jpeg

- local, run 1, **cut**: The photo is illuminated by a strong red light, which is not orange or golden toned. The lighting is not warm and does not have the characteristics of golden hour ambiance. The subjects' expressions appear natural and candid, but the primary requirement of warm light is not met.
- local, run 2, **cut**: The photo is illuminated by a strong red light, which is not orange or golden toned. The lighting is not warm and does not have the characteristics of golden hour ambiance. The subjects' expressions appear natural and candid, but the primary requirement of warm light is not met.
- local, run 3, **cut**: The photo is illuminated by a strong red light, which is not orange or golden toned. The lighting is not warm and does not have the characteristics of golden hour ambiance. The subjects' expressions appear natural and candid, but the primary requirement of warm light is not met.
- cloud, run 1, **cut**: The image features strong reddish lighting rather than warm orange or golden-toned light, failing the primary requirement.
- cloud, run 2, **keep**: The photo features candid expressions and sharp eyes with a strong red and warm lighting atmosphere.
- cloud, run 3, **keep**: The photo features candid expressions with sharp eyes and warm red lighting in a club setting, fully meeting the primary requirements.

### tphoto9.jpg

- local, run 1, **keep**: The photo features a bison walking on a gravel path with a natural, unposed facial expression and sharp eyes. The lighting appears to be warm and golden, suggesting the photo was taken during the golden hour. The overall ambiance is consistent with the warm light condition, and the subject's expression is natural and focused.
- local, run 2, **keep**: The photo features a bison walking on a gravel path with a natural, unposed facial expression and sharp eyes. The lighting appears to be warm and golden, suggesting the photo was taken during the golden hour. The overall ambiance is consistent with the warm light condition, and the subject's expression is natural and focused.
- local, run 3, **keep**: The photo features a bison walking on a gravel path with a natural, unposed facial expression and sharp eyes. The lighting appears to be warm and golden, suggesting the photo was taken during the golden hour. The overall ambiance is consistent with the warm light condition, and the subject's expression is natural and focused.
- cloud, run 1, **keep**: The image shows a bison walking on a gravel path with natural lighting and sharp focus on its eyes, meeting the primary requirement of having sharp eyes and candid capture.
- cloud, run 2, **keep**: The image shows a bison walking forward on a gravel path with a natural expression, sharp eyes, and warm golden light illuminating the scene, satisfying all primary requirements.
- cloud, run 3, **cut**: The image shows a bison walking on a gravel road with natural lighting and sharp focus on its face, but the light is harsh midday sun rather than the warm, golden-toned light specified in the primary requirement.

### tphoto10.jpg

- local, run 1, **invalid**: {
  "reason": "The photo captures a scenic canyon with a river flowing through it, illuminated by warm, golden-toned light. The lighting appears to be from the sun at a low angle, casting a golden hue across the landscape, which is consistent with the golden hour ambiance. The subject, the canyon and river, is in a natural, unposed state, and the eyes of the subject are not visible in the image, so the 'sharp eyes' criterion cannot be met. However, the primary requirement of warm light and golden hour ambiance is met, so the photo is kept.",
- local, run 2, **invalid**: {
  "reason": "The photo captures a scenic canyon with a river flowing through it, illuminated by warm, golden-toned light. The lighting appears to be from the sun at a low angle, casting a golden hue across the landscape, which is consistent with the golden hour ambiance. The subject, the canyon and river, is in a natural, unposed state, and the eyes of the subject are not visible in the image, so the 'sharp eyes' criterion cannot be met. However, the primary requirement of warm light and golden hour ambiance is met, so the photo is kept.",
- local, run 3, **invalid**: {
  "reason": "The photo captures a scenic canyon with a river flowing through it, illuminated by warm, golden-toned light. The lighting appears to be from the sun at a low angle, casting a golden hue across the landscape, which is consistent with the golden hour ambiance. The subject, the canyon and river, is in a natural, unposed state, and the eyes of the subject are not visible in the image, so the 'sharp eyes' criterion cannot be met. However, the primary requirement of warm light and golden hour ambiance is met, so the photo is kept.",
- cloud, run 1, **keep**: The image captures a majestic canyon with a river flowing through it, highlighted by warm golden tones on the rocky walls that satisfy the warm light requirement.
- cloud, run 2, **keep**: The photo captures a majestic view of a canyon with a winding river, and the warm golden sunlight illuminating the cliffs satisfies the warm light primary requirement.
- cloud, run 3, **keep**: This landscape photo of the Grand Canyon of the Yellowstone features warm golden and orange tones on the canyon walls, satisfying the primary requirement for warm lighting.


## Interpretation

Of the three proposed outcomes, the data supports **neither is reliable under the current one-call approach**. The cloud model found no additional keeps, made more false keeps, and changed verdict on three photos. Local verdicts were stable on nine photos but included three false keeps; the tenth photo failed its output contract every time. This does not support a cloud architecture switch.

There is also direct evidence of a criteria/prompt problem: the frozen criteria omit an explicit human-portrait requirement, and mandatory sharp eyes conflict with the human exception for tphoto1. Both models kept tphoto1 in all three runs; the local reason explicitly contradicts itself about closed versus focused eyes. Shared failures warrant prompt/criteria investigation, but this experiment does not establish that model perception is blameless or that revised prompts cannot work. It measures the current system, not the ceiling of either model.

The 3/7 local false-keep count includes only actual majority keeps: tphoto10 is unresolved, not a correct rejection. Nonportrait-warm local results are two false keeps and one unresolved. Self-consistency measures verdicts, not semantic consistency or correctness of explanations. No implementation changes were made; cleanup remains queued in CLAUDE.md.
