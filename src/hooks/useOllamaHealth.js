import { useCallback, useEffect, useRef, useState } from 'react'

export default function useOllamaHealth() {
  const [health, setHealth] = useState({ checking: true, connected: false, models: [] })
  const request = useRef(null)
  const refresh = useCallback(async () => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setHealth((old) => ({ ...old, checking: true }))
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch('http://localhost:3001/health', { signal: controller.signal })
      if (!response.ok) throw new Error('Health check failed')
      const data = await response.json()
      if (request.current !== controller) return
      setHealth({ checking: false, connected: data.connected === true,
        models: Array.isArray(data.models) ? [...new Set(data.models.filter((name) => typeof name === 'string'))] : [] })
    } catch {
      if (request.current === controller) setHealth({ checking: false, connected: false, models: [] })
    } finally { clearTimeout(timeout) }
  }, [])

  const markOffline = useCallback(() => {
    request.current?.abort()
    request.current = null
    setHealth({ checking: false, connected: false, models: [] })
  }, [])

  useEffect(() => {
    refresh()
    return () => { request.current?.abort(); request.current = null }
  }, [refresh])
  return { health, refresh, markOffline }
}
