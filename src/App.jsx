import { useState, useEffect, useRef } from 'react'
import Canvas from './components/Canvas'
import Console, { StepLabel, StatusLabel, ConsoleLink } from './components/Console'
import TasteInput from './components/TasteInput'
import PriorityPanel from './components/PriorityPanel'
import ProgressBar from './components/ProgressBar'
import { PrimaryButton, SecondaryButton, TextLink } from './components/Button'
import DropZone from './components/DropZone'
import ThumbnailGrid from './components/ThumbnailGrid'
import ResultsView from './components/ResultsView'
import ChipRow from './components/ChipRow'
import { buildCullCriteria, evaluatePhoto, fileToBase64, USE_MOCK } from './lib/ollama'
import { makeThumbnail } from './lib/thumbnail'

const TASTING_CHIPS = ['Exclude blurry shots', 'Best of duplicates', 'Faces in focus']

export default function App() {
  const [step, setStep] = useState('upload')
  // steps: 'upload' | 'tasting' | 'processing' | 'results'
  // The canvas persists across steps — only the console changes.
  const [cuiInput, setCuiInput]           = useState('')
  const [selectedChips, setSelectedChips] = useState([])
  const [photos, setPhotos]               = useState([])

  // Tasting
  const [criteria, setCriteria]               = useState([])
  const [isBuildingCriteria, setIsBuilding]   = useState(false)
  const [lastRead, setLastRead]               = useState(null) // { description, chips, criteria }

  // Processing
  const [progress, setProgress]         = useState({ current: 0, total: 0 })
  const [results, setResults]           = useState([])
  const [decisions, setDecisions]       = useState(() => new Map())
  const [evaluatingId, setEvaluatingId] = useState(null)
  // A ref, not state: the loop must read the current value, not one closed over
  // at the iteration it started.
  const cancelRef = useRef(false)

  // Results
  const [selectedId, setSelectedId] = useState(null)
  const [activeTab, setActiveTab]   = useState('keeps') // 'keeps' | 'cuts' | 'starred'
  const [undoItem, setUndoItem]     = useState(null)
  // Stars are a property of the photo, not of a run, so they live outside
  // `results` and survive a re-run.
  const [starredIds, setStarredIds] = useState(() => new Set())

  // Ingest
  const [isIngesting, setIsIngesting] = useState(false)
  const ingestSeq = useRef(0)
  const fileInputRef = useRef(null)

  // Ollama connection
  const [ollamaStatus, setOllamaStatus] = useState({ connected: false, models: [] })

  // Check Ollama on mount
  useEffect(() => {
    if (USE_MOCK) { setOllamaStatus({ connected: true, models: ['mock'] }); return }
    fetch('http://localhost:3001/health')
      .then((r) => r.json())
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ connected: false, models: [] }))
  }, [])

  // Revoke thumbnail blob URLs on unmount only. Keying this to [photos] would
  // revoke the whole batch every time the array changes — which "Add more
  // photos" does, killing the thumbnails already on the canvas.
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => () => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.thumbUrl))
  }, [])


  // ── Handlers ────────────────────────────────────────────────

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || /\.(raw|cr2|cr3|nef|arw|dng|raf|orf)$/i.test(f.name)
    )
    if (files.length === 0) return

    setIsIngesting(true)
    // ids are independent of the thumbnail URL — they key results, selection
    // and the memoized thumbnail, so they can't be a URL that gets revoked.
    const photoObjects = await Promise.all(
      files.map(async (file, i) => ({
        id:       `${ingestSeq.current++}-${file.name}-${file.size}`,
        thumbUrl: await makeThumbnail(file),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }))
    )
    setIsIngesting(false)

    setPhotos((prev) => [...prev, ...photoObjects])
    setStep('tasting')
  }

  const criteriaSeq = useRef(0)

  function normalizeCriteria(raw) {
    return raw.map((c) => ({
      id: `c${criteriaSeq.current++}`,
      signal: c.signal,
      weight: c.weight,
      description: c.description,
      weightSource: 'model',
    }))
  }

  /**
   * Match new criteria against existing ones by `signal` label:
   *   label matches — keep the user's weight if they set one manually; their
   *                   edit wins over the model's fresh assignment
   *   label is new  — add it at whatever weight the model assigned
   *   label is gone — drop it; the description changed, and that's the user's
   *                   own doing
   *
   * A criterion that keeps a user weight keeps weightSource 'user', or a second
   * re-read would silently revert it to the model's weight.
   */
  function mergeCriteria(existing, incoming) {
    const byLabel = new Map(existing.map((c) => [c.signal.trim().toLowerCase(), c]))
    return incoming.map((inc) => {
      const prev = byLabel.get(inc.signal.trim().toLowerCase())
      if (!prev) {
        return {
          id: `c${criteriaSeq.current++}`,
          signal: inc.signal,
          weight: inc.weight,
          description: inc.description,
          weightSource: 'model',
        }
      }
      const userSet = prev.weightSource === 'user'
      return {
        ...prev,
        // The model rewrote the description in vocabulary it can ground; take it.
        description: inc.description,
        weight: userSet ? prev.weight : inc.weight,
        weightSource: prev.weightSource,
      }
    })
  }

  function tasteProfile() {
    return [cuiInput.trim(), selectedChips.join(', ')].filter(Boolean).join(', ')
  }

  // Called only on a primary-button click — never on a debounce. A debounced
  // read flickers, and a late response can overwrite good criteria with
  // fallback defaults.
  async function runRead() {
    setIsBuilding(true)
    try {
      const raw = await buildCullCriteria(tasteProfile() || 'Best overall quality')
      // First read builds; every read after that merges onto what's on screen.
      const next = lastRead === null ? normalizeCriteria(raw) : mergeCriteria(criteria, raw)
      setCriteria(next)
      // Snapshot on every successful read only — a failed read leaves the
      // previous snapshot standing.
      setLastRead({
        description: cuiInput.trim(),
        chips: [...selectedChips],
        criteria: next.map((c) => ({ ...c })),
      })
    } catch (err) {
      console.error('buildCullCriteria failed:', err)
    } finally {
      setIsBuilding(false)
    }
  }

  function handleWeightChange(id, weight) {
    setCriteria((prev) => prev.map((c) =>
      c.id === id ? { ...c, weight, weightSource: 'user' } : c
    ))
  }

  function handleRemoveCriterion(id) {
    setCriteria((prev) => prev.filter((c) => c.id !== id))
  }

  // One control, one meaning: restore the console to the last state a read ran
  // on. Resets the whole console, not only the priorities.
  function handleRevert() {
    if (!lastRead) return
    setCuiInput(lastRead.description)
    setSelectedChips([...lastRead.chips])
    setCriteria(lastRead.criteria.map((c) => ({ ...c })))
  }

  function handleToggleChip(chip) {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
  }

  function openPicker() {
    fileInputRef.current?.click()
  }

  // Below this, the scan border becomes a flicker rather than a readable state.
  const MIN_SCAN_MS = 300

  async function handleRunCull() {
    cancelRef.current = false
    setStep('processing')
    setResults([])
    setActiveTab('keeps')
    setDecisions(new Map())
    setEvaluatingId(null)
    setProgress({ current: 0, total: photos.length })

    const builtCriteria = criteria

    const accumulated = []
    const decided = new Map()

    for (let i = 0; i < photos.length; i++) {
      if (cancelRef.current) break

      const photo = photos[i]
      const startedAt = Date.now()
      setEvaluatingId(photo.id)
      setProgress({ current: i + 1, total: photos.length })

      let entry
      try {
        const base64 = await fileToBase64(photo.file)
        const result = await evaluatePhoto(base64, builtCriteria, i, selectedChips)
        entry = { photo, decision: result.decision, originalDecision: result.decision, reason: result.reason }
      } catch (err) {
        console.error(`Failed on ${photo.name}:`, err)
        entry = { photo, decision: 'keep', originalDecision: 'keep', reason: 'Could not analyze — kept by default.' }
      }

      // Hold the scan border for its minimum before the decision lands.
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_SCAN_MS) await new Promise((r) => setTimeout(r, MIN_SCAN_MS - elapsed))

      accumulated.push(entry)
      decided.set(photo.id, entry.decision)
      setResults([...accumulated])
      setDecisions(new Map(decided))
    }

    // Cancel goes to results with whatever finished — partial results are
    // usable results.
    setEvaluatingId(null)
    setSelectedId(accumulated.find((r) => r.decision === 'keep')?.photo.id ?? null)
    setStep('results')
  }

  function handleCancel() {
    cancelRef.current = true
  }

  // The set the user is currently looking at, in grid order.
  function visibleSet(tab, res, stars) {
    if (tab === 'cuts') return res.filter((r) => r.decision === 'cut')
    if (tab === 'starred') return res.filter((r) => stars.has(r.photo.id))
    return res.filter((r) => r.decision === 'keep')
  }

  // The detail pane always shows something, so the actions never need a
  // disabled state. When the selected photo leaves the set: next photo in the
  // grid, or the previous one if it was last.
  function nextSelectionAfterRemoval(list, removedId) {
    const i = list.findIndex((r) => r.photo.id === removedId)
    if (i === -1) return list[0]?.photo.id ?? null
    const rest = list.filter((r) => r.photo.id !== removedId)
    if (rest.length === 0) return null
    return (rest[i] ?? rest[rest.length - 1]).photo.id
  }

  function handleTabChange(tab) {
    setActiveTab(tab)
    const list = visibleSet(tab, results, starredIds)
    setSelectedId(list[0]?.photo.id ?? null)
  }

  // Both directions need the undo toast — the reverse action is equally a
  // mistake someone can make.
  function handleMove(photoId) {
    const item = results.find((r) => r.photo.id === photoId)
    if (!item) return
    const from = item.decision
    const to   = from === 'keep' ? 'cut' : 'keep'

    const list = visibleSet(activeTab, results, starredIds)
    const nextSelected = activeTab === 'starred'
      ? selectedId // starred membership doesn't change on a move
      : nextSelectionAfterRemoval(list, photoId)

    setResults((prev) => prev.map((r) => r.photo.id === photoId ? { ...r, decision: to } : r))
    if (selectedId === photoId) setSelectedId(nextSelected)

    if (undoItem?.timeoutId) clearTimeout(undoItem.timeoutId)
    const timeoutId = setTimeout(() => setUndoItem(null), 5000)
    setUndoItem({ photoId, photoName: item.photo.name, from, to: to === 'cut' ? 'cuts' : 'keeps', timeoutId })
  }

  function handleUndo() {
    if (!undoItem) return
    clearTimeout(undoItem.timeoutId)
    setResults((prev) => prev.map((r) =>
      r.photo.id === undoItem.photoId ? { ...r, decision: undoItem.from } : r
    ))
    setSelectedId(undoItem.photoId)
    setUndoItem(null)
  }

  function handleStar(photoId) {
    setStarredIds((prev) => {
      const next = new Set(prev)
      next.has(photoId) ? next.delete(photoId) : next.add(photoId)
      return next
    })
  }

  function handleBackToSetTaste() {
    setStep('tasting')
  }

  // ── Derived ─────────────────────────────────────────────────

  // Chips are the user's input, not the model's output — a read never clears
  // them, and they no longer write into the description.
  const hasInput = cuiInput.trim() !== '' || selectedChips.length > 0

  const keepCount = results.filter((r) => r.decision === 'keep').length
  const cutCount  = results.filter((r) => r.decision === 'cut').length

  // Stale is derived, never stored: if the user undoes an edit and the text
  // matches the last read again, the state clears on its own. No edit-distance
  // threshold — guessing which edits matter reintroduces the mismatch the panel
  // exists to prevent.
  const isStale = lastRead !== null && cuiInput.trim() !== lastRead.description

  const readState = lastRead === null ? 'none' : isStale ? 'stale' : 'current'

  // Show Revert only when the console actually differs from the snapshot —
  // hidden before the first read, and again after a revert.
  const chipsDiffer =
    lastRead !== null &&
    (selectedChips.length !== lastRead.chips.length ||
     selectedChips.some((c) => !lastRead.chips.includes(c)))

  const criteriaDiffer =
    lastRead !== null &&
    (criteria.length !== lastRead.criteria.length ||
     criteria.some((c, i) => {
       const snap = lastRead.criteria[i]
       return !snap || snap.id !== c.id || snap.weight !== c.weight
     }))

  const showRevert = lastRead !== null && (isStale || chipsDiffer || criteriaDiffer)

  const primaryLabel =
    readState === 'none'  ? 'Show priorities' :
    readState === 'stale' ? 'Update priorities' :
    `Run Cull on ${photos.length} photos`

  const starredCount = results.filter((r) => starredIds.has(r.photo.id)).length
  // A re-run discards the result set, so warn about anything the user moved by hand.
  const manuallyMovedCount = results.filter((r) => r.decision !== r.originalDecision).length
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-canvas text-primary font-sans">
      {/* One picker for both the drop zone and the console's Browse files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.raw,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {step === 'upload' && (
        <>
          <Canvas>
            {/* The canvas supplies the 48px above; 32 below is the console's
                top padding, the same clearance the detail pane holds. */}
            <div className="flex flex-col flex-1 min-h-0" style={{ paddingBottom: '32px' }}>
              {!ollamaStatus.connected && (
                <div className="w-full shrink-0 px-4 py-3 mb-6 text-[13px] text-primary border border-border rounded-lg">
                  &#9888; Ollama isn&apos;t running. Start Ollama and run{' '}
                  <code className="font-mono text-xs px-1 py-0.5 rounded bg-surface">npm run dev</code>
                  {' '}to use Cull.
                </div>
              )}
              <DropZone onFiles={handleFiles} onBrowse={openPicker} />
              {isIngesting && (
                <p className="mt-4 shrink-0 text-[13px] text-primary">Preparing thumbnails&hellip;</p>
              )}
            </div>
          </Canvas>

          <Console
            label={<StepLabel prefix="Step 1 of 3:" name="Add photos" />}
            buttons={
              <div className="flex">
                <PrimaryButton onClick={openPicker}>Browse files</PrimaryButton>
              </div>
            }
          />
        </>
      )}

      {step === 'tasting' && (
        <>
          <Canvas>
            <ThumbnailGrid photos={photos} />
          </Canvas>

          <Console
            label={<StepLabel prefix="Step 2 of 3:" name="Set taste" />}
            secondary={
              showRevert
                // Names its scope: it restores the read snapshot, and manual
                // photo moves were never in that snapshot.
                ? <ConsoleLink onClick={handleRevert}>Revert priorities</ConsoleLink>
                : null
            }
            description={<TasteInput value={cuiInput} onChange={setCuiInput} />}
            priorities={
              <PriorityPanel
                criteria={criteria}
                stale={readState === 'stale'}
                onWeightChange={handleWeightChange}
                onRemove={handleRemoveCriterion}
              />
            }
            chips={
              <ChipRow
                chips={TASTING_CHIPS}
                activeChips={selectedChips}
                onToggle={handleToggleChip}
              />
            }
            buttons={
              <div className="w-full flex flex-col items-start" style={{ gap: '12px' }}>
                {manuallyMovedCount > 0 && (
                  <p className="text-[12px] font-normal text-primary leading-[14px]">
                    Re-running resets photos you moved between keeps and cuts.
                  </p>
                )}
                <div className="w-full flex items-center" style={{ gap: '16px' }}>
                <PrimaryButton
                  minWidth={157}
                  disabled={!hasInput || isBuildingCriteria}
                  onClick={readState === 'current' ? handleRunCull : runRead}
                >
                  {isBuildingCriteria ? 'Reading…' : primaryLabel}
                </PrimaryButton>
                <SecondaryButton onClick={openPicker}>Add more photos</SecondaryButton>
                </div>
              </div>
            }
          />
        </>
      )}

      {step === 'processing' && (
        <>
          <Canvas>
            <ThumbnailGrid
              photos={photos}
              decisions={decisions}
              evaluatingId={evaluatingId}
            />
          </Canvas>

          {/* Everything else locks: description, priorities, chips and Revert
              are all absent — there's nothing to revert into. */}
          <Console
            label={<StatusLabel prefix="Analyzing">{` ${progress.current} of ${progress.total}`}</StatusLabel>}
            secondary={
              <p className="text-[12px] font-normal text-primary leading-[14px] whitespace-nowrap">
                {keepCount} kept · {cutCount} cut
              </p>
            }
            progress={<ProgressBar current={progress.current} total={progress.total} />}
            buttons={
              <div className="w-full flex items-center" style={{ gap: '16px' }}>
                <PrimaryButton minWidth={157} onClick={handleCancel}>Cancel</PrimaryButton>
              </div>
            }
          />
        </>
      )}

      {step === 'results' && (
        <>
          {/* Not a scrolling canvas: the detail pane sizes itself to the canvas
              height so its actions can hold a fixed clearance above the console. */}
          <Canvas>
            <ResultsView
              results={results}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
              starredIds={starredIds}
              onMove={handleMove}
              onStar={handleStar}
              undoItem={undoItem}
              onUndo={handleUndo}
            />
          </Canvas>

          <Console
            label={<StepLabel prefix="Step 3 of 3:" name="Review results" />}
            secondary={
              <p className="text-[12px] font-normal text-primary leading-[14px] whitespace-nowrap">
                {photos.length} photos
              </p>
            }
            buttons={
              <div className="w-full flex items-center" style={{ gap: '16px' }}>
                {/* TODO: export flow is unspecified — inert for now. */}
                <PrimaryButton minWidth={157} disabled>Export keeps</PrimaryButton>
                <SecondaryButton disabled={starredCount === 0}>Export starred</SecondaryButton>
                <TextLink onClick={handleBackToSetTaste}>Back to set taste</TextLink>
              </div>
            }
          />
        </>
      )}
    </div>
  )
}
