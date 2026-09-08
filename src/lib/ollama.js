import { mockBuildCullCriteria, mockEvaluatePhoto } from './mock'
import { DEMO_MODEL } from './models'

const PROXY = 'http://localhost:3001'

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
export async function buildCullCriteria(tasteProfile, model = DEMO_MODEL, signal) {
  if (model === DEMO_MODEL) return mockBuildCullCriteria(tasteProfile)

  const prompt =
    `You are a photo culling assistant. A photographer wants: "${tasteProfile}"\n\n` +
    `Return ONLY a JSON array of 3 culling criteria, each with:\n` +
    `{ "signal": "short label", "weight": "high|medium|low", "description": "what to visually look for in the photo" }\n\n` +
    `Example for "golden hour landscapes":\n` +
    `[{"signal": "warm light", "weight": "high", "description": "photo has orange or golden toned light"},\n` +
    `{"signal": "horizon composition", "weight": "medium", "description": "horizon line is visible and well placed"}]\n\n` +
    `No explanation, no markdown, just the JSON array.`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false, num_predict: 1000 }),
    })
    if (!res.ok) throw new Error(`Model request failed (${res.status})`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const raw = data.response ?? ''
    console.log('[buildCullCriteria] raw response:', raw)

    let parsed = parseJsonArray(raw)

    // Normalise nested structures llava may emit:
    // [[{signal,...}]]            → unwrap outer array
    // [{criteria:[{signal,...}]}] → unwrap items wrapper
    // {criteria:[{signal,...}]}   → top-level object wrapper
    if (!Array.isArray(parsed)) {
      const obj = parseJsonObject(raw)
      if (obj && Array.isArray(obj.criteria)) parsed = obj.criteria
      else if (obj && Array.isArray(obj.signals)) parsed = obj.signals
    }
    if (Array.isArray(parsed) && parsed.length === 1 && Array.isArray(parsed[0])) {
      parsed = parsed[0] // [[...]] → [...]
    }
    if (Array.isArray(parsed) && parsed.length > 0 && !parsed[0].signal) {
      // items like [{criteria:[...]}] — grab first array-valued property
      const inner = Object.values(parsed[0]).find(Array.isArray)
      if (inner) parsed = inner
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
    `Reply with ONLY this JSON:\n` +
    `{"decision": "keep", "reason": "one sentence describing what you see and why it meets or fails the primary requirement"}\n\n` +
    `Use "keep" only if the primary requirement is satisfied.\n` +
    `Use "cut" if the primary requirement is not satisfied.`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        images: [cleanBase64],
        prompt,
        stream: false,
      }),
    })
    if (!res.ok) throw new Error(`Model request failed (${res.status})`)
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const raw = data.response ?? ''
    console.log('[evaluatePhoto] raw response:', raw)

    const parsed = parseJsonObject(raw)
    if (parsed && (parsed.decision === 'keep' || parsed.decision === 'cut')) {
      return { decision: parsed.decision, reason: parsed.reason ?? '' }
    }

    // Fallback: try to infer decision from plain text if JSON parse failed
    const lower = raw.toLowerCase()
    if (!/\b(keep|cut)\b/.test(lower)) throw new Error('The model did not return a decision')
    const decision = /\bkeep\b/.test(lower) ? 'keep' : 'cut'
    return { decision, reason: raw }
  } catch (err) {
    console.error('evaluatePhoto error:', err?.message ?? err)
    throw err
  }
}
