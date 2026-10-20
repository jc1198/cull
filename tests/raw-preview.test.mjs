import test from 'node:test'
import assert from 'node:assert/strict'
import { getPreviewRange, getDisplayBlob, isRawFile, mapIngestPhotos } from '../src/lib/rawPreview.js'
import { syntheticNef } from './fixtures/rawTiff.mjs'

for (const littleEndian of [true, false]) test(`TIFF ${littleEndian ? 'II' : 'MM'} header, SubIFD JPEG and IFD0 orientation`, async () => {
  const { file, offset, length } = syntheticNef({ littleEndian })
  // Disallow an accidental whole-file read, including on this synthetic File.
  file.arrayBuffer = () => { throw new Error('Whole-file read forbidden') }
  const range = await getPreviewRange(file)
  assert.deepEqual(range, { offset, length, width: 4928, height: 3264, orientation: 6, jpegOrientation: null })
  const blob = getDisplayBlob({ file, previewRange: range })
  assert.equal(blob.type, 'image/jpeg')
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()))
})

test('nested SubIFDs are followed; largest JPEG is selected across siblings', async () => {
  for (const options of [{ nested: true }, { multiple: true }]) {
    const { file, offset } = syntheticNef(options)
    assert.equal((await getPreviewRange(file)).offset, offset)
  }
})

for (const [label, options] of [
  ['out of bounds', { invalidRange: true }], ['missing JPEG magic', { badMagic: true }],
  ['no SubIFD JPEG', { subIfds: false }],
]) test(`returns null: ${label}`, async () => assert.equal(await getPreviewRange(syntheticNef(options).file), null))

test('invalid byte order, TIFF magic and truncated files return null without throwing', async () => {
  for (const data of [new Uint8Array(0), new Uint8Array(8), new Uint8Array([0x49, 0x49, 43, 0, 8, 0, 0, 0])]) {
    assert.equal(await getPreviewRange(new File([data], 'bad.nef')), null)
  }
})

test('JPEG EXIF orientation is recorded independently of outer IFD0 orientation', async () => {
  const { file } = syntheticNef({ orientation: 8, jpegOrientation: 6, littleEndian: true })
  const range = await getPreviewRange(file)
  assert.equal(range.orientation, 8)
  assert.equal(range.jpegOrientation, 6)
})

test('RAW extensions match ingest; non-RAW display returns original untouched', () => {
  for (const extension of ['raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf']) assert.equal(isRawFile({ name: `PHOTO.${extension.toUpperCase()}` }), true)
  const file = new File(['original'], 'photo.jpg')
  assert.equal(isRawFile(file), false)
  assert.equal(getDisplayBlob({ file }), file)
})

test('ingest has at most four active workers and retains order despite out-of-order completion', async () => {
  let active = 0, peak = 0
  const files = Array.from({ length: 17 }, (_, i) => i)
  const output = await mapIngestPhotos(files, async (file) => {
    active++; peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, (4 - file % 4) * 2))
    active--
    return file
  })
  assert.equal(peak, 4)
  assert.deepEqual(output, files)
})


test('overlapping ingests share the four-photo limit', async () => {
  let active = 0, peak = 0
  const prepare = async (value) => {
    active++; peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 2))
    active--
    return value
  }
  const batches = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]
  assert.deepEqual(await Promise.all(batches.map((files) => mapIngestPhotos(files, prepare))), batches)
  assert.equal(peak, 4)
})
