// Downscale on ingest. The canvas paints 148 x 110 tiles; holding 116 full-
// resolution decoded bitmaps to do that is the real memory cost of a batch.
//
// This does NOT change what the model sees. `photo.file` stays the untouched
// original and remains what fileToBase64 encodes — the "no compression before
// Ollama" decision was about the model's input, not the DOM's.

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
