# Cull local levers — 2026-09-14

Reason-first reduced acknowledged-requirement contradictions from **3/6 to 0/6**. The narrower explicit failure/verdict count fell **1/6 to 0/6**. 512px added no improvement: **0/6**, same decisions as reason-first at 768px, and unchanged image token count.

Taste: Golden hour portraits with candid expressions and sharp eyes.

All three criteria were HIGH: warm light; candid expressions; sharp eyes. Model, prompts (except field ordering), options and seed were held constant.

| Photo | Old order, 768px | Reason first, 768px | Reason first, 512px |
|---|---|---|---|
| _DSC1403.jpg | **keep** — The photo has warm, golden-toned light, which is characteristic of a natural, unposed scene. The subject, the sign, is not a person and therefore does not have facial expressions to evaluate. The primary requirement is met. | **cut** — The photo does not meet the primary requirement because it does not have warm light or golden tones. The lighting is natural daylight, and the scene is evenly illuminated with no visible orange or golden tint. The subject, the sign, is not a person and therefore does not have facial expressions to evaluate. The image is a landscape with a sign, and the primary requirement is not met. | **cut** — The photo does not meet the primary requirement because it does not have warm light or golden tones. The lighting is bright and even, typical of a sunny day, and there is no indication of orange or golden light. The scene is clearly a daytime outdoor shot, but the lighting is not described as warm or golden. |
| _DSC1426.jpg | **keep** — The photo features a sign for Yellowstone Grand Teton, with a natural, unposed facial expression of the subject (the sign) and sharp eyes. The lighting is bright and even, with no orange or golden tones, so it does not meet the primary requirement of warm light. | **cut** — The photo does not meet the primary requirement as it is not illuminated by warm, golden-toned light. The scene is captured under bright, even daylight, which is typical of a clear, sunny day. The lighting is not orange or golden in tone, and there are no indications of a warm light source or atmospheric conditions that would create such a tone. The subject, the sign, is not a person and therefore does not have facial expressions to evaluate. | **cut** — The photo does not meet the primary requirement as it is not illuminated by warm light; the lighting is neutral and even, typical of a clear day, and there are no indications of orange or golden tones. The subject, the sign, is not a person and therefore does not have facial expressions to evaluate. |
| _DSC1697.jpg | **keep** — The photo features a bison in a natural, grassy field under warm, golden-toned light, which satisfies the primary requirement. The bison's expression appears natural and unposed, and its eyes are focused and clear, meeting the secondary criteria as well. | **keep** — The photo features a bison in a grassy field under warm, golden-toned light, which aligns with the primary requirement. The bison's facial expression appears natural and unposed, and its eyes are focused and clear. The lighting is consistent with the golden hue, and the subject is captured in a candid moment, meeting all the criteria. | **keep** — The photo features a bison in a natural, grassy environment under warm, golden-toned light, which aligns with the primary requirement. The bison's facial expression appears natural and unposed, and its eyes are focused and clear. The lighting and subject are well-captured, meeting the criteria for a successful culling. |
| _DSC1701.jpg | **keep** — The photo features a bison walking on a gravel path with a natural, unposed facial expression and focused, clear eyes. The lighting appears to be warm and golden, suggesting a natural, candid light source, which aligns with the primary requirement. | **keep** — The photo features a bison walking on a gravel path with a natural, unposed facial expression and sharp eyes. The lighting appears to be warm and golden, suggesting a natural, possibly late afternoon light. The overall scene is candid and captures the bison in a natural environment, which aligns with the primary requirement. | **keep** — The photo features a bison in a natural setting with a warm, golden-toned light, which is consistent with the description of 'warm light'. The bison's facial expression appears natural and unposed, with its eyes focused and clear, meeting the criteria for 'candid expressions' and 'sharp eyes'. Therefore, the photo satisfies the primary requirement. |
| _DSC1736.jpg | **keep** — The photo features a canyon with a river flowing through it, illuminated by warm, golden-toned light that suggests a natural, unposed setting. The lighting is consistent with the description of 'warm light,' and the subject, the landscape, is not a person, so the criteria for 'candid expressions' and 'sharp eyes' are not applicable. Therefore, the photo meets the primary requirement. | **cut** — The photo depicts a scenic canyon with a river flowing through it, illuminated by warm, golden light. The lighting is consistent with a natural, unposed scene, and the subject is the landscape itself, not a person. The primary requirement is not met because the photo does not feature a subject with natural, unposed facial expressions or sharp eyes. The image is of a landscape, not a person, so the criteria for 'candid expressions' and 'sharp eyes' are not applicable. | **cut** — The photo depicts a scenic canyon with a river flowing through it, illuminated by warm, golden-toned light. The lighting appears natural and consistent with a sunny day, casting shadows that enhance the texture of the rock formations. The subject, the canyon and river, is not a person, so the criteria for 'candid expressions' and 'sharp eyes' are not applicable. Therefore, the photo does not meet the primary requirement. |
| _DSC1901.jpg | **cut** — The photo does not have warm light; it appears to be under bright, even daylight with a clear blue sky, which is not orange or golden toned light. Therefore, it does not meet the primary requirement. | **cut** — The photo depicts a serene landscape of a body of water with distant mountains under a clear blue sky. The lighting is natural and appears to be bright daylight, but there is no visible orange or golden tone in the scene. The image does not have any subjects with natural, unposed facial expressions or sharp eyes. Therefore, it does not meet the primary requirement. | **cut** — The photo depicts a serene landscape of a body of water under a clear blue sky with distant mountains. The lighting is natural and bright, but there is no visible orange or golden toned light, and the subject is not a person. Therefore, the photo does not meet the primary requirement. |

