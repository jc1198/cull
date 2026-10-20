import { BrowserExportWriter } from './browserWriter.js'

/**
 * @typedef {{name: string, size: number, read: () => Blob | ReadableStream | Promise<Blob | ReadableStream>}} PhotoSource
 * @typedef {Object} ExportWriter
 * @property {() => Promise<{label: string} | null>} chooseDestination Null means picker cancelled.
 * @property {(subfolderName: string) => Promise<void>} prepareFolder
 * @property {(name: string) => Promise<boolean>} exists
 * @property {(source: PhotoSource, finalName: string) => Promise<void>} writePhoto
 * @property {() => Promise<void>} finish
 */

// Result entries carry { photo, decision, starred }; the selector never reads originals.
export function selectExportSet(photos, kind) {
  return photos.filter((photo) => kind === 'starred' ? photo.starred : photo.decision === 'keep')
}

export async function resolveFilename(name, existsFn) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let candidate = name
  for (let suffix = 2; await existsFn(candidate); suffix++) candidate = `${stem}-${suffix}${extension}`
  return candidate
}

export { browserPhotoSource } from './browserSource.js'

export function getExportWriter() { return new BrowserExportWriter() }

/** @param {{photos: PhotoSource[], writer: ExportWriter, onProgress?: Function, signal?: AbortSignal}} options */
export async function runExport({ photos, writer, onProgress = () => {}, signal }) {
  let written = 0
  let processed = 0
  const failures = []
  onProgress({ current: 0, total: photos.length, written })
  try {
    for (const source of photos) {
      if (signal?.aborted) break
      onProgress({ current: processed + 1, total: photos.length, written })
      try {
        const name = await resolveFilename(source.name, (candidate) => writer.exists(candidate))
        if (signal?.aborted) break
        await writer.writePhoto(source, name)
        written++
      } catch (error) {
        failures.push({ name: source.name, message: error.message || String(error) })
      }
      processed++
      onProgress({ current: processed, total: photos.length, written })
    }
  } finally {
    await writer.finish()
  }
  return { written, failures, cancelled: Boolean(signal?.aborted) }
}
