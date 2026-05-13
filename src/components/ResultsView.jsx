import CUIBar from './CUIBar'
import ChipRow from './ChipRow'

function reasonToBullets(reason) {
  return reason
    .split(/\.\s+/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean)
}

function GridItem({ item, isSelected, showCuts, onSelect, onMoveToCuts, onMoveToKeeps, onStar }) {
  return (
    <div
      className="flex flex-col cursor-pointer"
      style={{ gap: '4px' }}
      onClick={() => onSelect(item.photo.id)}
    >
      <div className={['relative rounded overflow-hidden', isSelected ? 'ring-2 ring-primary' : ''].join(' ')}>
        <img
          src={item.photo.url}
          alt={item.photo.name}
          className="w-full object-cover"
          style={{ height: '105px' }}
          draggable={false}
        />
        {item.starred && (
          <span className="absolute top-1 left-1 text-sm leading-none" style={{ color: '#facc15' }}>★</span>
        )}
      </div>
      <p
        className="text-xs text-muted leading-relaxed"
        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {item.reason}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); showCuts ? onMoveToKeeps(item.photo.id) : onMoveToCuts(item.photo.id) }}
          className="text-xs text-muted hover:text-primary transition-colors"
        >
          {showCuts ? 'Move to keeps' : 'Move to cuts'}
        </button>
        <span className="text-muted" style={{ fontSize: '10px' }}>·</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStar(item.photo.id) }}
          className="text-sm transition-colors"
          style={{ color: item.starred ? '#facc15' : undefined }}
        >
          <span className={item.starred ? '' : 'text-muted hover:text-yellow-400'}>★</span>
        </button>
      </div>
    </div>
  )
}

function DetailPanel({ item, showCuts, onMoveToCuts, onStar }) {
  if (!item) {
    return (
      <div className="flex items-center justify-center" style={{ height: '200px' }}>
        <p className="text-sm text-muted">Select a photo to see details</p>
      </div>
    )
  }

  const bullets = reasonToBullets(item.reason)
  const manuallyMoved = item.originalDecision && item.decision !== item.originalDecision

  return (
    <div className="flex flex-col" style={{ gap: '16px' }}>
      <img
        src={item.photo.url}
        alt={item.photo.name}
        className="w-full rounded object-cover"
        style={{ aspectRatio: '4 / 3' }}
        draggable={false}
      />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Cull's Analysis</p>
          {manuallyMoved && (
            <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
              Manually moved
            </span>
          )}
        </div>
        <ul className="flex flex-col" style={{ gap: '6px' }}>
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-primary">
              <span className="text-muted shrink-0 mt-0.5">•</span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted truncate">{item.photo.name}</p>
      {!showCuts && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onMoveToCuts(item.photo.id)}
            className="flex-1 py-2 text-xs font-medium text-primary border border-border rounded-md hover:bg-gray-50 transition-colors"
          >
            Move to cuts
          </button>
          <button
            type="button"
            onClick={() => onStar(item.photo.id)}
            className="px-3 py-2 text-sm border border-border rounded-md transition-colors hover:bg-gray-50"
            style={{ color: item.starred ? '#facc15' : undefined }}
          >
            ★
          </button>
        </div>
      )}
    </div>
  )
}

export default function ResultsView({
  results,
  selectedId,
  onSelect,
  showCuts,
  onMoveToCuts,
  onMoveToKeeps,
  onStar,
  undoItem,
  onUndo,
  cuiInput,
  onCuiChange,
  chips,
  onChipSelect,
}) {
  const displayed = results.filter((r) => r.decision === (showCuts ? 'cut' : 'keep'))
  const selectedItem = results.find((r) => r.photo.id === selectedId) ?? null
  const keepCount = results.filter((r) => r.decision === 'keep').length
  const cutCount  = results.filter((r) => r.decision === 'cut').length

  return (
    <div className="w-full flex flex-col" style={{ gap: '20px' }}>
      {/* Summary */}
      <p className="text-sm text-muted">
        <span className="font-medium text-primary">{keepCount}</span> kept
        {' · '}
        <span className="font-medium text-primary">{cutCount}</span> cut
      </p>

      {/* Undo banner */}
      {undoItem && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border border-border rounded-md">
          <span className="text-sm text-muted">
            Moved <span className="text-primary font-medium">{undoItem.photoName}</span> to cuts
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="text-sm font-medium hover:opacity-70 transition-opacity"
            style={{ color: '#D85A30' }}
          >
            Undo
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="w-full flex" style={{ gap: '24px', alignItems: 'flex-start' }}>
        {/* Left: scrollable grid */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '62vh' }}>
          {displayed.length === 0 ? (
            <p className="text-sm text-muted py-8">
              {showCuts ? 'No photos were cut.' : 'All photos were cut.'}
            </p>
          ) : (
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}
            >
              {displayed.map((item) => (
                <GridItem
                  key={item.photo.id}
                  item={item}
                  isSelected={selectedId === item.photo.id}
                  showCuts={showCuts}
                  onSelect={onSelect}
                  onMoveToCuts={onMoveToCuts}
                  onMoveToKeeps={onMoveToKeeps}
                  onStar={onStar}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: sticky detail panel */}
        <div className="shrink-0 sticky" style={{ width: '280px', top: '24px' }}>
          <DetailPanel
            item={selectedItem}
            showCuts={showCuts}
            onMoveToCuts={onMoveToCuts}
            onStar={onStar}
          />
        </div>
      </div>

      {/* CUI bar */}
      <CUIBar
        value={cuiInput}
        onChange={onCuiChange}
        placeholder="e.g. Re-rank — I prefer the ones…"
      />

      {/* Chips */}
      <ChipRow chips={chips} onSelect={onChipSelect} />
    </div>
  )
}
