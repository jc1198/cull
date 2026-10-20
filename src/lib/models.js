export const DEMO_MODEL = 'demo'
export const CRITERIA_MODEL = 'qwen3:1.7b'
export const MODEL_STORAGE_KEY = 'cull.selectedModel'
export const LOCAL_MODELS = [
  { name: 'qwen3-vl:4b-instruct', description: 'Vision | 3.3 GB' },
  { name: 'qwen3-vl:2b-instruct', description: 'Vision | 1.9 GB' },
  { name: 'llava:7b', description: 'Balanced | 4 GB' },
  { name: 'moondream', description: 'Fastest | 1.7 GB' },
  { name: 'llama3.2-vision', description: 'Best quality | 8 GB', requiresMoreThan8GB: true },
]

export function canonicalModel(name) {
  return name.includes(':') ? name : `${name}:latest`
}

export function isInstalled(name, models) {
  return models.some((installed) => canonicalModel(installed) === canonicalModel(name))
}

export function modelRows(models) {
  return [...LOCAL_MODELS, ...models
    .filter((name) => !LOCAL_MODELS.some((model) => canonicalModel(model.name) === canonicalModel(name)))
    .map((name) => ({ name }))]
}

export function readSavedModel() {
  try { return localStorage.getItem(MODEL_STORAGE_KEY) || DEMO_MODEL } catch { return DEMO_MODEL }
}

export function prioritiesAreStale(lastRead, description, model) {
  return lastRead !== null && (description.trim() !== lastRead.description || model !== lastRead.model)
}
