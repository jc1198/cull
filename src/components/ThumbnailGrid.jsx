import { memo } from 'react'

const TILE_W = 148
const TILE_H = 110
const GUTTER = 8
const COLUMNS = 8
const VISIBLE = 23 // 23 thumbnails + the "+N more" tile fills three rows of 8

// Memoized and keyed by photo id, with `state` as a plain string prop. Without
// this, each streamed decision during analyzing re-renders all 116 thumbnails.
//
// state: 'idle' | 'evaluating' | 'keep' | 'cut'
//   evaluating — accent border, the scan line moving through the grid
//   cut        — dims to 40%
//   keep       — returns to full opacity
//   idle       — not yet reached, unchanged
const Thumbnail = memo(function Thumbnail({ photo, state = 'idle' }) {
  return (
    <div
      className="relative"
      style={{ width: `${TILE_W}px`, height: `${TILE_H}px` }}
    >
      <img
        src={photo.thumbUrl}
        alt={photo.name}
        className="object-cover transition-opacity duration-200"
        style={{
          width: `${TILE_W}px`,
          height: `${TILE_H}px`,
          borderRadius: '6px',
          opacity: state === 'cut' ? 0.4 : 1,
        }}
        draggable={false}
      />
      {state === 'evaluating' && (
        <div
          className="absolute inset-0 border-2 border-accent pointer-events-none"
          style={{ borderRadius: '6px' }}
        />
      )}
    </div>
  )
})

// Outlined, filled with the canvas color so it reads as a hole in the grid
// rather than as another photo.
function MoreTile({ count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center bg-canvas border border-border text-primary text-[20px] font-bold leading-none"
      style={{ width: `${TILE_W}px`, height: `${TILE_H}px`, borderRadius: '6px' }}
    >
      +{count} more
    </button>
  )
}

export default function ThumbnailGrid({ photos, onExpand, decisions, evaluatingId }) {
  // Only hold back photos when doing so actually saves a row's worth of space —
  // "+1 more" next to 23 tiles is noise.
  const truncated = photos.length > VISIBLE + 1
  const shown = truncated ? photos.slice(0, VISIBLE) : photos

  return (
    <div className="flex flex-col items-start" style={{ gap: '24px' }}>
      <p className="text-[20px] font-medium text-primary" style={{ lineHeight: '24px' }}>
        {photos.length} photo{photos.length === 1 ? '' : 's'} added
      </p>

      <div
        className="grid justify-start"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_W}px)`,
          gap: `${GUTTER}px`,
        }}
      >
        {shown.map((photo) => (
          <Thumbnail
            key={photo.id}
            photo={photo}
            state={
              photo.id === evaluatingId ? 'evaluating'
              : decisions?.get(photo.id) ?? 'idle'
            }
          />
        ))}
        {truncated && (
          // TODO: opens the expanded canvas view — a scrolling grid of the full
          // batch that stays expanded across steps. Not yet specified; inert.
          <MoreTile count={photos.length - VISIBLE} onClick={onExpand} />
        )}
      </div>
    </div>
  )
}
