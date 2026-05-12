import express from 'express'
import cors from 'cors'

const app = express()
const OLLAMA = 'http://localhost:11434'

app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json({ limit: '50mb' }))

// Health check — never throws, always returns valid JSON
app.get('/health', async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA}/api/tags`)
    const data = await r.json()
    const models = (data.models ?? []).map((m) => m.name)
    res.json({ connected: true, models })
  } catch {
    res.json({ connected: false, models: [] })
  }
})

// Forward to Ollama generate
app.post('/evaluate', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })
    const data = await r.json()
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: 'Ollama unreachable', detail: err.message })
  }
})

app.listen(3001, () => console.log('Cull proxy running on :3001'))
