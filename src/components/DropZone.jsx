import { useState, useRef } from 'react'

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

export default function DropZone({ onFiles }) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    if (onFiles) onFiles(e.dataTransfer.files)
  }

  function handleChange(e) {
    if (onFiles) onFiles(e.target.files)
  }

  return (
    <div
      className={[
        'w-full flex flex-col items-center justify-center gap-3 rounded-lg cursor-pointer transition-colors',
        isDragging ? 'opacity-80' : 'opacity-100',
      ].join(' ')}
      style={{
        height: '55vh',
        backgroundColor: '#A1A1A1',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.raw,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf"
        className="hidden"
        onChange={handleChange}
      />

      <UploadIcon />

      <p className="text-base font-medium text-white">Add or Drop files here</p>
      <p className="text-sm text-white/70 tracking-widest uppercase">JPG · PNG · RAW</p>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          fileInputRef.current?.click()
        }}
        className="mt-2 px-5 py-2 text-sm font-medium text-white border border-white/50 rounded-md bg-transparent hover:bg-white/10 active:bg-white/20 transition-colors"
      >
        Browse files
      </button>
    </div>
  )
}
