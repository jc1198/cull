import test from 'node:test'
import assert from 'node:assert/strict'
import { makeThumbnail, encodeForModel, getDetailPreviewBlob } from '../src/lib/thumbnail.js'

async function withCanvas(run) {
  const saved = { bitmap: globalThis.createImageBitmap, document: globalThis.document, reader: globalThis.FileReader }
  const decoded = [], transforms = [], canvases = []
  let closed = 0
  globalThis.createImageBitmap = async (blob, options) => {
    decoded.push({ blob, options })
    return { width: options.resizeWidth || 100, height: options.resizeHeight || 60, close() { closed++ } }
  }
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0,
      getContext: () => ({ scale() {}, transform(...args) { transforms.push(args) }, drawImage() {} }),
      toBlob: (callback) => callback(new Blob(['derivative'], { type: 'image/jpeg' })),
    }
    canvases.push(canvas)
    return canvas
  } }
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:image/jpeg;base64,ZGVyaXZhdGl2ZQ=='; this.onload() }
  }
  try { await run({ decoded, transforms, canvases, closed: () => closed }) }
  finally { globalThis.createImageBitmap = saved.bitmap; globalThis.document = saved.document; globalThis.FileReader = saved.reader }
}
function photo(jpegOrientation = null) {
  return { file: new File(['xxxJPEGxxx'], 'portrait.nef'), previewRange: {
    offset: 3, length: 4, width: 4928, height: 3264, orientation: 6, jpegOrientation,
  } }
}

test('RAW thumbnail, detail and model use JPEG slices and apply outer orientation once when JPEG has none', async () => {
  await withCanvas(async ({ decoded, transforms, canvases, closed }) => {
    const original = photo()
    const url = await makeThumbnail(original)
    URL.revokeObjectURL(url)
    await getDetailPreviewBlob(original)
    assert.equal(await encodeForModel(original), 'ZGVyaXZhdGl2ZQ==')
    assert.equal(decoded.length, 3)
    for (const call of decoded) {
      assert.equal(await call.blob.text(), 'JPEG')
      assert.equal(call.options.imageOrientation, 'none')
    }
    assert.ok(decoded[0].options.resizeWidth < 500)
    assert.ok(decoded[0].options.resizeHeight < 500)
    assert.equal(transforms.length, 3)
    assert.equal(canvases[1].width, 60)
    assert.equal(canvases[1].height, 100)
    assert.equal(closed(), 3)
    assert.equal(await original.file.text(), 'xxxJPEGxxx')
  })
})

test('JPEG EXIF takes precedence, including orientation 1: no outer canvas rotation', async () => {
  for (const orientation of [1, 6, 8]) await withCanvas(async ({ decoded, transforms }) => {
    const original = photo(orientation)
    const url = await makeThumbnail(original)
    URL.revokeObjectURL(url)
    await getDetailPreviewBlob(original)
    await encodeForModel(original)
    assert.ok(decoded.every((entry) => entry.options.imageOrientation === 'from-image'))
    assert.equal(transforms.length, 0)
  })
})

test('RAW without preview, or with a decode failure, has no original object URL fallback', async () => {
  await withCanvas(async ({ decoded }) => {
    assert.equal(await makeThumbnail({ file: photo().file, previewRange: null }), null)
    assert.equal(decoded.length, 0)
    globalThis.createImageBitmap = async () => { throw new Error('No decoder') }
    assert.equal(await makeThumbnail(photo()), null)
    const original = { file: new File(['broken'], 'photo.jpg') }
    const fallback = await makeThumbnail(original)
    assert.equal(await (await fetch(fallback)).text(), 'broken')
    URL.revokeObjectURL(fallback)
  })
})
