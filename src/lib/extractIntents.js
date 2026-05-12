import { callGemini } from './gemini'
import { MOCK_INTENTS } from './mock'

const isMock = import.meta.env.VITE_MOCK_API === 'true'

const SYSTEM = `You help photographers decide which photos to keep. Given a description of what they're looking for, extract 4-5 short intent signals that capture their priorities. Return ONLY a raw JSON array of short phrases (max 6 words each). No markdown fences, no explanation — just the JSON array.

Example output: ["golden hour light", "candid expressions", "sharp focus on subject", "minimalist backgrounds"]`

export async function extractIntentSignals(text) {
  if (isMock) return MOCK_INTENTS

  const raw = await callGemini({ system: SYSTEM, prompt: text })

  try {
    return JSON.parse(raw.trim())
  } catch {
    const match = raw.match(/\[[\s\S]*?\]/)
    if (match) return JSON.parse(match[0])
    return []
  }
}
