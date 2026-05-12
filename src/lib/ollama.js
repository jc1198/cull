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

function parseJson(raw) {
  try {
    return JSON.parse(raw.trim())
  } catch {
    const arrMatch = raw.match(/\[[\s\S]*?\]/)
    if (arrMatch) return JSON.parse(arrMatch[0])
    const objMatch = raw.match(/\{[\s\S]*?\}/)
    if (objMatch) return JSON.parse(objMatch[0])
    return null
  }
}

/**
 * Sends the taste profile text to Ollama and returns an array of
 * structured culling criteria: [{ signal, weight, description }, ...]
 */
export async function buildCullCriteria(tasteProfile) {
  const prompt =
    `You are a photo culling assistant. Based on this taste profile, generate exactly 5 culling signals.\n\n` +
    `Taste profile: "${tasteProfile}"\n\n` +
    `Return ONLY a raw JSON array — no markdown, no explanation — where each item has:\n` +
    `{ "signal": string, "weight": "high"|"medium"|"low", "description": string }`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'moondream', prompt, stream: false }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const parsed = parseJson(data.response ?? '')
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
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

  const criteriaText = criteria
    .map((c) => `- ${c.signal} (${c.weight}): ${c.description}`)
    .join('\n')

  const prompt =
    `You are a photo culling assistant. Evaluate this photo against the criteria below.\n\n` +
    `Criteria:\n${criteriaText}\n\n` +
    `Return ONLY this JSON: { "decision": "keep" or "cut", "reason": "one sentence" }\n` +
    `No markdown, no explanation.`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'moondream',
        images: [cleanBase64],
        prompt,
        stream: false,
      }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const parsed = parseJson(data.response ?? '')
    if (parsed && parsed.decision) return parsed
    return { decision: 'cut', reason: 'Could not evaluate — marked as cut' }
  } catch (err) {
    console.error('evaluatePhoto error:', err?.message ?? err)
    return { decision: 'cut', reason: 'Could not evaluate — marked as cut' }
  }
}
