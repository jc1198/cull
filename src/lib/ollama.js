const PROXY = 'http://localhost:3001'

const FALLBACK_CRITERIA = [
  { signal: 'General quality', weight: 'high', description: 'Select the best overall photos from the batch' },
]

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
export async function buildCullCriteria(tasteProfile) {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llava:7b', prompt, stream: false, num_predict: 1000 }),
    })
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
    return FALLBACK_CRITERIA
  } catch (err) {
    console.error('buildCullCriteria error:', err?.message ?? err)
    return FALLBACK_CRITERIA
  }
}

/**
 * Sends a single photo + criteria to Ollama and returns { decision, reason }.
 * imageBase64 may be a full data URL — the prefix is stripped automatically.
 */
export async function evaluatePhoto(imageBase64, criteria) {
  const cleanBase64 = stripDataUrl(imageBase64)
  console.log('[evaluatePhoto] base64 prefix check (first 100 chars):', cleanBase64.slice(0, 100))

  const prompt =
    `Look at this photo carefully.\n\n` +
    `You are a photo culling assistant. Decide whether to keep or cut this photo based on these criteria:\n` +
    `${criteria.map((c) => `- ${c.signal} (${c.weight} priority): ${c.description}`).join('\n')}\n\n` +
    `Reply with ONLY this JSON and nothing else:\n` +
    `{"decision": "keep", "reason": "one sentence describing what you see and why it matches or does not match the criteria"}\n\n` +
    `Use "keep" if the photo matches the criteria, "cut" if not.`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava:7b',
        images: [cleanBase64],
        prompt,
        stream: false,
      }),
    })
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
    const decision = lower.includes('keep') ? 'keep' : 'cut'
    return { decision, reason: 'Could not evaluate' }
  } catch (err) {
    console.error('evaluatePhoto error:', err?.message ?? err)
    return { decision: 'cut', reason: 'Could not evaluate' }
  }
}
