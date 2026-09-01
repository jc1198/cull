// Console button styles. Metrics are fixed by the design system:
// 13px Kantumruy Pro Regular, 8px padding, 8px radius.
//
// Primary hugs its content by default; pass `minWidth` where the label changes
// under the user — the set-taste primary swaps between three labels and the row
// must not shift, but a longer label must still be allowed to grow.

const BASE = 'text-[13px] font-normal leading-[15px] transition-colors rounded-lg'

export function PrimaryButton({ children, minWidth, className = '', ...props }) {
  return (
    <button
      type="button"
      className={[BASE, 'bg-primary text-canvas hover:opacity-90 active:opacity-80',
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:opacity-40',
                  className].join(' ')}
      style={{ padding: '8px', minWidth: minWidth ? `${minWidth}px` : undefined }}
      {...props}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={[BASE, 'border border-border text-primary bg-transparent hover:bg-white/10',
                  'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                  className].join(' ')}
      style={{ padding: '8px' }}
      {...props}
    >
      {children}
    </button>
  )
}

// White bottom border only — no fill, no side borders.
export function TextLink({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={['text-[13px] font-normal leading-[15px] text-primary border-b border-border',
                  'bg-transparent hover:opacity-70 transition-opacity', className].join(' ')}
      style={{ paddingTop: '8px', paddingBottom: '8px' }}
      {...props}
    >
      {children}
    </button>
  )
}
