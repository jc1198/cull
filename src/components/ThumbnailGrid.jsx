export default function ThumbnailGrid({ photos }) {
  return (
    <div className="w-full">
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(6, 120px)', gap: '12px' }}
      >
        {photos.map((photo) => (
          <img
            key={photo.id}
            src={photo.url}
            alt={photo.name}
            className="rounded object-cover"
            style={{ width: '120px', height: '90px' }}
            draggable={false}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} ready to review
      </p>
    </div>
  )
}
