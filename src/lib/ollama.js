import { mockBuildCullCriteria, mockEvaluatePhoto } from './mock'
import { CRITERIA_MODEL, DEMO_MODEL, isInstalled } from './models'

const PROXY = 'http://localhost:3001'

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
          maxLength: 120,
          description: 'what to look for in the photo to confirm the subject is present',
        },
      },
      required: ['named', 'signal', 'description'],
    },
    criteria: {
      type: 'array', minItems: 3, maxItems: 6,
      items: {
        type: 'object',
        properties: {
          signal: { type: 'string' },
          weight: { type: 'string', enum: ['high', 'medium', 'low'] },
          description: { type: 'string', maxLength: 120 },
        },
        required: ['signal', 'weight', 'description'],
      },
    },
  },
  required: ['subject', 'criteria'],
}

const EVALUATE_SCHEMA = {
  type: 'object',
  properties: {
    reason: { type: 'string' },
    decision: { type: 'string', enum: ['keep', 'cut'] },
  },
  required: ['reason', 'decision'],
}

export async function unloadCriteriaModel(signal) {
  const res = await fetch(`${PROXY}/evaluate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    body: JSON.stringify({ model: CRITERIA_MODEL, prompt: '', stream: false, keep_alive: 0 }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `Model unload failed (${res.status})`)
}

// Returns the full data URL as-is; evaluatePhoto strips the prefix before sending
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function stripDataUrl(base64) {
  const idx = base64.indexOf(',')
  return idx !== -1 ? base64.slice(idx + 1) : base64
}

function stripFences(raw) {
  // Remove ```json ... ``` or ``` ... ``` wrappers the model sometimes adds
  return raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim()
}

function parseJsonArray(raw) {
  const cleaned = stripFences(raw)
  const match = cleaned.match(/\[[\s\S]*\]/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

function parseJsonObject(raw) {
  const cleaned = stripFences(raw)
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

/**
 * Sends the taste profile text to Ollama and returns an array of
 * structured culling criteria: [{ signal, weight, description }, ...]
 */
export async function buildCullCriteria(tasteProfile, fallbackModel = DEMO_MODEL, signal) {
  if (fallbackModel === DEMO_MODEL) return mockBuildCullCriteria(tasteProfile)

  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000)

  const prompt =
    `You are a photo culling assistant. A photographer wants: "${tasteProfile}"\n\n` +
    `If the description names a subject type — portraits, landscapes, wildlife, architecture, street — include a criterion requiring that subject to be present in the photo. A photo that does not contain the named subject cannot satisfy the description.\n\n` +
    `Return ONLY a JSON object with "subject" first, followed by "criteria".\n` +
    `For "subject", set "named" to true when the description names a required subject type, and write a short "signal" label and a visual "description" explaining how to confirm that subject is present. When no subject type is named, set "named" to false and use empty strings for "signal" and "description".\n\n` +
    `The "criteria" array contains 3 culling criteria (3–6 allowed), each with:\n` +
    `{ "signal": "short label", "weight": "high|medium|low", "description": "what to visually look for in the photo" }\n\n` +
    `Example for "golden hour landscapes":\n` +
    `{"subject": {"named": true, "signal": "landscape", "description": "photo shows an outdoor scene with land or natural scenery"}, "criteria": [\n` +
    `{"signal": "warm light", "weight": "high", "description": "photo has orange or golden toned light"},\n` +
    `{"signal": "horizon composition", "weight": "medium", "description": "horizon line is visible and well placed"}]}\n\n` +
    `Return {"subject": {...}, "criteria": [...]} matching this JSON schema: ${JSON.stringify(CRITERIA_SCHEMA)}. No explanation or markdown.`

  try {
    const healthResponse = await fetch(`${PROXY}/health`, {
      signal: AbortSignal.any([requestSignal, AbortSignal.timeout(5000)]),
    })
    if (!healthResponse.ok) throw new Error(`Health request failed (${healthResponse.status})`)
    const health = await healthResponse.json()
    const model = isInstalled(CRITERIA_MODEL, health.models ?? []) ? CRITERIA_MODEL : fallbackModel
    if (model === fallbackModel && !isInstalled(CRITERIA_MODEL, health.models ?? [])) {
      console.warn(`[buildCullCriteria] ${CRITERIA_MODEL} missing from /health; falling back to ${fallbackModel}`)
    }
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      signal: requestSignal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, think: false, keep_alive: '5m', format: CRITERIA_SCHEMA, options: { num_predict: 600, temperature: 0, num_ctx: 2048 } }),
    })
    if (!res.ok) throw new Error(`Model request failed (${res.status})`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const raw = data.response ?? ''
    const { prompt_eval_count, eval_count, load_duration, prompt_eval_duration, eval_duration, total_duration } = data
    console.log('[buildCullCriteria] metrics:', { prompt_eval_count, eval_count, load_duration, prompt_eval_duration, eval_duration, total_duration })
    console.log('[buildCullCriteria] raw response:', raw)

    const subject = parseJsonObject(raw)?.subject
    if (!subject || typeof subject.named !== 'boolean' ||
        typeof subject.signal !== 'string' || typeof subject.description !== 'string' ||
        (subject.named && (!subject.signal.trim() || !subject.description.trim()))) {
      throw new Error('The model did not return usable priorities: invalid subject')
    }

    let parsed
    try {
      const obj = JSON.parse(raw)
      if (obj && Array.isArray(obj.criteria)) parsed = obj.criteria
    } catch { /* Legacy output is handled below. */ }
    if (!Array.isArray(parsed)) {
      console.warn('[buildCullCriteria] normalization: legacy JSON array/fences')
      parsed = parseJsonArray(raw)
      if (!Array.isArray(parsed)) {
        const obj = parseJsonObject(raw)
        if (obj && Array.isArray(obj.criteria)) {
          console.warn('[buildCullCriteria] normalization: criteria wrapper')
          parsed = obj.criteria
        } else if (obj && Array.isArray(obj.signals)) {
          console.warn('[buildCullCriteria] normalization: signals wrapper')
          parsed = obj.signals
        }
      }
    }
    if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0])) {
      console.warn('[buildCullCriteria] normalization: nested array')
      parsed = parsed[0]
    }
    if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0]?.signal) {
      const inner = parsed[0] && Object.values(parsed[0]).find(Array.isArray)
      if (inner) {
        console.warn('[buildCullCriteria] normalization: array-valued item wrapper')
        parsed = inner
      }
    }

    if (Array.isArray(parsed) && subject.named) {
      parsed = [{ signal: subject.signal, weight: 'high', description: subject.description }, ...parsed]
    }
    console.log('[buildCullCriteria] normalised criteria:', parsed)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].signal) return parsed
    throw new Error('The model did not return usable priorities')
  } catch (err) {
    console.error('buildCullCriteria error:', err?.message ?? err)
    throw err
  }
}

/**
 * Sends a single photo + criteria to Ollama and returns { decision, reason }.
 * imageBase64 may be a full data URL — the prefix is stripped automatically.
 * `index` is used only by the mock path to produce a deterministic decision.
 *
 * `constraints` are the active chips. They are a separate layer from the
 * criteria: the user sets them directly rather than the model inferring them,
 * so they're applied at evaluation time and never dim the priorities panel.
 */
export async function evaluatePhoto(imageBase64, criteria, index = 0, constraints = [], model = DEMO_MODEL, signal) {
  if (model === DEMO_MODEL) return mockEvaluatePhoto(index)

  const cleanBase64 = stripDataUrl(imageBase64)
  console.log('[evaluatePhoto] base64 prefix check (first 100 chars):', cleanBase64.slice(0, 100))

  const prompt =
    `Look at this photo carefully.\n\n` +
    `You are a photo culling assistant. The PRIMARY requirement is:\n` +
    `${criteria.filter((c) => c.weight === 'high').map((c) => `${c.signal}: ${c.description}`).join(', ')}\n\n` +
    `If the photo does NOT satisfy the primary requirement, it must be cut regardless of anything else.\n\n` +
    `Secondary criteria (only considered if primary is met):\n` +
    `${criteria.filter((c) => c.weight !== 'high').map((c) => `- ${c.signal}: ${c.description}`).join('\n')}\n\n` +
    (constraints.length
      ? `Hard constraints set by the photographer — a photo violating any of ` +
        `these must be cut regardless of everything above:\n` +
        `${constraints.map((c) => `- ${c}`).join('\n')}\n\n`
      : '') +
    `Reply with ONLY JSON matching this schema: ${JSON.stringify(EVALUATE_SCHEMA)}.\n` +
    `{"reason": "one sentence describing what you see and why it meets or fails the primary requirement", "decision": "keep"}\n\n` +
    `Use "keep" only if the primary requirement is satisfied.\n` +
    `Use "cut" if the primary requirement is not satisfied.`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90000)]) : AbortSignal.timeout(90000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        images: [cleanBase64],
        prompt,
        stream: false,
        think: false,
        keep_alive: '10m',
        format: EVALUATE_SCHEMA,
        options: { num_predict: 250, temperature: 0, num_ctx: 4096 },
      }),
    })
    if (!res.ok) throw new Error(`Model request failed (${res.status})`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const raw = data.response ?? ''
    const { prompt_eval_count, eval_count, load_duration, prompt_eval_duration, eval_duration, total_duration } = data
    console.log('[evaluatePhoto] metrics:', { prompt_eval_count, eval_count, load_duration, prompt_eval_duration, eval_duration, total_duration })
    console.log('[evaluatePhoto] raw response:', raw)

    const parsed = parseJsonObject(raw)
    if (parsed && (parsed.decision === 'keep' || parsed.decision === 'cut') && typeof parsed.reason === 'string') {
      return { decision: parsed.decision, reason: parsed.reason ?? '' }
    }

    throw new Error('The model did not return a decision')
  } catch (err) {
    console.error('evaluatePhoto error:', err?.message ?? err)
    throw err
  }
}
