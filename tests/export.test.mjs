import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFilename, selectExportSet, runExport } from '../src/lib/export/index.js'
import { MemoryExportWriter } from './fixtures/exportWriter.mjs'

for (const [label, name, taken, expected] of [
  ['no collision', 'photo.jpg', [], 'photo.jpg'],
  ['one collision', 'photo.jpg', ['photo.jpg'], 'photo-2.jpg'],
  ['repeated collisions', 'photo.jpg', ['photo.jpg', 'photo-2.jpg', 'photo-3.jpg'], 'photo-4.jpg'],
  ['no extension', 'photo', ['photo', 'photo-2'], 'photo-3'],
]) test(`resolveFilename: ${label}`, async () => {
  assert.equal(await resolveFilename(name, async (candidate) => taken.includes(candidate)), expected)
})
const entries = [
  { photo: { id: 'a' }, decision: 'keep', starred: true },
  { photo: { id: 'b' }, decision: 'cut', starred: true },
  { photo: { id: 'c' }, decision: 'keep', starred: false },
]
test('selectExportSet: keeps only', () => assert.deepEqual(selectExportSet(entries, 'keeps'), [entries[0], entries[2]]))
test('selectExportSet: stars include cuts', () => assert.deepEqual(selectExportSet(entries, 'starred'), entries.slice(0, 2)))
test('moving a starred keep to cuts preserves its independent star', () => {
  const moved = { ...entries[0], decision: 'cut' }
  assert.equal(moved.starred, true)
  assert.deepEqual(selectExportSet([moved], 'starred'), [moved])
  assert.deepEqual(selectExportSet([moved], 'keeps'), [])
})
const sources = ['one.jpg', 'two.jpg', 'three.jpg'].map((name, i) => ({
  name, size: 3, read: () => new Blob([new Uint8Array([i, 0, 255])]),
}))
test('runExport: success preserves original bytes and resolves collisions', async () => {
  const writer = new MemoryExportWriter()
  writer.files.set('one.jpg', new ArrayBuffer(1))
  const progress = []
  const result = await runExport({ photos: sources, writer, onProgress: (value) => progress.push(value) })
  assert.deepEqual(result, { written: 3, failures: [], cancelled: false })
  assert.deepEqual([...new Uint8Array(writer.files.get('one-2.jpg'))], [0, 0, 255])
  assert.equal(writer.files.get('one.jpg').byteLength, 1)
  assert.equal(progress.at(-1).current, 3)
  assert.equal(writer.finished, true)
})
test('runExport: cancel midway retains written files and finishes writer', async () => {
  const controller = new AbortController()
  const writer = new MemoryExportWriter({ afterWrite: () => controller.abort() })
  const result = await runExport({ photos: sources, writer, signal: controller.signal })
  assert.deepEqual(result, { written: 1, failures: [], cancelled: true })
  assert.equal(writer.files.size, 1)
  assert.equal(writer.finished, true)
})
test('runExport: per-file failure does not stop later writes', async () => {
  const writer = new MemoryExportWriter({ fail: ['two.jpg'] })
  const result = await runExport({ photos: sources, writer })
  assert.equal(result.written, 2)
  assert.deepEqual(result.failures, [{ name: 'two.jpg', message: 'Simulated failure' }])
  assert.equal(writer.files.has('three.jpg'), true)
  assert.equal(writer.finished, true)
})
