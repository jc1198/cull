import { memo, useState, useEffect } from 'react'
import { SecondaryButton } from './Button'

const TILE_W = 148
const TILE_H = 110
const GUTTER = 8
const COLUMNS = 5

// `color` is the glyph's own color when filled. On the canvas it's the accent;
// on the accent fill of the active toggle it flips to the canvas color, the same
// inversion the primary button uses — white on #BAA9FF is ~1.9:1.
function StarGlyph({ filled, size = 16, color = '#BAA9FF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block shrink-0"
         fill={filled ? color : 'none'} stroke={filled ? color : '#FFFFFF'} strokeWidth="2"
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

// The manual-override marker. Deliberately not the star's language — no accent
// fill, no glyph — because a photo can be starred and moved at once and the two
// must stay tellable apart. Top-left — across from the star rather than below
// it, so the marker survives the row the canvas clips at the console edge.
function MovedBadge() {
  return (
    <span
      className="absolute text-[9px] font-semibold text-primary rounded"
      style={{ top: '4px', left: '4px', padding: '1px 4px', lineHeight: '12px',
               backgroundColor: 'rgba(39,39,39,0.75)', boxShadow: '0 0 3px rgba(0,0,0,0.5)' }}
    >
      Moved
    </span>
  )
}

const GridTile = memo(function GridTile({ item, isSelected, starred, moved, onSelect }) {
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
      {moved && <MovedBadge />}
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

// Clearance between the actions and the console's top border. Matches the
// console's own 32px top padding, so the boundary breathes symmetrically.
const ACTIONS_CLEARANCE = 32

// The reasoning card's floor: four single-line bullets.
// 16 top + 18 title + 12 gap + (4 x 18 bullets + 3 x 6 gaps) + 16 bottom.
// It no longer keeps the pane from shifting — the pinned actions do that — but
// the card is the pane's only shrinkable item, so without a floor a short canvas
// collapses it to its own padding before anything else gives.
const REASON_CARD_MIN_H = 152

function DetailPane({ item, activeTab, starred, onMove, onStar }) {
  const previewUrl = useFullPreview(item?.photo.file)
  if (!item) return null

  // The move action follows where the photo is now; the card title follows
  // what Cull decided, because the bullets argue for that decision. When they
  // disagree the override line above the title says so.
  const isCut = item.decision === 'cut'
  const cullCut = item.originalDecision === 'cut'
  const overridden = item.decision !== item.originalDecision

  return (
    // Stretched to the canvas floor rather than sized by its content, so the
    // actions hold one position and the gap above the console stops varying
    // with the rationale's length. Top edge still aligns with the grid.
    <div
      className="flex flex-col shrink-0 self-stretch"
      style={{ width: '484px', gap: '16px', paddingBottom: `${ACTIONS_CLEARANCE}px` }}
    >
      {/* Everything above the actions lives in one bounded region. Free space
          collects at its bottom, so a shorter rationale leaves a gap between the
          card and the actions instead of moving them. */}
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ gap: '16px' }}>
        <img
          src={previewUrl ?? item.photo.thumbUrl}
          alt={item.photo.name}
          className="object-contain bg-black/20 shrink-0"
          style={{ width: '484px', height: '280px', borderRadius: '8px' }}
          draggable={false}
        />

        {/* Natural height, growing into the space below it. Two levels of give,
            in order: a long rationale shrinks the card and scrolls inside it,
            leaving the photo put; a canvas too short even for the photo scrolls
            the whole region. Either way the actions hold their position. */}
        <div
          className="w-full min-h-0 overflow-y-auto bg-surface rounded-lg"
          style={{ paddingLeft: '16px', paddingRight: '24px', paddingTop: '16px', paddingBottom: '16px',
                   minHeight: `${REASON_CARD_MIN_H}px` }}
        >
          <div className="flex flex-col" style={{ gap: '12px' }}>
            <div className="flex flex-col" style={{ gap: '4px' }}>
              {overridden && (
                <p className="text-[12px] font-semibold text-accent leading-[14px]">
                  You moved this photo to {isCut ? 'cuts' : 'keeps'}
                </p>
              )}
              <p className="text-[14px] font-semibold text-primary leading-[18px]">
                {cullCut ? 'Why Cull cut this' : 'Why Cull kept this'}
              </p>
            </div>
            <ul className="flex flex-col" style={{ gap: '6px' }}>
              {reasonToBullets(item.reason).map((b, i) => (
                <li key={i} className="flex items-start text-[13px] leading-[18px] text-primary" style={{ gap: '8px' }}>
                  <span aria-hidden="true">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center shrink-0" style={{ gap: '16px' }}>
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
            'flex items-center border border-border rounded-lg text-[14px] font-normal transition-colors',
            starred ? 'bg-accent text-canvas' : 'bg-transparent text-primary hover:bg-white/10',
          ].join(' ')}
          style={{ height: '34px', paddingLeft: '8px', paddingRight: '8px', gap: '4px', lineHeight: '16px' }}
        >
          <span>{starred ? 'Starred' : 'Star'}</span>
          <StarGlyph filled={starred} size={16} color="#272727" />
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
    <div className="w-full flex flex-col flex-1 min-h-0" style={{ marginTop: '48px', gap: '24px' }}>
      <FilterTabs
        activeTab={activeTab}
        counts={{ keeps: keeps.length, cuts: cuts.length, starred: starred.length }}
        onChange={onTabChange}
      />

      {/* items-start keeps the grid content-sized — it clips at the canvas edge
          mid-thumbnail. The pane opts into the full height instead. */}
      <div className="flex items-start flex-1 min-h-0" style={{ gap: '24px' }}>
        {/* The selection glow (spread 1, radius 4) reaches ~5px past the tile,
            so the clipping box is pushed 6px out and pulled back by an equal
            negative margin — the grid stays aligned to the 1280 column and the
            glow no longer clips on the outer tiles. The clip itself stays here:
            below 1440 the grid must still clip rather than push the pane off. */}
        <div className="flex-1 min-w-0 overflow-hidden" style={{ padding: '6px', margin: '-6px' }}>
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
                  moved={item.decision !== item.originalDecision}
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
