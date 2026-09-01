import { memo, useState, useEffect } from 'react'
import { SecondaryButton } from './Button'

const TILE_W = 148
const TILE_H = 110
const GUTTER = 8
const COLUMNS = 5

function StarGlyph({ filled, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block shrink-0"
         fill={filled ? '#BAA9FF' : 'none'} stroke={filled ? '#BAA9FF' : '#FFFFFF'} strokeWidth="2"
         strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// Backing shape so the badge holds against a bright image.
function StarBadge() {
  return (
    <span
      className="absolute flex items-center justify-center rounded-full"
      style={{ top: '4px', right: '4px', width: '20px', height: '20px',
               backgroundColor: 'rgba(39,39,39,0.75)', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }}
    >
      <StarGlyph filled size={12} />
    </span>
  )
}

const GridTile = memo(function GridTile({ item, isSelected, starred, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.photo.id)}
      className="relative block"
      style={{ width: `${TILE_W}px`, height: `${TILE_H}px`, borderRadius: '6px',
               // Selection is the shared accent effect, not a separate blue.
               boxShadow: isSelected ? '0 0 4px 1px #BAA9FF' : 'none' }}
    >
      <img
        src={item.photo.thumbUrl}
        alt={item.photo.name}
        className="object-cover"
        style={{ width: `${TILE_W}px`, height: `${TILE_H}px`, borderRadius: '6px' }}
        draggable={false}
      />
      {starred && <StarBadge />}
    </button>
  )
})

function FilterTabs({ activeTab, counts, onChange }) {
  const TABS = [
    { key: 'keeps',   label: 'Keeps',   count: counts.keeps },
    { key: 'cuts',    label: 'Cuts',    count: counts.cuts },
    { key: 'starred', label: 'Starred', count: counts.starred },
  ]
  return (
    <div className="flex items-start" style={{ gap: '24px' }}>
      {TABS.map((t) => {
        const active = activeTab === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            // Starred stays reachable at zero — a user who clicks it learns the
            // feature exists.
            className={[
              'relative text-[13px] whitespace-nowrap transition-colors',
              active ? 'font-bold text-accent' : 'font-normal text-primary hover:opacity-80',
            ].join(' ')}
            style={{ paddingBottom: '4px' }}
          >
            {t.label} {t.count}
            {active && (
              <span className="absolute left-0 bottom-0 w-full bg-accent" style={{ height: '1px' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function reasonToBullets(reason) {
  return reason.split(/\.\s+/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean)
}

function useFullPreview(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return url
}

function DetailPane({ item, activeTab, starred, onMove, onStar }) {
  const previewUrl = useFullPreview(item?.photo.file)
  if (!item) return null

  const isCut = item.decision === 'cut'

  return (
    <div className="flex flex-col shrink-0" style={{ width: '484px', gap: '16px' }}>
      <img
        src={previewUrl ?? item.photo.thumbUrl}
        alt={item.photo.name}
        className="object-contain bg-black/20"
        style={{ width: '484px', height: '280px', borderRadius: '8px' }}
        draggable={false}
      />

      <div
        className="w-full bg-surface rounded-lg"
        style={{ paddingLeft: '16px', paddingRight: '24px', paddingTop: '16px', paddingBottom: '16px' }}
      >
        <div className="flex flex-col" style={{ gap: '12px' }}>
          <p className="text-[14px] font-semibold text-primary">
            {isCut ? 'Why Cull cut this' : 'Why Cull kept this'}
          </p>
          <ul className="flex flex-col" style={{ gap: '6px' }}>
            {reasonToBullets(item.reason).map((b, i) => (
              <li key={i} className="flex items-start text-[13px] text-primary" style={{ gap: '8px' }}>
                <span aria-hidden="true">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center" style={{ gap: '16px' }}>
        <SecondaryButton
          onClick={() => onMove(item.photo.id)}
          className="!text-[14px] !leading-[16px]"
        >
          {isCut ? 'Move to keeps' : 'Move to cuts'}
        </SecondaryButton>

        {/* Labelled, not icon-only. */}
        <button
          type="button"
          onClick={() => onStar(item.photo.id)}
          className={[
            'flex items-center border border-border rounded-lg text-[14px] font-normal text-primary transition-colors',
            starred ? 'bg-accent' : 'bg-transparent hover:bg-white/10',
          ].join(' ')}
          style={{ height: '34px', paddingLeft: '8px', paddingRight: '8px', gap: '4px', lineHeight: '16px' }}
        >
          <span>{starred ? 'Starred' : 'Star'}</span>
          <StarGlyph filled={starred} size={16} />
        </button>
      </div>
    </div>
  )
}

export default function ResultsView({
  results, activeTab, onTabChange, selectedId, onSelect,
  starredIds, onMove, onStar, undoItem, onUndo,
}) {
  const keeps   = results.filter((r) => r.decision === 'keep')
  const cuts    = results.filter((r) => r.decision === 'cut')
  const starred = results.filter((r) => starredIds.has(r.photo.id))

  const displayed = activeTab === 'cuts' ? cuts : activeTab === 'starred' ? starred : keeps
  const selectedItem = displayed.find((r) => r.photo.id === selectedId) ?? null

  return (
    <div className="w-full flex flex-col" style={{ marginTop: '48px', gap: '24px' }}>
      <FilterTabs
        activeTab={activeTab}
        counts={{ keeps: keeps.length, cuts: cuts.length, starred: starred.length }}
        onChange={onTabChange}
      />

      <div className="flex items-start" style={{ gap: '24px' }}>
        <div className="flex-1 min-w-0 overflow-hidden">
          {displayed.length === 0 ? (
            // Centered on the canvas column, not the full viewport width.
            <div className="flex items-center justify-center w-full" style={{ height: '280px' }}>
              <p className="text-[13px] text-primary">
                No starred photos yet. Star a photo to collect it here.
              </p>
            </div>
          ) : (
            <div
              className="grid justify-start"
              style={{ gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_W}px)`, gap: `${GUTTER}px` }}
            >
              {displayed.map((item) => (
                <GridTile
                  key={item.photo.id}
                  item={item}
                  isSelected={selectedId === item.photo.id}
                  starred={starredIds.has(item.photo.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>

        <DetailPane
          item={selectedItem}
          activeTab={activeTab}
          starred={selectedItem ? starredIds.has(selectedItem.photo.id) : false}
          onMove={onMove}
          onStar={onStar}
        />
      </div>

      {undoItem && (
        <div
          className="fixed z-20 flex items-center bg-surface rounded-lg"
          style={{ left: '80px', bottom: '175px', gap: '16px', padding: '12px 16px' }}
        >
          <span className="text-[13px] text-primary">
            Moved {undoItem.photoName} to {undoItem.to}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="text-[13px] font-bold text-accent underline hover:opacity-70 transition-opacity"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
