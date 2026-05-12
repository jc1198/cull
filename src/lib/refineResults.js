import { anthropic } from './anthropic'
import { mockRefineResults } from './mock'

const isMock = import.meta.env.VITE_MOCK_API === 'true'

const SYSTEM = `You are a photo culling assistant helping a user refine their results. Given a conversational request, return ONLY a raw JSON object with keys "action" (string), "params" (object), and "message" (one sentence for the user). No markdown, no explanation.`

export async function refineResults(query, results) {
  if (isMock) return mockRefineResults()

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Current results: ${results.length} photos kept.\n\nUser request: ${query}`,
    }],
  })

  const raw = response.content[0].text.trim()
  try {
    return JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*?\}/)
    if (match) return JSON.parse(match[0])
    return { action: 'filter', params: {}, message: 'Got it — showing updated selection' }
  }
}
