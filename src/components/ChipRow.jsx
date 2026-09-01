// Two states, same shape and weight. Not distinguished by opacity — a dimmed
// chip reads as disabled rather than available.
//
//   Active    — accent outline and label, with an × to remove
//   Available — white outline and label, with a + to add

function PlusGlyph({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="block shrink-0">
      <path d="M8 3.5v9M3.5 8h9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CloseGlyph({ color }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="block shrink-0">
      <path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function ChipRow({ chips, activeChips = [], onToggle }) {
  return (
    <div className="flex flex-wrap items-start" style={{ gap: '16px' }}>
      {chips.map((chip) => {
        const active = activeChips.includes(chip)
        return (
          <button
            key={chip}
            type="button"
            onClick={() => onToggle(chip)}
            className={[
              'flex items-center justify-center bg-canvas border transition-colors',
              active
                ? 'border-accent text-accent hover:bg-accent/10'
                : 'border-border text-primary hover:bg-white/10',
            ].join(' ')}
            style={{ borderRadius: '16px', padding: '8px', gap: '4px' }}
          >
            <span className="text-[13px] font-normal whitespace-nowrap leading-[16px]">{chip}</span>
            {active
              ? <CloseGlyph color="#BAA9FF" />
              : <PlusGlyph color="#FFFFFF" />}
          </button>
        )
      })}
    </div>
  )
}
