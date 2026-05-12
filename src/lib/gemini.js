const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? ''
const BASE_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent'

/**
 * Direct fetch wrapper for Gemini v1 — bypasses the SDK entirely.
 * @param {object} opts
 * @param {string}  opts.system      - System instruction text
 * @param {string}  opts.prompt      - User-facing prompt
 * @param {string}  [opts.imageBase64] - Raw base64 image data (no data: prefix)
 * @param {string}  [opts.mimeType]  - MIME type of the image
 */
export async function callGemini({ system, prompt, imageBase64, mimeType }) {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { text: system },
        ...(imageBase64 ? [{ inline_data: { mime_type: mimeType, data: imageBase64 } }] : []),
        { text: prompt },
      ],
    }],
  }

  const response = await fetch(`${BASE_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${data.error?.message ?? 'Unknown error'}`)
  }

  return data.candidates[0].content.parts[0].text
}
