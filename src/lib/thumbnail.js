import { getDisplayBlob, isRawFile } from './rawPreview.js'

const THUMB_W = 296
const THUMB_H = 220

async function displayCanvas(photo, thumbnail = false, maxEdge = null) {
  const raw = isRawFile(photo.file)
  const range = photo.previewRange
  // Embedded JPEG EXIF is handled by the decoder exactly once. Use outer TIFF
  // orientation only when the JPEG has none, then apply it on the canvas.
  const orientation = raw && range?.jpegOrientation == null ? range?.orientation || 1 : 1
  const options = { imageOrientation: orientation === 1 ? 'from-image' : 'none' }
  if (thumbnail) {
    if (raw && range) {
      const decoderSwapsAxes = range.jpegOrientation >= 5
      const width = decoderSwapsAxes ? range.height : range.width
      const height = decoderSwapsAxes ? range.width : range.height
      const scale = Math.min(1, Math.max(THUMB_W / width, THUMB_H / height))
      options.resizeWidth = Math.max(1, Math.round(width * scale))
      options.resizeHeight = Math.max(1, Math.round(height * scale))
    } else options.resizeWidth = THUMB_W
    options.resizeQuality = 'high'
  }
  const bitmap = await createImageBitmap(getDisplayBlob(photo), options)
  try {
    const swapped = orientation >= 5
    const width = swapped ? bitmap.height : bitmap.width
    const height = swapped ? bitmap.width : bitmap.height
    const scale = maxEdge ? Math.min(1, maxEdge / Math.max(width, height)) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    ctx.scale(canvas.width / width, canvas.height / height)
    const transforms = {
      2: [-1, 0, 0, 1, width, 0], 3: [-1, 0, 0, -1, width, height],
      4: [1, 0, 0, -1, 0, height], 5: [0, 1, 1, 0, 0, 0],
      6: [0, 1, -1, 0, width, 0], 7: [0, -1, -1, 0, width, height],
      8: [0, -1, 1, 0, 0, height],
    }
    if (transforms[orientation]) ctx.transform(...transforms[orientation])
    ctx.drawImage(bitmap, 0, 0)
    return canvas
  } finally { bitmap.close() }
}

function jpegBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

export async function makeThumbnail(photo) {
  const raw = isRawFile(photo.file)
  if (raw && !photo.previewRange) return null
  try {
    const blob = await jpegBlob(await displayCanvas(photo, true))
    if (blob) return URL.createObjectURL(blob)
  } catch { /* Non-RAW retains its existing original URL fallback. */ }
  return raw ? null : URL.createObjectURL(getDisplayBlob(photo))
}

export async function getDetailPreviewBlob(photo) {
  if (!isRawFile(photo.file)) return getDisplayBlob(photo)
  // Canvas consumes the chosen orientation and emits a JPEG without EXIF, so
  // the detail <img> cannot apply a second rotation.
  const blob = await jpegBlob(await displayCanvas(photo))
  if (!blob) throw new Error('Could not prepare preview')
  return blob
}

export async function encodeForModel(photo) {
  const blob = await jpegBlob(await displayCanvas(photo, false, 768))
  if (!blob) throw new Error('Could not encode photo for the model')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
