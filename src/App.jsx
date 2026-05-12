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
import { extractIntentSignals } from './lib/extractIntents'
import { cullPhoto } from './lib/cullPhoto'

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
  const [intentSignals, setIntentSignals] = useState([])
  const [isExtracting, setIsExtracting]   = useState(false)

  // Processing
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })
  const [results, setResults]   = useState([])

  // Results
  const [selectedId, setSelectedId] = useState(null)
  const [showCuts, setShowCuts]     = useState(false)
  const [undoItem, setUndoItem]     = useState(null)  // { photoId, photoName, timeoutId }

  useEffect(() => {
    return () => { photos.forEach((p) => URL.revokeObjectURL(p.url)) }
  }, [photos])

  // Debounced intent extraction in tasting step
  useEffect(() => {
    if (step !== 'tasting') return
    if (!cuiInput.trim()) { setIntentSignals([]); return }

    const timer = setTimeout(async () => {
      setIsExtracting(true)
      try {
        const signals = await extractIntentSignals(cuiInput)
        setIntentSignals(signals)
      } catch (err) {
        console.error('Intent extraction failed:', err)
      } finally {
        setIsExtracting(false)
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [cuiInput, step])

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
    setIntentSignals([])
    setStep('tasting')
  }

  async function handleRunCull() {
    setStep('processing')
    setResults([])
    setShowCuts(false)
    setProgress({ current: 0, total: photos.length, label: 'Starting…' })

    const tasteProfile = cuiInput.trim() || selectedChips.join(', ') || 'Best overall quality'
    const accumulated = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      setProgress({ current: i + 1, total: photos.length, label: `Analyzing ${photo.name}…` })

      try {
        const result = await cullPhoto(photo, i, tasteProfile)
        accumulated.push({ photo, decision: result.decision, reason: result.reason, starred: false })
      } catch (err) {
        console.error(`Failed on ${photo.name}:`, err)
        accumulated.push({ photo, decision: 'keep', reason: 'Could not analyze — kept by default.', starred: false })
      }

      setResults([...accumulated])

      // Free tier: 5 req/min — wait between photos except after the last one
      if (i < photos.length - 1) {
        setProgress({ current: i + 1, total: photos.length, label: `Waiting to avoid rate limit…` })
        await new Promise((r) => setTimeout(r, 15000))
      }
    }

    const firstKeep = accumulated.find((r) => r.decision === 'keep')
    setSelectedId(firstKeep?.photo.id ?? null)
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
    step === 'upload'     ? UPLOAD_CHIPS  :
    step === 'loaded'     ? LOADED_CHIPS  :
    step === 'tasting'    ? TASTING_CHIPS :
    ['Export selects', showCuts ? 'Show keeps instead' : 'Show cuts instead', 'Re-rank by sharpness', 'Starred only']
  )
  const runCullDisabled = cuiInput.trim() === '' && selectedChips.length === 0
  const isUpload = step === 'upload'
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

            {step === 'upload' && <DropZone onFiles={handleFiles} />}

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
                intentSignals={intentSignals}
                isExtracting={isExtracting}
                onRunCull={handleRunCull}
                runCullDisabled={runCullDisabled}
              />
            )}

            {step === 'processing' && (
              <ProcessingView progress={progress} results={results} />
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
