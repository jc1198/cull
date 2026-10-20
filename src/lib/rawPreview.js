// Browser TIFF/NEF extraction boundary. Never read the whole original or maker notes.
const RAW = /\.(raw|cr2|cr3|nef|arw|dng|raf|orf)$/i
export function isRawFile(file) { return RAW.test(file.name) }

async function bytes(file, offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > file.size) throw new Error('Invalid range')
  return new DataView(await file.slice(offset, offset + length).arrayBuffer())
}

async function tiffReader(file, base = 0, limit = file.size) {
  const read = (offset, length) => {
    if (offset < 0 || offset + length > limit - base) throw new Error('Invalid TIFF offset')
    return bytes(file, base + offset, length)
  }
  const header = await read(0, 8)
  const mark = header.getUint16(0)
  if (mark !== 0x4949 && mark !== 0x4d4d) throw new Error('Invalid byte order')
  const le = mark === 0x4949
  if (header.getUint16(2, le) !== 42) throw new Error('Not classic TIFF')
  async function ifd(offset) {
    if (offset < 8) throw new Error('Invalid IFD')
    const count = (await read(offset, 2)).getUint16(0, le)
    const entries = await read(offset + 2, count * 12 + 4)
    const tags = new Map()
    // Only interpret the tags we need. In particular, never follow MakerNote.
    for (let i = 0; i < count; i++) {
      const pos = i * 12
      const tag = entries.getUint16(pos, le)
      if (![0x100, 0x101, 0x112, 0x14a, 0x201, 0x202].includes(tag)) continue
      const type = entries.getUint16(pos + 2, le)
      const n = entries.getUint32(pos + 4, le)
      const size = type === 3 ? 2 : type === 4 || type === 13 ? 4 : 0
      if (!size || !n || n > 4096) continue
      const values = n * size <= 4 ? new DataView(entries.buffer, entries.byteOffset + pos + 8, 4)
        : await read(entries.getUint32(pos + 8, le), n * size)
      tags.set(tag, Array.from({ length: n }, (_, j) => size === 2 ? values.getUint16(j * size, le) : values.getUint32(j * size, le)))
    }
    return tags
  }
  return { ifd, first: header.getUint32(4, le) }
}

// Walk JPEG markers without decoding pixels; EXIF orientation, if present, wins over IFD0.
async function jpegInfo(file, offset, length) {
  const end = offset + length
  if (length < 4 || (await bytes(file, offset, 2)).getUint16(0) !== 0xffd8) return null
  let pos = offset + 2
  let width = 0, height = 0, orientation = null
  while (pos + 4 <= end) {
    const marker = await bytes(file, pos, 2)
    if (marker.getUint8(0) !== 0xff) break
    const code = marker.getUint8(1)
    if (code === 0xff) { pos++; continue }
    if (code === 0xda || code === 0xd9) break
    if (code === 0x01 || code >= 0xd0 && code <= 0xd7) { pos += 2; continue }
    const size = (await bytes(file, pos + 2, 2)).getUint16(0)
    if (size < 2 || pos + 2 + size > end) return null
    if (code === 0xe1 && size >= 16) {
      const signature = await bytes(file, pos + 4, 6)
      if (signature.getUint32(0) === 0x45786966 && signature.getUint16(4) === 0) {
        try {
          const reader = await tiffReader(file, pos + 10, pos + 2 + size)
          const value = (await reader.ifd(reader.first)).get(0x112)?.[0]
          if (value >= 1 && value <= 8) orientation = value
        } catch { /* A malformed APP1 does not invalidate an otherwise usable JPEG. */ }
      }
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(code) && size >= 8) {
      const sof = await bytes(file, pos + 4, 5)
      height = sof.getUint16(1); width = sof.getUint16(3)
    }
    pos += 2 + size
  }
  return { width, height, jpegOrientation: orientation }
}

export async function getPreviewRange(file) {
  try {
    const reader = await tiffReader(file)
    const root = await reader.ifd(reader.first)
    const orientation = root.get(0x112)?.[0] || 1
    const queue = [...(root.get(0x14a) || [])]
    const visited = new Set([reader.first])
    let best = null
    while (queue.length && visited.size < 256) {
      const offset = queue.shift()
      if (visited.has(offset)) continue
      visited.add(offset)
      try {
        const tags = await reader.ifd(offset)
        queue.push(...(tags.get(0x14a) || []))
        const start = tags.get(0x201)?.[0], length = tags.get(0x202)?.[0]
        if (!length || !Number.isSafeInteger(start) || start < 8 || start + length > file.size) continue
        const info = await jpegInfo(file, start, length)
        if (!info) continue
        const width = info.width || tags.get(0x100)?.[0] || 0
        const height = info.height || tags.get(0x101)?.[0] || 0
        if (!width || !height) continue
        const candidate = { offset: start, length, width, height, orientation: orientation >= 1 && orientation <= 8 ? orientation : 1, jpegOrientation: info.jpegOrientation }
        if (!best || width * height > best.width * best.height || width * height === best.width * best.height && length > best.length) best = candidate
      } catch { /* Ignore a malformed SubIFD and continue with its siblings. */ }
    }
    return best
  } catch { return null }
}

export function getDisplayBlob(photo) {
  if (!isRawFile(photo.file)) return photo.file
  const range = photo.previewRange
  return range ? photo.file.slice(range.offset, range.offset + range.length, 'image/jpeg') : new Blob([], { type: 'image/jpeg' })
}

let activeIngest = 0
const ingestWaiters = []
async function withIngestSlot(prepare) {
  await new Promise((resolve) => {
    const start = () => { activeIngest++; resolve() }
    if (activeIngest < 4) start()
    else ingestWaiters.push(start)
  })
  try { return await prepare() }
  finally { activeIngest--; ingestWaiters.shift()?.() }
}

// Four shared slots bound extraction and decoding even across overlapping uploads.
// Result slots retain input order.
export async function mapIngestPhotos(files, prepare) {
  const output = new Array(files.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, files.length) }, async () => {
    while (next < files.length) {
      const index = next++
      output[index] = await withIngestSlot(() => prepare(files[index], index))
    }
  }))
  return output
}
