// Downscale on ingest. The canvas paints 148 x 110 tiles; holding 116 full-
// resolution decoded bitmaps to do that is the real memory cost of a batch.
//
// The original photo.file is retained; model encoding is a separate decode.

const THUMB_W = 296 // 2x the 148px tile, for retina
const THUMB_H = 220

/**
 * Returns a blob URL for a downscaled copy of `file`, cover-cropped to the
 * tile's aspect ratio. Falls back to a plain object URL of the original when
 * the browser can't decode the file (RAW formats), so a batch never breaks —
 * it just doesn't get the memory win for those frames.
 */
export async function makeThumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file)

    const scale = Math.max(THUMB_W / bitmap.width, THUMB_H / bitmap.height)
    // Never upscale a photo that's already smaller than the tile.
    const w = Math.min(bitmap.width, Math.round(bitmap.width * scale))
    const h = Math.min(bitmap.height, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )
    if (!blob) return URL.createObjectURL(file)
    return URL.createObjectURL(blob)
  } catch {
    return URL.createObjectURL(file)
  }
}

// Longest edge 768px, JPEG q0.85, raw base64 with no data: prefix.
export async function encodeForModel(file) {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  try {
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height))
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  } finally {
    bitmap.close()
  }
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new Error('Could not encode photo for the model')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
