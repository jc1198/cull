import { useState, useEffect } from 'react'
import Nav from './components/Nav'
import DropZone from './components/DropZone'
import ThumbnailGrid from './components/ThumbnailGrid'
import TasteBanner from './components/TasteBanner'
import TastingScreen from './components/TastingScreen'
import ProcessingView from './components/ProcessingView'
import ResultsView from './components/ResultsView'
import CUIBar from './components/CUIBar'
import ChipRow from './components/ChipRow'
import { buildCullCriteria, evaluatePhoto, fileToBase64 } from './lib/ollama'

const UPLOAD_CHIPS  = ['Landscape', 'Street photo', 'Portrait', 'Events', 'Architecture']
const LOADED_CHIPS  = ['Moody / dramatic', 'Clean & bright', 'Candid / natural', 'Minimalist']
const TASTING_CHIPS = ['No closed eyes', 'Best of duplicates', 'Sharpest frame only', 'Faces in focus']

export default function App() {
  const [step, setStep] = useState('upload')
  // steps: 'upload' | 'loaded' | 'tasting' | 'processing' | 'results'
  const [cuiInput, setCuiInput]           = useState('')
  const [selectedChips, setSelectedChips] = useState([])
  const [photos, setPhotos]               = useState([])

  // Tasting
  const [criteria, setCriteria]               = useState([])
  const [isBuildingCriteria, setIsBuilding]   = useState(false)

  // Processing
  const [processingStage, setProcessingStage] = useState(null) // 'compressing' | 'evaluating'
  const [cullCriteria, setCullCriteria]       = useState([])
  const [progress, setProgress]               = useState({ current: 0, total: 0, label: '' })
  const [results, setResults]                 = useState([])

  // Results
  const [selectedId, setSelectedId] = useState(null)
  const [showCuts, setShowCuts]     = useState(false)
  const [undoItem, setUndoItem]     = useState(null)

  // Ollama connection
  const [ollamaStatus, setOllamaStatus] = useState({ connected: false, models: [] })

  // Check Ollama on mount
  useEffect(() => {
    fetch('http://localhost:3001/health')
      .then((r) => r.json())
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ connected: false, models: [] }))
  }, [])

  useEffect(() => {
    return () => { photos.forEach((p) => URL.revokeObjectURL(p.url)) }
  }, [photos])


  // ── Handlers ────────────────────────────────────────────────

  function handleFiles(fileList) {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || /\.(raw|cr2|cr3|nef|arw|dng|raf|orf)$/i.test(f.name)
    )
    if (files.length === 0) return
    const photoObjects = files.map((file) => {
      const url = URL.createObjectURL(file)
      return { id: url, url, name: file.name, size: file.size, type: file.type, file }
    })
    setPhotos(photoObjects)
    setSelectedChips([])
    setCuiInput('')
    setStep('loaded')
  }

  function handleContinue() {
    setCriteria([])
    setStep('tasting')
  }

  async function handleRunCull() {
    setStep('processing')
    setResults([])
    setShowCuts(false)
    setCullCriteria([])

    const freeText       = cuiInput.trim()
    const chipConstraints = selectedChips.join(', ')
    const tasteProfile   = [freeText, chipConstraints].filter(Boolean).join(', ') || 'Best overall quality'

    // Stage 1: compress taste profile into structured criteria
    setProcessingStage('compressing')
    setProgress({ current: 0, total: photos.length, label: 'Reading your taste profile…' })

    const builtCriteria = await buildCullCriteria(tasteProfile)
    setCullCriteria(builtCriteria)

    // Stage 2: evaluate each photo
    setProcessingStage('evaluating')
    const accumulated = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      setProgress({ current: i + 1, total: photos.length, label: `Evaluating photo ${i + 1} of ${photos.length}…` })

      try {
        console.log('[evaluatePhoto] image size:', photo.file.size, 'bytes')
        const base64 = await fileToBase64(photo.file)
        const result  = await evaluatePhoto(base64, builtCriteria)
        accumulated.push({ photo, decision: result.decision, reason: result.reason, starred: false })
      } catch (err) {
        console.error(`Failed on ${photo.name}:`, err)
        accumulated.push({ photo, decision: 'keep', reason: 'Could not analyze — kept by default.', starred: false })
      }

      setResults([...accumulated])
    }

    const firstKeep = accumulated.find((r) => r.decision === 'keep')
    setSelectedId(firstKeep?.photo.id ?? null)
    setProcessingStage(null)
    setStep('results')
  }

  function handleMoveToCuts(photoId) {
    const remaining = results.filter((r) => r.photo.id !== photoId && r.decision === 'keep')
    setResults((prev) => prev.map((r) => r.photo.id === photoId ? { ...r, decision: 'cut' } : r))

    if (selectedId === photoId) setSelectedId(remaining[0]?.photo.id ?? null)

    const movedPhoto = results.find((r) => r.photo.id === photoId)
    if (undoItem?.timeoutId) clearTimeout(undoItem.timeoutId)
    const timeoutId = setTimeout(() => setUndoItem(null), 5000)
    setUndoItem({ photoId, photoName: movedPhoto?.photo.name ?? '', timeoutId })
  }

  function handleMoveToKeeps(photoId) {
    setResults((prev) => prev.map((r) => r.photo.id === photoId ? { ...r, decision: 'keep' } : r))
    setSelectedId(photoId)
  }

  function handleUndo() {
    if (!undoItem) return
    clearTimeout(undoItem.timeoutId)
    setResults((prev) => prev.map((r) => r.photo.id === undoItem.photoId ? { ...r, decision: 'keep' } : r))
    setSelectedId(undoItem.photoId)
    setUndoItem(null)
  }

  function handleStar(photoId) {
    setResults((prev) => prev.map((r) => r.photo.id === photoId ? { ...r, starred: !r.starred } : r))
  }

  function handleChipSelect(chip) {
    if (step === 'results') {
      if (chip === 'Show cuts instead' || chip === 'Show keeps instead') {
        setShowCuts((prev) => !prev)
        setSelectedId(null)
      } else {
        setCuiInput(chip)
      }
      return
    }
    if (step === 'tasting') {
      setCuiInput((prev) => { const b = prev.trim(); return b ? `${b}, ${chip}` : chip })
      setSelectedChips((prev) => [...prev.filter((c) => c !== chip), chip])
      return
    }
    setCuiInput(chip)
    setSelectedChips([chip])
  }

  // ── Derived ─────────────────────────────────────────────────

  const chips = (
    step === 'upload'  ? UPLOAD_CHIPS  :
    step === 'loaded'  ? LOADED_CHIPS  :
    step === 'tasting' ? TASTING_CHIPS :
    ['Export selects', showCuts ? 'Show keeps instead' : 'Show cuts instead', 'Re-rank by sharpness', 'Starred only']
  )
  const runCullDisabled = cuiInput.trim() === '' && selectedChips.length === 0
  const isUpload    = step === 'upload'
  const showSidebar = step === 'results'

  return (
    <div className="flex flex-col min-h-full bg-white font-sans">
      <Nav />

      <main
        className={[
          'flex flex-col flex-1 px-20 pb-10',
          isUpload ? 'justify-center items-center' : 'items-start',
        ].join(' ')}
        style={{ paddingTop: '24px' }}
      >
        {showSidebar ? (
          <ResultsView
            results={results}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showCuts={showCuts}
            onMoveToCuts={handleMoveToCuts}
            onMoveToKeeps={handleMoveToKeeps}
            onStar={handleStar}
            undoItem={undoItem}
            onUndo={handleUndo}
            cuiInput={cuiInput}
            onCuiChange={setCuiInput}
            chips={chips}
            onChipSelect={handleChipSelect}
          />
        ) : (
          <div className="w-full flex flex-col" style={{ gap: '30px' }}>

            {step === 'upload' && (
              <>
                {!ollamaStatus.connected && (
                  <div className="w-full px-4 py-3 text-sm text-primary border border-border rounded-md bg-gray-50">
                    ⚠ Ollama isn't running. Start Ollama and run{' '}
                    <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">npm run dev</code>
                    {' '}to use Cull.
                  </div>
                )}
                <DropZone onFiles={handleFiles} />
              </>
            )}

            {step === 'loaded' && (
              <>
                <ThumbnailGrid photos={photos} />
                <TasteBanner onContinue={handleContinue} />
              </>
            )}

            {step === 'tasting' && (
              <TastingScreen
                value={cuiInput}
                onChange={setCuiInput}
                criteria={criteria}
                isBuildingCriteria={isBuildingCriteria}
                onRunCull={handleRunCull}
                runCullDisabled={runCullDisabled}
              />
            )}

            {step === 'processing' && (
              <ProcessingView
                processingStage={processingStage}
                progress={progress}
                results={results}
                cullCriteria={cullCriteria}
              />
            )}

            {(step === 'upload' || step === 'loaded') && (
              <CUIBar
                value={cuiInput}
                onChange={setCuiInput}
                placeholder="What kind of shoot is this?  (optional)"
              />
            )}

            {step !== 'processing' && (
              <div className="flex flex-col items-start" style={{ gap: '20px' }}>
                <ChipRow chips={chips} onSelect={handleChipSelect} />
                {isUpload && (
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-muted">Up to 200 photos per batch</span>
                    <span className="text-xs text-muted">No account required to start</span>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}
