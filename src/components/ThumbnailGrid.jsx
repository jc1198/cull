import { memo } from 'react'

const TILE_W = 148
const TILE_H = 110
const GUTTER = 8
const COLUMNS = 8

// Memoized and keyed by photo id, with `state` as a plain string prop. Without
// this, each streamed decision during analyzing re-renders all 116 thumbnails.
//
// state: 'idle' | 'evaluating' | 'keep' | 'cut'
//   evaluating — accent border, the scan line moving through the grid
//   cut        — dims to 40%
//   keep       — returns to full opacity
//   idle       — not yet reached, unchanged
const Thumbnail = memo(function Thumbnail({ photo, state = 'idle', onRemove }) {
  return (
    <div
      className="relative photo-thumbnail"
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
      {onRemove && (
        <button type="button" className="photo-remove" aria-label={`Remove ${photo.name}`}
          onClick={() => onRemove(photo.id)}>×</button>
      )}
      {state === 'evaluating' && (
        <div
          className="absolute inset-0 border-2 border-accent pointer-events-none"
          style={{ borderRadius: '6px' }}
        />
      )}
    </div>
  )
})

export default function ThumbnailGrid({ photos, decisions, evaluatingId, onRemove, scrollRef }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 items-start w-full" style={{ gap: '24px' }}>
      <p className="shrink-0 text-[20px] font-medium text-primary" style={{ lineHeight: '24px' }}>
        {photos.length} photo{photos.length === 1 ? '' : 's'} added
      </p>

      <div className="photo-grid-frame">
        <div ref={scrollRef} className="photo-grid-scroll" tabIndex={0} role="region" aria-label="Photo library">
          <div className="photo-grid-runway">
            <div
              className="photo-grid-tiles grid justify-start"
              style={{
                gridTemplateColumns: `repeat(${COLUMNS}, ${TILE_W}px)`,
                gap: `${GUTTER}px`,
              }}
            >
              {photos.map((photo) => (
                <Thumbnail
                  key={photo.id}
                  photo={photo}
                  onRemove={onRemove}
                  state={
                    photo.id === evaluatingId ? 'evaluating'
                    : decisions?.get(photo.id) ?? 'idle'
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