The three counted old-order rows are _DSC1403 (waived facial-expression requirement), _DSC1426 (explicitly failed warm light plus invented facial features), and _DSC1736 (waived required facial expressions/eyes). Under the narrower explicit failure-verdict criterion, only _DSC1426 counts. No reverse contradictions were found. This is a reason/decision audit, not proof of visual accuracy.

| Variant | n | Median ms | p95 ms (nearest rank) | Errors |
|---|---:|---:|---:|---:|
| Old order, 768px | 6 | 1,853.0 | 8,773 | 0 |
| Reason first, 768px | 6 | 5,655.5 | 8,776 | 0 |
| Reason first, 512px | 6 | 8,235.5 | 8,491 | 0 |
| 10-photo repeat, reason first 768px | 10 | 3,381.0 | 9,564 | 0 |

Cache reuse differed: old-order cached token counts [1183, 1183, 4, 1183, 4, 1183]; new-order [1183, 4, 1183, 4, 1183, 4]; 512px [4, 4, 4, 4, 4, 4]. Do not interpret the medians as a causal speed ranking. The 512px sweep took 49.295s of calls. The 10-photo repeat completed in 53.081s of calls, with zero 502s, aborts or parse errors; repeated images benefited from cache reuse.

**Uncached image-cost comparison**

| Request | prompt_eval_count | prompt_eval_duration (ns) | Duration ms | Cached tokens |
|---|---:|---:|---:|---:|
| 768px image | 1265 | 6100819000 | 6100.819 | 0 |
| images omitted | 183 | 349416000 | 349.416 | 0 |

Image delta: **1082 tokens; 5751.403 ms**. This includes image processing plus extra language-model prefill; it does not isolate projector compute alone.

**Server log, verbatim**

```text
load_tensors: offloaded 29/29 layers to GPU
clip_model_loader: has vision encoder
clip_ctx: CLIP using MTL0 backend
load_hparams: projector:          qwen3vl_merger
load_hparams: n_layer:            24
load_hparams: image_size:         768
load_hparams: patch_size:         16
load_hparams: image_min_pixels:   1048576 (custom value)
load_hparams: image_max_pixels:   4194304
reserve_compute_meta:       MTL0 compute buffer size =   355.55 MiB
reserve_compute_meta:        CPU compute buffer size =    24.93 MiB
reserve_compute_meta: graph splits = 1, nodes = 766
```

The vision encoder selected Metal (MTL0), with an MTL0 compute buffer; the CPU buffer does not establish a CPU-only encoder. The log also reports a 1,048,576-pixel minimum. Every 768px and 512px sweep call consumed 1,265 prompt tokens, so lowering input resolution did not lower this model/server image budget. No encoder-placement or minimum-token settings were changed.

**Method and scope**

- Chrome was closed; pgrep found no Chrome/Vite processes before run; only proxy ran alongside the Node harness and Ollama.
- JPEGs precomputed using actual encodeForModel; 512px uses a harness-local source copy with only 768 replaced by 512. No product encoder change.
- Same saved criteria, no chips, model qwen3-vl:2b-instruct, seed 42, temperature 0, num_predict 120, num_ctx 4096, think false, keep_alive 10m.
- Order alternated across paired photos. Anchor was already cached from image-cost probe. Cache hits differ between variants; timing medians are observed values, not a fair speed ranking. Encoding/preparation and warmup excluded.
- Cold timing pair unloads same model before each call: cached prompt tokens zero for both; prompt_eval_duration excludes model loading. Delta includes vision processing AND extra language-model prefill, not isolated encoder time.
- 10-photo run repeats earlier inputs; cache reuse affects timing. No errors occurred. Prior 502 cause is not proven by one successful rerun.

Commands: `node benchmarks/local-levers.mjs prepare`, close Chrome/stop Vite, start `node proxy.js`, then `node benchmarks/local-levers.mjs run` and `node benchmarks/local-levers.mjs timing`. Preparation uses the already-installed Playwright; no dependency was added. Raw results are in `local-levers-results.json`. The only product change is evaluation schema/example field order. Known issues, models and image encoding were not changed.
