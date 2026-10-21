import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import Canvas from './components/Canvas'
import UndoToast from './components/UndoToast'
import Console, { StepLabel, StatusLabel, ConsoleLink } from './components/Console'
import TasteInput from './components/TasteInput'
import PriorityPanel from './components/PriorityPanel'
import ProgressBar from './components/ProgressBar'
import { PrimaryButton, SecondaryButton, TextLink } from './components/Button'
import DropZone from './components/DropZone'
import ThumbnailGrid from './components/ThumbnailGrid'
import ResultsView from './components/ResultsView'
import ExportDialog from './components/ExportDialog'
import ChipRow from './components/ChipRow'
import { buildCullCriteria, evaluatePhoto, unloadCriteriaModel } from './lib/ollama'
import ModelPicker from './components/ModelPicker'
import useOllamaHealth from './hooks/useOllamaHealth'
import { CRITERIA_MODEL, DEMO_MODEL, MODEL_STORAGE_KEY, readSavedModel, prioritiesAreStale } from './lib/models'
import { makeThumbnail, encodeForModel } from './lib/thumbnail'
import { isRawFile, getPreviewRange, mapIngestPhotos } from './lib/rawPreview'

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

  const [tasteCollapsed, setTasteCollapsed] = useState(false)
  const [tasteMotionReady, setTasteMotionReady] = useState(false)
  const tasteGridRef = useRef(null)
  const tastePanelRef = useRef(null)

  // Measure the expanded layout before paint, once per entry to this step.
  // Subsequent edits, uploads, scrolling and resizes never override the choice.
  useLayoutEffect(() => {
    if (step !== 'tasting') return
    setTasteMotionReady(false)
    const scroll = tasteGridRef.current
    const naturalHeight = scroll.querySelector('.photo-grid-tiles').offsetHeight
    const panelHeight = tastePanelRef.current.firstElementChild.scrollHeight
    const expandedSpace = scroll.clientHeight - (tasteCollapsed ? panelHeight : 0)
    setTasteCollapsed(naturalHeight > expandedSpace)
    let secondFrame
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setTasteMotionReady(true))
    })
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame) }
  }, [step])

  function changeTasteCollapsed(collapsed) {
    const scroll = tasteGridRef.current
    if (scroll && collapsed !== tasteCollapsed) {
      // Keep enough trailing space to prevent the browser clamping scrollTop
      // when collapse enlarges the viewport, including at the final grid row.
      const panelHeight = tastePanelRef.current.firstElementChild.scrollHeight
      scroll.firstElementChild.style.minHeight =
        `${scroll.scrollTop + scroll.clientHeight + (collapsed ? panelHeight : 0)}px`
    }
    setTasteCollapsed(collapsed)
  }

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
  const [exportKind, setExportKind] = useState(null)
  const [activeTab, setActiveTab]   = useState('keeps') // 'keeps' | 'cuts' | 'starred'
  const [undoItem, setUndoItem]     = useState(null)
  const undoTimer = useRef(null)
  useEffect(() => () => clearTimeout(undoTimer.current), [])
  // Stars are a property of the photo, not of a run, so they live outside
  // `results` and survive a re-run.
  const [starredIds, setStarredIds] = useState(() => new Set())

  // Ingest
  const [isIngesting, setIsIngesting] = useState(false)
  const ingestSeq = useRef(0)
  const fileInputRef = useRef(null)

  const [model, setModel] = useState(readSavedModel)
  const { health, refresh, markOffline } = useOllamaHealth()
  const [readError, setReadError] = useState(null)
  const [runFailure, setRunFailure] = useState(null)
  const readSequence = useRef(0)
  const readRequest = useRef(null)
  const runRequest = useRef(null)
  const runSnapshot = useRef(null)
  const runActive = useRef(false)

  useEffect(() => {
    try { localStorage.setItem(MODEL_STORAGE_KEY, model) } catch { /* Storage may be unavailable. */ }
  }, [model])
  useEffect(() => () => {
    readSequence.current++
    readRequest.current?.abort()
    runRequest.current?.abort()
    cancelRef.current = true
  }, [])

  function switchModel(nextModel) {
    if (runActive.current || nextModel === model) return
    readSequence.current++
    readRequest.current?.abort()
    setIsBuilding(false)
    setReadError(null)
    setModel(nextModel)
    setResults([])
    setDecisions(new Map())
    setEvaluatingId(null)
    setSelectedId(null)
    setActiveTab('keeps')
    clearTimeout(undoTimer.current)
    setUndoItem(null)
    setRunFailure(null)
    runSnapshot.current = null
    if (step === 'results' || step === 'processing') setStep('tasting')
  }

  // Revoke thumbnail blob URLs on unmount only. Keying this to [photos] would
  // revoke the whole batch every time the array changes — which "Add more
  // photos" does, killing the thumbnails already on the canvas.
  const thumbnailUrls = useRef(new Set())
  const photosRef = useRef(photos)
  useEffect(() => { photosRef.current = photos }, [photos])
  useEffect(() => () => {
    thumbnailUrls.current.forEach((url) => URL.revokeObjectURL(url))
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
    const photoObjects = await mapIngestPhotos(files, async (file) => {
      const photo = {
        id: `${ingestSeq.current++}-${file.name}-${file.size}`,
        file, name: file.name, size: file.size, type: file.type,
        previewRange: isRawFile(file) ? await getPreviewRange(file) : null,
      }
      photo.thumbUrl = await makeThumbnail(photo)
      photo.noPreview = isRawFile(file) && !photo.thumbUrl
      return photo
    })
    photoObjects.forEach((photo) => {
      if (photo.thumbUrl) thumbnailUrls.current.add(photo.thumbUrl)
    })
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
    changeTasteCollapsed(false)
    const sequence = ++readSequence.current
    readRequest.current?.abort()
    const controller = new AbortController()
    readRequest.current = controller
    setIsBuilding(true)
    setReadError(null)
    try {
      const raw = await buildCullCriteria(tasteProfile() || 'Best overall quality', model, controller.signal)
      if (sequence !== readSequence.current) return
      // First read builds; every read after that merges onto what's on screen.
      const next = lastRead === null ? normalizeCriteria(raw) : mergeCriteria(criteria, raw)
      setCriteria(next)
      // Snapshot on every successful read only — a failed read leaves the
      // previous snapshot standing.
      setLastRead({
        model,
        description: cuiInput.trim(),
        chips: [...selectedChips],
        criteria: next.map((c) => ({ ...c })),
      })
    } catch (err) {
      if (sequence !== readSequence.current) return
      setReadError(`${model === DEMO_MODEL ? 'Demo mode' : model} could not read your priorities. Please retry or choose another model.`)
      if (model !== DEMO_MODEL) refresh()
    } finally {
      if (sequence === readSequence.current) setIsBuilding(false)
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

  async function handleRunCull(resume = false) {
    if (runActive.current) return
    if (!resume && (lastRead === null || prioritiesAreStale(lastRead, cuiInput, model))) return
    runActive.current = true
    cancelRef.current = false
    const controller = new AbortController()
    runRequest.current = controller
    setRunFailure(null)
    if (resume && model !== DEMO_MODEL) refresh()
    setStep('processing')
    setActiveTab('keeps')
    clearTimeout(undoTimer.current)
    setUndoItem(null)
    if (!resume) {
      runSnapshot.current = { criteria, chips: [...selectedChips], model, photos: photos.filter((photo) => !photo.noPreview), finished: [] }
      setResults([])
      setDecisions(new Map())
    }
    const snapshot = runSnapshot.current
    const accumulated = [...snapshot.finished]
    const decided = new Map(accumulated.map((entry) => [entry.photo.id, entry.decision]))
    setProgress({ current: accumulated.length, total: snapshot.photos.length })

    const firstIndex = accumulated.length
    for (let i = firstIndex; i < snapshot.photos.length; i++) {
      if (cancelRef.current) break
      const photo = snapshot.photos[i]
      const startedAt = Date.now()
      setEvaluatingId(photo.id)
      setProgress({ current: i + 1, total: snapshot.photos.length })
      let entry
      try {
        if (i === firstIndex && snapshot.model !== DEMO_MODEL && health.models.includes(CRITERIA_MODEL)) await unloadCriteriaModel(controller.signal)
        const base64 = snapshot.model === DEMO_MODEL ? '' : await encodeForModel(photo)
        if (cancelRef.current) break
        const result = await evaluatePhoto(base64, snapshot.criteria, i, snapshot.chips, snapshot.model, controller.signal)
        entry = { photo, decision: result.decision, originalDecision: result.decision, reason: result.reason }
      } catch (err) {
        if (cancelRef.current) break
        snapshot.finished = accumulated
        setProgress({ current: accumulated.length, total: snapshot.photos.length })
        setEvaluatingId(null)
        setRunFailure({ model: snapshot.model, nextIndex: i })
        markOffline()
        runActive.current = false
        return
      }
      const elapsed = Date.now() - startedAt
      console.log('[evaluatePhoto] elapsed:', { photo: photo.name, elapsedMs: elapsed })
      if (elapsed < MIN_SCAN_MS) await new Promise((r) => setTimeout(r, MIN_SCAN_MS - elapsed))
      if (cancelRef.current) break
      accumulated.push(entry)
      snapshot.finished = [...accumulated]
      decided.set(photo.id, entry.decision)
      setResults([...accumulated])
      setDecisions(new Map(decided))
    }
    runActive.current = false
    setEvaluatingId(null)
    setSelectedId(accumulated.find((r) => r.decision === 'keep')?.photo.id ?? null)
    setStep('results')
    if (snapshot.model !== DEMO_MODEL) refresh()
  }

  function handleCancel() {
    cancelRef.current = true
    runRequest.current?.abort()
  }

  function seeFinished() {
    setRunFailure(null)
    setActiveTab('keeps')
    setSelectedId(results.find((r) => r.decision === 'keep')?.photo.id ?? null)
    setStep('results')
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

    clearTimeout(undoTimer.current)
    const timeoutId = setTimeout(() => setUndoItem(null), 5000)
    undoTimer.current = timeoutId
    setUndoItem({ kind: 'move', photoId, from, message: `Moved ${item.photo.name} to ${to === 'cut' ? 'cuts' : 'keeps'}`, timeoutId })
  }

  const handleRemovePhoto = useCallback((photoId) => {
    const index = photosRef.current.findIndex((photo) => photo.id === photoId)
    if (index < 0) return
    const photo = photosRef.current[index]
    setPhotos((prev) => prev.filter((item) => item.id !== photoId))
    clearTimeout(undoTimer.current)
    const timeoutId = setTimeout(() => setUndoItem(null), 5000)
    undoTimer.current = timeoutId
    setUndoItem({ kind: 'remove', photo, index, message: 'Photo removed', timeoutId })
  }, [])

  function handleUndo() {
    if (!undoItem) return
    clearTimeout(undoItem.timeoutId)
    if (undoItem.kind === 'remove') {
      setPhotos((prev) => {
        const restored = [...prev]
        restored.splice(undoItem.index, 0, undoItem.photo)
        return restored
      })
    } else {
      setResults((prev) => prev.map((r) =>
        r.photo.id === undoItem.photoId ? { ...r, decision: undoItem.from } : r
      ))
      setSelectedId(undoItem.photoId)
    }
    setUndoItem(null)
  }

  function handleStar(photoId) {
    if (activeTab === 'starred' && selectedId === photoId && starredIds.has(photoId)) {
      setSelectedId(nextSelectionAfterRemoval(visibleSet(activeTab, results, starredIds), photoId))
    }
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
  const isStale = prioritiesAreStale(lastRead, cuiInput, model)
  const modelChanged = lastRead !== null && model !== lastRead.model

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

  const showRevert = lastRead !== null && (cuiInput.trim() !== lastRead.description || chipsDiffer || criteriaDiffer)

  const skippedCount = photos.filter((photo) => photo.noPreview).length
  const analysisCount = photos.length - skippedCount

  const primaryLabel =
    readState === 'none'  ? 'Show priorities' :
    readState === 'stale' ? 'Update priorities' :
    `Run Cull on ${analysisCount} photo${analysisCount === 1 ? '' : 's'}`

  const starredCount = results.filter((r) => starredIds.has(r.photo.id)).length
  // A re-run discards the result set, so warn about anything the user moved by hand.
  const manuallyMovedCount = results.filter((r) => r.decision !== r.originalDecision).length
  const modelPicker = <ModelPicker model={model} health={health} refresh={refresh}
    locked={step === 'processing' && !runFailure} onSelect={switchModel}
    consequence={results.length > 0 || step === 'results' ? 'results' : lastRead ? 'priorities' : null} />
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

      <UndoToast undoItem={undoItem} onUndo={handleUndo} />
      {exportKind && <ExportDialog kind={exportKind}
        photos={results.map((entry) => ({ ...entry, starred: starredIds.has(entry.photo.id) }))}
        onClose={() => setExportKind(null)} />}

      {step === 'upload' && (
        <>
          <Canvas modelPicker={modelPicker}>
            {/* The canvas supplies the 48px above; 32 below is the console's
                top padding, the same clearance the detail pane holds. */}
            <div className="flex flex-col flex-1 min-h-0" style={{ paddingBottom: '32px' }}>
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
          <Canvas modelPicker={modelPicker}>
            <ThumbnailGrid photos={photos} onRemove={handleRemovePhoto} scrollRef={tasteGridRef} />
          </Canvas>

          <Console
            collapsed={tasteCollapsed}
            onToggle={() => changeTasteCollapsed(!tasteCollapsed)}
            motionReady={tasteMotionReady}
            panelRef={tastePanelRef}
            summary={readState === 'none' ? '' : `${criteria.length} ${criteria.length === 1 ? 'priority' : 'priorities'} · ${readState === 'stale' ? 'needs update' : 'current'}`}
            label={<StepLabel prefix="Step 2 of 3:" name="Set taste" />}
            secondary={
              showRevert
                // Names its scope: it restores the read snapshot, and manual
                // photo moves were never in that snapshot.
                ? <ConsoleLink onClick={handleRevert}>Revert changes</ConsoleLink>
                : null
            }
            description={<TasteInput value={cuiInput} onChange={setCuiInput} />}
            priorities={
              <PriorityPanel
                criteria={criteria}
                stale={readState === 'stale'}
                staleMessage={modelChanged ? 'These priorities reflect your earlier model' : undefined}
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
                {skippedCount > 0 && <p className="text-[12px] leading-[14px]">
                  {skippedCount} {skippedCount === 1 ? "photo can't be previewed and will be skipped" : "photos can't be previewed and will be skipped"}
                </p>}
                {readError && <p role="alert" className="text-[12px] leading-[14px]">{readError}</p>}
                {manuallyMovedCount > 0 && (
                  <p className="text-[12px] font-normal text-primary leading-[14px]">
                    Re-running resets photos you moved between keeps and cuts.
                  </p>
                )}
                <div className="w-full flex items-center" style={{ gap: '16px' }}>
                <PrimaryButton
                  minWidth={157}
                  disabled={!hasInput || isBuildingCriteria || isIngesting || analysisCount === 0}
                  onClick={readState === 'current' ? () => handleRunCull() : runRead}
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
          <Canvas modelPicker={modelPicker}>
            <ThumbnailGrid
              photos={photos}
              decisions={decisions}
              evaluatingId={evaluatingId}
            />
          </Canvas>

          {/* Everything else locks: description, priorities, chips and Revert
              are all absent — there's nothing to revert into. */}
          <Console
            label={<StatusLabel prefix="Analyzing">{`${runFailure ? ' stopped at' : ''} ${progress.current} of ${progress.total}`}</StatusLabel>}
            secondary={!runFailure &&
              <p className="text-[12px] font-normal text-primary leading-[14px] whitespace-nowrap">
                {keepCount} kept · {cutCount} cut
              </p>
            }
            progress={!runFailure && <ProgressBar current={progress.current} total={progress.total} />}
            description={runFailure && <p role="alert" className="text-[12px] font-bold leading-[14px]">
              <span className="font-mono text-accent">{runFailure.model}</span> stopped responding
            </p>}
            buttons={
              <div className="w-full flex items-center" style={{ gap: '16px' }}>
                {runFailure ? <>
                  <PrimaryButton minWidth={157} onClick={() => handleRunCull(true)}>Retry from photo {runFailure.nextIndex + 1}</PrimaryButton>
                  <SecondaryButton onClick={() => switchModel(DEMO_MODEL)}>Switch to demo mode</SecondaryButton>
                  <TextLink onClick={seeFinished} disabled={results.length === 0}>See the {results.length} finished</TextLink>
                </> : <PrimaryButton minWidth={157} onClick={handleCancel}>Cancel</PrimaryButton>}
              </div>
            }
          />
        </>
      )}

      {step === 'results' && (
        <>
          {/* Results scrolls its grid independently of the fixed detail pane. */}
          <Canvas modelPicker={modelPicker}>
            <ResultsView
              results={results}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
              starredIds={starredIds}
              onMove={handleMove}
              onStar={handleStar}
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
                <PrimaryButton minWidth={157} disabled={keepCount === 0} onClick={() => setExportKind('keeps')}>Export keeps</PrimaryButton>
                <SecondaryButton disabled={starredCount === 0} onClick={() => setExportKind('starred')}>Export starred</SecondaryButton>
                <TextLink onClick={handleBackToSetTaste}>Back to set taste</TextLink>
              </div>
            }
          />
        </>
      )}
    </div>
  )
}
