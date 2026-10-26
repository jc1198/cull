import { memo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { SecondaryButton } from './Button'
import { getDetailPreviewBlob } from '../lib/thumbnail'

const TILE_W = 148
const TILE_H = 110
const GUTTER = 8
const COLUMNS = 5

// White in both states, per the Review results frame — the filled star sits on
// the accent (the active toggle's fill, the grid badge's image) and the accent
// is the fill, not the glyph.
function StarGlyph({ filled, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block shrink-0"
         fill={filled ? '#FFFFFF' : 'none'} stroke="#FFFFFF" strokeWidth="2"
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
// it, keeping both markers visible together.
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

const GridTile = memo(function GridTile({ item, isSelected, starred, moved, cutLabel, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.photo.id)}
      data-photo-id={item.photo.id}
      className="relative block"
      style={{ width: `${TILE_W}px`, height: `${TILE_H}px`, borderRadius: '6px',
               // Selection is the shared accent effect, not a separate blue.
               boxShadow: isSelected ? '0 0 4px 1px #BAA9FF' : 'none' }}
    >
      <img
        loading="lazy"
        decoding="async"
        src={item.photo.thumbUrl}
        alt={item.photo.name}
        className="object-cover"
        style={{ width: `${TILE_W}px`, height: `${TILE_H}px`, borderRadius: '6px' }}
        draggable={false}
      />
      {starred && <StarBadge />}
      {moved && <MovedBadge />}
      {cutLabel && <span className="absolute bottom-1 left-1 rounded bg-canvas/80 px-1 text-[10px] text-primary">Cut</span>}
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
    <div className="flex items-start shrink-0" style={{ gap: '24px' }}>
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

function useFullPreview(photo) {
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    let disposed = false
    let url
    if (photo) {
      getDetailPreviewBlob(photo).then((blob) => {
        if (disposed) return
        url = URL.createObjectURL(blob)
        setPreview({ photo, url })
      }).catch(() => { if (!disposed) setPreview(null) })
    }
    return () => { disposed = true; if (url) URL.revokeObjectURL(url) }
  }, [photo])
  return preview && preview.photo === photo ? preview.url : null
}

function DetailPane({ item, activeTab, starred, onMove, onStar }) {
  const previewUrl = useFullPreview(item?.photo)
  const paneRef = useRef(null)
  const reasonRef = useRef(null)
  const reasonContentRef = useRef(null)
  useLayoutEffect(() => {
    const pane = paneRef.current
    const card = reasonRef.current
    const content = reasonContentRef.current
    if (!pane || !card || !content) return
    const measure = () => {
      // Measure natural content, independently of the card's scroll viewport.
      pane.style.setProperty('--reason-content-height', `${content.getBoundingClientRect().height + 32}px`)
      const title = content.firstElementChild.getBoundingClientRect().height
      pane.style.setProperty('--reason-readable-floor', `${32 + title + 6 + 36}px`)
      card.classList.toggle('is-overflowing', card.scrollHeight > card.clientHeight)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(pane)
    observer.observe(card)
    observer.observe(content)
    measure()
    return () => observer.disconnect()
  }, [item])
  if (!item) return null

  // The move action follows where the photo is now; the card title follows
  // what Cull decided, because the bullets argue for that decision. When they
  // disagree the override line above the title says so.
  const isCut = item.decision === 'cut'
  const cullCut = item.originalDecision === 'cut'
  const overridden = item.decision !== item.originalDecision

  return (
    <div ref={paneRef} className="results-detail flex flex-col shrink-0 self-stretch min-h-0 gap-4">
      <img
        src={previewUrl ?? item.photo.thumbUrl}
        alt={item.photo.name}
        className="results-detail-photo object-contain bg-black/20"
        style={{ borderRadius: '8px' }}
        draggable={false}
      />

      <div
        ref={reasonRef}
        className="results-detail-reason w-full min-h-0 overflow-y-auto bg-surface rounded-lg"
        tabIndex={0} role="region" aria-label="Cull’s reasoning"
      >
        <div ref={reasonContentRef} className="flex flex-col gap-1.5">
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
          <ul className="flex flex-col gap-1.5">
            {reasonToBullets(item.reason).map((b, i) => (
              <li key={i} className="flex items-start text-[13px] leading-[18px] text-primary" style={{ gap: '8px' }}>
                <span aria-hidden="true">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="results-detail-actions flex items-center shrink-0 gap-4">
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
            starred ? 'bg-accent text-primary' : 'bg-transparent text-primary hover:bg-white/10',
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
  starredIds, onMove, onStar,
}) {
  const keeps   = results.filter((r) => r.decision === 'keep')
  const cuts    = results.filter((r) => r.decision === 'cut')
  const starred = results.filter((r) => starredIds.has(r.photo.id))

  const displayed = activeTab === 'cuts' ? cuts : activeTab === 'starred' ? starred : keeps
  const selectedItem = displayed.find((r) => r.photo.id === selectedId) ?? null

  const scrollRef = useRef(null)
  const runwayRef = useRef(null)
  const previous = useRef(null)
  const scrollTop = useRef(0)
  const manualUntil = useRef(0)

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const row = scroll.closest('.results-row')
    // Native scrollbar styling stays shared with Taste. Measure the stable
    // gutter instead of assuming an OS-specific width. Overlay bars reserve
    // one tile gutter explicitly so they cannot overlap the thumbnails.
    function measureScrollbar() {
      const width = scroll.offsetWidth - scroll.clientWidth
      row.style.setProperty('--results-scrollbar-width', `${width || GUTTER}px`)
      row.style.setProperty('--results-overlay-reserve', `${width ? 0 : GUTTER}px`)
    }
    measureScrollbar()
    const observer = new ResizeObserver(measureScrollbar)
    observer.observe(scroll)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const scroll = scrollRef.current
    const before = previous.current
    const ids = displayed.map((item) => item.photo.id)
    previous.current = { tab: activeTab, selectedId, ids }
    if (!before || before.tab !== activeTab) {
      runwayRef.current.style.minHeight = ''
      scroll.scrollTop = 0
      scrollTop.current = 0
      return
    }
    // Retain trailing space when a move removes the last row. Browser scroll
    // anchoring is disabled by the shared library CSS; undo keeps this offset too.
    if (before.ids.length !== ids.length) {
      runwayRef.current.style.minHeight = `${scrollTop.current + scroll.clientHeight - parseFloat(getComputedStyle(scroll).paddingTop)}px`
      scroll.scrollTop = scrollTop.current
    }
    // Only a departing selection warrants revealing its replacement. Tile clicks
    // and undo (which adds a photo) never trigger a programmatic scroll.
    if (!before.selectedId || before.selectedId === selectedId || ids.includes(before.selectedId) ||
        !selectedId || performance.now() < manualUntil.current) return
    const tile = [...scroll.querySelectorAll('[data-photo-id]')]
      .find((node) => node.dataset.photoId === String(selectedId))
    if (!tile) return
    const viewport = scroll.getBoundingClientRect()
    const bounds = tile.getBoundingClientRect()
    if (bounds.top < viewport.top + 6 || bounds.bottom > viewport.bottom - 6) {
      tile.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    }
  })

  function markManualScroll() {
    manualUntil.current = performance.now() + 250
  }

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 gap-6 pb-6">
      <FilterTabs
        activeTab={activeTab}
        counts={{ keeps: keeps.length, cuts: cuts.length, starred: starred.length }}
        onChange={onTabChange}
      />

      <div className="results-row flex items-start flex-1 min-h-0" style={{
        '--results-grid-width': `${COLUMNS * TILE_W + (COLUMNS - 1) * GUTTER}px`,
        '--results-row-space': '24px',
        '--results-tile-gutter': `${GUTTER}px`,
        '--results-edge-padding': '6px',
      }}>
        <div className="photo-grid-frame results-grid-frame">
          <div ref={scrollRef} className="photo-grid-scroll results-grid-scroll"
            tabIndex={0} role="region" aria-label={`${activeTab} photos`}
            onWheel={markManualScroll} onTouchMove={markManualScroll}
            onPointerDown={markManualScroll} onKeyDown={markManualScroll}
            onScroll={() => {
              scrollTop.current = scrollRef.current.scrollTop
              // Include momentum and scrollbar dragging in the manual-scroll guard.
              if (performance.now() < manualUntil.current) markManualScroll()
            }}>
          <div ref={runwayRef}>
          {displayed.length === 0 ? (
            // Centered on the canvas column, not the full viewport width.
            <div className="flex items-center justify-center" style={{ width: '772px', height: '280px' }}>
              <p className="text-[13px] text-primary">
                {activeTab === 'keeps' ? 'No keeps yet.' : activeTab === 'cuts' ? 'No cuts yet.' : 'No starred photos yet. Star a photo to collect it here.'}
              </p>
            </div>
          ) : (
            <div
              className="grid justify-start"
              style={{ width: '772px', gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_W}px)`, gap: `${GUTTER}px` }}
            >
              {displayed.map((item) => (
                <GridTile
                  key={item.photo.id}
                  item={item}
                  isSelected={selectedId === item.photo.id}
                  starred={starredIds.has(item.photo.id)}
                  moved={item.decision !== item.originalDecision}
                  cutLabel={activeTab === 'starred' && item.decision === 'cut'}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
          </div>
          </div>
        </div>

        <DetailPane
          item={selectedItem}
          activeTab={activeTab}
          starred={selectedItem ? starredIds.has(selectedItem.photo.id) : false}
          onMove={onMove}
          onStar={onStar}
        />
      </div>


    </div>
  )
}
