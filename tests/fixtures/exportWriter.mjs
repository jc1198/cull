// Deliberately no browser handles: exercises the portable writer contract.
export class MemoryExportWriter {
  constructor({ fail = [], afterWrite = () => {} } = {}) {
    this.files = new Map()
    this.fail = new Set(fail)
    this.afterWrite = afterWrite
    this.finished = false
  }
  async chooseDestination() { return { label: 'Memory' } }
  async prepareFolder(name) { this.folder = name }
  async exists(name) { return this.files.has(name) }
  async writePhoto(source, name) {
    if (this.fail.has(source.name)) throw new Error('Simulated failure')
    if (this.files.has(name)) throw new Error('Would overwrite')
    const bytes = await source.read()
    this.files.set(name, await new Response(bytes).arrayBuffer())
    this.afterWrite(name)
  }
  async finish() { this.finished = true }
}
