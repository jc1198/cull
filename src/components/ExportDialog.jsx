import { useEffect, useRef, useState } from 'react'
import { browserPhotoSource, getExportWriter, runExport, selectExportSet } from '../lib/export'
import Console, { StatusLabel } from './Console'
import ProgressBar from './ProgressBar'
import { PrimaryButton, SecondaryButton } from './Button'

export default function ExportDialog({ kind, photos, onClose }) {
  const [writer] = useState(getExportWriter)
  const [destination, setDestination] = useState(null)
  const [subfolder, setSubfolder] = useState(() => {
    const today = new Date()
    const day = String(today.getDate()).padStart(2, '0')
    const month = today.toLocaleDateString('en-US', { month: 'short' })
    return `Cull ${kind} ${day}_${month}`
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState(null)
  const dialog = useRef(null)
  const controller = useRef(null)
  const selected = selectExportSet(photos, kind)
  const cuts = selected.filter((entry) => entry.decision === 'cut').length
  const valid = subfolder.trim() !== '' && !/[\\/]/.test(subfolder) && !subfolder.startsWith('.')

  useEffect(() => {
    const opener = document.activeElement
    dialog.current.showModal()
    return () => { controller.current?.abort(); opener?.focus() }
  }, [])

  async function chooseFolder() {
    setError('')
    setChoosing(true)
    try {
      const chosen = await writer.chooseDestination()
      if (chosen) setDestination(chosen)
    } catch (err) { setError(err.message) }
    finally { setChoosing(false) }
  }

  async function startExport() {
    if (!valid || !destination || busy) return
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError('')
    try {
      await writer.prepareFolder(subfolder)
      const outcome = await runExport({
        photos: selected.map((entry) => browserPhotoSource(entry.photo)),
        writer, signal: abort.signal, onProgress: setProgress,
      })
      setResult(outcome)
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <dialog ref={dialog} className="export-dialog" aria-labelledby="export-title"
      onCancel={(event) => { event.preventDefault(); busy ? controller.current?.abort() : onClose() }}>
      <h2 id="export-title" className="text-[18px] font-semibold px-8 pt-8">
        Export {selected.length} {kind}
      </h2>
      <Console
        label={busy ? <StatusLabel prefix="Exporting"> {progress.current} of {progress.total}</StatusLabel> : null}
        progress={busy ? <ProgressBar {...progress} /> : null}
        description={<div className="flex flex-col gap-4 text-[13px]">
          {result ? <>
            <p role="status">{result.cancelled
              ? `Export cancelled. ${result.written} photos written to ${subfolder}. Files already written remain in the folder.`
              : `Exported ${result.written} photos to ${subfolder}`}</p>
            {result.failures.length > 0 && <div>
              <p>{result.failures.length} files failed</p>
              <ul>{result.failures.map((failure, index) => <li key={index}>{failure.name}: {failure.message}</li>)}</ul>
            </div>}
          </> : !busy && <>
            {kind === 'starred' && cuts > 0 && <p>Includes {cuts} photos in your cuts</p>}
            {writer.supported === false ? <p>Export needs Chrome, Edge, or Arc for now. A desktop version is planned.</p> : <>
              <div className="flex items-center gap-4"><span>Destination</span>
                <SecondaryButton onClick={chooseFolder} disabled={choosing}>{destination?.label || 'Choose folder'}</SecondaryButton>
              </div>
              <label className="flex flex-col gap-2">Subfolder
                <input value={subfolder} onChange={(event) => setSubfolder(event.target.value)}
                  aria-invalid={!valid} aria-describedby={!valid ? 'subfolder-error' : undefined} />
              </label>
              {!valid && <p id="subfolder-error">Enter a name with no slashes and no leading dot.</p>}
            </>}
          </>}
          {error && <p role="alert">{error}</p>}
        </div>}
        buttons={<div className="flex gap-4">
          {result ? <PrimaryButton onClick={onClose}>Done</PrimaryButton> : busy
            ? <PrimaryButton onClick={() => controller.current?.abort()}>Cancel</PrimaryButton>
            : <>
              <PrimaryButton onClick={startExport} disabled={!destination || !valid || choosing || selected.length === 0}>Export {selected.length} photos</PrimaryButton>
              <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            </>}
        </div>} />
    </dialog>
  )
}
