function UploadGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="#FFFFFF" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

/**
 * 1280 x 459 drop target on the canvas. The Browse files button lives in the
 * console, not here — both open the same picker, which App owns.
 */
export default function DropZone({ onFiles, onBrowse }) {
  function handleDragOver(e) { e.preventDefault() }

  function handleDrop(e) {
    e.preventDefault()
    if (onFiles) onFiles(e.dataTransfer.files)
  }

  return (
    <div
      className="w-full flex flex-col items-center justify-center cursor-pointer"
      style={{
        height: '459px',
        borderRadius: '12px',
        backgroundColor: 'rgba(209, 209, 209, 0.2)',
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={onBrowse}
    >
      <div
        className="flex items-center justify-center"
        style={{ width: '56px', height: '56px', borderRadius: '8px', backgroundColor: '#BAA9FF' }}
      >
        <UploadGlyph />
      </div>

      <p className="text-[16px] font-normal text-primary text-center" style={{ marginTop: '24px' }}>
        Add or Drop files here
      </p>
      <p className="text-[13px] font-normal text-primary text-center" style={{ marginTop: '23px' }}>
        JPG · PNG · RAW
      </p>
    </div>
  )
}
