// This is the only module coupled to the browser directory API.
export class BrowserExportWriter {
  supported = typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
  destination = null
  folder = null

  async chooseDestination() {
    try {
      const destination = await window.showDirectoryPicker({ mode: 'readwrite' })
      this.destination = destination
      return { label: destination.name }
    } catch (error) {
      if (error.name === 'AbortError') return null
      if (error.name === 'SecurityError' || error.name === 'NotAllowedError') {
        throw new Error('Choose a subfolder, such as Documents/Photos.')
      }
      throw error
    }
  }

  async prepareFolder(subfolderName) {
    this.folder = await this.destination.getDirectoryHandle(subfolderName, { create: true })
  }

  async exists(name) {
    try {
      await this.folder.getFileHandle(name)
      return true
    } catch (error) {
      if (error.name === 'NotFoundError') return false
      if (error.name === 'TypeMismatchError') return true // A directory also occupies this name.
      throw error
    }
  }

  async writePhoto(source, finalName) {
    // Check again immediately before creation; never knowingly open an existing file.
    if (await this.exists(finalName)) throw new Error('Filename was taken before writing. Please retry.')
    const handle = await this.folder.getFileHandle(finalName, { create: true })
    const writable = await handle.createWritable({ mode: 'exclusive' })
    try {
      const bytes = await source.read()
      await (bytes instanceof Blob ? bytes.stream() : bytes).pipeTo(writable)
    } catch (error) {
      try { await writable.abort() } catch { /* pipeTo may already have aborted it. */ }
      throw error
    }
  }

  async finish() {}
}
