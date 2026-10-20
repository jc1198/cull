import test from 'node:test'
import assert from 'node:assert/strict'
import { BrowserExportWriter } from '../src/lib/export/browserWriter.js'

test('browser writer: unsupported, picker cancel, blocked-folder advice, and original streaming', async () => {
  const previous = globalThis.window
  try {
    globalThis.window = {}
    assert.equal(new BrowserExportWriter().supported, false)
    const reject = (name) => async () => { throw Object.assign(new Error('picker rejected'), { name }) }
    window.showDirectoryPicker = reject('AbortError')
    const writer = new BrowserExportWriter()
    assert.equal(await writer.chooseDestination(), null)
    window.showDirectoryPicker = reject('SecurityError')
    await assert.rejects(writer.chooseDestination(), /Choose a subfolder, such as Documents\/Photos\./)
    const files = new Map()
    const folder = {
      async getFileHandle(name, options) {
        if (!files.has(name) && !options?.create) throw Object.assign(new Error(), { name: 'NotFoundError' })
        return { async createWritable() {
          return new WritableStream({ write(chunk) { files.set(name, chunk) } })
        } }
      },
    }
    window.showDirectoryPicker = async (options) => {
      assert.equal(options.mode, 'readwrite')
      return { name: 'Photos', async getDirectoryHandle(name, options) {
        assert.equal(name, 'Cull keeps')
        assert.deepEqual(options, { create: true })
        return folder
      } }
    }
    assert.deepEqual(await writer.chooseDestination(), { label: 'Photos' })
    await writer.prepareFolder('Cull keeps')
    const source = { name: 'original.raw', size: 3, read: () => new Blob([new Uint8Array([0, 255, 17])]) }
    await writer.writePhoto(source, source.name)
    assert.deepEqual([...files.get(source.name)], [0, 255, 17])
    await assert.rejects(writer.writePhoto(source, source.name), /Filename was taken/)
    assert.deepEqual([...files.get(source.name)], [0, 255, 17])
  } finally { globalThis.window = previous }
})
