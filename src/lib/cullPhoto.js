import { callGemini } from './gemini'
import { mockCullPhoto } from './mock'

const isMock = import.meta.env.VITE_MOCK_API === 'true'

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const SYSTEM = `You are a photo culling assistant. Given a photo and a taste profile, evaluate whether this photo should be kept or cut.

Consider: sharpness, exposure, composition, and how well the image matches the stated taste profile.

Return ONLY a raw JSON object with exactly two keys:
- "decision": either "keep" or "cut"
- "reason": one concise sentence explaining your decision

No markdown, no explanation — just the JSON object.`

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function cullPhoto(photo, index, tasteProfile) {
  if (isMock) {
    await new Promise((r) => setTimeout(r, 200))
    return mockCullPhoto(photo, index)
  }

  if (!photo.type || !SUPPORTED_TYPES.has(photo.type)) {
    return { decision: 'keep', reason: 'RAW file — manual review recommended.' }
  }

  try {
    const base64 = await fileToBase64(photo.file)
    const raw = await callGemini({
      system: SYSTEM,
      prompt: `Taste profile: ${tasteProfile}`,
      imageBase64: base64,
      mimeType: photo.type,
    })

    console.log(`Gemini raw response for ${photo.name}:`, raw)

    try {
      return JSON.parse(raw.trim())
    } catch {
      const match = raw.match(/\{[\s\S]*?\}/)
      if (match) return JSON.parse(match[0])
      console.warn(`Gemini non-JSON response for ${photo.name}:`, raw)
      return { decision: 'keep', reason: 'Could not parse Gemini response.' }
    }
  } catch (err) {
    console.error(`Gemini API error for ${photo.name}:`, err?.message ?? err)
    throw err
  }
}
