import { useState, useRef } from 'react'
import WeightMenu from './WeightMenu'

const WEIGHT_LABEL = { high: 'HIGH', medium: 'MED', low: 'LOW' }

/**
 * Label and description are NOT editable — deliberately. The model writes
 * descriptions in vocabulary it can ground in pixels; a user rewording one
 * produces a criterion the vision pass can't evaluate, and every result
 * degrades with nothing on screen explaining why. Weight and remove cover the
 * observed failure. Prose stays in the input.
 */
export default function PriorityCard({ criterion, onWeightChange, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [direction, setDirection] = useState('down')
  const pillRef = useRef(null)

  const MENU_HEIGHT = 112

  function toggleMenu() {
    if (!menuOpen && pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect()
      // Open upward when there isn't room below.
      setDirection(rect.top + MENU_HEIGHT > window.innerHeight ? 'up' : 'down')
    }
    setMenuOpen((open) => !open)
  }

  return (
    <div
      className="flex flex-col bg-surface rounded-lg"
      style={{ flex: '1 1 0', minWidth: 0, height: '64px', padding: '12px', gap: '8px' }}
    >
      <div className="flex items-center justify-between w-full" style={{ height: '20px' }}>
        <p className="text-[12px] font-medium text-accent truncate">{criterion.signal}</p>

        <div className="relative shrink-0" ref={pillRef}>
          <button
            type="button"
            onClick={toggleMenu}
            className="flex items-center justify-center bg-white rounded-lg text-[10px] font-medium text-black hover:opacity-90 transition-opacity"
            style={{ height: '20px', width: '32px', padding: '4px' }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {WEIGHT_LABEL[criterion.weight] ?? 'MED'}
          </button>

          {menuOpen && (
            <WeightMenu
              weight={criterion.weight}
              direction={direction}
              onSelect={(w) => { onWeightChange(w); setMenuOpen(false) }}
              onRemove={() => { onRemove(); setMenuOpen(false) }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      <p className="text-[10px] font-normal text-accent w-full truncate">
        {criterion.description}
      </p>
    </div>
  )
}
