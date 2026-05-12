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
  // Remove ```json ... ``` or ``` ... ``` wrappers Moondream sometimes adds
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
    `You are a photo culling assistant. Based on this taste profile, generate exactly 5 visual culling signals.\n\n` +
    `Taste profile: "${tasteProfile}"\n\n` +
    `Each signal must describe something you can SEE in a photo — a visual characteristic to look for.\n` +
    `For example, if the taste profile mentions "dogs", the signals should describe visual qualities of dog photos to select: ` +
    `clear view of the dog's face, good focus on the subject, expressive or playful moment, etc.\n` +
    `Do NOT just restate the input — describe concrete visual things to look for when evaluating each photo.\n\n` +
    `Return ONLY a raw JSON array — no markdown, no explanation — where each item has:\n` +
    `{ "signal": string, "weight": "high"|"medium"|"low", "description": string }`

  try {
    const res = await fetch(`${PROXY}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'moondream', prompt, stream: false, num_predict: 1000 }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)

    const raw = data.response ?? ''
    console.log('[buildCullCriteria] raw Moondream response:', raw)

    let parsed = parseJsonArray(raw)

    // Normalise nested structures Moondream sometimes emits:
    // [[{signal,...}]]            → unwrap outer array
    // [{criteria:[{signal,...}]}] → unwrap items wrapper
    // {criteria:[{signal,...}]}   → top-level object wrapper
    if (!Array.isArray(parsed)) {
      const obj = parseJsonObject(raw)
      if (obj && Array.isArray(obj.criteria)) parsed = obj.criteria
      else if (obj && Array.isArray(obj.signals))  parsed = obj.signals
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
async function ollamaCall(prompt, cleanBase64) {
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
  return data.response ?? ''
}

export async function evaluatePhoto(imageBase64, criteria) {
  const cleanBase64 = stripDataUrl(imageBase64)
  console.log('[evaluatePhoto] base64 prefix check (first 100 chars):', cleanBase64.slice(0, 100))

  try {
    // Call 1 — decision only (plain text, no JSON)
    const decisionPrompt =
      `Look at this photo. Based on these criteria:\n` +
      `${criteria.map((c) => `- ${c.signal}: ${c.description}`).join('\n')}\n\n` +
      `Does this photo match the criteria? Reply with ONLY one word: keep or cut`

    const decisionRaw = await ollamaCall(decisionPrompt, cleanBase64)
    console.log('[evaluatePhoto] decision raw:', decisionRaw)
    const decision = decisionRaw.trim().toLowerCase().includes('keep') ? 'keep' : 'cut'

    // Call 2 — reason only (plain text, no JSON)
    const reasonPrompt =
      `Describe what you see in this photo in one sentence. Be specific about the subject and content.`

    const reason = (await ollamaCall(reasonPrompt, cleanBase64)).trim()
    console.log('[evaluatePhoto] reason raw:', reason)

    return { decision, reason }
  } catch (err) {
    console.error('evaluatePhoto error:', err?.message ?? err)
    return { decision: 'cut', reason: 'Could not evaluate — marked as cut' }
  }
}
