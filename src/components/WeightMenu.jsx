import { useEffect, useRef } from 'react'

// Weight tokens are all-caps; Remove is sentence case. The divider plus the
// casing keep it from reading as a fourth weight.
const WEIGHTS = [
  { value: 'high',   label: 'HIGH' },
  { value: 'medium', label: 'MED'  },
  { value: 'low',    label: 'LOW'  },
]

function Row({ label, active, hug, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center justify-center rounded-lg bg-white text-[10px] font-medium',
        'hover:bg-black/5 transition-colors',
        active ? 'text-accentLight' : 'text-black',
      ].join(' ')}
      style={{ height: '20px', width: hug ? undefined : '32px', padding: '4px' }}
    >
      {label}
    </button>
  )
}

/**
 * Opens from the weight badge. The menu is a light surface, so the active row
 * uses the on-light accent (#2100B2), not the on-dark one.
 *
 * `direction` is decided by the caller from available room.
 */
export default function WeightMenu({ weight, direction = 'down', onSelect, onRemove, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function onDocDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 z-30 flex flex-col items-center justify-center bg-white rounded-lg"
      style={{
        [direction === 'up' ? 'bottom' : 'top']: 0,
        padding: '4px',
        gap: '6px',
        filter: 'drop-shadow(0 0 5px #BAA9FF)',
      }}
    >
      {WEIGHTS.map((w) => (
        <Row
          key={w.value}
          label={w.label}
          active={weight === w.value}
          onClick={() => onSelect(w.value)}
        />
      ))}
      <div className="w-full bg-black/20" style={{ height: '1px' }} />
      <Row label="Remove" hug onClick={onRemove} />
    </div>
  )
}
